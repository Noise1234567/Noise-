import type { Logger } from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PURGE_FIRST_RUN_MS, PURGE_INTERVAL_MS, startPurgeJob } from './purge-job.js';

const logger = () => ({ info: vi.fn(), error: vi.fn() }) as unknown as Logger;

describe('job de purge des données expirées', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('premier passage peu après le démarrage, puis une fois par jour', async () => {
    const purgeExpired = vi.fn().mockResolvedValue({ idempotencyKeys: 3, refreshTokens: 1 });
    const log = logger();
    const stop = startPurgeJob({ purgeExpired }, log);

    await vi.advanceTimersByTimeAsync(PURGE_FIRST_RUN_MS - 1);
    expect(purgeExpired).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(purgeExpired).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith(
      { idempotencyKeys: 3, refreshTokens: 1 },
      'Données expirées supprimées',
    );

    await vi.advanceTimersByTimeAsync(PURGE_INTERVAL_MS * 2);
    expect(purgeExpired).toHaveBeenCalledTimes(3);
    stop();
  });

  it('continue après une erreur et la journalise ; rien à journaliser sans suppression', async () => {
    const purgeExpired = vi
      .fn()
      .mockRejectedValueOnce(new Error('base injoignable'))
      .mockResolvedValue({ idempotencyKeys: 0, refreshTokens: 0 });
    const log = logger();
    const stop = startPurgeJob({ purgeExpired }, log, 1000, 10);

    await vi.advanceTimersByTimeAsync(10);
    expect(log.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      'Échec de la purge des données expirées',
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(purgeExpired).toHaveBeenCalledTimes(2);
    expect(log.info).not.toHaveBeenCalled();
    stop();
  });

  it('s’arrête, même avant le premier passage', async () => {
    const purgeExpired = vi.fn().mockResolvedValue({ idempotencyKeys: 0, refreshTokens: 0 });
    startPurgeJob({ purgeExpired }, logger(), 1000, 10)();
    await vi.advanceTimersByTimeAsync(5000);
    expect(purgeExpired).not.toHaveBeenCalled();
  });
});
