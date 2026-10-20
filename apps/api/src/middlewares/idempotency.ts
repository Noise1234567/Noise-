import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Prisma } from '../generated/prisma/client.js';
import { HttpError } from '../lib/http-error.js';
import type { PrismaClient } from '../lib/prisma.js';

/**
 * En-tête Idempotency-Key (NOISE-053, docs/api.md section 1). En 3G, une réponse peut se perdre
 * alors que le serveur a bien créé la commande : le mobile renvoie la même requête avec la
 * même clé et reçoit la réponse déjà donnée, au lieu d'une seconde commande.
 *
 * - Sans en-tête : rien ne change.
 * - Même clé, même corps, réponse connue : réponse rejouée (en-tête Idempotent-Replayed).
 * - Même clé, autre corps ou autre route : 409.
 * - Même clé pendant que la première requête est en cours : 409, à réessayer.
 * - Erreur serveur (5xx) ou connexion coupée avant la fin : rien n'est gardé, un nouvel essai
 *   est traité normalement.
 * Les clés sont propres à chaque compte et gardées 24 heures.
 *
 * À placer après requireAuth et la validation du corps, juste avant le contrôleur.
 */

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const KEY_FORMAT = /^[A-Za-z0-9_-]{8,128}$/;

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

export function createIdempotency(prisma: PrismaClient, now: () => Date = () => new Date()) {
  return (scope: string): RequestHandler =>
    async (req, res, next) => {
      const key = req.header('Idempotency-Key');
      if (key === undefined) {
        next();
        return;
      }
      if (!KEY_FORMAT.test(key)) {
        next(
          new HttpError(
            400,
            'VALIDATION_ERROR',
            'Idempotency-Key invalide (8 à 128 caractères : lettres, chiffres, - et _)',
          ),
        );
        return;
      }
      if (!req.auth) throw new Error('requireAuth manquant avant idempotency');
      const userId = req.auth.userId;
      const requestHash = createHash('sha256')
        .update(JSON.stringify(req.body ?? null))
        .digest('hex');

      const claim = () =>
        prisma.idempotencyKey.create({
          data: {
            userId,
            key,
            scope,
            requestHash,
            expiresAt: new Date(now().getTime() + IDEMPOTENCY_TTL_MS),
          },
        });

      let claimed;
      try {
        claimed = await claim();
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const existing = await prisma.idempotencyKey.findUnique({
          where: { userId_key: { userId, key } },
        });
        if (existing && existing.expiresAt <= now()) {
          // Clé expirée : elle peut resservir comme une nouvelle.
          await prisma.idempotencyKey.deleteMany({ where: { id: existing.id } });
          claimed = await claim();
        } else if (!existing) {
          throw error;
        } else if (existing.scope !== scope || existing.requestHash !== requestHash) {
          next(new HttpError(409, 'CONFLICT', 'Cette clé a déjà servi pour une autre requête'));
          return;
        } else if (existing.responseStatus === null) {
          next(
            new HttpError(
              409,
              'CONFLICT',
              'La même requête est en cours de traitement. Réessayez dans un instant.',
            ),
          );
          return;
        } else {
          res.set('Idempotent-Replayed', 'true');
          res.status(existing.responseStatus).json(existing.responseBody);
          return;
        }
      }

      // La réponse (y compris une erreur 4xx du contrôleur) est enregistrée AVANT d'être
      // envoyée : un nouvel essai immédiat, ou après une connexion coupée pendant l'envoi,
      // trouve déjà la réponse. Une erreur serveur (5xx) libère la clé.
      const id = claimed.id;
      const json = res.json.bind(res);
      let answered = false;
      res.json = (payload: unknown) => {
        answered = true;
        const save =
          res.statusCode < 500
            ? prisma.idempotencyKey.update({
                where: { id },
                data: {
                  responseStatus: res.statusCode,
                  responseBody: payload as Prisma.InputJsonValue,
                },
              })
            : prisma.idempotencyKey.deleteMany({ where: { id } });
        void save
          .catch((error: unknown) =>
            req.log?.warn({ err: error }, 'Clé d’idempotence non enregistrée'),
          )
          .finally(() => json(payload));
        return res;
      };
      // Aucune réponse JSON (connexion fermée avant) : la clé est libérée.
      res.once('close', () => {
        if (!answered)
          void prisma.idempotencyKey.deleteMany({ where: { id } }).catch(() => undefined);
      });
      next();
    };
}

export type Idempotency = ReturnType<typeof createIdempotency>;
