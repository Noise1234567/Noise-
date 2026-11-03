import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { hashPassword } from '../src/modules/auth/password.js';
import {
  DEMO_DEFAULT_PASSWORD,
  DemoSeedRefused,
  databaseNameOf,
  planDemoSeed,
} from '../src/modules/demo/demo-guard.js';
import { seedDemo } from '../src/modules/demo/demo-seed.js';
import { buildQrToken, hashQrToken } from '../src/modules/tickets/qr-token.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/** Données de démonstration (NOISE-058). Base : noise_test. */

// Le jeu compte environ 500 écritures : plusieurs secondes, bien plus sur un poste chargé.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const QR_SECRET = 'secret-qr-de-test-assez-long-pour-hmac-0123456789';
const JWT_SECRET = 'secret-jwt-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const NOW = new Date('2026-10-26T10:00:00Z');

let passwordHash: string;
const run = (withAdmin = true) =>
  seedDemo({ prisma, qrSigningSecret: QR_SECRET, passwordHash, withAdmin, now: NOW });

/** Compte « réel » : hors de la plage de numéros réservée à la démo (les fabriques de test y entrent). */
let realCounter = 0;
const realUser = (role: 'PARTICIPANT' | 'ORGANIZER') =>
  prisma.user.create({
    data: {
      name: 'Utilisateur réel',
      phone: `+22901970${String(++realCounter).padStart(7, '0')}`,
      passwordHash: 'x',
      role,
    },
  });

beforeEach(async () => {
  await resetDatabase(prisma);
  passwordHash ??= await hashPassword(DEMO_DEFAULT_PASSWORD);
});
afterAll(() => prisma.$disconnect());

describe('contenu du jeu de démonstration', () => {
  it('couvre tous les états d’événement, d’identité et de billet', async () => {
    await run();

    const events = await prisma.event.findMany({ select: { title: true, status: true } });
    const statuses = new Set(events.map((event) => event.status));
    expect(statuses).toEqual(new Set(['DRAFT', 'PUBLISHED', 'CANCELLED', 'SUSPENDED']));

    const identities = await prisma.identityVerification.findMany({ select: { status: true } });
    expect(new Set(identities.map((identity) => identity.status))).toEqual(
      new Set(['VERIFIED', 'PENDING', 'REFUSED']),
    );

    const tickets = await prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } });
    expect(new Set(tickets.map((row) => row.status))).toEqual(
      new Set(['VALID', 'USED', 'CANCELLED']),
    );

    const orders = await prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
    expect(new Set(orders.map((row) => row.status))).toEqual(
      new Set(['PAID', 'PENDING', 'EXPIRED', 'FAILED', 'CANCELLED']),
    );

    const results = await prisma.scanLog.groupBy({ by: ['result'] });
    expect(new Set(results.map((row) => row.result))).toEqual(
      new Set(['ACCEPTED', 'ALREADY_USED', 'INVALID']),
    );
  });

  it('contient un événement complet, un presque complet, un annulé et un passé scanné', async () => {
    await run();
    const types = await prisma.ticketType.findMany({ include: { event: true } });
    const soldOut = types.find((type) => type.event.title === 'Reggae Sunset Festival');
    expect(soldOut?.quantitySold).toBe(soldOut?.quantityTotal);
    const low = types.find(
      (type) => type.event.title === 'Zouk & R&B Lovers' && type.name === 'Solo',
    );
    expect(low && low.quantityTotal - low.quantitySold).toBeLessThanOrEqual(
      Math.floor(low!.quantityTotal * 0.2),
    );

    const cancelled = await prisma.event.findFirstOrThrow({
      where: { status: 'CANCELLED' },
      include: { cancellation: true },
    });
    expect(cancelled.cancellation?.salesXof).toBeGreaterThan(0);
    expect(cancelled.cancellation?.cancellationFeeXof).toBe(
      Math.floor((cancelled.cancellation?.salesXof ?? 0) / 10),
    );
    expect(await prisma.ticket.count({ where: { eventId: cancelled.id, status: 'VALID' } })).toBe(
      0,
    );

    const past = await prisma.event.findFirstOrThrow({
      where: { title: 'Gala Amapiano Haie Vive' },
    });
    expect(
      await prisma.ticket.count({ where: { eventId: past.id, status: 'USED' } }),
    ).toBeGreaterThan(50);
  });

  it('garde des compteurs de ventes égaux aux commandes payées', async () => {
    await run();
    for (const type of await prisma.ticketType.findMany()) {
      const paid = await prisma.order.aggregate({
        where: {
          ticketTypeId: type.id,
          status: { in: ['PAID', 'CANCELLED'] },
          paidAt: { not: null },
        },
        _sum: { quantity: true },
      });
      expect(type.quantitySold).toBe(paid._sum.quantity ?? 0);
      expect(type.quantitySold).toBeLessThanOrEqual(type.quantityTotal);
    }
    for (const event of await prisma.event.findMany({ include: { ticketTypes: true } })) {
      const total = event.ticketTypes.reduce((sum, type) => sum + type.quantityTotal, 0);
      expect(total).toBeLessThanOrEqual(event.capacity);
    }
  });

  it('crée de vrais QR : chaque billet a l’empreinte du QR signé avec le secret', async () => {
    await run();
    const tickets = await prisma.ticket.findMany({ select: { id: true, qrTokenHash: true } });
    expect(tickets.length).toBeGreaterThan(100);
    for (const ticket of tickets) {
      expect(ticket.qrTokenHash).toBe(hashQrToken(buildQrToken(ticket.id, QR_SECRET)));
    }
  });

  it('ne crée le compte administrateur que sur demande', async () => {
    await run(false);
    expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(0);
    expect(await prisma.adminAuditLog.count()).toBe(0);
    await run(true);
    expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(1);
    expect(await prisma.adminAuditLog.count()).toBeGreaterThan(0);
  });
});

