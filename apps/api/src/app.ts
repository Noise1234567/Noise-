import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { globalRateLimit } from './middlewares/rate-limit.js';
import type { PrismaClient } from './lib/prisma.js';
import { createAuthRouter, createMeRouter } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';

export interface AppDependencies {
  /** Vérifie que la base répond (lève une erreur sinon). Absent : /health/ready répond 503. */
  checkDatabase?: () => Promise<void>;
  /** Accès à la base : sans lui, les routes métier ne sont pas montées. */
  prisma?: PrismaClient;
}

/**
 * Construit l'application Express sans la démarrer : les tests l'utilisent
 * directement avec supertest, server.ts la démarre.
 *
 * Les modules métier (src/modules/<domaine>) sont montés sous /api/v1.
 */
export function createApp(env: Env, logger: Logger, deps: AppDependencies = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // derrière le proxy Railway : IP client correcte pour le rate limiting
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS }));
  app.use(globalRateLimit());
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger, genReqId: () => randomUUID() }));

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
    const auth = new AuthService(deps.prisma, env.JWT_ACCESS_SECRET);
    app.use('/api/v1/auth', createAuthRouter(auth, env.JWT_ACCESS_SECRET));
    app.use('/api/v1/me', createMeRouter(auth, env.JWT_ACCESS_SECRET));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
