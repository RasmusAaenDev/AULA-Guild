import { describe, expect, it } from 'vitest';
import { classKey, classKeys, switcherLabel, sortForSwitcher } from '@/lib/character-switcher';

describe('classKey', () => {
  it('mapper Blizzard-klassenavne til faste nøgler', () => {
    expect(classKey('Mage')).toBe('mage');
    expect(classKey('Death Knight')).toBe('death-knight');
    expect(classKey('  demon hunter ')).toBe('demon-hunter');
    expect(classKey('WARRIOR')).toBe('warrior');
  });
  it('giver "ukendt" for ukendte klasser', () => {
    expect(classKey('Ukendt')).toBe('ukendt');
    expect(classKey('')).toBe('ukendt');
    expect(classKey('Bard')).toBe('ukendt');
  });
  it('udleveres kun nøgler fra den kendte liste', () => {
    for (const k of classKeys) expect(classKey(k.replace('-', ' '))).toBe(k);
  });
});

describe('switcherLabel', () => {
  it('giver skiftetekst til ikke-primære og «(primær karakter)» til den primære', () => {
    expect(switcherLabel('Ezzek Svumpukkel', false)).toBe('Skift primær karakter til Ezzek Svumpukkel');
    expect(switcherLabel('Ezzek Svumpukkel', true)).toBe('Ezzek Svumpukkel (primær karakter)');
    expect(switcherLabel('Ezzek Svumpukkel', true, false)).toBe('Ezzek Svumpukkel (primær karakter, ikke verificeret)');
    expect(switcherLabel('Ezzek Svumpukkel', false, false)).toBe('Skift primær karakter til Ezzek Svumpukkel (ikke verificeret)');
  });
});

describe('sortForSwitcher', () => {
  const c = (id: number, fullName: string) => ({ id, fullName });
  it('sorterer alfabetisk efter fuldt navn (da) uafhængigt af den primære', () => {
    const list = [c(1, 'Ølund Ø'), c(2, 'Zed Zorn'), c(3, 'Åse Å'), c(4, 'Abe Aaen')];
    expect(sortForSwitcher(list).map((x) => x.fullName)).toEqual(['Abe Aaen', 'Zed Zorn', 'Ølund Ø', 'Åse Å']);
  });
  it('bryder uafgjort på id og muterer ikke input', () => {
    const list = [c(9, 'Bo Ek'), c(2, 'Bo Ek')];
    expect(sortForSwitcher(list).map((x) => x.id)).toEqual([2, 9]);
    expect(list.map((x) => x.id)).toEqual([9, 2]);
  });
});
