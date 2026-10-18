import { splitSale, type UserRole } from '@noise/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { createAccessToken } from '../src/modules/auth/tokens.js';
import type { CancellationNotifier } from '../src/modules/cancellation/cancellation.service.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/** Annulation d'un événement par son organisateur (NOISE-029, DEC-025). Base noise_test. */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET });
let notify: ReturnType<typeof vi.fn<CancellationNotifier>>;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  notify = vi.fn<CancellationNotifier>(async () => {});
  app = createApp(env, createLogger('silent'), { prisma, notifyCancellation: notify });
});
afterAll(() => prisma.$disconnect());

const DAY = 86_400_000;
const bearer = async (user: { id: string; roles: UserRole[] }) =>
  `Bearer ${await createAccessToken({ userId: user.id, roles: user.roles }, SECRET)}`;

async function paidOrder(
  participantId: string,
  ticketTypeId: string,
  quantity: number,
  price: number,
) {
  const total = quantity * price;
  const split = splitSale(total, { withAffiliate: false });
  const order = await prisma.order.create({
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
  return order;
}

/**
 * Événement publié : 3 × 5 000 (Aminata) et 1 × 10 000 (Koffi) payés, soit 25 000 de ventes,
 * 4 billets, une commande en attente et un lien scanner actif.
 */
async function scenario(options: { endsInDays?: number } = {}) {
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
      startsAt: new Date(Date.now() + ((options.endsInDays ?? 3) - 1) * DAY),
      endsAt: new Date(Date.now() + (options.endsInDays ?? 3) * DAY),
    },
  });
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
  const aminata = await factories.user(prisma, ['PARTICIPANT']);
  const koffi = await factories.user(prisma, ['PARTICIPANT']);
  const a = await paidOrder(aminata.id, standard.id, 3, 5000);
  const k = await paidOrder(koffi.id, vip.id, 1, 10_000);
  for (const [order, type, count] of [
    [a, standard, 3],
    [k, vip, 1],
  ] as const) {
    for (let i = 0; i < count; i++) {
      await prisma.ticket.create({
        data: {
          orderId: order.id,
          ticketTypeId: type.id,
          eventId: event.id,
          holderName: 'Titulaire',
          qrTokenHash: crypto.randomUUID().replace(/-/g, '').padEnd(64, '0'),
        },
      });
    }
  }
  const pending = await factories.order(prisma, (await factories.user(prisma)).id, standard.id, 2);
  await prisma.scannerLink.create({
    data: {
      eventId: event.id,
      createdById: organizer.id,
      jti: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 4 * DAY),
    },
  });
  return { organizer, event, standard, aminata, koffi, pending, auth: await bearer(organizer) };
}

const preview = (auth: string, id: string) =>
  request(app).get(`/api/v1/events/${id}/cancellation`).set('Authorization', auth);
const cancel = (auth: string, id: string, body: object = {}) =>
  request(app).post(`/api/v1/events/${id}/cancel`).set('Authorization', auth).send(body);

describe('aperçu : GET /api/v1/events/:id/cancellation', () => {
  it('affiche le calcul de DEC-025 sans rien modifier', async () => {
    const { event, auth } = await scenario();
    const res = await preview(auth, event.id);

    expect(res.status).toBe(200);
    expect(res.body.cancellation).toMatchObject({
      ticketsSold: 4,
      salesXof: 25_000,
      refundTotalXof: 25_000,
      cancellationFeeXof: 2500,
      alreadyPaidOutXof: 0,
      retainedXof: 22_500,
      organizerOwesXof: 2500,
    });
    const due = new Date(res.body.cancellation.returnDueAt).getTime();
    expect(due - Date.now()).toBeGreaterThan(9.9 * DAY);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe(
      'PUBLISHED',
    );
  });
});

