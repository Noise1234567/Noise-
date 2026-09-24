import { loadEnv } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { createApp } from './app.js';

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
const app = createApp(env, logger);

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API Noise démarrée');
});

function shutdown(signal: string) {
  logger.info({ signal }, 'Arrêt en cours');
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
