import type { UserRole } from '@noise/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { createAccessToken } from '../src/modules/auth/tokens.js';
import { OrdersService } from '../src/modules/orders/orders.service.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/** Commandes de bout en bout (NOISE-018) : HTTP → API → base noise_test. */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET });
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createApp(env, createLogger('silent'), { prisma });
});
afterAll(() => prisma.$disconnect());

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const inDays = (days: number) => new Date(Date.now() + days * DAY);

const as = async (user: { id: string; roles: UserRole[] }) => ({
  Authorization: `Bearer ${await createAccessToken({ userId: user.id, roles: user.roles }, SECRET)}`,
});
const buyer = async () => {
  const user = await factories.user(prisma, ['PARTICIPANT']);
  return { user, headers: await as(user) };
};

/** Un événement publié avec un type de billet ; tout est modifiable test par test. */
async function setup(
  options: {
    quantityTotal?: number;
    quantitySold?: number;
    priceXof?: number;
    salesEndAt?: Date | null;
    status?: 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
    startsAt?: Date;
    endsAt?: Date;
  } = {},
) {
  const organizer = await factories.user(prisma, ['ORGANIZER']);
  const event = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Soirée Afrobeats',
      description: 'Test',
      genre: 'Afrobeats',
      venue: 'Club',
      city: 'Cotonou',
      startsAt: options.startsAt ?? inDays(5),
      endsAt: options.endsAt ?? inDays(6),
      status: options.status ?? 'PUBLISHED',
    },
  });
  const ticketType = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: 'Standard',
      priceXof: options.priceXof ?? 5000,
      quantityTotal: options.quantityTotal ?? 10,
      quantitySold: options.quantitySold ?? 0,
      salesEndAt: options.salesEndAt ?? null,
    },
  });
  return { organizer, event, ticketType };
}

const order = (headers: Record<string, string>, ticketTypeId: string, quantity: number) =>
  request(app).post('/api/v1/orders').set(headers).send({ ticketTypeId, quantity });

/** Place disponible affichée par l'API des événements (DEC-007). */
async function availableOf(headers: Record<string, string>, eventId: string): Promise<number> {
  const res = await request(app).get(`/api/v1/events/${eventId}`).set(headers);
  return res.body.event.ticketTypes[0].available;
}

describe('création d’une commande', () => {
  it('crée une commande en attente et réserve les places 15 minutes', async () => {
    const { event, ticketType } = await setup();
    const { user, headers } = await buyer();
    const before = Date.now();

    const res = await order(headers, ticketType.id, 2);

    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({
      eventId: event.id,
      eventTitle: 'Soirée Afrobeats',
      ticketTypeId: ticketType.id,
      ticketTypeName: 'Standard',
      quantity: 2,
      unitPriceXof: 5000,
      totalXof: 10000,
      status: 'PENDING',
      paidAt: null,
    });
    const expiresAt = new Date(res.body.order.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 15 * MINUTE);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 15 * MINUTE);

    const stored = await prisma.order.findUniqueOrThrow({ where: { id: res.body.order.id } });
    expect(stored.participantId).toBe(user.id);
    // Les places sont réservées, mais pas vendues avant le paiement (CDC 6.2).
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } })).quantitySold,
    ).toBe(0);
    expect(await availableOf(headers, event.id)).toBe(8);
  });

  it.each([
    ['0 billet', { quantity: 0 }],
    ['6 billets', { quantity: 6 }],
    ['quantité décimale', { quantity: 1.5 }],
    ['quantité en texte', { quantity: '2' }],
    ['identifiant invalide', { ticketTypeId: 'pas-un-uuid' }],
  ])('refuse : %s (400)', async (_label, override) => {
    const { ticketType } = await setup();
    const { headers } = await buyer();
    const res = await request(app)
      .post('/api/v1/orders')
      .set(headers)
      .send({ ticketTypeId: ticketType.id, quantity: 1, ...override });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.order.count()).toBe(0);
  });

  it.each([1, 5])('accepte %i billet(s)', async (quantity) => {
    const { ticketType } = await setup();
    const { headers } = await buyer();
    expect((await order(headers, ticketType.id, quantity)).status).toBe(201);
  });

  it('401 sans jeton, 403 sans le rôle participant', async () => {
    const { ticketType } = await setup();
    expect(
      (await request(app).post('/api/v1/orders').send({ ticketTypeId: ticketType.id, quantity: 1 }))
        .status,
    ).toBe(401);
    const organizerOnly = await factories.user(prisma, ['ORGANIZER']);
    const res = await order(await as(organizerOnly), ticketType.id, 1);
    expect(res.status).toBe(403);
  });

  it('404 pour un type de billet inconnu ou d’un événement en brouillon', async () => {
    const { headers } = await buyer();
    expect((await order(headers, '00000000-0000-4000-8000-000000000000', 1)).status).toBe(404);
    const draft = await setup({ status: 'DRAFT' });
    expect((await order(headers, draft.ticketType.id, 1)).status).toBe(404);
  });

  it.each([
    ['événement annulé', { status: 'CANCELLED' as const }, /annulé/],
    ['date limite de vente dépassée', { salesEndAt: new Date(Date.now() - MINUTE) }, /ventes/],
    [
      'événement terminé',
      { startsAt: inDays(-2), endsAt: new Date(Date.now() - MINUTE) },
      /terminé/,
    ],
  ])('409 : %s', async (_label, options, message) => {
    const { ticketType } = await setup(options);
    const { headers } = await buyer();
    const res = await order(headers, ticketType.id, 1);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(message);
    expect(await prisma.order.count()).toBe(0);
  });

  it('vend jusqu’à la date limite : une vente qui se termine plus tard reste ouverte', async () => {
    const { ticketType } = await setup({ salesEndAt: inDays(1) });
    const { headers } = await buyer();
    expect((await order(headers, ticketType.id, 1)).status).toBe(201);
  });
});

