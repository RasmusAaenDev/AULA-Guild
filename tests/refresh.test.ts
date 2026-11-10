import { describe, expect, it } from 'vitest';
import { cooldownMessage, createRefreshGate, refreshMessage, REFRESH_COOLDOWN_MS } from '@/lib/refresh';

describe('createRefreshGate', () => {
  it('tillader første kald og afviser kald inden for 2 minutter med resterende sekunder', () => {
    const g = createRefreshGate();
    expect(g.take(1_000_000)).toEqual({ ok: true });
    expect(g.take(1_000_000 + 30_000)).toEqual({ ok: false, waitSeconds: 90 });
    expect(g.take(1_000_000 + REFRESH_COOLDOWN_MS - 1)).toEqual({ ok: false, waitSeconds: 1 });
    expect(g.take(1_000_000 + REFRESH_COOLDOWN_MS)).toEqual({ ok: true });
  });
  it('en afvist forsøg forlænger ikke ventetiden', () => {
    const g = createRefreshGate(1000);
    g.take(0);
    g.take(500);
    expect(g.take(1000)).toEqual({ ok: true });
  });
});

describe('beskeder', () => {
  it('melder antal og fejl, og afvist/utilgængelig armory', () => {
    expect(refreshMessage({ skipped: false, updated: 1, failed: 0 }).message).toBe('Opdaterede 1 karakter fra armory.');
    expect(refreshMessage({ skipped: false, updated: 5, failed: 2 }).message).toContain('2 kunne ikke hentes');
    expect(refreshMessage({ skipped: true, updated: 0, failed: 0 }).error).toContain('kunne ikke nås');
    expect(cooldownMessage(42).error).toContain('42 sekunder');
  });
});
