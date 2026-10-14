import type { UserRole } from '@noise/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { createAccessToken } from '../src/modules/auth/tokens.js';
import { FakeImageStorage, type ImageStorage } from '../src/modules/uploads/image-storage.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/**
 * Affiche d'un événement de bout en bout (NOISE-012, étape 2) : route montée, propriété
 * vérifiée avant la réception du fichier, URL enregistrée. Stockage simulé.
 */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET });
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

let storage: FakeImageStorage;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  storage = new FakeImageStorage();
  app = createApp(env, createLogger('silent'), { prisma, imageStorage: storage });
});
afterAll(() => prisma.$disconnect());

const as = async (user: { id: string; roles: UserRole[] }) =>
  `Bearer ${await createAccessToken({ userId: user.id, roles: user.roles }, SECRET)}`;

async function ownedEvent() {
  const owner = await factories.user(prisma, ['ORGANIZER']);
  const event = await factories.event(prisma, owner.id);
  return { owner, event, auth: await as(owner) };
}

const upload = (eventId: string, auth: string | null, file: Buffer = JPEG, target = app) => {
  const req = request(target).post(`/api/v1/events/${eventId}/poster`);
  if (auth) req.set('Authorization', auth);
  return req.attach('poster', file, { filename: 'affiche.jpg', contentType: 'image/jpeg' });
};

describe('POST /api/v1/events/:id/poster', () => {
  it('l’organisateur propriétaire envoie l’affiche : URL enregistrée sur l’événement', async () => {
    const { event, auth } = await ownedEvent();
    const res = await upload(event.id, auth);

    expect(res.status).toBe(200);
    expect(res.body.event.posterUrl).toContain('w_1080');
    expect(storage.uploads).toEqual([{ eventId: event.id, size: JPEG.length }]);
    const saved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(saved.posterUrl).toBe(res.body.event.posterUrl);
  });

  it('un autre organisateur ne peut pas écraser l’affiche (403, rien n’est envoyé)', async () => {
    const { event } = await ownedEvent();
    const intruder = await factories.user(prisma, ['ORGANIZER']);
    const res = await upload(event.id, await as(intruder));

    expect(res.status).toBe(403);
    expect(storage.uploads).toHaveLength(0);
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).posterUrl,
    ).toBeNull();
  });

  it('un participant est refusé (403), sans jeton 401', async () => {
    const { event } = await ownedEvent();
    const participant = await factories.user(prisma, ['PARTICIPANT']);
    expect((await upload(event.id, await as(participant))).status).toBe(403);
    expect((await upload(event.id, null)).status).toBe(401);
    expect(storage.uploads).toHaveLength(0);
  });

  it('événement inconnu 404, identifiant invalide 400', async () => {
    const { auth } = await ownedEvent();
    expect((await upload('00000000-0000-4000-8000-000000000000', auth)).status).toBe(404);
    expect((await upload('pas-un-uuid', auth)).status).toBe(400);
    expect(storage.uploads).toHaveLength(0);
  });

  it('événement annulé : 409', async () => {
    const { event, auth } = await ownedEvent();
    await prisma.event.update({ where: { id: event.id }, data: { status: 'CANCELLED' } });
    expect((await upload(event.id, auth)).status).toBe(409);
    expect(storage.uploads).toHaveLength(0);
  });

  it('fichier qui n’est pas une image : 400', async () => {
    const { event, auth } = await ownedEvent();
    const res = await upload(event.id, auth, Buffer.from('<?php echo 1; ?>'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('stockage indisponible : 500 générique, l’affiche existante est conservée', async () => {
    const { event, auth } = await ownedEvent();
    await prisma.event.update({
      where: { id: event.id },
      data: { posterUrl: 'https://res.cloudinary.com/demo/ancienne.jpg' },
    });
    const failing: ImageStorage = {
      uploadPoster: async () => {
        throw new Error('Cloudinary indisponible');
      },
    };
    const failingApp = createApp(env, createLogger('silent'), { prisma, imageStorage: failing });
    const res = await upload(event.id, auth, JPEG, failingApp);

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Erreur interne');
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).posterUrl).toBe(
      'https://res.cloudinary.com/demo/ancienne.jpg',
    );
  });
});

describe('CLOUDINARY_URL', () => {
  const base = {
    JWT_ACCESS_SECRET: SECRET,
    QR_SIGNING_SECRET: 'q'.repeat(32),
    PAYMENT_PROVIDER: 'fedapay',
    PAYMENT_API_KEY: 'sk_live_x',
    PAYMENT_ENVIRONMENT: 'live',
    PAYMENT_WEBHOOK_SECRET: 'w',
  };

  it('obligatoire en staging et en production, au format cloudinary://', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/CLOUDINARY_URL/);
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'production', CLOUDINARY_URL: 'https://exemple' }),
    ).toThrow(/CLOUDINARY_URL/);
    expect(
      loadEnv({ ...base, NODE_ENV: 'production', CLOUDINARY_URL: 'cloudinary://k:s@noise' })
        .CLOUDINARY_URL,
    ).toBe('cloudinary://k:s@noise');
  });

  it('facultative en développement (affiches simulées)', () => {
    expect(() =>
      loadEnv({ JWT_ACCESS_SECRET: SECRET, QR_SIGNING_SECRET: 'q'.repeat(32) }),
    ).not.toThrow();
  });
});
