import type { Logger } from 'pino';
import type { DataPurge } from './data-purge.js';

/** Une purge par jour (NOISE-069). */
export const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
/**
 * Premier passage peu après le démarrage : le staging redémarre à chaque déploiement, souvent
 * plus d'une fois par jour, et une purge attendue 24 h ne passerait jamais.
 */
export const PURGE_FIRST_RUN_MS = 5 * 60 * 1000;

/**
 * Lance la purge quotidienne. Minuteur distinct de l'expiration des commandes : une purge
 * lente ou en échec ne la retarde jamais. Renvoie la fonction d'arrêt.
 */
export function startPurgeJob(
  purge: Pick<DataPurge, 'purgeExpired'>,
  logger: Logger,
  intervalMs = PURGE_INTERVAL_MS,
  firstRunMs = PURGE_FIRST_RUN_MS,
): () => void {
  const run = async () => {
    try {
      const counts = await purge.purgeExpired();
      if (counts.idempotencyKeys > 0 || counts.refreshTokens > 0)
        logger.info(counts, 'Données expirées supprimées');
    } catch (error) {
      logger.error({ err: error }, 'Échec de la purge des données expirées');
    }
  };
  let interval: NodeJS.Timeout | undefined;
  const first = setTimeout(() => {
    void run();
    interval = setInterval(() => void run(), intervalMs);
    interval.unref();
  }, firstRunMs);
  first.unref();
  return () => {
    clearTimeout(first);
    clearInterval(interval);
  };
}
