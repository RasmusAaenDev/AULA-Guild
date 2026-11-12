import { describe, expect, it } from 'vitest';
import { createSendLimiter, validateMessage } from '@/lib/chat-send';

describe('validateMessage', () => {
  it('trimmer og accepterer 1-500 tegn', () => {
    expect(validateMessage('  hej  ')).toEqual({ ok: true, text: 'hej' });
    expect(validateMessage('a'.repeat(500)).ok).toBe(true);
    expect(validateMessage('a\tb\nc')).toEqual({ ok: true, text: 'a\tb\nc' });
  });
  it('afviser tom, for lang, kontroltegn og for mange linjeskift', () => {
    for (const bad of ['', '   \n ', 'a'.repeat(501), 'a\u0000b', 'a\u001bb', 'a\u0085b', '1\n2\n3\n4\n5\n6\n7', undefined, 5]) {
      const r = validateMessage(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/[A-Za-zæøå]/);
    }
    expect(validateMessage('1\n2\n3\n4\n5\n6').ok).toBe(true);
  });
});

describe('createSendLimiter', () => {
  it('kræver mindst 2 sek mellem beskeder og højst 5 pr. minut pr. bruger', () => {
    const l = createSendLimiter();
    expect(l.take(1, 0).ok).toBe(true);
    expect(l.take(1, 1000).ok).toBe(false);
    expect(l.take(2, 1000).ok).toBe(true);
    for (const t of [2000, 4000, 6000, 8000]) expect(l.take(1, t).ok).toBe(true);
    expect(l.take(1, 10_000).ok).toBe(false);
    expect(l.take(1, 60_500).ok).toBe(true);
  });
});
