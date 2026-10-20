import type { UserRole } from '@noise/shared';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { errorHandler } from '../src/middlewares/error-handler.js';
import { IDEMPOTENCY_TTL_MS, createIdempotency } from '../src/middlewares/idempotency.js';
import { createAccessToken } from '../src/modules/auth/tokens.js';
import {
  FAKE_PHONE_NUMBERS,
  FakePaymentProvider,
} from '../src/modules/payments/providers/index.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/**
 * Idempotency-Key (NOISE-053) : une requête renvoyée avec la même clé, après une réponse
 * perdue en 3G, reçoit la réponse déjà donnée au lieu d'une seconde commande.
 */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET });
let provider: FakePaymentProvider;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  provider = new FakePaymentProvider('whsec-test');
  app = createApp(env, createLogger('silent'), { prisma, paymentProvider: provider });
});
afterAll(() => prisma.$disconnect());

const bearer = async (user: { id: string; roles: UserRole[] }) =>
  `Bearer ${await createAccessToken({ userId: user.id, roles: user.roles }, SECRET)}`;

async function ticketType(quantityTotal = 10) {
  const organizer = await factories.user(prisma, ['ORGANIZER']);
  const event = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Afro Night',
      description: 'Test',
      styles: ['Afrobeat'],
      venue: 'Club',
      city: 'Cotonou',
      capacity: 100,
      status: 'PUBLISHED',
      startsAt: new Date(Date.now() + 2 * 86_400_000),
      endsAt: new Date(Date.now() + 3 * 86_400_000),
    },
  });
  return prisma.ticketType.create({
    data: { eventId: event.id, name: 'Standard', priceXof: 5000, quantityTotal },
  });
}

async function participant() {
  const user = await factories.user(prisma, ['PARTICIPANT']);
  return { user, auth: await bearer(user) };
}

const createOrder = (auth: string, body: object, key?: string) => {
  const req = request(app).post('/api/v1/orders').set('Authorization', auth);
  if (key) req.set('Idempotency-Key', key);
  return req.send(body);
};

describe('Idempotency-Key sur POST /api/v1/orders', () => {
  it('même clé : la commande n’est créée qu’une fois, la réponse est rejouée', async () => {
    const type = await ticketType();
    const { auth } = await participant();
    const body = { ticketTypeId: type.id, quantity: 2 };

    const first = await createOrder(auth, body, 'commande-0001');
    const retry = await createOrder(auth, body, 'commande-0001');

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.body.order.id).toBe(first.body.order.id);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(await prisma.order.count()).toBe(1);
  });

  it('sans clé : chaque requête est traitée (comportement inchangé)', async () => {
    const type = await ticketType();
    const { auth } = await participant();
    await createOrder(auth, { ticketTypeId: type.id, quantity: 1 });
    await createOrder(auth, { ticketTypeId: type.id, quantity: 1 });
    expect(await prisma.order.count()).toBe(2);
  });

  it('même clé avec un autre contenu : 409, rien de créé', async () => {
    const type = await ticketType();
    const { auth } = await participant();
    await createOrder(auth, { ticketTypeId: type.id, quantity: 1 }, 'commande-0002');
    const res = await createOrder(auth, { ticketTypeId: type.id, quantity: 3 }, 'commande-0002');
    expect(res.status).toBe(409);
    expect(await prisma.order.count()).toBe(1);
  });

  it('les clés sont propres à chaque compte', async () => {
    const type = await ticketType();
    const a = await participant();
    const b = await participant();
    const body = { ticketTypeId: type.id, quantity: 1 };
    const ra = await createOrder(a.auth, body, 'meme-cle-0001');
    const rb = await createOrder(b.auth, body, 'meme-cle-0001');
    expect(rb.body.order.id).not.toBe(ra.body.order.id);
    expect(await prisma.order.count()).toBe(2);
  });

  it('une erreur métier (4xx) est aussi rejouée à l’identique', async () => {
    const type = await ticketType(1);
    const { auth } = await participant();
    const body = { ticketTypeId: type.id, quantity: 2 };
    const first = await createOrder(auth, body, 'commande-0003');
    const retry = await createOrder(auth, body, 'commande-0003');
    expect(first.status).toBe(409);
    expect(retry.status).toBe(409);
    expect(retry.body.error.message).toBe(first.body.error.message);
    expect(retry.headers['idempotent-replayed']).toBe('true');
  });

  it('première requête encore en cours : 409, à réessayer', async () => {
    const type = await ticketType();
    const { user, auth } = await participant();
    const body = { ticketTypeId: type.id, quantity: 1 };
    const { createHash } = await import('node:crypto');
    await prisma.idempotencyKey.create({
      data: {
        userId: user.id,
        key: 'commande-0004',
        scope: 'orders.create',
        requestHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      },
    });
    const res = await createOrder(auth, body, 'commande-0004');
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/en cours/);
    expect(await prisma.order.count()).toBe(0);
  });

  it('clé au mauvais format : 400', async () => {
    const type = await ticketType();
    const { auth } = await participant();
    const res = await createOrder(auth, { ticketTypeId: type.id, quantity: 1 }, 'court');
    expect(res.status).toBe(400);
  });
});

describe('Idempotency-Key sur POST /api/v1/payments/initiate', () => {
  it('même clé : une seule demande de paiement envoyée au fournisseur', async () => {
    const type = await ticketType();
    const { auth } = await participant();
    const order = (await createOrder(auth, { ticketTypeId: type.id, quantity: 1 })).body.order;
    const pay = () =>
      request(app)
        .post('/api/v1/payments/initiate')
        .set('Authorization', auth)
        .set('Idempotency-Key', 'paiement-0001')
        .send({ orderId: order.id, operator: 'MTN', phone: `+229${FAKE_PHONE_NUMBERS.success}` });

    const first = await pay();
    const retry = await pay();
    expect(first.status).toBe(201);
    expect(retry.body.paymentId).toBe(first.body.paymentId);
    expect(await prisma.payment.count()).toBe(1);
  });
});

describe('cas limites du middleware', () => {
  function testApp(handler: express.RequestHandler) {
    const user = factories.user(prisma, ['PARTICIPANT']);
    const idempotent = createIdempotency(prisma);
    const test = express();
    test.use(express.json());
    test.use(async (req, _res, next) => {
      req.auth = { userId: (await user).id, roles: ['PARTICIPANT'] };
      next();
    });
    test.post('/action', idempotent('test.action'), handler);
    test.use(errorHandler);
    return test;
  }

  it('erreur serveur (5xx) : rien n’est gardé, un nouvel essai est traité', async () => {
    let calls = 0;
    const test = testApp((_req, res) => {
      calls++;
      if (calls === 1) throw new Error('panne');
      res.status(201).json({ ok: true });
    });
    const first = await request(test)
      .post('/action')
      .set('Idempotency-Key', 'essai-00001')
      .send({ a: 1 });
    const retry = await request(test)
      .post('/action')
      .set('Idempotency-Key', 'essai-00001')
      .send({ a: 1 });
    expect(first.status).toBe(500);
    expect(retry.status).toBe(201);
    expect(calls).toBe(2);
  });

  it('clé expirée : elle resert comme une nouvelle', async () => {
    let calls = 0;
    const test = testApp((_req, res) => {
      calls++;
      res.status(201).json({ call: calls });
    });
    await request(test).post('/action').set('Idempotency-Key', 'essai-00002').send({ a: 1 });
    await prisma.idempotencyKey.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const again = await request(test)
      .post('/action')
      .set('Idempotency-Key', 'essai-00002')
      .send({ a: 1 });
    expect(again.body).toEqual({ call: 2 });
  });
});
