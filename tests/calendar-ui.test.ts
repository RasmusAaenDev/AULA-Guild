import { describe, expect, it } from 'vitest';
import {
  calendarMessage, countsLabel, formatClock, formatDayHeading, formatTimeRange, groupByDay, seriesKeptMessage, timeMessage,
} from '@/lib/calendar-ui';

describe('kalender-hjælpere', () => {
  it('formaterer dag på dansk', () => {
    expect(formatDayHeading(new Date('2026-11-16T19:00:00Z'))).toBe('mandag 16. november');
  });
  it('bruger dansk tid ved dagsskifte', () => {
    // 23:30 UTC d. 15. nov = 00:30 d. 16. nov dansk tid
    expect(formatDayHeading(new Date('2026-11-15T23:30:00Z'))).toBe('mandag 16. november');
  });
  it('formaterer klokkeslæt og interval (sommertid)', () => {
    expect(formatClock(new Date('2026-07-10T19:00:00Z'))).toBe('21:00');
    expect(formatTimeRange(new Date('2026-07-10T19:00:00Z'), 120)).toBe('21:00–23:00');
    expect(formatTimeRange(new Date('2026-11-10T19:00:00Z'), null)).toBe('20:00');
  });
  it('grupperer pr. dansk dag og bevarer rækkefølgen', () => {
    const items = [
      { id: 1, startsAt: new Date('2026-11-16T18:00:00Z') },
      { id: 2, startsAt: new Date('2026-11-16T22:30:00Z') }, // 23:30 dansk, samme dag
      { id: 3, startsAt: new Date('2026-11-16T23:30:00Z') }, // 00:30 d. 17.
      { id: 4, startsAt: new Date('2026-11-18T18:00:00Z') },
    ];
    const g = groupByDay(items);
    expect(g.map((x) => x.items.map((i) => i.id))).toEqual([[1, 2], [3], [4]]);
    expect(g[0].label).toBe('mandag 16. november');
    expect(g[1].label).toBe('tirsdag 17. november');
    expect(groupByDay([])).toEqual([]);
  });
  it('tæller roller', () => {
    expect(countsLabel({ tank: 2, healer: 3, dps: 8, total: 13 })).toBe('2 tank · 3 healer · 8 dps');
  });
  it('har danske fejlbeskeder', () => {
    expect(timeMessage('invalid')).toBe('Ugyldig dato eller tid');
    expect(timeMessage('nonexistent')).toBe('Tidspunktet findes ikke (sommertidsskifte)');
    expect(calendarMessage('in_past')).toBe('Tidspunktet ligger i fortiden');
    for (const r of ['invalid', 'forbidden', 'not_found', 'cancelled', 'closed', 'no_character'] as const) {
      expect(calendarMessage(r).length).toBeGreaterThan(10);
    }
  });
  it('viser kun besked om bevarede events når N > 0', () => {
    expect(seriesKeptMessage(0)).toBeNull();
    expect(seriesKeptMessage(NaN)).toBeNull();
    expect(seriesKeptMessage(1)).toBe('1 event har tilmeldinger og blev ikke ændret');
    expect(seriesKeptMessage(3)).toBe('3 events har tilmeldinger og blev ikke ændret');
  });
});
