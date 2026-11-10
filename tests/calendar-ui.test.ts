import { describe, expect, it } from 'vitest';
import {
  calendarMessage, countsLabel, formatClock, formatDayHeading, formatDayMonth, formatTimeRange, pinnedEvent, selectNextEvents, groupByDay, seriesKeptMessage, timeMessage,
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
    expect(calendarMessage('series_date_change')).toBe(
      'Et event i en serie kan ikke flyttes til en anden dag. Aflys forekomsten og opret et enkeltstående event.',
    );
    for (const r of ['invalid', 'forbidden', 'not_found', 'cancelled', 'closed', 'no_character', 'series_date_change'] as const) {
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

import type { EventListItem } from '@/lib/events';

describe('formatDayMonth', () => {
  it('giver dag og kort måned uden punktum i dansk tid', () => {
    expect(formatDayMonth(new Date('2026-11-12T18:00:00Z'))).toEqual({ day: '12', month: 'nov' });
    expect(formatDayMonth(new Date('2026-03-05T12:00:00Z'))).toEqual({ day: '5', month: 'mar' });
  });
  it('bruger dansk dato omkring midnat', () => {
    expect(formatDayMonth(new Date('2026-11-12T23:30:00Z'))).toEqual({ day: '13', month: 'nov' });
    expect(formatDayMonth(new Date('2026-07-31T22:30:00Z'))).toEqual({ day: '1', month: 'aug' });
  });
});

describe('selectNextEvents', () => {
  const NOW = new Date('2026-11-10T12:00:00Z');
  const ev = (id: number, type: 'raid' | 'aften', hours: number, over: Partial<EventListItem> = {}): EventListItem => ({
    id, type, title: `E${id}`, startsAt: new Date(NOW.getTime() + hours * 3600_000), durationMinutes: 60,
    cancelled: false, seriesId: null, counts: { tank: 0, healer: 0, dps: 0, total: 0 }, myStatus: null, ...over,
  });
  const ids = (r: { shown: EventListItem[] }) => r.shown.map((e) => e.id);

  it('tager de første max og ingen ekstra, når næste raid og aften er med', () => {
    const list = [ev(1, 'raid', 1), ev(2, 'aften', 2), ev(3, 'raid', 3), ev(4, 'aften', 4), ev(5, 'raid', 5), ev(6, 'raid', 6)];
    const r = selectNextEvents(list, NOW);
    expect(ids(r)).toEqual([1, 2, 3, 4, 5]);
    expect([...r.rsvpIds].sort()).toEqual([1, 2]);
  });

  it('tager næste raid med, selv om den ligger efter den femte', () => {
    const list = [1, 2, 3, 4, 5].map((i) => ev(i, 'aften', i)).concat(ev(6, 'raid', 6), ev(7, 'aften', 7));
    const r = selectNextEvents(list, NOW);
    expect(ids(r)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.rsvpIds).toEqual(new Set([1, 6]));
  });

  it('tager næste aften med, selv om den ligger efter den femte', () => {
    const list = [1, 2, 3, 4, 5].map((i) => ev(i, 'raid', i)).concat(ev(6, 'aften', 6));
    const r = selectNextEvents(list, NOW);
    expect(ids(r)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.rsvpIds).toEqual(new Set([1, 6]));
  });

  it('kan overskride max med højst to og holder rækkefølgen', () => {
    const list = [1, 2, 3, 4, 5].map((i) => ev(i, 'raid', i)).concat(ev(6, 'raid', 6), ev(7, 'aften', 7));
    const r = selectNextEvents(list, NOW, 3);
    expect(ids(r)).toEqual([1, 2, 3, 7]);
    const worst = selectNextEvents([ev(1, 'raid', 1), ev(2, 'raid', 2), ev(3, 'raid', 3), ev(4, 'aften', 4), ev(5, 'aften', 5)], NOW, 1);
    expect(ids(worst)).toEqual([1, 4]);
    const none = selectNextEvents([ev(1, 'raid', 1)], NOW, 0);
    expect(none.shown.length).toBeLessThanOrEqual(2);
  });

  it('klarer at der slet ingen raid (eller aften) findes', () => {
    const r = selectNextEvents([ev(1, 'aften', 1), ev(2, 'aften', 2)], NOW);
    expect(ids(r)).toEqual([1, 2]);
    expect(r.rsvpIds).toEqual(new Set([1]));
    expect(selectNextEvents([], NOW)).toEqual({ shown: [], rsvpIds: new Set() });
  });

  it('udelader aflyste og allerede startede events', () => {
    const list = [
      ev(1, 'raid', -1), ev(2, 'raid', 0), ev(3, 'raid', 2, { cancelled: true }), ev(4, 'aften', 3, { cancelled: true }),
      ev(5, 'raid', 4), ev(6, 'aften', 5),
    ];
    const r = selectNextEvents(list, NOW);
    expect(ids(r)).toEqual([5, 6]);
    expect(r.rsvpIds).toEqual(new Set([5, 6]));
  });

  it('sorterer ens starttidspunkter efter id', () => {
    const r = selectNextEvents([ev(9, 'raid', 2), ev(4, 'aften', 2), ev(7, 'raid', 2)], NOW);
    expect(ids(r)).toEqual([4, 7, 9]);
  });
});

describe('pinnedEvent', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  const ev = (id: number, hoursAhead: number, over: Partial<EventListItem> = {}): EventListItem => ({
    id, type: 'aften', title: `e${id}`, startsAt: new Date(now.getTime() + hoursAhead * 3600_000), durationMinutes: null,
    cancelled: false, seriesId: null, counts: { tank: 0, healer: 0, dps: 0, total: 0 } as never, myStatus: null, ...over,
  });
  it('vælger den næste begivenhed, når den er inden for 3 døgn (inklusive 72 timer)', () => {
    expect(pinnedEvent([ev(2, 30), ev(1, 5)], now)?.id).toBe(1);
    expect(pinnedEvent([ev(1, 72)], now)?.id).toBe(1);
  });
  it('giver null når den næste er senere end 3 døgn, aflyst eller allerede startet', () => {
    expect(pinnedEvent([ev(1, 72.1)], now)).toBeNull();
    expect(pinnedEvent([ev(1, 5, { cancelled: true })], now)).toBeNull();
    expect(pinnedEvent([ev(1, -1)], now)).toBeNull();
    expect(pinnedEvent([], now)).toBeNull();
  });
  it('en aflyst nær begivenhed overstyrer ikke: næste ikke-aflyste vælges', () => {
    expect(pinnedEvent([ev(1, 5, { cancelled: true }), ev(2, 20)], now)?.id).toBe(2);
    expect(pinnedEvent([ev(1, 5, { cancelled: true }), ev(2, 100)], now)).toBeNull();
  });
});
