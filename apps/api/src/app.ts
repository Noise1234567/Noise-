import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { globalRateLimit } from './middlewares/rate-limit.js';

/**
 * Construit l'application Express sans la démarrer : les tests l'utilisent
 * directement avec supertest, server.ts la démarre.
 *
 * Les modules métier (src/modules/<domaine>) seront montés ici sous /api/v1
 * au fil des tâches NOISE-007 et suivantes.
 */
export function createApp(env: Env, logger: Logger) {
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
