import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { errorHandler } from '../src/middlewares/error-handler.js';
import { globalRateLimit, scannerRateLimit } from '../src/middlewares/rate-limit.js';
import { ScannerLinksService } from '../src/modules/scanner/scanner-links.service.js';
import { buildQrToken, hashQrToken } from '../src/modules/tickets/qr-token.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/**
 * Validation des QR à l'entrée (NOISE-025, docs/qr-scanner.md sections 3 et 5) : un test par
 * cas du tableau, plus 10 scans simultanés du même billet. Base noise_test.
 */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const SCANNER_SECRET = 'secret-scanner-de-test-assez-long-0123456789';
const QR_SECRET = 'secret-qr-de-test-assez-long-0123456789abcd';
const prisma = createTestPrisma();
const env = loadEnv({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  JWT_ACCESS_SECRET: SECRET,
  SCANNER_JWT_SECRET: SCANNER_SECRET,
  QR_SIGNING_SECRET: QR_SECRET,
});
const links = new ScannerLinksService(prisma, SCANNER_SECRET, null);
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createApp(env, createLogger('silent'), { prisma });
});
afterAll(() => prisma.$disconnect());

const inHours = (hours: number) => new Date(Date.now() + hours * 60 * 60_000);

async function eventWithTicket(options: { status?: 'VALID' | 'USED' | 'CANCELLED' } = {}) {
  const organizer = await factories.user(prisma, ['ORGANIZER']);
  const participant = await factories.user(prisma, ['PARTICIPANT']);
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
      startsAt: inHours(1),
      endsAt: inHours(6),
    },
  });
  const ticketType = await prisma.ticketType.create({
    data: { eventId: event.id, name: 'VIP', priceXof: 10_000, quantityTotal: 10 },
  });
  const order = await factories.order(prisma, participant.id, ticketType.id, 1);
  const ticketId = crypto.randomUUID();
  const qrCode = buildQrToken(ticketId, QR_SECRET);
  await prisma.ticket.create({
    data: {
      id: ticketId,
      orderId: order.id,
      ticketTypeId: ticketType.id,
      eventId: event.id,
      holderName: 'Aminata Sossou',
      qrTokenHash: hashQrToken(qrCode),
      status: options.status ?? 'VALID',
      usedAt: options.status === 'USED' ? new Date('2026-10-15T21:30:00Z') : null,
    },
  });
  const { token } = await links.create(organizer.id, { eventId: event.id, label: 'Porte A' });
  return { event, organizer, ticketId, qrCode, token };
}

const scan = (token: string | null, body: unknown, target = app) => {
  const req = request(target).post('/api/v1/scanner/validate');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send(body as object);
};

