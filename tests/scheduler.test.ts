import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startScheduler } from '@/lib/scheduler';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('startScheduler', () => {
  it('kører efter startforsinkelsen og derefter hvert interval', async () => {
    const run = vi.fn(async () => {});
    const stop = startScheduler({ run, intervalMs: 1000, initialDelayMs: 100, log: () => {} });
    await vi.advanceTimersByTimeAsync(99);
    expect(run).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('starter ikke en ny kørsel, mens den forrige stadig kører', async () => {
    let release!: () => void;
    const run = vi.fn(() => new Promise<void>((r) => (release = r)));
    const stop = startScheduler({ run, intervalMs: 1000, initialDelayMs: 0, log: () => {} });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(3000);
    expect(run).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
  });

  it('logger fejl og fortsætter', async () => {
    const log = vi.fn();
    const run = vi.fn(async () => {
      throw new Error('boom');
    });
    const stop = startScheduler({ run, intervalMs: 1000, initialDelayMs: 0, log });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalled();
    stop();
  });
});