describe('rejouable', () => {
  it('rejoué deux fois, donne le même résultat sans erreur', async () => {
    const first = await run();
    const second = await run();
    expect(second).toMatchObject({
      users: first.users,
      events: first.events,
      ticketTypes: first.ticketTypes,
      orders: first.orders,
      tickets: first.tickets,
      scans: first.scans,
    });
    expect(await prisma.user.count()).toBe(first.users);
    expect(await prisma.event.count()).toBe(first.events);
  });

  it('ne touche pas aux données réelles', async () => {
    const organizer = await realUser('ORGANIZER');
    const buyer = await realUser('PARTICIPANT');
    const event = await factories.event(prisma, organizer.id);
    const type = await factories.ticketType(prisma, event.id);
    await run();
    await run();
    expect(await prisma.user.findUnique({ where: { id: organizer.id } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: buyer.id } })).not.toBeNull();
    expect(await prisma.ticketType.findUnique({ where: { id: type.id } })).not.toBeNull();
  });

  it('supprime l’achat qu’un testeur a fait avec un compte de démo sur un événement réel', async () => {
    const organizer = await realUser('ORGANIZER');
    const event = await factories.event(prisma, organizer.id);
    const type = await factories.ticketType(prisma, event.id, 10);
    await run();
    const demoBuyer = await prisma.user.findFirstOrThrow({ where: { phone: '+2290100000002' } });
    const order = await factories.order(prisma, demoBuyer.id, type.id, 2);
    await prisma.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: NOW } });
    await prisma.ticketType.update({ where: { id: type.id }, data: { quantitySold: 2 } });

    await run();
    expect(await prisma.order.count({ where: { ticketTypeId: type.id } })).toBe(0);
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).quantitySold,
    ).toBe(0);
  });
});

