import type { UserRole } from '@noise/shared';
import express from 'express';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { errorHandler } from '../src/middlewares/error-handler.js';
import { createAccessToken, verifyAccessToken } from '../src/modules/auth/tokens.js';
import { requireScannerLink, scannerLinkOf } from '../src/modules/scanner/require-scanner-link.js';
import { ScannerLinksService } from '../src/modules/scanner/scanner-links.service.js';
import { createScannerToken, verifyScannerToken } from '../src/modules/scanner/scanner-token.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/** Liens scanner (NOISE-024) : création, liste, révocation et vérification du jeton. */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const SCANNER_SECRET = 'secret-scanner-de-test-assez-long-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  JWT_ACCESS_SECRET: SECRET,
  SCANNER_JWT_SECRET: SCANNER_SECRET,
  SCANNER_URL: 'https://noise.test/scan/',
});
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createApp(env, createLogger('silent'), { prisma });
});
afterAll(() => prisma.$disconnect());

const HOUR = 60 * 60_000;
const inHours = (hours: number) => new Date(Date.now() + hours * HOUR);

const as = async (user: { id: string; roles: UserRole[] }) => ({
  Authorization: `Bearer ${await createAccessToken({ userId: user.id, roles: user.roles }, SECRET)}`,
});
const organizer = async () => {
  const user = await factories.user(prisma, ['ORGANIZER']);
  return { user, headers: await as(user) };
};

async function eventOf(
  organizerId: string,
  options: {
    status?: 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
    startsAt?: Date;
    endsAt?: Date;
  } = {},
) {
  return prisma.event.create({
    data: {
      organizerId,
      title: 'Soirée Afrobeats',
      description: 'Test',
      genre: 'Afrobeats',
      venue: 'Club',
      city: 'Cotonou',
      startsAt: options.startsAt ?? inHours(24),
      endsAt: options.endsAt ?? inHours(30),
      status: options.status ?? 'PUBLISHED',
    },
  });
}

const create = (headers: Record<string, string>, body: object) =>
  request(app).post('/api/v1/scanner/links').set(headers).send(body);

describe('création d’un lien', () => {
  it('crée un lien limité à l’événement, valable jusqu’à la fin + 2 h par défaut', async () => {
    const { user, headers } = await organizer();
    const event = await eventOf(user.id, { startsAt: inHours(5), endsAt: inHours(10) });

    const res = await create(headers, { eventId: event.id, label: 'Kofi, entrée nord' });

    expect(res.status).toBe(201);
    expect(res.body.link).toMatchObject({
      eventId: event.id,
      label: 'Kofi, entrée nord',
      status: 'ACTIVE',
      revokedAt: null,
    });
    expect(new Date(res.body.link.expiresAt).getTime()).toBe(event.endsAt.getTime() + 2 * HOUR);
    expect(res.body.url).toBe(`https://noise.test/scan/#${res.body.token}`);
    // Le JWT dit à quel événement il donne accès et porte le jti conservé en base.
    const stored = await prisma.scannerLink.findUniqueOrThrow({ where: { id: res.body.link.id } });
    expect(stored.createdById).toBe(user.id);
    expect(await verifyScannerToken(res.body.token, SCANNER_SECRET)).toEqual({
      eventId: event.id,
      jti: stored.jti,
    });
  });

  it('ne conserve pas le jeton en base', async () => {
    const { user, headers } = await organizer();
    const event = await eventOf(user.id);
    const res = await create(headers, { eventId: event.id });
    const rows = await prisma.$queryRaw<unknown[]>`SELECT * FROM scanner_links`;
    expect(JSON.stringify(rows)).not.toContain(res.body.token);
  });

  it('applique la durée choisie, en heures', async () => {
    const { user, headers } = await organizer();
    const event = await eventOf(user.id, { endsAt: inHours(100) });
    const before = Date.now();

    const res = await create(headers, { eventId: event.id, durationHours: 6 });

    const expiresAt = new Date(res.body.link.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 6 * HOUR - 1000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 6 * HOUR + 1000);
  });

  it('plafonne la durée par défaut à 48 h', async () => {
    const { user, headers } = await organizer();
    const event = await eventOf(user.id, { startsAt: inHours(200), endsAt: inHours(210) });

    const res = await create(headers, { eventId: event.id });

    const expiresAt = new Date(res.body.link.expiresAt).getTime();
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 48 * HOUR + 1000);
    expect(expiresAt).toBeGreaterThan(Date.now() + 47 * HOUR);
  });

  it.each([
    ['0 heure', { durationHours: 0 }],
    ['49 heures', { durationHours: 49 }],
    ['durée décimale', { durationHours: 1.5 }],
    ['durée en texte', { durationHours: '6' }],
    ['nom vide', { label: '   ' }],
    ['nom trop long', { label: 'x'.repeat(61) }],
    ['identifiant invalide', { eventId: 'pas-un-uuid' }],
  ])('refuse : %s (400)', async (_label, override) => {
    const { user, headers } = await organizer();
    const event = await eventOf(user.id);
    const res = await create(headers, { eventId: event.id, ...override });
    expect(res.status).toBe(400);
    expect(await prisma.scannerLink.count()).toBe(0);
  });

  it('refuse l’événement d’un autre organisateur (403) ou inconnu (404)', async () => {
    const owner = await organizer();
    const other = await organizer();
    const event = await eventOf(owner.user.id);

    expect((await create(other.headers, { eventId: event.id })).status).toBe(403);
    expect(
      (await create(owner.headers, { eventId: '3f2b8a0e-7c1d-4e55-9a10-2b6f5c0d9e11' })).status,
    ).toBe(404);
    expect(await prisma.scannerLink.count()).toBe(0);
  });

  it('refuse un événement en brouillon, annulé ou terminé (409)', async () => {
    const { user, headers } = await organizer();
    const draft = await eventOf(user.id, { status: 'DRAFT' });
    const cancelled = await eventOf(user.id, { status: 'CANCELLED' });
    const over = await eventOf(user.id, { startsAt: inHours(-10), endsAt: inHours(-3) });

    for (const event of [draft, cancelled, over]) {
      expect((await create(headers, { eventId: event.id })).status, event.status).toBe(409);
    }
    expect(await prisma.scannerLink.count()).toBe(0);
  });

  it('refuse sans connexion (401) et à un participant (403)', async () => {
    const { user } = await organizer();
    const event = await eventOf(user.id);
    expect(
      (await request(app).post('/api/v1/scanner/links').send({ eventId: event.id })).status,
    ).toBe(401);
    const participant = await factories.user(prisma, ['PARTICIPANT']);
    expect((await create(await as(participant), { eventId: event.id })).status).toBe(403);
  });
});

