import { createHash } from 'node:crypto';
import type { UserRole } from '@noise/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { createAccessToken } from '../src/modules/auth/tokens.js';
import { buildQrToken, hashQrToken, verifyQrToken } from '../src/modules/tickets/qr-token.js';
import { createTicketIssuer } from '../src/modules/tickets/ticket-issuer.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/** Billets et QR signés (NOISE-020) : de la commande gratuite à GET /tickets/mine. */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const QR_SECRET = 'secret-qr-de-test-assez-long-0123456789abcdef';
const prisma = createTestPrisma();
const baseEnv = { NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET } as const;
const env = loadEnv({ ...baseEnv, QR_SIGNING_SECRET: QR_SECRET });
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createApp(env, createLogger('silent'), { prisma });
});
afterAll(() => prisma.$disconnect());

const DAY = 24 * 60 * 60_000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);

const as = async (user: { id: string; roles: UserRole[] }) => ({
  Authorization: `Bearer ${await createAccessToken({ userId: user.id, roles: user.roles }, SECRET)}`,
});
const buyer = async () => {
  const user = await factories.user(prisma, ['PARTICIPANT']);
  return { user, headers: await as(user) };
};

async function setupEvent(
  options: { priceXof?: number; startsInDays?: number; title?: string } = {},
) {
  const organizer = await factories.user(prisma, ['ORGANIZER']);
  const event = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: options.title ?? 'Soirée Afrobeats',
      description: 'Test',
      genre: 'Afrobeats',
      venue: 'Club',
      city: 'Cotonou',
      startsAt: inDays(options.startsInDays ?? 5),
      endsAt: inDays((options.startsInDays ?? 5) + 1),
      status: 'PUBLISHED',
    },
  });
  const ticketType = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: 'Standard',
      priceXof: options.priceXof ?? 0,
      quantityTotal: 50,
    },
  });
  return { event, ticketType };
}

const order = (headers: Record<string, string>, ticketTypeId: string, quantity: number) =>
  request(app).post('/api/v1/orders').set(headers).send({ ticketTypeId, quantity });
const mine = (headers: Record<string, string>) =>
  request(app).get('/api/v1/tickets/mine').set(headers);

describe('format et signature du QR', () => {
  const id = '3f2b8a0e-7c1d-4e55-9a10-2b6f5c0d9e11';

  it('a la forme NOISE1.<billet>.<aléa>.<signature> et ne change pas d’un appel à l’autre', () => {
    const token = buildQrToken(id, QR_SECRET);
    const [prefix, ticketId, random, signature] = token.split('.');
    expect(prefix).toBe('NOISE1');
    expect(ticketId).toBe(id);
    expect(random).toMatch(/^[0-9a-f]{32}$/); // 128 bits
    expect(signature).toMatch(/^[A-Za-z0-9_-]{22}$/); // 128 bits en base64url
    expect(buildQrToken(id, QR_SECRET)).toBe(token);
  });

  it('deux billets n’ont jamais le même QR', () => {
    const other = '9c1d5e22-0b7a-4c3f-8d4e-6a1b2c3d4e5f';
    expect(buildQrToken(id, QR_SECRET)).not.toBe(buildQrToken(other, QR_SECRET));
  });

  it('accepte un QR authentique', () => {
    expect(verifyQrToken(buildQrToken(id, QR_SECRET), QR_SECRET)).toEqual({ ticketId: id });
  });

  it('rejette un QR falsifié', () => {
    const [prefix, ticketId, random, signature] = buildQrToken(id, QR_SECRET).split('.') as [
      string,
      string,
      string,
      string,
    ];
    const other = '9c1d5e22-0b7a-4c3f-8d4e-6a1b2c3d4e5f';
    const forged = [
      ['autre billet', [prefix, other, random, signature]],
      ['autre aléa', [prefix, ticketId, 'a'.repeat(32), signature]],
      ['signature modifiée', [prefix, ticketId, random, `${signature.slice(0, -1)}A`]],
      ['signature vide', [prefix, ticketId, random, '']],
      ['autre préfixe', ['NOISE2', ticketId, random, signature]],
      ['partie manquante', [prefix, ticketId, random]],
      ['partie en trop', [prefix, ticketId, random, signature, 'x']],
    ] as const;
    for (const [label, parts] of forged) {
      expect(verifyQrToken(parts.join('.'), QR_SECRET), label).toBeNull();
    }
    expect(verifyQrToken('', QR_SECRET)).toBeNull();
    expect(verifyQrToken('n’importe quoi', QR_SECRET)).toBeNull();
  });

  it('rejette un QR signé avec un autre secret', () => {
    expect(
      verifyQrToken(buildQrToken(id, 'un-autre-secret-0123456789abcdef0123'), QR_SECRET),
    ).toBeNull();
  });

  it('l’empreinte est le SHA-256 hexadécimal du QR', () => {
    const token = buildQrToken(id, QR_SECRET);
    expect(hashQrToken(token)).toBe(createHash('sha256').update(token).digest('hex'));
    expect(hashQrToken(token)).toHaveLength(64);
  });
});