describe('POST /api/v1/events/:id/cancel', () => {
  it('annule tout en une fois : événement, billets, commandes, liens scanner, montants figés', async () => {
    const { event, pending, aminata, koffi, organizer, auth } = await scenario();
    const res = await cancel(auth, event.id, { reason: 'Salle indisponible' });

    expect(res.status).toBe(200);
    expect(res.body.cancellation).toMatchObject({
      ticketsCancelled: 4,
      ordersCancelled: 2,
      ordersExpired: 1,
      scannerLinksRevoked: 1,
      refundTotalXof: 25_000,
      organizerOwesXof: 2500,
    });

    const saved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(saved.status).toBe('CANCELLED');
    expect(saved.cancelledAt).toBeInstanceOf(Date);
    expect(
      await prisma.ticket.count({ where: { eventId: event.id, status: { not: 'CANCELLED' } } }),
    ).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe(
      'EXPIRED',
    );
    expect(await prisma.scannerLink.count({ where: { eventId: event.id, revokedAt: null } })).toBe(
      0,
    );
    expect(
      await prisma.eventCancellation.findUniqueOrThrow({ where: { eventId: event.id } }),
    ).toMatchObject({
      cancelledById: organizer.id,
      reason: 'Salle indisponible',
      ticketsCancelled: 4,
      salesXof: 25_000,
      cancellationFeeXof: 2500,
      paidOutXof: 0,
    });
    expect(notify).toHaveBeenCalledOnce();
    expect(notify.mock.calls[0]?.[1].sort()).toEqual([aminata.id, koffi.id].sort());
  });

  it('plus aucune commande possible ensuite', async () => {
    const { event, standard, auth } = await scenario();
    await cancel(auth, event.id);
    const buyer = await factories.user(prisma, ['PARTICIPANT']);
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', await bearer(buyer))
      .send({ ticketTypeId: standard.id, quantity: 1 });
    expect(res.status).toBe(409);
  });

  it('déjà annulé ou terminé : 409', async () => {
    const { event, auth } = await scenario();
    await cancel(auth, event.id);
    expect((await cancel(auth, event.id)).status).toBe(409);

    const ended = await scenario({ endsInDays: -1 });
    expect((await cancel(ended.auth, ended.event.id)).status).toBe(409);
  });

  it('autre organisateur 403, participant 403, inconnu 404, sans jeton 401 ; rien ne change', async () => {
    const { event } = await scenario();
    const other = await factories.user(prisma, ['ORGANIZER']);
    const participant = await factories.user(prisma, ['PARTICIPANT']);
    expect((await cancel(await bearer(other), event.id)).status).toBe(403);
    expect((await cancel(await bearer(participant), event.id)).status).toBe(403);
    expect((await cancel(await bearer(other), crypto.randomUUID())).status).toBe(404);
    expect((await request(app).post(`/api/v1/events/${event.id}/cancel`)).status).toBe(401);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe(
      'PUBLISHED',
    );
  });

  it('motif trop court : 400', async () => {
    const { event, auth } = await scenario();
    expect((await cancel(auth, event.id, { reason: 'x' })).status).toBe(400);
  });

  it('notification en échec : l’annulation est quand même faite', async () => {
    const { event, auth } = await scenario();
    notify.mockRejectedValueOnce(new Error('Expo indisponible'));
    const res = await cancel(auth, event.id);
    expect(res.status).toBe(200);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe(
      'CANCELLED',
    );
  });

  it('commande en cours de création pendant l’annulation : elle est expirée, jamais laissée en attente', async () => {
    // Le test imite une création de commande déjà passée par la vérification du statut : il
    // tient le verrou du type de billet et insère une commande en attente, pas encore validée.
    // L'annulation doit attendre ce verrou, puis voir la commande et l'expirer.
    const { event, standard, auth } = await scenario();
    const buyer = await factories.user(prisma, ['PARTICIPANT']);
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let markInserted!: () => void;
    const inserted = new Promise<void>((resolve) => (markInserted = resolve));
    const creating = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM ticket_types WHERE id = ${standard.id}::uuid FOR UPDATE`;
        await tx.order.create({
          data: {
            participantId: buyer.id,
            ticketTypeId: standard.id,
            quantity: 1,
            unitPriceXof: 5000,
            totalXof: 5000,
            expiresAt: new Date(Date.now() + 15 * 60_000),
          },
        });
        markInserted();
        await released;
      },
      { timeout: 20_000 },
    );
    await inserted;
    const cancelled = cancel(auth, event.id).then((r) => r.status);
    await new Promise((resolve) => setTimeout(resolve, 500));
    release();
    await creating;

    expect(await cancelled).toBe(200);
    expect(
      await prisma.order.count({ where: { ticketType: { eventId: event.id }, status: 'PENDING' } }),
    ).toBe(0);
  });
});

describe('GET /api/v1/admin/events/:eventId/refunds', () => {
  it('liste les remboursements à faire, numéro complet, total et échéance', async () => {
    const { event, auth } = await scenario();
    await cancel(auth, event.id);
    const admin = await prisma.user.create({
      data: { name: 'Admin', phone: '+2290199999999', passwordHash: 'x', roles: ['ADMIN'] },
    });
    const res = await request(app)
      .get(`/api/v1/admin/events/${event.id}/refunds`)
      .set('Authorization', await bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ refundTotalXof: 25_000, organizerOwesXof: 2500 });
    expect(res.body.refunds).toHaveLength(2);
    expect(res.body.refunds[0]).toMatchObject({
      participantPhone: expect.stringMatching(/^\+229\d{10}$/),
      refundXof: expect.any(Number),
    });
  });

  it('réservé aux administrateurs ; événement non annulé : 404', async () => {
    const { event, auth } = await scenario();
    expect(
      (
        await request(app)
          .get(`/api/v1/admin/events/${event.id}/refunds`)
          .set('Authorization', auth)
      ).status,
    ).toBe(403);
    const admin = await prisma.user.create({
      data: { name: 'Admin', phone: '+2290199999998', passwordHash: 'x', roles: ['ADMIN'] },
    });
    expect(
      (
        await request(app)
          .get(`/api/v1/admin/events/${event.id}/refunds`)
          .set('Authorization', await bearer(admin))
      ).status,
    ).toBe(404);
  });
});
