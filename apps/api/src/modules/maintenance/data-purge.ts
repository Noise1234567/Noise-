import type { PrismaClient } from '../../lib/prisma.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Jetons de rafraîchissement gardés encore 7 jours après leur expiration : un jeton révoqué
 * rejoué pendant ce délai est toujours reconnu comme une réutilisation (toutes les sessions
 * de l'utilisateur sont fermées) au lieu d'un simple jeton inconnu.
 */
export const REFRESH_TOKEN_RETENTION_DAYS = 7;

/**
 * Purge des données expirées (NOISE-069) : clés d'idempotence (NOISE-053) et jetons de
 * rafraîchissement périmés. Deux suppressions conditionnelles : sans risque si plusieurs
 * instances la lancent en même temps.
 */
export class DataPurge {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async purgeExpired(): Promise<{ idempotencyKeys: number; refreshTokens: number }> {
    const now = this.now();
    const keys = await this.prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: now } } });
    const tokens = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date(now.getTime() - REFRESH_TOKEN_RETENTION_DAYS * DAY_MS) },
      },
    });
    return { idempotencyKeys: keys.count, refreshTokens: tokens.count };
  }
}