describe('POST /api/v1/scanner/validate', () => {
  it('billet valable : ACCEPTED, billet passé à USED avec l’heure d’entrée, scan journalisé', async () => {
    const { ticketId, qrCode, token } = await eventWithTicket();
    const res = await scan(token, { qrCode });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      result: 'ACCEPTED',
      holderName: 'Aminata Sossou',
      ticketTypeName: 'VIP',
    });
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(ticket.status).toBe('USED');
    expect(ticket.usedAt).toBeInstanceOf(Date);
    const logs = await prisma.scanLog.findMany();
    expect(logs).toMatchObject([{ ticketId, result: 'ACCEPTED' }]);
  });

  it('deuxième passage (capture d’écran, réutilisation) : ALREADY_USED avec l’heure de la première entrée', async () => {
    const { qrCode, token } = await eventWithTicket();
    await scan(token, { qrCode });
    const res = await scan(token, { qrCode });
    expect(res.body).toMatchObject({
      result: 'ALREADY_USED',
      holderName: 'Aminata Sossou',
      usedAt: expect.any(String),
    });
  });

  it('QR falsifié (signature modifiée) : INVALID, sans nom ni type', async () => {
    const { qrCode, token, ticketId } = await eventWithTicket();
    const forged = `${qrCode.slice(0, -2)}xx`;
    const res = await scan(token, { qrCode: forged });
    expect(res.body).toEqual({ result: 'INVALID' });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).status).toBe(
      'VALID',
    );
    expect(await prisma.scanLog.findMany()).toMatchObject([{ ticketId: null, result: 'INVALID' }]);
  });

  it('QR bien signé mais billet inconnu : INVALID', async () => {
    const { token } = await eventWithTicket();
    const res = await scan(token, { qrCode: buildQrToken(crypto.randomUUID(), QR_SECRET) });
    expect(res.body).toEqual({ result: 'INVALID' });
  });

  it('billet d’un autre événement : WRONG_EVENT, billet inchangé', async () => {
    const first = await eventWithTicket();
    const other = await eventWithTicket();
    const res = await scan(other.token, { qrCode: first.qrCode });
    expect(res.body).toEqual({
      result: 'WRONG_EVENT',
      holderName: 'Aminata Sossou',
      ticketTypeName: 'VIP',
    });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: first.ticketId } })).status).toBe(
      'VALID',
    );
  });

  it('billet annulé (événement annulé, remboursement) : CANCELLED', async () => {
    const { qrCode, token } = await eventWithTicket({ status: 'CANCELLED' });
    expect((await scan(token, { qrCode })).body).toMatchObject({ result: 'CANCELLED' });
  });

  it('10 scans simultanés du même billet : exactement un ACCEPTED', async () => {
    const { qrCode, token, ticketId } = await eventWithTicket();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => scan(token, { qrCode }).then((r) => r.body.result)),
    );
    expect(results.filter((r) => r === 'ACCEPTED')).toHaveLength(1);
    expect(results.filter((r) => r === 'ALREADY_USED')).toHaveLength(9);
    expect(await prisma.scanLog.count({ where: { ticketId } })).toBe(10);
  });

  it('lien absent, révoqué ou falsifié : 401, rien n’est validé', async () => {
    const { qrCode, token, organizer, ticketId } = await eventWithTicket();
    expect((await scan(null, { qrCode })).status).toBe(401);
    expect((await scan(`${token}x`, { qrCode })).status).toBe(401);
    const [link] = await prisma.scannerLink.findMany();
    await links.revoke(organizer.id, link!.id);
    expect((await scan(token, { qrCode })).status).toBe(401);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).status).toBe(
      'VALID',
    );
  });

  it('corps illisible : 400', async () => {
    const { token } = await eventWithTicket();
    expect((await scan(token, {})).status).toBe(400);
    expect((await scan(token, { qrCode: 'x'.repeat(600) })).status).toBe(400);
  });
});

describe('limites de débit du scan', () => {
  const ok: RequestHandler = (_req, res) => {
    res.json({ ok: true });
  };

  it('la validation échappe à la limite globale par IP (tout le staff partage la box)', async () => {
    const test = express();
    test.use(globalRateLimit({ limit: 1 }));
    test.post('/api/v1/scanner/validate', ok);
    test.post('/api/v1/autre', ok);
    test.use(errorHandler);
    for (let i = 0; i < 3; i++) {
      expect((await request(test).post('/api/v1/scanner/validate')).status).toBe(200);
    }
    expect((await request(test).post('/api/v1/autre')).status).toBe(200);
    expect((await request(test).post('/api/v1/autre')).status).toBe(429);
  });

  it('la validation a sa propre limite, par lien scanner', async () => {
    const test = express();
    test.post(
      '/scan/:link',
      (req, res, next) => {
        res.locals.scannerLink = { linkId: req.params.link };
        next();
      },
      scannerRateLimit({ limit: 2 }),
      ok,
    );
    test.use(errorHandler);
    expect((await request(test).post('/scan/a')).status).toBe(200);
    expect((await request(test).post('/scan/a')).status).toBe(200);
    expect((await request(test).post('/scan/a')).status).toBe(429);
    expect((await request(test).post('/scan/b')).status).toBe(200);
  });
});
