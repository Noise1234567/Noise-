import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { createAccessToken } from '../src/modules/auth/tokens.js';
import { FakePaymentProvider } from '../src/modules/payments/providers/index.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/**
 * Administration minimale (NOISE-037, DEC-020) de bout en bout : suspension d'un organisateur
 * ou d'un événement, journal d'audit, listes de commandes et de paiements, et effets de la
 * suspension sur les routes organisateur, commande et paiement.
 */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET });
const app = createApp(env, createLogger('silent'), {
  prisma,
  paymentProvider: new FakePaymentProvider('whsec-test'),
});
const REASON = { reason: 'Signalements répétés de fraude' };

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

type Role = 'ADMIN' | 'ORGANIZER' | 'PARTICIPANT';

async function account(role: Role) {
  const user = await factories.user(prisma, role);
  const token = await createAccessToken({ userId: user.id, roles: [role] }, SECRET);
  return { user, auth: `Bearer ${token}` };
}

/** Un organisateur avec un événement publié et un autre en brouillon. */
async function organizerWithEvents() {
  const organizer = await account('ORGANIZER');
  const published = await prisma.event.update({
    where: { id: (await factories.event(prisma, organizer.user.id)).id },
    data: { status: 'PUBLISHED' },
  });
  const draft = await factories.event(prisma, organizer.user.id);
  return { organizer, published, draft };
}

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const validEvent = {
  title: 'Soirée Afrobeats',
  description: 'Une grande soirée au bord de la mer',
  styles: ['Afrobeat'],
  venue: 'Plage de Fidjrossè',
  city: 'Cotonou',
  startsAt: inDays(10),
  endsAt: inDays(11),
  capacity: 200,
};

describe('contrôle d’accès', () => {
  it('401 sans jeton, 403 pour un organisateur ou un participant', async () => {
    const { user } = await account('ORGANIZER');
    const target = `/api/v1/admin/users/${user.id}/suspend`;
    expect((await request(app).post(target).send(REASON)).status).toBe(401);
    for (const role of ['ORGANIZER', 'PARTICIPANT'] as const) {
      const other = await account(role);
      const res = await request(app).post(target).set('Authorization', other.auth).send(REASON);
      expect(res.status).toBe(403);
    }
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe('ACTIVE');
    expect(await prisma.adminAuditLog.count()).toBe(0);
  });
});

