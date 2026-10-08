import { splitSale } from '@noise/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { createAccessToken } from '../src/modules/auth/tokens.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/** Export des ventes (NOISE-039) de bout en bout : HTTP → API → registre en base. */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET });
const app = createApp(env, createLogger('silent'), { prisma });

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

const bearer = async (roles: ('ADMIN' | 'ORGANIZER' | 'PARTICIPANT')[]) =>
  `Bearer ${await createAccessToken({ userId: '00000000-0000-0000-0000-000000000001', roles }, SECRET)}`;

/** Événement avec deux types de billets et des commandes de tous statuts. */
async function eventWithSales() {
  const organizer = await factories.user(prisma, ['ORGANIZER']);
  const participant = await factories.user(prisma);
  const event = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Afro Night Cadjehoun',
      description: 'Test',
      genre: 'Afrobeats',
      venue: 'Club',
      city: 'Cotonou',
      startsAt: new Date('2026-11-01T21:00:00Z'),
      endsAt: new Date('2026-11-02T03:00:00Z'),
    },
  });
  const vip = await prisma.ticketType.create({
    data: { eventId: event.id, name: 'VIP', priceXof: 10_000, quantityTotal: 20 },
  });
  const standard = await prisma.ticketType.create({
    data: { eventId: event.id, name: 'Standard', priceXof: 5_000, quantityTotal: 100 },
  });

  const order = (
    ticketTypeId: string,
    unitPriceXof: number,
    quantity: number,
    status: 'PAID' | 'PENDING' | 'CANCELLED',
    withAffiliate = false,
  ) => {
    const split = splitSale(unitPriceXof * quantity, { withAffiliate });
    return prisma.order.create({
      data: {
        participantId: participant.id,
        ticketTypeId,
        quantity,
        unitPriceXof,
        totalXof: split.totalXof,
        status,
        expiresAt: new Date(),
        ...(status === 'PAID'
          ? {
              paidAt: new Date(),
              noiseShareXof: split.noiseXof,
              affiliateShareXof: split.affiliateXof,
              organizerShareXof: split.organizerXof,
            }
          : {}),
      },
    });
  };

  await order(vip.id, 10_000, 2, 'PAID');
  await order(standard.id, 5_000, 3, 'PAID', true);
  await order(standard.id, 5_000, 5, 'PENDING'); // pas encore payée : exclue
  await order(vip.id, 10_000, 1, 'CANCELLED'); // annulée : exclue
  return { event, standard, participant };
}

describe('GET /api/v1/admin/events/:eventId/sales', () => {
  it('ne compte que les commandes payées, avec la répartition enregistrée', async () => {
    const { event } = await eventWithSales();
    const res = await request(app)
      .get(`/api/v1/admin/events/${event.id}/sales`)
      .set('Authorization', await bearer(['ADMIN']));

    expect(res.status).toBe(200);
    expect(res.body.lines).toEqual([
      { ticketTypeName: 'Standard', unitPriceXof: 5_000, ticketsSold: 3, grossXof: 15_000 },
      { ticketTypeName: 'VIP', unitPriceXof: 10_000, ticketsSold: 2, grossXof: 20_000 },
    ]);
    expect(res.body.totals).toEqual({
      ticketsSold: 5,
      grossXof: 35_000,
      noiseXof: 3_500,
      affiliateXof: 150,
      organizerXof: 31_350,
    });
  });

  it('refuse l’export si une commande payée n’a pas de répartition (409)', async () => {
    const { event, standard, participant } = await eventWithSales();
    await prisma.order.create({
      data: {
        participantId: participant.id,
        ticketTypeId: standard.id,
        quantity: 1,
        unitPriceXof: 5_000,
        totalXof: 5_000,
        status: 'PAID',
        expiresAt: new Date(),
      },
    });
    const res = await request(app)
      .get(`/api/v1/admin/events/${event.id}/sales`)
      .set('Authorization', await bearer(['ADMIN']));
    expect(res.status).toBe(409);
  });

  it.each([
    ['sans jeton', undefined, 401],
    ['organisateur', ['ORGANIZER'] as const, 403],
    ['participant', ['PARTICIPANT'] as const, 403],
  ])('réservé aux administrateurs : %s → %i', async (_label, roles, status) => {
    const { event } = await eventWithSales();
    const req = request(app).get(`/api/v1/admin/events/${event.id}/sales`);
    const res = await (roles ? req.set('Authorization', await bearer([...roles])) : req);
    expect(res.status).toBe(status);
  });

  it('404 pour un événement inconnu, 400 pour un identifiant invalide', async () => {
    const admin = await bearer(['ADMIN']);
    const unknown = await request(app)
      .get('/api/v1/admin/events/00000000-0000-0000-0000-000000000000/sales')
      .set('Authorization', admin);
    expect(unknown.status).toBe(404);
    const invalid = await request(app)
      .get('/api/v1/admin/events/pas-un-uuid/sales')
      .set('Authorization', admin);
    expect(invalid.status).toBe(400);
  });
});

describe('GET /api/v1/admin/events/:eventId/sales.csv', () => {
  it('télécharge le CSV pour Excel avec un nom de fichier lisible', async () => {
    const { event } = await eventWithSales();
    const res = await request(app)
      .get(`/api/v1/admin/events/${event.id}/sales.csv`)
      .set('Authorization', await bearer(['ADMIN']))
      .buffer(true)
      .parse((response, done) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (body += chunk));
        response.on('end', () => done(null, body));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="ventes-afro-night-cadjehoun-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    const csv = res.body as string;
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Net à reverser à l’organisateur;;;31350');
  });
});
