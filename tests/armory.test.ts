import { describe, expect, it } from 'vitest';
import { armoryUrl } from '@/lib/armory';

describe('armoryUrl', () => {
  it('bygger adressen til WoW Forever-armory ud fra sluggen', () => {
    expect(armoryUrl('magi-far')).toBe('https://worldofwarcraft.blizzard.com/en-gb/forever/eu/armory/character/magi-far');
  });
  it('url-koder specialtegn som æøå', () => {
    expect(armoryUrl('knud-klunkekløe')).toBe('https://worldofwarcraft.blizzard.com/en-gb/forever/eu/armory/character/knud-klunkekl%C3%B8e');
  });
  it('giver null uden gyldig slug og afviser stitegn og mellemrum', () => {
    for (const bad of [null, undefined, '', '   ', 'a/b', 'a b', 'a?b', 'a#b', 'a\\b', 'x'.repeat(81)]) expect(armoryUrl(bad as never)).toBeNull();
  });
});
