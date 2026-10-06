import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';

const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });

/** Faux build du scanner dans un dossier temporaire. */
function fakeScannerBuild() {
  const dir = mkdtempSync(join(tmpdir(), 'noise-scanner-'));
  writeFileSync(join(dir, 'index.html'), '<title>Noise — Scanner</title>');
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'index.js'), 'console.log(1)');
  return dir;
}

describe('scanner servi par l’API sous /scan', () => {
  it('sert la page et ses fichiers', async () => {
    const app = createApp(env, createLogger('silent'), { scannerDir: fakeScannerBuild() });

    const page = await request(app).get('/scan/');
    expect(page.status).toBe(200);
    expect(page.text).toContain('Noise — Scanner');
    expect((await request(app).get('/scan/assets/index.js')).status).toBe(200);
  });

  it('renvoie la 404 standard pour un fichier absent', async () => {
    const app = createApp(env, createLogger('silent'), { scannerDir: fakeScannerBuild() });
    const res = await request(app).get('/scan/absent.js');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('ne sert rien si le scanner n’a pas été construit', async () => {
    const app = createApp(env, createLogger('silent'), {
      scannerDir: join(tmpdir(), 'inexistant'),
    });
    expect((await request(app).get('/scan/')).status).toBe(404);
  });
});
