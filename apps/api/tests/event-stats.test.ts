import { splitSale, type EventStatsDto, type UserRole } from '@noise/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { createAccessToken } from '../src/modules/auth/tokens.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/** Statistiques d'un événement pour son organisateur (NOISE-027). Base noise_test. */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET });
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createApp(env, createLogger('silent'), { prisma });
});
afterAll(() => prisma.$disconnect());

const DAY = 86_400_000;
const bearer = async (user: { id: string; roles: UserRole[] }) =>
  `Bearer ${await createAccessToken({ userId: user.id, roles: user.roles }, SECRET)}`;
const stats = (auth: string | null, id: string) => {
  const req = request(app).get(`/api/v1/events/${id}/stats`);
  return auth ? req.set('Authorization', auth) : req;
};

async function createEvent(organizerId: string) {
  return prisma.event.create({
    data: {
      organizerId,
      title: 'Afro Night',
      description: 'Test',
      styles: ['Afrobeat'],
      venue: 'Club',
      city: 'Cotonou',
      capacity: 100,
      status: 'PUBLISHED',
      startsAt: new Date(Date.now() + DAY),
      endsAt: new Date(Date.now() + 2 * DAY),
    },
  });
}

async function paidOrder(
  participantId: string,
  ticketTypeId: string,
  quantity: number,
  price: number,
) {
  const total = quantity * price;
  const split = splitSale(total, { withAffiliate: false });
  return prisma.order.create({
    data: {
      participantId,
      ticketTypeId,
      quantity,
      unitPriceXof: price,
      totalXof: total,
      status: 'PAID',
      paidAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60_000),
      noiseShareXof: split.noiseXof,
      affiliateShareXof: split.affiliateXof,
      organizerShareXof: split.organizerXof,
    },
  });
}

async function createTicket(
  orderId: string,
  ticketTypeId: string,
  eventId: string,
  values: { status?: 'VALID' | 'USED' | 'CANCELLED'; usedAt?: Date } = {},
) {
  return prisma.ticket.create({
    data: {
      orderId,
      ticketTypeId,
      eventId,
      holderName: 'Titulaire',
      qrTokenHash: crypto.randomUUID().replace(/-/g, '').padEnd(64, '0'),
      ...values,
    },
  });
}

/**
 * 3 × 5 000 (Standard) et 1 × 10 000 (VIP) payés : 25 000 de ventes, 4 billets. Deux billets
 * Standard sont entrés (21 h 10 et 23 h 40 UTC), il y a eu un scan refusé et un billet déjà utilisé.
 */
async function scenario() {
  const organizer = await factories.user(prisma, ['ORGANIZER']);
  const event = await createEvent(organizer.id);
  const standard = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: 'Standard',
      priceXof: 5000,
      quantityTotal: 50,
      quantitySold: 3,
    },
  });
  const vip = await prisma.ticketType.create({
    data: { eventId: event.id, name: 'VIP', priceXof: 10_000, quantityTotal: 10, quantitySold: 1 },
  });
  const buyerA = await factories.user(prisma);
  const buyerB = await factories.user(prisma);
  const orderA = await paidOrder(buyerA.id, standard.id, 3, 5000);
  const orderB = await paidOrder(buyerB.id, vip.id, 1, 10_000);
  const entered1 = await createTicket(orderA.id, standard.id, event.id, {
    status: 'USED',
    usedAt: new Date('2026-10-25T21:10:00.000Z'),
  });
  await createTicket(orderA.id, standard.id, event.id, {
    status: 'USED',
    usedAt: new Date('2026-10-25T23:40:00.000Z'),
  });
  await createTicket(orderA.id, standard.id, event.id);
  await createTicket(orderB.id, vip.id, event.id);

  const link = await prisma.scannerLink.create({
    data: {
      eventId: event.id,
      createdById: organizer.id,
      jti: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + DAY),
    },
  });
  for (const result of ['ACCEPTED', 'ACCEPTED', 'ALREADY_USED', 'INVALID'] as const) {
    await prisma.scanLog.create({
      data: {
        scannerLinkId: link.id,
        result,
        ticketId: result === 'INVALID' ? null : entered1.id,
      },
    });
  }
  return { organizer, event, standard, vip, auth: await bearer(organizer) };
}