describe('réservation du stock (DEC-007)', () => {
  it('compte les vendus et les réservés', async () => {
    const { event, ticketType } = await setup({ quantityTotal: 10, quantitySold: 3 });
    const first = await buyer();
    const second = await buyer();
    expect((await order(first.headers, ticketType.id, 5)).status).toBe(201); // 3 vendus + 5 réservés
    expect(await availableOf(second.headers, event.id)).toBe(2);

    const tooMany = await order(second.headers, ticketType.id, 3);
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.message).toBe('Il ne reste que 2 places pour ce billet');
    expect((await order(second.headers, ticketType.id, 2)).status).toBe(201);

    const soldOut = await order((await buyer()).headers, ticketType.id, 1);
    expect(soldOut.status).toBe(409);
    expect(soldOut.body.error.message).toBe('Ce billet est épuisé');
  });

  it('une commande expirée ne réserve plus rien, même avant le passage du job', async () => {
    const { event, ticketType } = await setup({ quantityTotal: 2 });
    const { user, headers } = await buyer();
    await prisma.order.create({
      data: {
        participantId: user.id,
        ticketTypeId: ticketType.id,
        quantity: 2,
        unitPriceXof: 5000,
        totalXof: 10000,
        expiresAt: new Date(Date.now() - MINUTE),
      },
    });
    expect(await availableOf(headers, event.id)).toBe(2);
    expect((await order(headers, ticketType.id, 2)).status).toBe(201);
  });

  it('commandes simultanées sur le dernier billet : une seule réussit', async () => {
    const { event, ticketType } = await setup({ quantityTotal: 1 });
    const buyers = await Promise.all(Array.from({ length: 10 }, () => buyer()));

    const results = await Promise.all(
      buyers.map(({ headers }) => order(headers, ticketType.id, 1)),
    );

    const statuses = results.map((res) => res.status).sort();
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(9);
    expect(await prisma.order.count()).toBe(1);
    expect(await availableOf(buyers[0]!.headers, event.id)).toBe(0);
  });

  it('commandes simultanées de plusieurs billets : jamais plus que le stock', async () => {
    const { ticketType } = await setup({ quantityTotal: 5 });
    const buyers = await Promise.all(Array.from({ length: 6 }, () => buyer()));

    const results = await Promise.all(
      buyers.map(({ headers }) => order(headers, ticketType.id, 2)),
    );

    expect(results.filter((res) => res.status === 201)).toHaveLength(2); // 4 billets sur 5
    expect(results.filter((res) => res.status === 409)).toHaveLength(4);
    const reserved = await prisma.order.aggregate({ _sum: { quantity: true } });
    expect(reserved._sum.quantity).toBe(4);
  });
});

