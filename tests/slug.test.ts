import { describe, expect, it } from 'vitest';
import { nameToSlug, normalizeName } from '@/lib/slug';

describe('nameToSlug', () => {
  it.each([
    ['Magi Far', 'magi-far'],
    ['  Magi   Far ', 'magi-far'],
    ['Ezzek', 'ezzek'],
    ["D'arc", "d'arc"],
  ])('%s → %s', (input, expected) => {
    expect(nameToSlug(input)).toBe(expected);
  });

  it.each(['', '   ', 'a/b', 'Magi_Far', 'x'.repeat(61), 'Magi?Far'])('afviser %j', (input) => {
    expect(nameToSlug(input)).toBeNull();
  });
});

describe('normalizeName', () => {
  it('trimmer, samler mellemrum og sænker', () => {
    expect(normalizeName('  Magi   FAR ')).toBe('magi far');
  });
});
