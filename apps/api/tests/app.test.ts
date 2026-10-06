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

  it('utilise le FakeProvider par défaut', () => {
    expect(loadEnv({}).PAYMENT_PROVIDER).toBe('fake');
  });

  it('interdit le FakeProvider en production', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/PAYMENT_PROVIDER/);
  });

  it('exige la clé et le secret de webhook pour FedaPay', () => {
    expect(() => loadEnv({ PAYMENT_PROVIDER: 'fedapay' })).toThrow(
      /PAYMENT_API_KEY.*PAYMENT_WEBHOOK_SECRET/,
    );
  });

  it('refuse une clé live en sandbox', () => {
    expect(() =>
      loadEnv({
        PAYMENT_PROVIDER: 'fedapay',
        PAYMENT_ENVIRONMENT: 'sandbox',
        PAYMENT_API_KEY: 'sk_live_xxx',
        PAYMENT_WEBHOOK_SECRET: 'whsec',
      }),
    ).toThrow(/sk_sandbox_/);
  });

  it('accepte une configuration FedaPay sandbox complète', () => {
    const env = loadEnv({
      PAYMENT_PROVIDER: 'fedapay',
      PAYMENT_API_KEY: 'sk_sandbox_xxx',
      PAYMENT_WEBHOOK_SECRET: 'whsec',
    });
    expect(env.PAYMENT_ENVIRONMENT).toBe('sandbox');
  });
});
