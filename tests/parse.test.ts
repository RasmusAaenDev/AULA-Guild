import { describe, expect, it } from 'vitest';
import { parseId, parseWeekday } from '@/lib/parse';

describe('parseId', () => {
  it('accepterer positive heltal inden for int4', () => {
    expect(parseId('1')).toBe(1);
    expect(parseId('2147483647')).toBe(2147483647);
  });
  it('afviser alt andet', () => {
    for (const v of ['0', '-1', '1.5', '', ' ', 'abc', '2147483648', '99999999999', '1e3', '0x10', null, undefined, '007x']) {
      expect(parseId(v)).toBeNull();
    }
  });
});

describe('parseWeekday', () => {
  it('accepterer 0-6', () => {
    expect(parseWeekday('0')).toBe(0);
    expect(parseWeekday('6')).toBe(6);
  });
  it('afviser tomt, manglende og ugyldigt', () => {
    for (const v of ['', ' ', '7', '-1', '1.5', 'x', null, undefined]) expect(parseWeekday(v)).toBeNull();
  });
});
