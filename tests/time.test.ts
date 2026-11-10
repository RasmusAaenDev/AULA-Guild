import { describe, expect, it } from 'vitest';
import { addDaysToDate, copenhagenToUtc, todayInCopenhagen, utcToCopenhagen } from '@/lib/time';

function iso(date: string, time: string): string {
  const r = copenhagenToUtc(date, time);
  if (!r.ok) return `fejl:${r.reason}`;
  return r.utc.toISOString().replace('.000Z', 'Z');
}

describe('copenhagenToUtc', () => {
  it('vintertid og sommertid', () => {
    expect(iso('2026-11-10', '20:00')).toBe('2026-11-10T19:00:00Z');
    expect(iso('2026-07-10', '20:00')).toBe('2026-07-10T18:00:00Z');
  });
  it('sommertidsskifte 2027-03-28', () => {
    expect(iso('2027-03-28', '02:30')).toBe('fejl:nonexistent');
    expect(iso('2027-03-28', '03:30')).toBe('2027-03-28T01:30:00Z');
    expect(iso('2027-03-28', '01:59')).toBe('2027-03-28T00:59:00Z');
  });
  it('vintertidsskifte 2026-10-25 vælger første forekomst', () => {
    expect(iso('2026-10-25', '02:30')).toBe('2026-10-25T00:30:00Z');
    expect(iso('2026-10-25', '03:00')).toBe('2026-10-25T02:00:00Z');
  });
  it.each([
    ['2026-02-30', '20:00'],
    ['2026-13-01', '20:00'],
    ['2026-11-10', '25:00'],
    ['2026-11-10', '24:00'],
    ['2026-11-10', '12:60'],
    ['abc', '20:00'],
    ['', ''],
    ['2026-11-10', 'abc'],
  ])('afviser %s %s', (d, t) => {
    expect(iso(d, t)).toBe('fejl:invalid');
  });
});

describe('utcToCopenhagen', () => {
  it('runder over midnat', () => {
    // 2026-07-11 er en lørdag
    expect(utcToCopenhagen(new Date('2026-07-10T22:30:00Z'))).toEqual({ date: '2026-07-11', time: '00:30', weekday: 5 });
  });
  it('mandag = 0, søndag = 6', () => {
    expect(utcToCopenhagen(new Date('2026-11-09T12:00:00Z')).weekday).toBe(0);
    expect(utcToCopenhagen(new Date('2026-11-15T12:00:00Z')).weekday).toBe(6);
  });
});

describe('datoregning', () => {
  it('addDaysToDate', () => {
    expect(addDaysToDate('2026-02-27', 2)).toBe('2026-03-01');
    expect(addDaysToDate('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('todayInCopenhagen over midnat', () => {
    expect(todayInCopenhagen(new Date('2026-11-10T22:59:00Z'))).toBe('2026-11-10');
    expect(todayInCopenhagen(new Date('2026-11-10T23:00:00Z'))).toBe('2026-11-11');
    expect(todayInCopenhagen(new Date('2026-07-10T21:59:00Z'))).toBe('2026-07-10');
    expect(todayInCopenhagen(new Date('2026-07-10T22:00:00Z'))).toBe('2026-07-11');
  });
});
