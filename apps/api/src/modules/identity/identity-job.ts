import type { Logger } from 'pino';
import { IDENTITY_JOB_INTERVAL_MS, type IdentityMaintenance } from './identity-maintenance.js';

/** Lance la maintenance des pièces d'identité toutes les heures. Renvoie la fonction d'arrêt. */
export function startIdentityJob(
  maintenance: Pick<IdentityMaintenance, 'enforceDeadlines' | 'purgeDueDocuments'>,
  logger: Logger,
  intervalMs = IDENTITY_JOB_INTERVAL_MS,
): () => void {
  const run = async () => {
    try {
      const pulled = await maintenance.enforceDeadlines();
      if (pulled > 0)
        logger.info({ pulled }, 'Événements retirés : pièce d’identité non régularisée');
      const { purged, failed } = await maintenance.purgeDueDocuments();
      if (purged > 0) logger.info({ purged }, 'Pièces d’identité supprimées du stockage');
      if (failed > 0) logger.error({ failed }, 'Suppression de pièces d’identité en échec');
    } catch (error) {
      logger.error({ err: error }, 'Échec de la maintenance des pièces d’identité');
    }
  };
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
