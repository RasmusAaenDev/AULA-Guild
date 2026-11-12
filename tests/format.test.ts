import { describe, expect, it } from 'vitest';
import { formatDateTime } from '@/lib/format';
import { addCharacterMessage, roleLabel } from '@/lib/messages';

describe('formatDateTime', () => {
  it('viser dansk tid (vintertid, UTC+1)', () => {
    expect(formatDateTime(new Date('2026-11-10T19:00:00Z'))).toMatch(/10\.11\.2026.*20[.:]00/);
  });
  it('viser sommertid (UTC+2)', () => {
    expect(formatDateTime(new Date('2026-07-10T19:00:00Z'))).toMatch(/10\.07\.2026.*21[.:]00/);
  });
  it('viser tekst når der ikke er nogen dato', () => {
    expect(formatDateTime(null)).toBe('Ikke synkroniseret endnu');
  });
});

describe('beskeder', () => {
  it('har en dansk tekst for hver fejl', () => {
    for (const r of ['invalid_name', 'invalid_characters', 'not_found', 'taken', 'already_yours', 'unavailable'] as const) {
      expect(addCharacterMessage(r).length).toBeGreaterThan(10);
    }
    expect(addCharacterMessage('invalid_name')).toBe('Skriv både fornavn og efternavn.');
    expect(addCharacterMessage('invalid_characters')).toBe(
      'Karakternavne må kun indeholde bogstaver, mellemrum, bindestreg og apostrof.',
    );
    expect(roleLabel('dps')).toBe('DPS');
  });
});
