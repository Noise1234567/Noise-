import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import type { PrismaClient } from '../src/lib/prisma.js';
import { createAccessToken } from '../src/modules/auth/tokens.js';
import {
  FAKE_PHONE_NUMBERS,
  FakePaymentProvider,
  type PaymentProvider,
} from '../src/modules/payments/providers/index.js';
import { PaymentsService, type TicketIssuer } from '../src/modules/payments/payments.service.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/**
 * Paiement de bout en bout (NOISE-019) : initiation, webhook signé, revérification,
 * idempotence, suivi de commande. Base noise_test, FakeProvider (aucun appel réseau).
 */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET });

let provider: FakePaymentProvider;
let issueTickets: ReturnType<typeof vi.fn<TicketIssuer>>;
let logger: ReturnType<typeof createLogger>;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  provider = new FakePaymentProvider('whsec-test');
  issueTickets = vi.fn<TicketIssuer>(async () => {});
  logger = createLogger('silent');
  app = createApp(env, logger, { prisma, paymentProvider: provider, issueTickets });
});
afterAll(() => prisma.$disconnect());

/** Participant, événement, type de billet à 5 000 FCFA et commande PENDING de 2 billets. */
async function scenario(options: { expiresInMs?: number } = {}) {
  const organizer = await factories.user(prisma, ['ORGANIZER']);
  const participant = await prisma.user.update({
    where: { id: (await factories.user(prisma)).id },
    data: { name: 'Aminata Sossou' },
  });
  const event = await factories.event(prisma, organizer.id);
  const ticketType = await factories.ticketType(prisma, event.id);
  const order = await prisma.order.create({
    data: {
      participantId: participant.id,
      ticketTypeId: ticketType.id,
      quantity: 2,
      unitPriceXof: 5000,
      totalXof: 10_000,
      expiresAt: new Date(Date.now() + (options.expiresInMs ?? 15 * 60 * 1000)),
    },
  });
  const token = await createAccessToken({ userId: participant.id, roles: ['PARTICIPANT'] }, SECRET);
  return { participant, event, ticketType, order, auth: `Bearer ${token}` };
}

const initiate = (auth: string, orderId: string, phone: string = FAKE_PHONE_NUMBERS.success) =>
  request(app)
    .post('/api/v1/payments/initiate')
    .set('Authorization', auth)
    .send({ orderId, operator: 'MTN', phone });

const sendWebhook = (webhook: { headers: Record<string, unknown>; rawBody: string }) =>
  request(app)
    .post('/api/v1/payments/webhook')
    .set(webhook.headers as Record<string, string>)
    .set('Content-Type', 'application/json')
    .send(webhook.rawBody);

const transactionIdOf = async (orderId: string) =>
  (await prisma.payment.findFirstOrThrow({ where: { orderId }, orderBy: { createdAt: 'desc' } }))
    .providerTransactionId ?? '';

describe('POST /api/v1/payments/initiate', () => {
  it('crée la tentative, masque le numéro et déclenche la demande chez le fournisseur', async () => {
    const { order, auth } = await scenario();
    const res = await initiate(auth, order.id);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ paymentId: expect.any(String), status: 'PENDING' });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: res.body.paymentId } });
    expect(payment).toMatchObject({
      status: 'PENDING',
      provider: 'fake',
      operator: 'MTN',
      amountXof: 10_000,
      phoneMasked: '+2290166****01',
    });
    expect(payment.providerTransactionId).toBeTruthy();
  });

  it('la commande d’un autre participant est introuvable (404)', async () => {
    const { order } = await scenario();
    const intruder = await factories.user(prisma);
    const token = await createAccessToken({ userId: intruder.id, roles: ['PARTICIPANT'] }, SECRET);
    expect((await initiate(`Bearer ${token}`, order.id)).status).toBe(404);
  });

  it('refuse une commande expirée (409)', async () => {
    const { order, auth } = await scenario({ expiresInMs: -1000 });
    expect((await initiate(auth, order.id)).status).toBe(409);
  });

  it('refuse une seconde tentative tant que la première est en cours (409)', async () => {
    const { order, auth } = await scenario();
    expect((await initiate(auth, order.id)).status).toBe(201);
    expect((await initiate(auth, order.id)).status).toBe(409);
  });

  it('fournisseur indisponible : 502 générique et tentative marquée FAILED', async () => {
    const { order, participant } = await scenario();
    const broken: PaymentProvider = {
      ...provider,
      name: 'fake',
      initiate: async () => {
        throw new Error('HTTP 500 chez le fournisseur, clé sk_secret');
      },
      getStatus: provider.getStatus.bind(provider),
      verifyWebhookSignature: provider.verifyWebhookSignature.bind(provider),
      parseWebhook: provider.parseWebhook.bind(provider),
    };
    const brokenApp = createApp(env, logger, { prisma, paymentProvider: broken });
    const token = await createAccessToken(
      { userId: participant.id, roles: ['PARTICIPANT'] },
      SECRET,
    );
    const res = await request(brokenApp)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: order.id, operator: 'MOOV', phone: FAKE_PHONE_NUMBERS.success });

    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain('sk_secret');
    expect((await prisma.payment.findFirstOrThrow()).status).toBe('FAILED');
  });

  it('400 sur une saisie invalide, 401 sans jeton', async () => {
    const { order, auth } = await scenario();
    expect((await initiate(auth, order.id, '123')).status).toBe(400);
    expect(
      (await request(app).post('/api/v1/payments/initiate').send({ orderId: order.id })).status,
    ).toBe(401);
  });

  it('limite à 5 tentatives par 10 minutes par compte (429)', async () => {
    const { order, auth } = await scenario();
    for (let attempt = 0; attempt < 5; attempt += 1) await initiate(auth, order.id);
    expect((await initiate(auth, order.id)).status).toBe(429);
  });
});