describe('billets d’une commande gratuite', () => {
  it('crée un billet par place, chacun avec son QR, au nom de l’acheteur', async () => {
    const { event, ticketType } = await setupEvent();
    const { user, headers } = await buyer();

    const res = await order(headers, ticketType.id, 3);
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('PAID');

    const tickets = await prisma.ticket.findMany({ where: { orderId: res.body.order.id } });
    expect(tickets).toHaveLength(3);
    expect(new Set(tickets.map((t) => t.qrTokenHash)).size).toBe(3);
    for (const ticket of tickets) {
      expect(ticket).toMatchObject({
        eventId: event.id,
        ticketTypeId: ticketType.id,
        holderName: user.name,
        status: 'VALID',
        usedAt: null,
      });
    }
  });

  it('ne crée aucun billet pour une commande à payer (en attente)', async () => {
    const { ticketType } = await setupEvent({ priceXof: 5000 });
    const { headers } = await buyer();
    const res = await order(headers, ticketType.id, 2);
    expect(res.body.order.status).toBe('PENDING');
    expect(await prisma.ticket.count()).toBe(0);
  });

  it('n’enregistre jamais le QR lui-même, seulement son empreinte', async () => {
    const { ticketType } = await setupEvent();
    const { headers } = await buyer();
    await order(headers, ticketType.id, 1);

    const [payload] = (await mine(headers)).body.tickets.map(
      (t: { qrPayload: string }) => t.qrPayload,
    );
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`SELECT * FROM tickets`;
    expect(JSON.stringify(rows)).not.toContain(payload);
    expect(rows[0]?.qr_token_hash).toBe(hashQrToken(payload));
  });
});

describe('GET /tickets/mine', () => {
  it('renvoie les billets du participant avec le contenu exact du QR', async () => {
    const { event, ticketType } = await setupEvent({ title: 'Nuit Électro' });
    const { user, headers } = await buyer();
    await order(headers, ticketType.id, 2);

    const res = await mine(headers);

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(2);
    for (const ticket of res.body.tickets) {
      expect(ticket).toMatchObject({
        eventId: event.id,
        eventTitle: 'Nuit Électro',
        venue: 'Club',
        city: 'Cotonou',
        ticketTypeName: 'Standard',
        holderName: user.name,
        status: 'VALID',
        usedAt: null,
      });
      expect(verifyQrToken(ticket.qrPayload, QR_SECRET)).toEqual({ ticketId: ticket.id });
      const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(stored.qrTokenHash).toBe(hashQrToken(ticket.qrPayload));
    }
    // Le même QR à chaque appel : le participant le retrouve sur un nouveau téléphone.
    expect(
      (await mine(headers)).body.tickets.map((t: { qrPayload: string }) => t.qrPayload).sort(),
    ).toEqual(res.body.tickets.map((t: { qrPayload: string }) => t.qrPayload).sort());
  });

  it('ne montre jamais les billets d’un autre participant', async () => {
    const { ticketType } = await setupEvent();
    const alice = await buyer();
    const bob = await buyer();
    await order(alice.headers, ticketType.id, 2);
    await order(bob.headers, ticketType.id, 1);

    expect((await mine(alice.headers)).body.tickets).toHaveLength(2);
    expect((await mine(bob.headers)).body.tickets).toHaveLength(1);
    const stranger = await buyer();
    expect((await mine(stranger.headers)).body.tickets).toEqual([]);
  });

  it('classe les événements les plus proches d’abord', async () => {
    const later = await setupEvent({ title: 'Plus tard', startsInDays: 20 });
    const sooner = await setupEvent({ title: 'Bientôt', startsInDays: 3 });
    const { headers } = await buyer();
    await order(headers, later.ticketType.id, 1);
    await order(headers, sooner.ticketType.id, 1);

    const titles = (await mine(headers)).body.tickets.map(
      (t: { eventTitle: string }) => t.eventTitle,
    );
    expect(titles).toEqual(['Bientôt', 'Plus tard']);
  });

  it('reflète l’état du billet (utilisé, annulé)', async () => {
    const { ticketType } = await setupEvent();
    const { headers } = await buyer();
    await order(headers, ticketType.id, 2);
    const [first, second] = await prisma.ticket.findMany({ orderBy: { id: 'asc' } });
    const usedAt = new Date();
    await prisma.ticket.update({ where: { id: first!.id }, data: { status: 'USED', usedAt } });
    await prisma.ticket.update({ where: { id: second!.id }, data: { status: 'CANCELLED' } });

    const byId = new Map(
      (await mine(headers)).body.tickets.map((t: { id: string }) => [t.id, t] as const),
    );
    expect(byId.get(first!.id)).toMatchObject({ status: 'USED', usedAt: usedAt.toISOString() });
    expect(byId.get(second!.id)).toMatchObject({ status: 'CANCELLED', usedAt: null });
  });

  it('refuse sans connexion (401) et à un organisateur (403)', async () => {
    expect((await request(app).get('/api/v1/tickets/mine')).status).toBe(401);
    const organizer = await factories.user(prisma, ['ORGANIZER']);
    expect((await mine(await as(organizer))).status).toBe(403);
  });
});