describe('billet gratuit', () => {
  it('est confirmé tout de suite, sans paiement', async () => {
    const { event, ticketType } = await setup({ priceXof: 0, quantityTotal: 10 });
    const { headers } = await buyer();

    const res = await order(headers, ticketType.id, 3);

    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({ unitPriceXof: 0, totalXof: 0, status: 'PAID' });
    expect(res.body.order.paidAt).toEqual(expect.any(String));
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: res.body.order.id } });
    expect([stored.noiseShareXof, stored.affiliateShareXof, stored.organizerShareXof]).toEqual([
      0, 0, 0,
    ]);
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } })).quantitySold,
    ).toBe(3);
    expect(await availableOf(headers, event.id)).toBe(7);
  });

  it('respecte aussi le stock', async () => {
    const { ticketType } = await setup({ priceXof: 0, quantityTotal: 1 });
    const results = await Promise.all(
      (await Promise.all(Array.from({ length: 5 }, () => buyer()))).map(({ headers }) =>
        order(headers, ticketType.id, 1),
      ),
    );
    expect(results.filter((res) => res.status === 201)).toHaveLength(1);
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } })).quantitySold,
    ).toBe(1);
  });
});

describe('suivi d’une commande', () => {
  it('renvoie la commande à son propriétaire', async () => {
    const { ticketType } = await setup();
    const { headers } = await buyer();
    const created = (await order(headers, ticketType.id, 2)).body.order;

    const res = await request(app).get(`/api/v1/orders/${created.id}`).set(headers);

    expect(res.status).toBe(200);
    expect(res.body.order).toEqual(created);
  });

  it('404 pour la commande d’un autre, 400 pour un identifiant invalide, 401 sans jeton', async () => {
    const { ticketType } = await setup();
    const owner = await buyer();
    const other = await buyer();
    const created = (await order(owner.headers, ticketType.id, 1)).body.order;

    expect((await request(app).get(`/api/v1/orders/${created.id}`).set(other.headers)).status).toBe(
      404,
    );
    expect((await request(app).get('/api/v1/orders/pas-un-uuid').set(owner.headers)).status).toBe(
      400,
    );
    expect((await request(app).get(`/api/v1/orders/${created.id}`)).status).toBe(401);
  });

  it('une commande en attente périmée est lue comme expirée, même sans le job', async () => {
    const { ticketType } = await setup();
    const { user, headers } = await buyer();
    const stale = await prisma.order.create({
      data: {
        participantId: user.id,
        ticketTypeId: ticketType.id,
        quantity: 1,
        unitPriceXof: 5000,
        totalXof: 5000,
        expiresAt: new Date(Date.now() - MINUTE),
      },
    });

    const res = await request(app).get(`/api/v1/orders/${stale.id}`).set(headers);

    expect(res.body.order.status).toBe('EXPIRED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe(
      'EXPIRED',
    );
  });

  it('une commande payée reste payée après sa date d’expiration', async () => {
    const { ticketType } = await setup();
    const { user, headers } = await buyer();
    const paid = await prisma.order.create({
      data: {
        participantId: user.id,
        ticketTypeId: ticketType.id,
        quantity: 1,
        unitPriceXof: 5000,
        totalXof: 5000,
        status: 'PAID',
        paidAt: new Date(Date.now() - 20 * MINUTE),
        expiresAt: new Date(Date.now() - 5 * MINUTE),
      },
    });
    const res = await request(app).get(`/api/v1/orders/${paid.id}`).set(headers);
    expect(res.body.order.status).toBe('PAID');
  });
});

describe('expiration des commandes (job)', () => {
  it('expire seulement les commandes en attente dont l’heure est passée', async () => {
    const { ticketType } = await setup({ quantityTotal: 50 });
    const { user } = await buyer();
    const base = {
      participantId: user.id,
      ticketTypeId: ticketType.id,
      quantity: 1,
      unitPriceXof: 5000,
      totalXof: 5000,
    };
    const overdue = await prisma.order.create({
      data: { ...base, expiresAt: new Date(Date.now() - MINUTE) },
    });
    const active = await prisma.order.create({
      data: { ...base, expiresAt: new Date(Date.now() + 10 * MINUTE) },
    });
    const paid = await prisma.order.create({
      data: {
        ...base,
        status: 'PAID',
        paidAt: new Date(),
        expiresAt: new Date(Date.now() - MINUTE),
      },
    });

    const count = await new OrdersService(prisma).expirePending();

    expect(count).toBe(1);
    const statusOf = async (id: string) =>
      (await prisma.order.findUniqueOrThrow({ where: { id } })).status;
    expect(await statusOf(overdue.id)).toBe('EXPIRED');
    expect(await statusOf(active.id)).toBe('PENDING');
    expect(await statusOf(paid.id)).toBe('PAID');
    expect(await new OrdersService(prisma).expirePending()).toBe(0);
  });
});
