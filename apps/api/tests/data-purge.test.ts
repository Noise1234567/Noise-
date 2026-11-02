import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DataPurge, REFRESH_TOKEN_RETENTION_DAYS } from '../src/modules/maintenance/data-purge.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/** Purge des données expirées (NOISE-069). Base noise_test. */

const prisma = createTestPrisma();
const NOW = new Date('2026-11-02T12:00:00Z');
const DAY = 86_400_000;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

let counter = 0;
const key = (userId: string, expiresAt: Date) =>
  prisma.idempotencyKey.create({
    data: {
      userId,
      key: `cle-${++counter}`,
      scope: 'orders.create',
      requestHash: 'a'.repeat(64),
      expiresAt,
    },
  });
const token = (userId: string, expiresAt: Date, revokedAt: Date | null = null) =>
  prisma.refreshToken.create({
    data: { userId, tokenHash: String(++counter).padStart(64, '0'), expiresAt, revokedAt },
  });

describe('DataPurge.purgeExpired', () => {
  it('ne supprime que les clés d’idempotence expirées', async () => {
    const user = await factories.user(prisma, ['PARTICIPANT']);
    const expired = await key(user.id, at(-1));
    const valid = await key(user.id, at(DAY));

    const counts = await new DataPurge(prisma, () => NOW).purgeExpired();

    expect(counts.idempotencyKeys).toBe(1);
    const left = await prisma.idempotencyKey.findMany({ select: { id: true } });
    expect(left).toEqual([{ id: valid.id }]);
    expect(left).not.toContainEqual({ id: expired.id });
  });

  it('jetons de rafraîchissement : supprimés seulement après le délai de conservation', async () => {
    const user = await factories.user(prisma, ['PARTICIPANT']);
    const retention = REFRESH_TOKEN_RETENTION_DAYS * DAY;
    const old = await token(user.id, at(-retention - 1), at(-retention - DAY));
    const recentlyExpired = await token(user.id, at(-DAY), at(-2 * DAY));
    const active = await token(user.id, at(30 * DAY));
    const revokedNotExpired = await token(user.id, at(30 * DAY), at(-DAY));

    const counts = await new DataPurge(prisma, () => NOW).purgeExpired();

    expect(counts.refreshTokens).toBe(1);
    const left = (await prisma.refreshToken.findMany({ select: { id: true } })).map((t) => t.id);
    expect(left.sort()).toEqual([recentlyExpired.id, active.id, revokedNotExpired.id].sort());
    expect(left).not.toContain(old.id);
  });

  it('deux purges simultanées : pas d’erreur, rien supprimé deux fois', async () => {
    const user = await factories.user(prisma, ['PARTICIPANT']);
    await key(user.id, at(-1));
    await key(user.id, at(-1));
    const purge = new DataPurge(prisma, () => NOW);

    const results = await Promise.all([purge.purgeExpired(), purge.purgeExpired()]);

    expect(results.reduce((sum, r) => sum + r.idempotencyKeys, 0)).toBe(2);
    expect(await prisma.idempotencyKey.count()).toBe(0);
  });
});