describe('liste des liens d’un événement', () => {
  it('liste les liens avec leur état, le plus récent d’abord', async () => {
    const { user, headers } = await organizer();
    const event = await eventOf(user.id);
    const active = (await create(headers, { eventId: event.id, label: 'Actif' })).body.link;
    const revoked = (await create(headers, { eventId: event.id, label: 'Révoqué' })).body.link;
    const expired = (await create(headers, { eventId: event.id, label: 'Expiré' })).body.link;
    await request(app).delete(`/api/v1/scanner/links/${revoked.id}`).set(headers);
    await prisma.scannerLink.update({
      where: { id: expired.id },
      data: { expiresAt: inHours(-1) },
    });

    const res = await request(app).get(`/api/v1/events/${event.id}/scanner-links`).set(headers);

    expect(res.status).toBe(200);
    const byLabel = new Map(res.body.links.map((l: { label: string }) => [l.label, l] as const));
    expect(byLabel.get('Actif')).toMatchObject({ id: active.id, status: 'ACTIVE' });
    expect(byLabel.get('Révoqué')).toMatchObject({ id: revoked.id, status: 'REVOKED' });
    expect(byLabel.get('Expiré')).toMatchObject({ id: expired.id, status: 'EXPIRED' });
    expect(res.body.links[0].label).toBe('Expiré'); // le plus récent d’abord
    expect(JSON.stringify(res.body)).not.toContain('token');
  });

  it('ne montre que les liens de l’événement demandé', async () => {
    const { user, headers } = await organizer();
    const a = await eventOf(user.id);
    const b = await eventOf(user.id);
    await create(headers, { eventId: a.id });
    await create(headers, { eventId: b.id });

    const res = await request(app).get(`/api/v1/events/${a.id}/scanner-links`).set(headers);
    expect(res.body.links).toHaveLength(1);
    expect(res.body.links[0].eventId).toBe(a.id);
  });

  it('refuse un autre organisateur (403), un événement inconnu (404), un participant (403)', async () => {
    const owner = await organizer();
    const other = await organizer();
    const event = await eventOf(owner.user.id);
    const list = (headers: Record<string, string>, id: string) =>
      request(app).get(`/api/v1/events/${id}/scanner-links`).set(headers);

    expect((await list(other.headers, event.id)).status).toBe(403);
    expect((await list(owner.headers, '3f2b8a0e-7c1d-4e55-9a10-2b6f5c0d9e11')).status).toBe(404);
    const participant = await factories.user(prisma, ['PARTICIPANT']);
    expect((await list(await as(participant), event.id)).status).toBe(403);
    expect((await request(app).get(`/api/v1/events/${event.id}/scanner-links`)).status).toBe(401);
  });
});

