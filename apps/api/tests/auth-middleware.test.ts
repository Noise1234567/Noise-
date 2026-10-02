import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requireAuth, requireRole } from '../src/middlewares/auth.js';
import { errorHandler } from '../src/middlewares/error-handler.js';
import { createAccessToken } from '../src/modules/auth/tokens.js';

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';

/** Petite application de test : une route protégée par rôle, le vrai gestionnaire d'erreurs. */
function buildApp() {
  const app = express();
  app.get('/participant', requireAuth(SECRET), (req, res) => {
    res.json({ auth: req.auth });
  });
  app.get('/organisateur', requireAuth(SECRET), requireRole('ORGANIZER'), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

const bearer = async (roles: ('PARTICIPANT' | 'ORGANIZER')[]) =>
  `Bearer ${await createAccessToken({ userId: 'user-1', roles }, SECRET)}`;

describe('requireAuth', () => {
  it('laisse passer un jeton valide et expose l’utilisateur', async () => {
    const res = await request(buildApp())
      .get('/participant')
      .set('Authorization', await bearer(['PARTICIPANT']));
    expect(res.status).toBe(200);
    expect(res.body.auth).toEqual({ userId: 'user-1', roles: ['PARTICIPANT'] });
  });

  it.each([
    ['sans en-tête', undefined],
    ['schéma incorrect', 'Basic abc'],
    ['jeton vide', 'Bearer '],
    ['jeton invalide', 'Bearer pas.un.jeton'],
  ])('401 au format standard : %s', async (_label, header) => {
    const req = request(buildApp()).get('/participant');
    const res = await (header ? req.set('Authorization', header) : req);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('requireRole', () => {
  it('403 si l’utilisateur n’a pas le rôle demandé', async () => {
    const res = await request(buildApp())
      .get('/organisateur')
      .set('Authorization', await bearer(['PARTICIPANT']));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('laisse passer un utilisateur qui a ce rôle parmi d’autres', async () => {
    const res = await request(buildApp())
      .get('/organisateur')
      .set('Authorization', await bearer(['PARTICIPANT', 'ORGANIZER']));
    expect(res.status).toBe(200);
  });
});
