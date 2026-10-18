import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { createIdempotency } from './middlewares/idempotency.js';
import { globalRateLimit } from './middlewares/rate-limit.js';
import type { PrismaClient } from './lib/prisma.js';
import { createAdminRouter } from './modules/admin/admin.routes.js';
import { createAuthRouter, createMeRouter } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import { createPaymentProvider, type PaymentProvider } from './modules/payments/providers/index.js';
import {
  createOrderStatusRouter,
  createPaymentWebhookRouter,
  createPaymentsRouter,
} from './modules/payments/payments.routes.js';
import { PaymentsService } from './modules/payments/payments.service.js';
import { createOrdersRouter } from './modules/orders/orders.routes.js';
import { OrdersService } from './modules/orders/orders.service.js';
import { createTicketIssuer, type TicketIssuer } from './modules/tickets/ticket-issuer.js';
import { createTicketsRouter } from './modules/tickets/tickets.routes.js';
import { TicketsService } from './modules/tickets/tickets.service.js';
import { ScannerLinksService } from './modules/scanner/scanner-links.service.js';
import { createScannerLinksRouter } from './modules/scanner/scanner.routes.js';
import { createEventsRouter } from './modules/events/events.routes.js';
import {
  CloudinaryImageStorage,
  FakeImageStorage,
  type ImageStorage,
} from './modules/uploads/image-storage.js';
import { createIdentityRouter } from './modules/identity/identity.routes.js';
import { IdentityMaintenance } from './modules/identity/identity-maintenance.js';
import { IdentityService } from './modules/identity/identity.service.js';
import {
  createIdentityStorage,
  type IdentityDocumentStorage,
} from './modules/uploads/identity-storage.js';
import { EventsService } from './modules/events/events.service.js';

export interface AppDependencies {
  /** Stockage des affiches ; par défaut Cloudinary si CLOUDINARY_URL est défini, sinon simulé. */
  imageStorage?: ImageStorage;
  /** Stockage privé des pièces d'identité ; par défaut Cloudinary si CLOUDINARY_URL est défini, sinon simulé. */
  identityStorage?: IdentityDocumentStorage;
  /** Vérifie que la base répond (lève une erreur sinon). Absent : /health/ready répond 503. */
  checkDatabase?: () => Promise<void>;
  /** Accès à la base : sans lui, les routes métier ne sont pas montées. */
  prisma?: PrismaClient;
  /** Fournisseur de paiement ; par défaut celui de PAYMENT_PROVIDER (FakeProvider en local). */
  paymentProvider?: PaymentProvider;
  /** Création des billets à la confirmation du paiement (NOISE-020). */
  issueTickets?: TicketIssuer;
  /** Dossier du build du scanner web (tests). Par défaut : apps/scanner/dist. */
  scannerDir?: string;
}

/** Build du scanner web (apps/scanner/dist), au même niveau depuis src/ et dist/. */
const DEFAULT_SCANNER_DIR = fileURLToPath(new URL('../../scanner/dist', import.meta.url));

/** Cloudinary si configuré ; sinon stockage simulé (développement local, tests). */
function defaultImageStorage(env: Env, logger: Logger): ImageStorage {
  if (env.CLOUDINARY_URL) return new CloudinaryImageStorage(env.CLOUDINARY_URL);
  if (env.NODE_ENV !== 'test') {
    logger.warn('CLOUDINARY_URL absente : affiches simulées, non stockées');
  }
  return new FakeImageStorage();
}

/**
 * Construit l'application Express sans la démarrer : les tests l'utilisent
 * directement avec supertest, server.ts la démarre.
 *
 * Les modules métier (src/modules/<domaine>) sont montés sous /api/v1.
 */