describe('révocation', () => {
  it('révoque le lien, sans effet si déjà révoqué', async () => {
    const { user, headers } = await organizer();
    const event = await eventOf(user.id);
    const { link } = (await create(headers, { eventId: event.id })).body;

    const first = await request(app).delete(`/api/v1/scanner/links/${link.id}`).set(headers);
    expect(first.status).toBe(200);
    expect(first.body.link).toMatchObject({ id: link.id, status: 'REVOKED' });
    const revokedAt = first.body.link.revokedAt;
    expect(revokedAt).not.toBeNull();

    const again = await request(app).delete(`/api/v1/scanner/links/${link.id}`).set(headers);
    expect(again.status).toBe(200);
    expect(again.body.link.revokedAt).toBe(revokedAt);
  });

  it('refuse un autre organisateur (403) sans révoquer, un lien inconnu (404), un id invalide (400)', async () => {
    const owner = await organizer();
    const other = await organizer();
    const event = await eventOf(owner.user.id);
    const { link } = (await create(owner.headers, { eventId: event.id })).body;

    expect(
      (await request(app).delete(`/api/v1/scanner/links/${link.id}`).set(other.headers)).status,
    ).toBe(403);
    const stored = await prisma.scannerLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(stored.revokedAt).toBeNull();
    expect(
      (
        await request(app)
          .delete('/api/v1/scanner/links/3f2b8a0e-7c1d-4e55-9a10-2b6f5c0d9e11')
          .set(owner.headers)
      ).status,
    ).toBe(404);
    expect((await request(app).delete('/api/v1/scanner/links/abc').set(owner.headers)).status).toBe(
      400,
    );
  });
});

