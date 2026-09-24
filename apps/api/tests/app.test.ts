import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';

const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });
const app = createApp(env, createLogger(env.LOG_LEVEL));

describe('socle API', () => {
  it('GET /health répond 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', env: 'test' });
  });

  it('une route inconnue renvoie une erreur au format standard', async () => {
    const res = await request(app).get('/route-inexistante');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it("n'expose pas l'en-tête x-powered-by", async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('loadEnv', () => {
  it('refuse une configuration invalide', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow(/Configuration invalide/);
  });
});
