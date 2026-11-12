import { describe, expect, it } from 'vitest';
import { formatMessageTime, isNearBottom, nextPollDelay } from '@/lib/chat-ui';

describe('formatMessageTime', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  it('viser kun klokkeslæt (dansk tid, HH.mm) samme dag', () => {
    expect(formatMessageTime('2026-11-10T09:05:00Z', now)).toBe('10.05');
    expect(formatMessageTime('2026-07-10T21:30:00Z', new Date('2026-07-10T21:45:00Z'))).toBe('23.30');
  });
  it('bruger dansk dag for «i dag», ikke UTC-dag', () => {
    expect(formatMessageTime('2026-11-09T23:30:00Z', new Date('2026-11-10T08:00:00Z'))).toBe('00.30');
  });
  it('tilføjer dato når dagen er en anden, og år når året er et andet', () => {
    expect(formatMessageTime('2026-11-08T09:05:00Z', now)).toBe('08.11 10.05');
    expect(formatMessageTime('2025-12-31T09:05:00Z', now)).toBe('31.12.2025 10.05');
  });
  it('giver tom tekst for ugyldigt tidspunkt', () => {
    expect(formatMessageTime('ikke en dato', now)).toBe('');
  });
});

describe('isNearBottom', () => {
  it('følger med når nær bunden, ikke når der er scrollet op', () => {
    expect(isNearBottom({ scrollTop: 900, clientHeight: 100, scrollHeight: 1000 })).toBe(true);
    expect(isNearBottom({ scrollTop: 850, clientHeight: 100, scrollHeight: 1000 })).toBe(true);
    expect(isNearBottom({ scrollTop: 500, clientHeight: 100, scrollHeight: 1000 })).toBe(false);
  });
  it('følger med når alt kan ses', () => {
    expect(isNearBottom({ scrollTop: 0, clientHeight: 500, scrollHeight: 300 })).toBe(true);
  });
});

describe('nextPollDelay', () => {
  it('poller hvert 5. sekund og går op til 60 sekunder ved fejl', () => {
    expect(nextPollDelay(0)).toBe(5000);
    expect(nextPollDelay(1)).toBe(10000);
    expect(nextPollDelay(2)).toBe(20000);
    expect(nextPollDelay(10)).toBe(60000);
  });
});

describe('formatMessageTime, dagsskift', () => {
  it('viser dato når dansk dag er forskellig fra UTC-dag', () => {
    expect(formatMessageTime('2026-11-10T23:30:00Z', new Date('2026-11-10T12:00:00Z'))).toBe('11.11 00.30');
  });
});
