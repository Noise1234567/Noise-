import { createPrismaClient, type PrismaClient } from '../../src/lib/prisma.js';

/**
 * Accès à la base de test (CLAUDE.md section 8 : noise_test, jamais noise_dev).
 * URL : TEST_DATABASE_URL (apps/api/.env en local), sinon DATABASE_URL (CI).
 * Le schéma doit être à jour : pnpm --filter @noise/api db:test:prepare.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

export function createTestPrisma(): PrismaClient {
  if (!/\/noise_test(\?|$)/.test(TEST_DATABASE_URL)) {
    throw new Error('Tests de base refusés : TEST_DATABASE_URL doit pointer vers noise_test.');
  }
  return createPrismaClient(TEST_DATABASE_URL);
}

const TABLES = [
  'scan_logs',
  'scanner_links',
  'tickets',
  'payments',
  'orders',
  'ticket_types',
  'events',
  'push_tokens',
  'refresh_tokens',
  'users',
];

/** Vide toutes les tables entre deux tests. */
export async function resetDatabase(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`,
  );
}

let phoneCounter = 0;

/** Petites fabriques : des données valides, à modifier test par test. */
export const factories = {
  user: (prisma: PrismaClient, roles: ('PARTICIPANT' | 'ORGANIZER')[] = ['PARTICIPANT']) =>
    prisma.user.create({
      data: {
        name: 'Utilisateur Test',
        phone: `+22901${String(++phoneCounter).padStart(8, '0')}`,
        passwordHash: 'hash-de-test',
        roles,
      },
    }),

  event: (prisma: PrismaClient, organizerId: string) =>
    prisma.event.create({
      data: {
        organizerId,
        title: 'Soirée test',
        description: 'Test',
        genre: 'Afrobeats',
        venue: 'Club',
        city: 'Cotonou',
        startsAt: new Date('2026-11-01T21:00:00Z'),
        endsAt: new Date('2026-11-02T03:00:00Z'),
      },
    }),

  ticketType: (prisma: PrismaClient, eventId: string, quantityTotal = 10) =>
    prisma.ticketType.create({
      data: { eventId, name: `Standard ${++phoneCounter}`, priceXof: 5000, quantityTotal },
    }),

  order: (prisma: PrismaClient, participantId: string, ticketTypeId: string, quantity = 2) =>
    prisma.order.create({
      data: {
        participantId,
        ticketTypeId,
        quantity,
        unitPriceXof: 5000,
        totalXof: 5000 * quantity,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    }),
};