describe('vérification du jeton (pour la validation des billets, NOISE-025)', () => {
  const service = (now?: () => Date) => new ScannerLinksService(prisma, SCANNER_SECRET, null, now);

  async function activeLink() {
    const { user, headers } = await organizer();
    const event = await eventOf(user.id);
    const res = await create(headers, { eventId: event.id, label: 'Ama' });
    return { user, headers, event, link: res.body.link, token: res.body.token as string };
  }

  it('accepte un lien valide et renvoie son événement', async () => {
    const { event, link, token } = await activeLink();
    expect(await service().authenticate(token)).toEqual({
      linkId: link.id,
      eventId: event.id,
      label: 'Ama',
    });
  });

  it('refuse un lien révoqué, aussitôt', async () => {
    const { headers, link, token } = await activeLink();
    expect(await service().authenticate(token)).not.toBeNull();
    await request(app).delete(`/api/v1/scanner/links/${link.id}`).set(headers);
    expect(await service().authenticate(token)).toBeNull();
  });

  it('refuse un lien expiré', async () => {
    const { token } = await activeLink();
    expect(await service(() => inHours(60)).authenticate(token)).toBeNull();
  });

  it('refuse un lien expiré en base même si le jeton court encore', async () => {
    const { link, token } = await activeLink();
    await prisma.scannerLink.update({ where: { id: link.id }, data: { expiresAt: inHours(-1) } });
    expect(await service().authenticate(token)).toBeNull();
  });

  it('refuse un jeton falsifié, signé avec un autre secret ou sans lien en base', async () => {
    const { event, token } = await activeLink();
    const jti = '9c1d5e22-0b7a-4c3f-8d4e-6a1b2c3d4e5f';
    const unknown = await createScannerToken(
      { eventId: event.id, jti },
      inHours(5),
      SCANNER_SECRET,
    );
    const otherSecret = await createScannerToken(
      { eventId: event.id, jti },
      inHours(5),
      'un-autre-secret-0123456789abcdef0123',
    );
    const tampered = `${token.slice(0, -2)}${token.endsWith('AA') ? 'BB' : 'AA'}`;

    for (const bad of [unknown, otherSecret, tampered, '', 'abc.def.ghi']) {
      expect(await service().authenticate(bad), bad.slice(0, 12)).toBeNull();
    }
  });

  it('refuse un jeton dont l’événement ne correspond pas au lien', async () => {
    const { user, link } = await activeLink();
    const stored = await prisma.scannerLink.findUniqueOrThrow({ where: { id: link.id } });
    const otherEvent = await eventOf(user.id);
    const forged = await createScannerToken(
      { eventId: otherEvent.id, jti: stored.jti },
      inHours(5),
      SCANNER_SECRET,
    );
    expect(await service().authenticate(forged)).toBeNull();
  });

  it('refuse un jeton scanner dont le JWT est expiré', async () => {
    const { event, link } = await activeLink();
    const stored = await prisma.scannerLink.findUniqueOrThrow({ where: { id: link.id } });
    const past = await createScannerToken(
      { eventId: event.id, jti: stored.jti },
      inHours(-1),
      SCANNER_SECRET,
      inHours(-5),
    );
    expect(await service().authenticate(past)).toBeNull();
  });

  it('ne se confond pas avec un access token, dans aucun sens', async () => {
    const { user, token } = await activeLink();
    const access = await createAccessToken({ userId: user.id, roles: ['ORGANIZER'] }, SECRET);

    expect(await service().authenticate(access)).toBeNull();
    expect(await verifyAccessToken(token, SECRET)).toBeNull();
    // Même signé avec le même secret, l'audience différente le refuse.
    const sameSecret = await createScannerToken(
      {
        eventId: '3f2b8a0e-7c1d-4e55-9a10-2b6f5c0d9e11',
        jti: '9c1d5e22-0b7a-4c3f-8d4e-6a1b2c3d4e5f',
      },
      inHours(1),
      SECRET,
    );
    expect(await verifyAccessToken(sameSecret, SECRET)).toBeNull();
    // Un jeton qui a les bonnes informations mais une autre audience est refusé par le scanner.
    const wrongAudience = await new SignJWT({
      eventId: '3f2b8a0e-7c1d-4e55-9a10-2b6f5c0d9e11',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('noise-api')
      .setAudience('noise-app')
      .setJti('9c1d5e22-0b7a-4c3f-8d4e-6a1b2c3d4e5f')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SCANNER_SECRET));
    expect(await verifyScannerToken(wrongAudience, SCANNER_SECRET)).toBeNull();
    // Et le jeton scanner n'ouvre aucune route de l'application.
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('le garde requireScannerLink laisse passer un lien valide et refuse le reste (401)', async () => {
    const { event, link, token } = await activeLink();
    const probe = express();
    probe.get('/probe', requireScannerLink(service()), (_req, res) => {
      res.json({ access: scannerLinkOf(res) });
    });
    probe.use(errorHandler);

    const ok = await request(probe).get('/probe').set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.access).toMatchObject({ linkId: link.id, eventId: event.id });
    expect((await request(probe).get('/probe')).status).toBe(401);
    expect(
      (await request(probe).get('/probe').set('Authorization', 'Bearer nimporte')).status,
    ).toBe(401);
    expect((await request(probe).get('/probe').set('Authorization', token)).status).toBe(401);
  });
});

describe('configuration', () => {
  const base = { NODE_ENV: 'development', JWT_ACCESS_SECRET: SECRET } as const;

  it('exige SCANNER_JWT_SECRET (32 caractères minimum) hors des tests', () => {
    expect(() => loadEnv(base)).toThrow(/SCANNER_JWT_SECRET/);
    expect(() => loadEnv({ ...base, SCANNER_JWT_SECRET: 'court' })).toThrow(/SCANNER_JWT_SECRET/);
    expect(loadEnv({ ...base, SCANNER_JWT_SECRET: SCANNER_SECRET }).SCANNER_JWT_SECRET).toBe(
      SCANNER_SECRET,
    );
  });

  it('refuse le même secret que les access tokens', () => {
    expect(() => loadEnv({ ...base, SCANNER_JWT_SECRET: SECRET })).toThrow(/différer/);
  });

  it('sans secret (tests), les routes ne sont pas montées', async () => {
    const bare = createApp(
      loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET }),
      createLogger('silent'),
      { prisma },
    );
    const { headers } = await organizer();
    const res = await request(bare).post('/api/v1/scanner/links').set(headers).send({});
    expect(res.status).toBe(404);
  });

  it('sans SCANNER_URL, la réponse ne contient pas d’url', async () => {
    const noUrl = createApp(
      loadEnv({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        JWT_ACCESS_SECRET: SECRET,
        SCANNER_JWT_SECRET: SCANNER_SECRET,
      }),
      createLogger('silent'),
      { prisma },
    );
    const { user, headers } = await organizer();
    const event = await eventOf(user.id);
    const res = await request(noUrl)
      .post('/api/v1/scanner/links')
      .set(headers)
      .send({ eventId: event.id });
    expect(res.status).toBe(201);
    expect(res.body.url).toBeNull();
    expect(typeof res.body.token).toBe('string');
  });
});
