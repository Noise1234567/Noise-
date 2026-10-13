import type { Logger } from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startOrderExpiryJob } from './expiry-job.js';

const logger = () => ({ info: vi.fn(), error: vi.fn() }) as unknown as Logger;

describe('job d’expiration des commandes', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('expire les commandes à chaque minute', async () => {
    const expirePending = vi.fn().mockResolvedValue(2);
    const log = logger();
    const stop = startOrderExpiryJob({ expirePending }, log);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(expirePending).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith({ count: 2 }, 'Commandes expirées');

    await vi.advanceTimersByTimeAsync(120_000);
    expect(expirePending).toHaveBeenCalledTimes(3);
    stop();
  });

  it('continue après une erreur et la journalise', async () => {
    const expirePending = vi
      .fn()
      .mockRejectedValueOnce(new Error('base injoignable'))
      .mockResolvedValue(0);
    const log = logger();
    const stop = startOrderExpiryJob({ expirePending }, log);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(log.error).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(expirePending).toHaveBeenCalledTimes(2);
    stop();
  });

  it('s’arrête quand on appelle la fonction retournée', async () => {
    const expirePending = vi.fn().mockResolvedValue(0);
    const stop = startOrderExpiryJob({ expirePending }, logger());
    stop();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(expirePending).not.toHaveBeenCalled();
  });
});
