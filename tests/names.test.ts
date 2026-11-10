import { describe, expect, it } from 'vitest';
import { fullName, initials } from '@/lib/names';

describe('fullName', () => {
  it('bruger efternavnet, når det findes', () => {
    expect(fullName({ name: 'Ezzek', surname: 'Svumpukkel', slug: 'ezzek-svumpukkel' })).toBe('Ezzek Svumpukkel');
  });
  it('udleder efternavnet af sluggen, når det mangler (null/undefined)', () => {
    expect(fullName({ name: 'Ezzek', surname: null, slug: 'ezzek-svumpukkel' })).toBe('Ezzek Svumpukkel');
    expect(fullName({ name: 'Magi', slug: 'magi-far' })).toBe('Magi Far');
  });
  it('håndterer æ/ø/å, også som første bogstav i efternavnet', () => {
    expect(fullName({ name: 'Knud', surname: null, slug: 'knud-klunkekløe' })).toBe('Knud Klunkekløe');
    expect(fullName({ name: 'Åse', surname: null, slug: 'åse-ølund' })).toBe('Åse Ølund');
    expect(fullName({ name: 'Ida', surname: null, slug: 'ida-ærø' })).toBe('Ida Ærø');
  });
  it('NFC-normaliserer navn, efternavn og slug', () => {
    const nfd = 'Klunkeklöe'; // o + kombinerende diaeresis
    expect(fullName({ name: 'Knud', surname: nfd, slug: 'x' })).toBe('Knud ' + nfd.normalize('NFC'));
    expect(fullName({ name: 'Knud', surname: null, slug: 'knud-klunkekløe'.normalize('NFD') })).toBe('Knud Klunkekløe');
  });
  it('bevarer resten af sluggen uændret ved flere bindestreger', () => {
    expect(fullName({ name: 'Anna', surname: null, slug: 'anna-lise-berg' })).toBe('Anna Lise-berg');
  });
  it('behandler tomt eller blankt efternavn som manglende', () => {
    expect(fullName({ name: 'Magi', surname: '', slug: 'magi-far' })).toBe('Magi Far');
    expect(fullName({ name: 'Magi', surname: '   ', slug: 'magi-far' })).toBe('Magi Far');
  });
  it('falder tilbage til fornavnet, når sluggen ikke matcher', () => {
    expect(fullName({ name: 'Magi', surname: null, slug: 'ezzek-svumpukkel' })).toBe('Magi');
    expect(fullName({ name: 'Magi', surname: null, slug: 'magi' })).toBe('Magi');
    expect(fullName({ name: 'Magi', surname: null, slug: 'magi-' })).toBe('Magi');
    expect(fullName({ name: 'Magi', surname: null, slug: 'magier-far' })).toBe('Magi');
  });
  it('trimmer efternavnet', () => {
    expect(fullName({ name: 'Magi', surname: ' Far ', slug: 'x' })).toBe('Magi Far');
  });
});

describe('initials', () => {
  it('tager første bogstav af første og sidste ord med store bogstaver', () => {
    expect(initials('Ezzek Svumpukkel')).toBe('ES');
    expect(initials('ezzek svumpukkel')).toBe('ES');
    expect(initials('Anna Lise-berg')).toBe('AL');
    expect(initials('Anna Lise Berg')).toBe('AB');
  });
  it('håndterer æ/ø/å og ét ord', () => {
    expect(initials('Åse Ølund')).toBe('ÅØ');
    expect(initials('æbel ørn')).toBe('ÆØ');
    expect(initials('Magi')).toBe('M');
  });
  it('håndterer overskydende mellemrum og tom streng', () => {
    expect(initials('  Magi   Far ')).toBe('MF');
    expect(initials('')).toBe('');
  });
});