describe('création des billets d’une commande payée (point d’accroche du paiement)', () => {
  async function paidOrder(quantity: number) {
    const { event, ticketType } = await setupEvent({ priceXof: 5000 });
    const { user } = await buyer();
    const created = await prisma.order.create({
      data: {
        participantId: user.id,
        ticketTypeId: ticketType.id,
        quantity,
        unitPriceXof: 5000,
        totalXof: 5000 * quantity,
        status: 'PAID',
        paidAt: new Date(),
        noiseShareXof: 0,
        affiliateShareXof: 0,
        organizerShareXof: 5000 * quantity,
        expiresAt: inDays(1),
      },
    });
    return {
      orderId: created.id,
      eventId: event.id,
      ticketTypeId: ticketType.id,
      participantId: user.id,
      holderName: user.name,
      quantity,
    };
  }

  it('crée les billets, une seule fois même si la confirmation est rejouée', async () => {
    const issue = createTicketIssuer(QR_SECRET);
    const paid = await paidOrder(4);

    await prisma.$transaction((tx) => issue(tx, paid));
    await prisma.$transaction((tx) => issue(tx, paid)); // webhook reçu deux fois

    expect(await prisma.ticket.count({ where: { orderId: paid.orderId } })).toBe(4);
  });

  it('annule tout si la transaction échoue : pas de paiement confirmé sans billets', async () => {
    const issue = createTicketIssuer(QR_SECRET);
    const paid = await paidOrder(2);

    await expect(
      prisma.$transaction(async (tx) => {
        await issue(tx, paid);
        throw new Error('échec après la création des billets');
      }),
    ).rejects.toThrow();

    expect(await prisma.ticket.count()).toBe(0);
  });
});

describe('configuration', () => {
  it('exige QR_SIGNING_SECRET (32 caractères minimum) hors des tests', () => {
    const prod = { NODE_ENV: 'development', JWT_ACCESS_SECRET: SECRET } as const;
    expect(() => loadEnv(prod)).toThrow(/QR_SIGNING_SECRET/);
    expect(() => loadEnv({ ...prod, QR_SIGNING_SECRET: 'court' })).toThrow(/QR_SIGNING_SECRET/);
    expect(loadEnv({ ...prod, QR_SIGNING_SECRET: QR_SECRET }).QR_SIGNING_SECRET).toBe(QR_SECRET);
  });

  it('sans secret (tests), les commandes gratuites fonctionnent sans billets', async () => {
    const bare = createApp(loadEnv(baseEnv), createLogger('silent'), { prisma });
    const { ticketType } = await setupEvent();
    const { headers } = await buyer();
    const res = await request(bare)
      .post('/api/v1/orders')
      .set(headers)
      .send({ ticketTypeId: ticketType.id, quantity: 1 });
    expect(res.status).toBe(201);
    expect(await prisma.ticket.count()).toBe(0);
    expect((await request(bare).get('/api/v1/tickets/mine').set(headers)).status).toBe(404);
  });
});