describe('suspension d’un organisateur', () => {
  it('suspend le compte, révoque les sessions, retire les événements publiés et trace', async () => {
    const admin = await account('ADMIN');
    const { organizer, published, draft } = await organizerWithEvents();
    await prisma.refreshToken.create({
      data: {
        userId: organizer.user.id,
        tokenHash: 'a'.repeat(64),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const res = await request(app)
      .post(`/api/v1/admin/users/${organizer.user.id}/suspend`)
      .set('Authorization', admin.auth)
      .send(REASON);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      userId: organizer.user.id,
      status: 'SUSPENDED',
      affectedEvents: 1,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: organizer.user.id } });
    expect(user.status).toBe('SUSPENDED');
    const token = await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(token.revokedAt).not.toBeNull();
    const after = await prisma.event.findUniqueOrThrow({ where: { id: published.id } });
    expect(after).toMatchObject({ status: 'SUSPENDED', suspendedWithOrg: true });
    expect((await prisma.event.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe(
      'DRAFT',
    );
    const logs = await prisma.adminAuditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      adminId: admin.user.id,
      action: 'USER_SUSPENDED',
      targetType: 'USER',
      targetId: organizer.user.id,
      reason: REASON.reason,
      metadata: { suspendedEvents: 1 },
    });
  });

  it('refuse un motif absent ou trop court (400), un id invalide (400), un inconnu (404)', async () => {
    const admin = await account('ADMIN');
    const { organizer } = await organizerWithEvents();
    const post = (id: string, body: object) =>
      request(app)
        .post(`/api/v1/admin/users/${id}/suspend`)
        .set('Authorization', admin.auth)
        .send(body);
    expect((await post(organizer.user.id, {})).status).toBe(400);
    expect((await post(organizer.user.id, { reason: '  abc ' })).status).toBe(400);
    expect((await post('pas-un-uuid', REASON)).status).toBe(400);
    expect((await post('00000000-0000-4000-8000-000000000000', REASON)).status).toBe(404);
    expect(await prisma.adminAuditLog.count()).toBe(0);
  });

  it('409 si déjà suspendu ou si le compte n’est pas organisateur, 403 pour un admin', async () => {
    const admin = await account('ADMIN');
    const { organizer } = await organizerWithEvents();
    const participant = await account('PARTICIPANT');
    const post = (id: string) =>
      request(app)
        .post(`/api/v1/admin/users/${id}/suspend`)
        .set('Authorization', admin.auth)
        .send(REASON);
    expect((await post(organizer.user.id)).status).toBe(200);
    expect((await post(organizer.user.id)).status).toBe(409);
    expect((await post(participant.user.id)).status).toBe(409);
    expect((await post(admin.user.id)).status).toBe(403);
    expect(await prisma.adminAuditLog.count()).toBe(1);
  });

  it('un organisateur suspendu ne peut plus créer ni modifier (jeton encore valide)', async () => {
    const admin = await account('ADMIN');
    const { organizer, draft } = await organizerWithEvents();
    await request(app)
      .post(`/api/v1/admin/users/${organizer.user.id}/suspend`)
      .set('Authorization', admin.auth)
      .send(REASON);

    const create = await request(app)
      .post('/api/v1/events')
      .set('Authorization', organizer.auth)
      .send(validEvent);
    expect(create.status).toBe(403);
    expect(create.body.error.message).toBe('Compte suspendu');
    const update = await request(app)
      .put(`/api/v1/events/${draft.id}`)
      .set('Authorization', organizer.auth)
      .send({ title: 'Nouveau titre' });
    expect(update.status).toBe(403);
    const ticketType = await request(app)
      .post(`/api/v1/events/${draft.id}/ticket-types`)
      .set('Authorization', organizer.auth)
      .send({ name: 'Standard', priceXof: 5000, quantityTotal: 10 });
    expect(ticketType.status).toBe(403);
  });
});

describe('réactivation d’un organisateur', () => {
  it('remet en vente uniquement les événements retirés avec le compte', async () => {
    const admin = await account('ADMIN');
    const { organizer, published } = await organizerWithEvents();
    const apart = await prisma.event.update({
      where: { id: (await factories.event(prisma, organizer.user.id)).id },
      data: { status: 'PUBLISHED' },
    });
    // Suspendu à la main avant le compte : il ne doit pas revenir avec lui.
    await request(app)
      .post(`/api/v1/admin/events/${apart.id}/suspend`)
      .set('Authorization', admin.auth)
      .send(REASON);
    await request(app)
      .post(`/api/v1/admin/users/${organizer.user.id}/suspend`)
      .set('Authorization', admin.auth)
      .send(REASON);

    const res = await request(app)
      .post(`/api/v1/admin/users/${organizer.user.id}/reactivate`)
      .set('Authorization', admin.auth)
      .send({ reason: 'Vérification terminée' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: organizer.user.id, status: 'ACTIVE', affectedEvents: 1 });
    expect((await prisma.event.findUniqueOrThrow({ where: { id: published.id } })).status).toBe(
      'PUBLISHED',
    );
    expect((await prisma.event.findUniqueOrThrow({ where: { id: apart.id } })).status).toBe(
      'SUSPENDED',
    );
    const actions = (await prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'asc' } })).map(
      (log) => log.action,
    );
    expect(actions).toEqual(['EVENT_SUSPENDED', 'USER_SUSPENDED', 'USER_REACTIVATED']);
  });

  it('409 si le compte n’est pas suspendu', async () => {
    const admin = await account('ADMIN');
    const { organizer } = await organizerWithEvents();
    const res = await request(app)
      .post(`/api/v1/admin/users/${organizer.user.id}/reactivate`)
      .set('Authorization', admin.auth)
      .send(REASON);
    expect(res.status).toBe(409);
  });
});

