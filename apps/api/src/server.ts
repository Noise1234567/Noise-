import { loadEnv } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { createPrismaClient } from './lib/prisma.js';
import { createApp } from './app.js';
import { startOrderExpiryJob } from './modules/orders/expiry-job.js';
import { OrdersService } from './modules/orders/orders.service.js';

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
const prisma = env.DATABASE_URL ? createPrismaClient(env.DATABASE_URL) : null;
if (!prisma) logger.warn('DATABASE_URL absente : /health/ready répondra 503');
const app = createApp(env, logger, {
  prisma: prisma ?? undefined,
  checkDatabase: prisma
    ? async () => {
        await prisma.$queryRaw`SELECT 1`;
      }
    : undefined,
});

// Expiration des commandes en attente, toutes les minutes (NOISE-018).
const stopOrderExpiryJob = prisma
  ? startOrderExpiryJob(new OrdersService(prisma), logger)
  : () => undefined;

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API Noise démarrée');
});

function shutdown(signal: string) {
  logger.info({ signal }, 'Arrêt en cours');
  stopOrderExpiryJob();
  server.close(() => {
    void (prisma?.$disconnect() ?? Promise.resolve()).finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