describe('POST /api/v1/payments/webhook', () => {
  it('paiement réussi : commande PAID, répartition DEC-022, stock vendu, billets créés', async () => {
    const { order, ticketType, auth } = await scenario();
    await initiate(auth, order.id);
    const transactionId = await transactionIdOf(order.id);

    const res = await sendWebhook(provider.buildWebhook(transactionId));
    expect(res.status).toBe(200);

    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'PAID',
      paidAt: expect.any(Date),
      noiseShareXof: 1000,
      affiliateShareXof: 0,
      organizerShareXof: 9000,
    });
    expect((await prisma.payment.findFirstOrThrow()).status).toBe('SUCCEEDED');
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } })).quantitySold,
    ).toBe(2);
    expect(issueTickets).toHaveBeenCalledOnce();
    expect(issueTickets.mock.calls[0]?.[1]).toEqual({
      orderId: order.id,
      eventId: ticketType.eventId,
      ticketTypeId: ticketType.id,
      participantId: order.participantId,
      holderName: 'Aminata Sossou',
      quantity: 2,
    });
  });

  it('signature invalide : 401 et aucune modification', async () => {
    const { order, auth } = await scenario();
    await initiate(auth, order.id);
    const webhook = provider.buildWebhook(await transactionIdOf(order.id));
    const forged = await sendWebhook({
      headers: webhook.headers,
      rawBody: webhook.rawBody.replace('10000', '1'),
    });
    expect(forged.status).toBe(401);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'PENDING',
    );
  });

  it('webhook rejoué : une seule confirmation', async () => {
    const { order, ticketType, auth } = await scenario();
    await initiate(auth, order.id);
    const webhook = provider.buildWebhook(await transactionIdOf(order.id));
    for (let delivery = 0; delivery < 3; delivery += 1) {
      expect((await sendWebhook(webhook)).status).toBe(200);
    }
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } })).quantitySold,
    ).toBe(2);
    expect(issueTickets).toHaveBeenCalledOnce();
  });

  it('webhooks simultanés : une seule confirmation', async () => {
    const { order, ticketType, auth } = await scenario();
    await initiate(auth, order.id);
    const webhook = provider.buildWebhook(await transactionIdOf(order.id));
    const results = await Promise.all(Array.from({ length: 5 }, () => sendWebhook(webhook)));
    expect(results.every((res) => res.status === 200)).toBe(true);
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } })).quantitySold,
    ).toBe(2);
    expect(issueTickets).toHaveBeenCalledOnce();
  });

  it('ordre inversé : un ancien webhook « en attente » reçu après le succès ne change rien', async () => {
    const { order, auth } = await scenario();
    await initiate(auth, order.id, FAKE_PHONE_NUMBERS.pending);
    const transactionId = await transactionIdOf(order.id);
    const oldPending = provider.buildWebhook(transactionId); // transaction.created
    provider.settle(transactionId, 'SUCCEEDED');
    await sendWebhook(provider.buildWebhook(transactionId));
    await sendWebhook(oldPending);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
  });

  it('le contenu du webhook ne suffit pas : le statut est redemandé au fournisseur', async () => {
    const { order, auth } = await scenario();
    await initiate(auth, order.id, FAKE_PHONE_NUMBERS.pending);
    const transactionId = await transactionIdOf(order.id);
    provider.settle(transactionId, 'SUCCEEDED');
    const approved = provider.buildWebhook(transactionId);
    provider.settle(transactionId, 'FAILED'); // le fournisseur dit finalement « échec »
    await sendWebhook(approved);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'PENDING',
    );
    expect((await prisma.payment.findFirstOrThrow()).status).toBe('FAILED');
  });

  it('paiement refusé : tentative FAILED, la commande reste payable', async () => {
    const { order, auth } = await scenario();
    await initiate(auth, order.id, FAKE_PHONE_NUMBERS.failure);
    await sendWebhook(provider.buildWebhook(await transactionIdOf(order.id)));
    expect((await prisma.payment.findFirstOrThrow()).status).toBe('FAILED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'PENDING',
    );
  });

  it('montant incohérent : pas de confirmation, alerte', async () => {
    const errors = vi.spyOn(logger, 'error');
    const { order, auth } = await scenario();
    await initiate(auth, order.id);
    await prisma.payment.updateMany({ data: { amountXof: 9000 } });
    await sendWebhook(provider.buildWebhook(await transactionIdOf(order.id)));
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'PENDING',
    );
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({ alert: 'PAYMENT_AMOUNT_MISMATCH' }),
      expect.any(String),
    );
  });

  it('paiement reçu sur une commande expirée : pas de billet, alerte de remboursement', async () => {
    const errors = vi.spyOn(logger, 'error');
    const { order, ticketType, auth } = await scenario();
    await initiate(auth, order.id);
    await prisma.order.update({
      where: { id: order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await sendWebhook(provider.buildWebhook(await transactionIdOf(order.id)));

    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'EXPIRED',
    );
    expect((await prisma.payment.findFirstOrThrow()).status).toBe('SUCCEEDED');
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } })).quantitySold,
    ).toBe(0);
    expect(issueTickets).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({ alert: 'PAYMENT_ON_EXPIRED_ORDER' }),
      expect.any(String),
    );
  });

  it('commande payée deux fois (deux tentatives réussies) : la seconde est à rembourser', async () => {
    const errors = vi.spyOn(logger, 'error');
    const { order, ticketType, auth } = await scenario();
    await initiate(auth, order.id);
    const first = await transactionIdOf(order.id);
    // Seconde tentative après le délai de 2 minutes (simulé en vieillissant la première).
    await prisma.payment.updateMany({ data: { createdAt: new Date(Date.now() - 3 * 60 * 1000) } });
    await initiate(auth, order.id);
    const second = await transactionIdOf(order.id);

    await sendWebhook(provider.buildWebhook(first));
    await sendWebhook(provider.buildWebhook(second));
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } })).quantitySold,
    ).toBe(2);
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({ alert: 'PAYMENT_DUPLICATE' }),
      expect.any(String),
    );
  });

  it('confirmation concurrente entre la lecture et la mise à jour : une seule (course déterministe)', async () => {
    const { order, ticketType, auth } = await scenario();
    await initiate(auth, order.id);
    const transactionId = await transactionIdOf(order.id);
    // Juste après la lecture de la commande dans la transaction, un « autre traitement »
    // la confirme en base : la mise à jour conditionnelle doit alors ne rien faire.
    let raced = false;
    const racing = prisma.$extends({
      query: {
        order: {
          async findUniqueOrThrow({ args, query }) {
            const found = await query(args);
            if (!raced) {
              raced = true;
              await prisma.order.update({
                where: { id: order.id },
                data: {
                  status: 'PAID',
                  paidAt: new Date(),
                  noiseShareXof: 1000,
                  affiliateShareXof: 0,
                  organizerShareXof: 9000,
                },
              });
            }
            return found;
          },
        },
      },
    });
    const service = new PaymentsService(
      racing as unknown as PrismaClient,
      provider,
      logger,
      issueTickets,
    );

    expect(await service.reconcile(transactionId)).toBe('already-confirmed');
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } })).quantitySold,
    ).toBe(0);
    expect(issueTickets).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/orders/:id/status', () => {
  it('le participant suit sa commande ; un autre compte reçoit 404', async () => {
    const { order, auth } = await scenario();
    await initiate(auth, order.id);
    await sendWebhook(provider.buildWebhook(await transactionIdOf(order.id)));

    const res = await request(app)
      .get(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      orderId: order.id,
      status: 'PAID',
      payment: { status: 'SUCCEEDED' },
    });

    const intruder = await factories.user(prisma);
    const token = await createAccessToken({ userId: intruder.id, roles: ['PARTICIPANT'] }, SECRET);
    const other = await request(app)
      .get(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${token}`);
    expect(other.status).toBe(404);
  });

  it('commande en attente dont le délai est passé : EXPIRED', async () => {
    const { order, auth } = await scenario({ expiresInMs: -1000 });
    const res = await request(app)
      .get(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', auth);
    expect(res.body.status).toBe('EXPIRED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'EXPIRED',
    );
  });

  it('webhook perdu : le suivi redemande le statut au fournisseur et confirme', async () => {
    const { order, auth } = await scenario();
    await initiate(auth, order.id, FAKE_PHONE_NUMBERS.pending);
    provider.settle(await transactionIdOf(order.id), 'SUCCEEDED');
    // Dernière vérification il y a plus de 15 s, aucun webhook reçu.
    await prisma.$executeRaw`UPDATE payments SET updated_at = now() - interval '20 seconds'`;

    const res = await request(app)
      .get(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', auth);
    expect(res.body.status).toBe('PAID');
    expect(issueTickets).toHaveBeenCalledOnce();
  });
});
