import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { CreateAdminError, createAdmin } from '../src/modules/admin/create-admin.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/** Création du premier compte administrateur (NOISE-055). Base noise_test. */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET });

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

const input = {
  name: 'Équipe Noise',
  phone: '01 97 00 00 01',
  email: 'Admin@Noise.bj',
  password: 'un-mot-de-passe-long',
};

describe('création d’un compte administrateur', () => {
  it('crée un compte ADMIN qui peut se connecter et accéder à l’administration', async () => {
    const admin = await createAdmin(prisma, input);
    expect(admin.phone).not.toContain('97000001');

    const saved = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(saved).toMatchObject({
      role: 'ADMIN',
      phone: '+2290197000001',
      email: 'admin@noise.bj',
    });
    expect(saved.passwordHash).not.toContain(input.password);

    const app = createApp(env, createLogger('silent'), { prisma });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: input.phone, password: input.password, role: 'ADMIN' });
    expect(login.status).toBe(200);
    const orders = await request(app)
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(orders.status).toBe(200);
  });

  it('refuse un numéro ou un e-mail déjà utilisé par un autre admin (un compte par rôle, DEC-029)', async () => {
    // Le numéro d'un participant ne bloque pas : l'admin est un compte distinct.
    const user = await factories.user(prisma, 'PARTICIPANT');
    const sameNumber = await createAdmin(prisma, {
      ...input,
      phone: user.phone,
      email: 'autre.admin@noise.bj',
    });
    expect(sameNumber.id).not.toBe(user.id);
    await createAdmin(prisma, input);
    await expect(createAdmin(prisma, { ...input, email: 'encore@noise.bj' })).rejects.toThrow(
      CreateAdminError,
    );
    await expect(createAdmin(prisma, { ...input, phone: '01 97 00 00 02' })).rejects.toThrow(
      /déjà un compte/,
    );
  });

  it('mot de passe de moins de 12 caractères ou champ manquant : refus, sans créer de compte', async () => {
    await expect(createAdmin(prisma, { ...input, password: 'court-1234' })).rejects.toThrow(
      /12 caractères/,
    );
    await expect(createAdmin(prisma, { ...input, name: undefined })).rejects.toThrow(
      CreateAdminError,
    );
    expect(await prisma.user.count()).toBe(0);
  });
});
