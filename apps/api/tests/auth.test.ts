import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import type { PrismaClient } from '../src/lib/prisma.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { verifyAccessToken } from '../src/modules/auth/tokens.js';
import { createTestPrisma, resetDatabase } from './db/test-database.js';

/** Authentification de bout en bout (NOISE-007) : HTTP → API → base noise_test. */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET });
// Une application par test : les compteurs de limitation repartent de zéro.
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createApp(env, createLogger('silent'), { prisma });
});
afterAll(() => prisma.$disconnect());

const aminata = {
  name: 'Aminata Sossou',
  phone: '01 97 45 45 47',
  email: 'aminata@example.com',
  password: 'motdepasse',
  role: 'PARTICIPANT',
};
const register = (body: object = aminata) => request(app).post('/api/v1/auth/register').send(body);
const login = (phone: string, password: string) =>
  request(app).post('/api/v1/auth/login').send({ phone, password });
const refresh = (refreshToken: string) =>
  request(app).post('/api/v1/auth/refresh').send({ refreshToken });

describe('inscription', () => {
  it('crée le compte, normalise le numéro et ouvre une session', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({
      id: expect.any(String),
      name: 'Aminata Sossou',
      phone: '+2290197454547',
      email: 'aminata@example.com',
      roles: ['PARTICIPANT'],
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(await verifyAccessToken(res.body.accessToken, SECRET)).toEqual({
      userId: res.body.user.id,
      roles: ['PARTICIPANT'],
    });

    const stored = await prisma.user.findUniqueOrThrow({ where: { phone: '+2290197454547' } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    const token = await prisma.refreshToken.findFirstOrThrow({ where: { userId: stored.id } });
    expect(token.tokenHash).not.toBe(res.body.refreshToken); // seul le hash est stocké
  });

  it('refuse un numéro déjà utilisé, même écrit autrement (409)', async () => {
    await register();
    const res = await register({ ...aminata, phone: '+229 01 97 45 45 47' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('enregistre l’e-mail en minuscules, sans espaces', async () => {
    const res = await register({ ...aminata, email: '  Aminata@Example.COM ' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('aminata@example.com');
    const stored = await prisma.user.findUniqueOrThrow({ where: { phone: '+2290197454547' } });
    expect(stored.email).toBe('aminata@example.com');
  });

  it('refuse un e-mail déjà utilisé, quelle que soit la casse (409)', async () => {
    await register();
    const res = await register({
      ...aminata,
      phone: '01 66 00 00 01',
      email: 'AMINATA@example.com',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toMatch(/e-mail/);
    expect(await prisma.user.count()).toBe(1);
  });

  it('refuse une inscription sans e-mail (400)', async () => {
    const withoutEmail: Record<string, unknown> = { ...aminata };
    delete withoutEmail.email;
    const res = await register(withoutEmail);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain('email');
    expect(await prisma.user.count()).toBe(0);
  });

  it('refuse un e-mail invalide (400)', async () => {
    const res = await register({ ...aminata, email: 'pas-un-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain('email');
  });

  it('deux inscriptions simultanées avec le même e-mail : une seule réussit', async () => {
    const [first, second] = await Promise.all([
      register(),
      register({ ...aminata, phone: '01 66 00 00 01' }),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await prisma.user.count()).toBe(1);
  });

  it('400 avec le détail des champs invalides', async () => {
    const res = await register({
      ...aminata,
      phone: '123',
      email: 'x',
      password: 'court',
      role: 'ADMIN',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'email',
      'password',
      'phone',
      'role',
    ]);
  });
});

describe('connexion', () => {
  it('connecte avec le bon mot de passe, quelle que soit l’écriture du numéro', async () => {
    await register();
    const res = await login('97454547', 'motdepasse');
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe('+2290197454547');
  });

  it('même message générique pour un mauvais mot de passe et un numéro inconnu', async () => {
    await register();
    const wrongPassword = await login('0197454547', 'mauvais');
    const unknownPhone = await login('0166000001', 'motdepasse');
    for (const res of [wrongPassword, unknownPhone]) {
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Numéro ou mot de passe incorrect');
    }
  });

  it('refuse un compte suspendu (403)', async () => {
    await register();
    await prisma.user.update({ where: { phone: '+2290197454547' }, data: { status: 'SUSPENDED' } });
    expect((await login('0197454547', 'motdepasse')).status).toBe(403);
  });

  it('bloque après 5 échecs pour ce numéro (429)', async () => {
    await register();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login('0197454547', 'mauvais')).status).toBe(401);
    }
    expect((await login('0197454547', 'motdepasse')).status).toBe(429);
  });
});

describe('refresh token', () => {
  it('rotation : un nouveau couple de jetons, l’ancien refresh devient inutilisable', async () => {
    const session = (await register()).body;
    const rotated = await refresh(session.refreshToken);
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(session.refreshToken);

    const tokens = await prisma.refreshToken.findMany({ orderBy: { createdAt: 'asc' } });
    expect(tokens).toHaveLength(2);
    expect(tokens[0]?.revokedAt).not.toBeNull();
    expect(tokens[0]?.replacedById).toBe(tokens[1]?.id);
  });

  it('réutiliser un ancien refresh token révoque toute la chaîne (vol présumé)', async () => {
    const session = (await register()).body;
    const rotated = (await refresh(session.refreshToken)).body;

    expect((await refresh(session.refreshToken)).status).toBe(401); // réutilisation
    expect((await refresh(rotated.refreshToken)).status).toBe(401); // chaîne révoquée
    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
  });

  it('jeton révoqué par une requête concurrente entre la lecture et la rotation : refusé', async () => {
    const session = (await register()).body;
    // Reproduit la course de façon déterministe : juste après la lecture du jeton par le
    // service, une « autre requête » le révoque en base.
    const racing = prisma.$extends({
      query: {
        refreshToken: {
          async findUnique({ args, query }) {
            const found = await query(args);
            await prisma.refreshToken.updateMany({
              where: { tokenHash: args.where.tokenHash },
              data: { revokedAt: new Date() },
            });
            return found;
          },
        },
      },
    });
    const service = new AuthService(racing as unknown as PrismaClient, SECRET);

    await expect(service.refresh(session.refreshToken)).rejects.toMatchObject({ status: 401 });
    expect(await prisma.refreshToken.count({ where: { replacedById: { not: null } } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
  });

  it('refuse un jeton inconnu ou expiré', async () => {
    const session = (await register()).body;
    expect((await refresh('inconnu')).status).toBe(401);
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await refresh(session.refreshToken)).status).toBe(401);
  });
});

describe('déconnexion', () => {
  it('révoque le refresh token de l’appareil', async () => {
    const session = (await register()).body;
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ refreshToken: session.refreshToken });
    expect(res.status).toBe(204);
    expect((await refresh(session.refreshToken)).status).toBe(401);
  });

  it('exige d’être connecté (401)', async () => {
    const res = await request(app).post('/api/v1/auth/logout').send({ refreshToken: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('/me', () => {
  it('renvoie le compte connecté, 401 sans jeton', async () => {
    const session = (await register()).body;
    const me = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${session.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(session.user.id);
    expect((await request(app).get('/api/v1/me')).status).toBe(401);
  });

  it('active le second rôle et renvoie un access token qui le contient', async () => {
    const session = (await register()).body;
    const res = await request(app)
      .patch('/api/v1/me/roles')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ role: 'ORGANIZER' });
    expect(res.status).toBe(200);
    expect(res.body.user.roles).toEqual(['PARTICIPANT', 'ORGANIZER']);
    expect((await verifyAccessToken(res.body.accessToken, SECRET))?.roles).toEqual([
      'PARTICIPANT',
      'ORGANIZER',
    ]);
  });

  it('ne permet jamais de devenir ADMIN (400)', async () => {
    const session = (await register()).body;
    const res = await request(app)
      .patch('/api/v1/me/roles')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(400);
  });
});
