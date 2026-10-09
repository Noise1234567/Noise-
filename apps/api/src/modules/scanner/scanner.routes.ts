import {
  createScannerLinkSchema,
  eventIdParamSchema,
  scannerLinkIdParamSchema,
  type CreateScannerLinkInput,
} from '@noise/shared';
import { Router, type Request } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validateBody, validateParams } from '../../middlewares/validate.js';
import type { ScannerLinksService } from './scanner-links.service.js';

/**
 * Liens scanner de l'organisateur (docs/api.md, NOISE-024). Monté sur /api/v1 car les chemins
 * mélangent /scanner/links et /events/:id/scanner-links. Réservé au rôle ORGANIZER, puis à
 * l'organisateur propriétaire de l'événement (vérifié par le service).
 */
export function createScannerLinksRouter(
  service: ScannerLinksService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const organizer = [requireAuth(accessTokenSecret), requireRole('ORGANIZER')];
  const userId = (req: Request) => {
    if (!req.auth) throw new Error('requireAuth manquant sur la route');
    return req.auth.userId;
  };

  router.post(
    '/scanner/links',
    ...organizer,
    validateBody(createScannerLinkSchema),
    async (req, res) => {
      res.status(201).json(await service.create(userId(req), req.body as CreateScannerLinkInput));
    },
  );
  router.get(
    '/events/:id/scanner-links',
    ...organizer,
    validateParams(eventIdParamSchema),
    async (req, res) => {
      const { id } = res.locals.params as { id: string };
      res.json({ links: await service.list(userId(req), id) });
    },
  );
  router.delete(
    '/scanner/links/:id',
    ...organizer,
    validateParams(scannerLinkIdParamSchema),
    async (req, res) => {
      const { id } = res.locals.params as { id: string };
      res.json({ link: await service.revoke(userId(req), id) });
    },
  );

  return router;
}
