import type { Logger } from 'pino';
import type { OrdersService } from './orders.service.js';

/** Fréquence du job : toutes les minutes (NOISE-018). */
export const ORDER_EXPIRY_INTERVAL_MS = 60_000;

/**
 * Expire périodiquement les commandes en attente. Plusieurs instances de l'API peuvent le
 * lancer en même temps sans risque : la mise à jour est conditionnelle. Renvoie la fonction
 * qui l'arrête.
 */
export function startOrderExpiryJob(
  service: Pick<OrdersService, 'expirePending'>,
  logger: Logger,
  intervalMs = ORDER_EXPIRY_INTERVAL_MS,
): () => void {
  const timer = setInterval(() => {
    service
      .expirePending()
      .then((count) => {
        if (count > 0) logger.info({ count }, 'Commandes expirées');
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, 'Échec de l’expiration des commandes');
      });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