export function createApp(env: Env, logger: Logger, deps: AppDependencies = {}) {
  const app = express();
  const scannerDir = deps.scannerDir ?? DEFAULT_SCANNER_DIR;

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // derrière le proxy Railway : IP client correcte pour le rate limiting
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS }));
  app.use(globalRateLimit());
  app.use(pinoHttp({ logger, genReqId: () => randomUUID() }));

  // Création des billets et de leurs QR (NOISE-020), partagée par le paiement et les billets
  // gratuits. Sans QR_SIGNING_SECRET (tests seulement), aucun billet n'est créé.
  const issueTickets =
    deps.issueTickets ??
    (env.QR_SIGNING_SECRET ? createTicketIssuer(env.QR_SIGNING_SECRET) : undefined);
  const payments =
    deps.prisma &&
    new PaymentsService(
      deps.prisma,
      deps.paymentProvider ?? createPaymentProvider(env),
      logger,
      issueTickets,
    );
  // Avant express.json() : le webhook a besoin du corps brut pour vérifier la signature.
  if (payments) app.use('/api/v1/payments/webhook', createPaymentWebhookRouter(payments));

  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV });
  });

  // Prêt à servir : la base répond. Utilisé par Railway et UptimeRobot (NOISE-016, NOISE-030).
  app.get('/health/ready', async (req, res) => {
    try {
      if (!deps.checkDatabase) throw new Error('Base non configurée');
      await deps.checkDatabase();
      res.json({ status: 'ready', checks: { database: 'up' } });
    } catch (error) {
      req.log.warn({ err: error }, 'Base de données injoignable');
      res.status(503).json({ status: 'unavailable', checks: { database: 'down' } });
    }
  });

  if (deps.prisma && env.JWT_ACCESS_SECRET) {
    // Idempotency-Key sur la création de commande et le paiement (NOISE-053).
    const idempotent = createIdempotency(deps.prisma);
    const auth = new AuthService(deps.prisma, env.JWT_ACCESS_SECRET);
    app.use('/api/v1/auth', createAuthRouter(auth, env.JWT_ACCESS_SECRET));
    const identityStorage = deps.identityStorage ?? createIdentityStorage(env.CLOUDINARY_URL);
    // Avant /me : « /me/identity » ne doit pas être intercepté par le routeur du profil.
    app.use(
      '/api/v1/me/identity',
      createIdentityRouter(
        new IdentityService(deps.prisma, identityStorage),
        env.JWT_ACCESS_SECRET,
      ),
    );
    app.use('/api/v1/me', createMeRouter(auth, env.JWT_ACCESS_SECRET));
    app.use(
      '/api/v1/admin',
      createAdminRouter(
        deps.prisma,
        env.JWT_ACCESS_SECRET,
        identityStorage,
        new IdentityMaintenance(deps.prisma, identityStorage),
      ),
    );
    if (payments) {
      app.use(
        '/api/v1/payments',
        createPaymentsRouter(payments, env.JWT_ACCESS_SECRET, idempotent),
      );
      app.use('/api/v1/orders', createOrderStatusRouter(payments, env.JWT_ACCESS_SECRET));
    }
    app.use(
      '/api/v1/events',
      createEventsRouter(
        new EventsService(deps.prisma),
        env.JWT_ACCESS_SECRET,
        deps.imageStorage ?? defaultImageStorage(env, logger),
      ),
    );
    app.use(
      '/api/v1/orders',
      createOrdersRouter(
        new OrdersService(deps.prisma, undefined, issueTickets),
        env.JWT_ACCESS_SECRET,
        idempotent,
      ),
    );
    // Sans QR_SIGNING_SECRET (tests seulement), la route des billets est absente.
    if (env.QR_SIGNING_SECRET) {
      app.use(
        '/api/v1/tickets',
        createTicketsRouter(
          new TicketsService(deps.prisma, env.QR_SIGNING_SECRET),
          env.JWT_ACCESS_SECRET,
        ),
      );
    }
    // Sans SCANNER_JWT_SECRET (tests seulement), les liens scanner ne sont pas montés.
    if (env.SCANNER_JWT_SECRET) {
      app.use(
        '/api/v1',
        createScannerLinksRouter(
          new ScannerLinksService(deps.prisma, env.SCANNER_JWT_SECRET, env.SCANNER_URL ?? null),
          env.JWT_ACCESS_SECRET,
        ),
      );
    }
  }

  // Scanner du staff (NOISE-026), servi s'il a été construit (pnpm --filter @noise/scanner build).
  // Le jeton du lien est après le « # » : il n'est jamais reçu ni journalisé par le serveur.
  if (existsSync(scannerDir)) {
    app.use('/scan', express.static(scannerDir, { index: 'index.html', fallthrough: true }));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
