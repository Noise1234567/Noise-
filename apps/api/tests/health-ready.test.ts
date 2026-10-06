import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';

const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });
const logger = createLogger('silent');

describe('GET /health/ready', () => {
  it('200 quand la base répond', async () => {
    const app = createApp(env, logger, { checkDatabase: async () => {} });
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready', checks: { database: 'up' } });
  });

  it('503 quand la base ne répond pas, sans détail technique', async () => {
    const app = createApp(env, logger, {
      checkDatabase: async () => {
        throw new Error('connect ECONNREFUSED 10.0.0.1:5432 password=secret');
      },
    });
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'unavailable', checks: { database: 'down' } });
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('503 quand aucune base n’est configurée', async () => {
    const res = await request(createApp(env, logger)).get('/health/ready');
    expect(res.status).toBe(503);
  });
});
