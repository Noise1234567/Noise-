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

/** Build du scanner web (apps/scanner/dist), au même niveau depuis src/ et dist/. */
const DEFAULT_SCANNER_DIR = fileURLToPath(new URL('../../scanner/dist', import.meta.url));

/**
 * Construit l'application Express sans la démarrer : les tests l'utilisent
 * directement avec supertest, server.ts la démarre.
 *
 * Les modules métier (src/modules/<domaine>) seront montés ici sous /api/v1
 * au fil des tâches NOISE-007 et suivantes.
 */
export function createApp(env: Env, logger: Logger, options: { scannerDir?: string } = {}) {
  const app = express();
  const scannerDir = options.scannerDir ?? DEFAULT_SCANNER_DIR;

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // derrière le proxy Railway : IP client correcte pour le rate limiting
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS }));
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger, genReqId: () => randomUUID() }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV });
  });

  // Scanner du staff (NOISE-026), servi s'il a été construit (pnpm --filter @noise/scanner build).
  // Le jeton du lien est après le « # » : il n'est jamais reçu ni journalisé par le serveur.
  if (existsSync(scannerDir)) {
    app.use('/scan', express.static(scannerDir, { index: 'index.html', fallthrough: true }));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