describe('suspension d’un événement', () => {
  it('suspend un événement publié puis le réactive, avec trace', async () => {
    const admin = await account('ADMIN');
    const { published } = await organizerWithEvents();
    const call = (action: 'suspend' | 'reactivate') =>
      request(app)
        .post(`/api/v1/admin/events/${published.id}/${action}`)
        .set('Authorization', admin.auth)
        .send(REASON);

    const first = await call('suspend');
    expect(first.body).toEqual({ eventId: published.id, status: 'SUSPENDED' });
    expect((await call('suspend')).status).toBe(409);
    const back = await call('reactivate');
    expect(back.body).toEqual({ eventId: published.id, status: 'PUBLISHED' });
    expect((await call('reactivate')).status).toBe(409);
    expect(await prisma.adminAuditLog.count()).toBe(2);
  });

  it('refuse de suspendre un brouillon (409) et un événement inconnu (404)', async () => {
    const admin = await account('ADMIN');
    const { draft } = await organizerWithEvents();
    const post = (id: string) =>
      request(app)
        .post(`/api/v1/admin/events/${id}/suspend`)
        .set('Authorization', admin.auth)
        .send(REASON);
    expect((await post(draft.id)).status).toBe(409);
    expect((await post('00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('refuse de réactiver si l’organisateur est suspendu (409)', async () => {
    const admin = await account('ADMIN');
    const { organizer, published } = await organizerWithEvents();
    await prisma.event.update({ where: { id: published.id }, data: { status: 'SUSPENDED' } });
    await prisma.user.update({ where: { id: organizer.user.id }, data: { status: 'SUSPENDED' } });
    const res = await request(app)
      .post(`/api/v1/admin/events/${published.id}/reactivate`)
      .set('Authorization', admin.auth)
      .send(REASON);
    expect(res.status).toBe(409);
  });

  it('bloque les commandes et les paiements, mais pas la modification par l’organisateur', async () => {
    const admin = await account('ADMIN');
    const { organizer, published } = await organizerWithEvents();
    const ticketType = await factories.ticketType(prisma, published.id);
    const buyer = await account('PARTICIPANT');
    const pending = await prisma.order.create({
      data: {
        participantId: buyer.user.id,
        ticketTypeId: ticketType.id,
        quantity: 1,
        unitPriceXof: 5000,
        totalXof: 5000,
        expiresAt: new Date(Date.now() + 600_000),
      },
    });
    await request(app)
      .post(`/api/v1/admin/events/${published.id}/suspend`)
      .set('Authorization', admin.auth)
      .send(REASON);

    const order = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', buyer.auth)
      .send({ ticketTypeId: ticketType.id, quantity: 1 });
    expect(order.status).toBe(409);
    const pay = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', buyer.auth)
      .send({ orderId: pending.id, operator: 'MTN', phone: buyer.user.phone });
    expect(pay.status).toBe(409);
    const update = await request(app)
      .put(`/api/v1/events/${published.id}`)
      .set('Authorization', organizer.auth)
      .send({ title: 'Titre modifié' });
    expect(update.status).toBe(409);
  });
});

describe('listes de commandes et de paiements', () => {
  async function sales() {
    const { published } = await organizerWithEvents();
    const ticketType = await factories.ticketType(prisma, published.id, 50);
    const buyer = await prisma.user.update({
      where: { id: (await factories.user(prisma)).id },
      data: { name: 'Aminata Sossou' },
    });
    const orders = [];
    for (const [i, status] of (['PAID', 'PENDING', 'PAID'] as const).entries()) {
      const order = await prisma.order.create({
        data: {
          participantId: buyer.id,
          ticketTypeId: ticketType.id,
          quantity: 1,
          unitPriceXof: 5000,
          totalXof: 5000,
          status,
          expiresAt: new Date(Date.now() + 600_000),
          createdAt: new Date(Date.now() - (3 - i) * 60_000),
        },
      });
      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: 'fake',
          operator: i === 0 ? 'MOOV' : 'MTN',
          phoneMasked: '0197****47',
          amountXof: 5000,
          status: status === 'PAID' ? 'SUCCEEDED' : 'PENDING',
          createdAt: order.createdAt,
        },
      });
      orders.push(order);
    }
    return { published, buyer, orders };
  }

  it('liste les commandes, filtrées, avec le téléphone masqué', async () => {
    const admin = await account('ADMIN');
    const { published, buyer } = await sales();
    const get = (qs: string) =>
      request(app).get(`/api/v1/admin/orders?${qs}`).set('Authorization', admin.auth);

    const all = await get('');
    expect(all.status).toBe(200);
    expect(all.body.items).toHaveLength(3);
    expect(all.body.items[0]).toMatchObject({
      eventId: published.id,
      participantName: 'Aminata Sossou',
      totalXof: 5000,
    });
    expect(all.body.items[0].participantPhoneMasked).toMatch(/\*\*\*\*/);
    expect(JSON.stringify(all.body)).not.toContain(buyer.phone);

    expect((await get('status=PAID')).body.items).toHaveLength(2);
    expect((await get(`eventId=${published.id}`)).body.items).toHaveLength(3);
    expect((await get('eventId=00000000-0000-4000-8000-000000000000')).body.items).toHaveLength(0);
    expect((await get('status=NOPE')).status).toBe(400);
    expect((await get('limit=51')).status).toBe(400);
    expect((await get('from=2026-12-01&to=2026-11-01')).status).toBe(400);
  });

  it('pagine par curseur du plus récent au plus ancien', async () => {
    const admin = await account('ADMIN');
    const { orders } = await sales();
    const page1 = await request(app)
      .get('/api/v1/admin/orders?limit=2')
      .set('Authorization', admin.auth);
    expect(page1.body.items.map((o: { id: string }) => o.id)).toEqual([
      orders[2]!.id,
      orders[1]!.id,
    ]);
    expect(page1.body.nextCursor).toBe(orders[1]!.id);
    const page2 = await request(app)
      .get(`/api/v1/admin/orders?limit=2&cursor=${page1.body.nextCursor}`)
      .set('Authorization', admin.auth);
    expect(page2.body.items.map((o: { id: string }) => o.id)).toEqual([orders[0]!.id]);
    expect(page2.body.nextCursor).toBeNull();
  });

  it('liste les paiements, filtrés par statut et opérateur', async () => {
    const admin = await account('ADMIN');
    await sales();
    const get = (qs: string) =>
      request(app).get(`/api/v1/admin/payments?${qs}`).set('Authorization', admin.auth);
    const all = await get('');
    expect(all.body.items).toHaveLength(3);
    expect(all.body.items[0]).toMatchObject({ phoneMasked: '0197****47', amountXof: 5000 });
    expect((await get('status=SUCCEEDED')).body.items).toHaveLength(2);
    expect((await get('operator=MOOV')).body.items).toHaveLength(1);
    expect((await get('operator=ORANGE')).status).toBe(400);
  });

  it('réserve les listes aux administrateurs', async () => {
    const organizer = await account('ORGANIZER');
    for (const path of ['orders', 'payments']) {
      expect((await request(app).get(`/api/v1/admin/${path}`)).status).toBe(401);
      const res = await request(app)
        .get(`/api/v1/admin/${path}`)
        .set('Authorization', organizer.auth);
      expect(res.status).toBe(403);
    }
  });
});

describe('export des ventes', () => {
  it('laisse une trace d’audit pour le rapport JSON et le CSV', async () => {
    const admin = await account('ADMIN');
    const { published } = await organizerWithEvents();
    const get = (suffix: string) =>
      request(app)
        .get(`/api/v1/admin/events/${published.id}/${suffix}`)
        .set('Authorization', admin.auth);
    expect((await get('sales')).status).toBe(200);
    expect((await get('sales.csv')).status).toBe(200);
    const logs = await prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.metadata)).toEqual([{ format: 'json' }, { format: 'csv' }]);
    expect(logs.every((l) => l.action === 'SALES_EXPORTED' && l.adminId === admin.user.id)).toBe(
      true,
    );
  });
});
