import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../src/middlewares/error-handler.js';
import { authRateLimit, globalRateLimit } from '../src/middlewares/rate-limit.js';

/**
 * Faux /login : refuse tout sauf le mot de passe « bon ». La limite est réduite à 2 pour le
 * test ; la valeur réelle (5 par 15 minutes) est dans AUTH_RATE_LIMIT.
 */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/login', authRateLimit({ limit: 2 }), (req, res) => {
    res.status(req.body.password === 'bon' ? 200 : 401).json({});
  });
  app.use(errorHandler);
  return app;
}

const login = (app: express.Express, phone: string, password = 'faux') =>
  request(app).post('/login').send({ phone, password });

describe('authRateLimit', () => {
  it('bloque au-delà de la limite avec une erreur 429 au format standard', async () => {
    const app = buildApp();
    expect((await login(app, '0197454547')).status).toBe(401);
    expect((await login(app, '0197454547')).status).toBe(401);

    const blocked = await login(app, '0197454547');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers.ratelimit).toBeDefined();
  });

  it('compte ensemble les différentes écritures d’un même numéro', async () => {
    const app = buildApp();
    await login(app, '0197454547');
    await login(app, '+229 01 97 45 45 47');
    expect((await login(app, '97454547')).status).toBe(429);
  });

  it('un autre numéro depuis la même IP a son propre compteur', async () => {
    const app = buildApp();
    await login(app, '0197454547');
    await login(app, '0197454547');
    expect((await login(app, '0166000001')).status).toBe(401);
  });

  it('ne compte pas les connexions réussies', async () => {
    const app = buildApp();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect((await login(app, '0197454547', 'bon')).status).toBe(200);
    }
    expect((await login(app, '0197454547')).status).toBe(401);
  });
});

describe('globalRateLimit', () => {
  it('limite le nombre total de requêtes par IP', async () => {
    const app = express();
    app.use(globalRateLimit({ limit: 2 }));
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok' });
    });
    app.use(errorHandler);

    await request(app).get('/health');
    await request(app).get('/health');
    const blocked = await request(app).get('/health');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