describe('GET /api/v1/events/:id/stats', () => {
  it('renvoie les ventes, les entrées et la courbe d’arrivée', async () => {
    const { event, auth } = await scenario();
    const res = await stats(auth, event.id);

    expect(res.status).toBe(200);
    const body = res.body.stats as EventStatsDto;
    expect(body.eventId).toBe(event.id);
    expect(body.status).toBe('PUBLISHED');
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(body.sales).toEqual({
      ticketsSold: 4,
      grossXof: 25_000,
      organizerNetXof: 22_500,
      noiseFeeXof: 2500,
    });
    expect(body.byType).toEqual([
      expect.objectContaining({
        name: 'Standard',
        priceXof: 5000,
        sold: 3,
        grossXof: 15_000,
        remaining: 47,
      }),
      expect.objectContaining({ name: 'VIP', sold: 1, grossXof: 10_000, remaining: 9 }),
    ]);
    expect(body.entries).toEqual({
      checkedIn: 2,
      notYetEntered: 2,
      cancelled: 0,
      lastEntryAt: '2026-10-25T23:40:00.000Z',
      refusedScans: 2,
      alreadyUsedScans: 1,
      arrivals: [
        { hourStart: '2026-10-25T21:00:00.000Z', count: 1 },
        { hourStart: '2026-10-25T22:00:00.000Z', count: 0 },
        { hourStart: '2026-10-25T23:00:00.000Z', count: 1 },
      ],
    });
  });

  it('ne compte que les commandes payées (ni en attente, ni expirées, ni échouées)', async () => {
    const { event, standard, auth } = await scenario();
    const buyer = await factories.user(prisma);
    for (const status of ['PENDING', 'EXPIRED', 'FAILED'] as const) {
      await prisma.order.create({
        data: {
          participantId: buyer.id,
          ticketTypeId: standard.id,
          quantity: 2,
          unitPriceXof: 5000,
          totalXof: 10_000,
          status,
          expiresAt: new Date(Date.now() + 15 * 60_000),
        },
      });
    }
    const res = await stats(auth, event.id);
    expect(res.body.stats.sales).toMatchObject({ ticketsSold: 4, grossXof: 25_000 });
  });

  it('événement sans vente : tout à zéro, courbe vide', async () => {
    const organizer = await factories.user(prisma, ['ORGANIZER']);
    const event = await createEvent(organizer.id);
    await prisma.ticketType.create({
      data: { eventId: event.id, name: 'Standard', priceXof: 5000, quantityTotal: 30 },
    });
    const res = await stats(await bearer(organizer), event.id);

    expect(res.status).toBe(200);
    expect(res.body.stats.sales).toEqual({
      ticketsSold: 0,
      grossXof: 0,
      organizerNetXof: 0,
      noiseFeeXof: 0,
    });
    expect(res.body.stats.byType).toEqual([expect.objectContaining({ sold: 0, remaining: 30 })]);
    expect(res.body.stats.entries).toEqual({
      checkedIn: 0,
      notYetEntered: 0,
      cancelled: 0,
      lastEntryAt: null,
      refusedScans: 0,
      alreadyUsedScans: 0,
      arrivals: [],
    });
  });

  it('événement annulé : le statut est renvoyé, les ventes remboursées ne comptent plus', async () => {
    const { event, auth } = await scenario();
    await prisma.event.update({
      where: { id: event.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await prisma.order.updateMany({ data: { status: 'CANCELLED' } });
    // Les billets déjà entrés restent USED (contrainte tickets_used_has_time) : seuls les valides sont annulés.
    await prisma.ticket.updateMany({ where: { status: 'VALID' }, data: { status: 'CANCELLED' } });

    const res = await stats(auth, event.id);
    expect(res.status).toBe(200);
    expect(res.body.stats.status).toBe('CANCELLED');
    expect(res.body.stats.sales.ticketsSold).toBe(0);
    expect(res.body.stats.entries).toMatchObject({ checkedIn: 2, notYetEntered: 0, cancelled: 2 });
  });

  it('refuse sans jeton (401), pour un participant (403) et pour un autre organisateur (403)', async () => {
    const { event } = await scenario();
    expect((await stats(null, event.id)).status).toBe(401);

    const participant = await factories.user(prisma, ['PARTICIPANT']);
    expect((await stats(await bearer(participant), event.id)).status).toBe(403);

    const other = await factories.user(prisma, ['ORGANIZER']);
    const res = await stats(await bearer(other), event.id);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('404 pour un événement inconnu, 400 pour un identifiant invalide', async () => {
    const organizer = await factories.user(prisma, ['ORGANIZER']);
    const auth = await bearer(organizer);
    expect((await stats(auth, crypto.randomUUID())).status).toBe(404);
    expect((await stats(auth, 'pas-un-uuid')).status).toBe(400);
  });

  it('ne mélange pas les scans et les billets de deux événements', async () => {
    const { organizer, event, auth } = await scenario();
    const second = await createEvent(organizer.id);
    const res = await stats(auth, second.id);
    expect(res.body.stats.entries).toMatchObject({
      checkedIn: 0,
      refusedScans: 0,
      arrivals: [],
    });
    const first = await stats(auth, event.id);
    expect(first.body.stats.entries.checkedIn).toBe(2);
  });
});
