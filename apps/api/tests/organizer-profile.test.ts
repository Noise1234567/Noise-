import type { UserRole } from '@noise/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { createAccessToken } from '../src/modules/auth/tokens.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/** Profil public de l'organisateur (NOISE-061) : WhatsApp et réseaux, visibles sur ses événements. */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET });
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createApp(env, createLogger('silent'), { prisma });
});
afterAll(() => prisma.$disconnect());

const PATH = '/api/v1/me/organizer-profile';
const bearer = async (user: { id: string; roles: UserRole[] }) =>
  `Bearer ${await createAccessToken({ userId: user.id, roles: user.roles }, SECRET)}`;
const EMPTY = { whatsapp: null, instagram: null, facebook: null, tiktok: null };

describe('GET et PUT /me/organizer-profile', () => {
  it('profil vide au départ, puis enregistré et normalisé', async () => {
    const auth = await bearer(await factories.user(prisma, ['ORGANIZER']));
    expect((await request(app).get(PATH).set('Authorization', auth)).body).toEqual({
      profile: EMPTY,
    });

    const res = await request(app).put(PATH).set('Authorization', auth).send({
      whatsapp: '01 97 45 45 47',
      instagram: '@kofi.events',
      facebook: 'facebook.com/kofi.events',
      tiktok: '',
    });
    expect(res.status).toBe(200);
    const expected = {
      whatsapp: '+2290197454547',
      instagram: 'https://www.instagram.com/kofi.events',
      facebook: 'https://facebook.com/kofi.events',
      tiktok: null,
    };
    expect(res.body.profile).toEqual(expected);
    expect((await request(app).get(PATH).set('Authorization', auth)).body.profile).toEqual(
      expected,
    );
  });

  it('PUT remplace tout : un champ absent est effacé', async () => {
    const auth = await bearer(await factories.user(prisma, ['ORGANIZER']));
    await request(app)
      .put(PATH)
      .set('Authorization', auth)
      .send({ whatsapp: '0197454547', instagram: '@kofi' });
    const res = await request(app)
      .put(PATH)
      .set('Authorization', auth)
      .send({ instagram: '@kofi' });
    expect(res.body.profile).toEqual({ ...EMPTY, instagram: 'https://www.instagram.com/kofi' });
  });

  it('400 avec le détail : numéro invalide, lien d’un autre site', async () => {
    const auth = await bearer(await factories.user(prisma, ['ORGANIZER']));
    const res = await request(app).put(PATH).set('Authorization', auth).send({
      whatsapp: '123',
      instagram: 'https://evil.example.com/kofi',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { path: 'whatsapp', message: 'Numéro WhatsApp béninois invalide' },
      { path: 'instagram', message: 'Lien Instagram invalide' },
    ]);
    expect(await prisma.organizerProfile.count()).toBe(0);
  });

  it('401 sans jeton, 403 pour un participant', async () => {
    expect((await request(app).get(PATH)).status).toBe(401);
    const auth = await bearer(await factories.user(prisma, ['PARTICIPANT']));
    expect((await request(app).get(PATH).set('Authorization', auth)).status).toBe(403);
    expect(
      (await request(app).put(PATH).set('Authorization', auth).send({ instagram: '@x' })).status,
    ).toBe(403);
  });
});

describe('contacts sur les événements', () => {
  it('le participant voit les contacts renseignés de l’organisateur (liste et détail)', async () => {
    const organizer = await factories.user(prisma, ['ORGANIZER']);
    const event = await prisma.event.update({
      where: { id: (await factories.event(prisma, organizer.id)).id },
      data: { status: 'PUBLISHED' },
    });
    const participant = await bearer(await factories.user(prisma, ['PARTICIPANT']));

    const before = await request(app)
      .get(`/api/v1/events/${event.id}`)
      .set('Authorization', participant);
    expect(before.body.event.organizerContact).toEqual(EMPTY);

    await request(app)
      .put(PATH)
      .set('Authorization', await bearer(organizer))
      .send({ whatsapp: '0197454547', tiktok: '@kofi' });

    const detail = await request(app)
      .get(`/api/v1/events/${event.id}`)
      .set('Authorization', participant);
    expect(detail.body.event.organizerContact).toEqual({
      ...EMPTY,
      whatsapp: '+2290197454547',
      tiktok: 'https://www.tiktok.com/@kofi',
    });
    const list = await request(app).get('/api/v1/events').set('Authorization', participant);
    expect(list.body.data[0].organizerContact.whatsapp).toBe('+2290197454547');
  });
});