describe('utilisation par l’application', () => {
  const env = loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    JWT_ACCESS_SECRET: JWT_SECRET,
    QR_SIGNING_SECRET: QR_SECRET,
  });
  const app = () => createApp(env, createLogger('silent'), { prisma });
  // Un compte par rôle (DEC-029) : la connexion précise le rôle du compte.
  const login = (phone: string, role: 'PARTICIPANT' | 'ORGANIZER' | 'ADMIN') =>
    request(app())
      .post('/api/v1/auth/login')
      .send({ phone, password: DEMO_DEFAULT_PASSWORD, role });

  it('les comptes de démo peuvent se connecter, sauf le compte suspendu', async () => {
    await run();
    expect((await login('+2290100000001', 'ORGANIZER')).status).toBe(200);
    expect((await login('+2290100000002', 'PARTICIPANT')).status).toBe(200);
    expect((await login('+2290100000012', 'ADMIN')).status).toBe(200);
    expect((await login('+2290100000011', 'PARTICIPANT')).status).not.toBe(200);
  });

  it('la participante de démo voit ses billets et l’organisateur voit ses statistiques', async () => {
    await run();
    const aminata = await login('+2290100000002', 'PARTICIPANT');
    const tickets = await request(app())
      .get('/api/v1/tickets/mine')
      .set('Authorization', `Bearer ${aminata.body.accessToken}`);
    expect(tickets.status).toBe(200);
    expect(JSON.stringify(tickets.body)).toContain('NOISE1.');

    const kofi = await login('+2290100000001', 'ORGANIZER');
    const past = await prisma.event.findFirstOrThrow({
      where: { title: 'Gala Amapiano Haie Vive' },
    });
    const stats = await request(app())
      .get(`/api/v1/events/${past.id}/stats`)
      .set('Authorization', `Bearer ${kofi.body.accessToken}`);
    expect(stats.status).toBe(200);
    expect(stats.body.stats.entries.checkedIn).toBeGreaterThan(50);
    expect(stats.body.stats.sales.ticketsSold).toBe(118);
  });
});

describe('garde-fous', () => {
  const DEV = 'postgresql://noise:noise@localhost:5432/noise_dev';
  const STAGING = 'postgresql://noise:secret@db:5432/noise_staging';

  it('lit le nom de la base dans l’URL', () => {
    expect(databaseNameOf(`${DEV}?schema=public`)).toBe('noise_dev');
    expect(databaseNameOf('pas une url')).toBeNull();
  });

  it('local : noise_dev, administrateur de développement, mot de passe par défaut', () => {
    expect(planDemoSeed({ DATABASE_URL: DEV })).toEqual({
      databaseName: 'noise_dev',
      withAdmin: true,
      password: DEMO_DEFAULT_PASSWORD,
    });
  });

  it('staging : mot de passe obligatoire, pas d’administrateur', () => {
    expect(() => planDemoSeed({ NODE_ENV: 'staging', DATABASE_URL: STAGING })).toThrow(
      DemoSeedRefused,
    );
    expect(() =>
      planDemoSeed({ NODE_ENV: 'staging', DATABASE_URL: STAGING, DEMO_PASSWORD: 'court' }),
    ).toThrow(/au moins 8/);
    expect(
      planDemoSeed({
        NODE_ENV: 'staging',
        DATABASE_URL: STAGING,
        DEMO_PASSWORD: 'un-mot-de-passe',
      }),
    ).toEqual({ databaseName: 'noise_staging', withAdmin: false, password: 'un-mot-de-passe' });
  });

  it('refuse la production et toute autre base', () => {
    expect(() => planDemoSeed({ NODE_ENV: 'production', DATABASE_URL: DEV })).toThrow(/production/);
    expect(() =>
      planDemoSeed({ DATABASE_URL: 'postgresql://noise@db:5432/noise_production' }),
    ).toThrow(DemoSeedRefused);
    expect(() => planDemoSeed({ DATABASE_URL: 'postgresql://noise@db:5432/noise_test' })).toThrow(
      DemoSeedRefused,
    );
    expect(() => planDemoSeed({})).toThrow(DemoSeedRefused);
  });
});
