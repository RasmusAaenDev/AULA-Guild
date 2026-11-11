import { describe, expect, it } from 'vitest';
import {
  activeSatire, datedSatire, newestFirst, SATIRE_VISIBLE, parseSatirePreference, satireMode, effectiveTab, satirePosts,
} from '@/lib/satire';
import { addDaysToDate, todayInCopenhagen, utcToCopenhagen } from '@/lib/time';
import { parseTab } from '@/lib/posts-ui';

describe('satire-data', () => {
  const N = satirePosts.length;
  it('har 60 opslag med unikke id\'er satire-01..satire-60 og alle felter', () => {
    expect(N).toBe(60);
    expect(satirePosts.map((p) => p.id)).toEqual(Array.from({ length: 60 }, (_, i) => `satire-${String(i + 1).padStart(2, '0')}`));
    expect(new Set(satirePosts.map((p) => p.id)).size).toBe(N);
    for (const p of satirePosts) {
      expect(p.title.trim()).not.toBe('');
      expect(p.title.length).toBeLessThanOrEqual(60);
      expect(p.author.trim()).not.toBe('');
      expect(typeof p.important).toBe('boolean');
      expect(Array.isArray(p.comments)).toBe(true);
      expect(Array.isArray(p.tags)).toBe(true);
    }
  });
  it('har brødtekst på 40-300 tegn, kommentarer på 10-120 tegn og «(fiktiv)» i alle afsendere og kommentarforfattere', () => {
    for (const p of satirePosts) {
      expect(p.body.length).toBeGreaterThanOrEqual(40);
      expect(p.body.length).toBeLessThanOrEqual(300);
      expect(p.author).toContain('(fiktiv)');
      for (const c of p.comments) {
        expect(c.author).toContain('(fiktiv)');
        expect(c.body.length).toBeGreaterThanOrEqual(10);
        expect(c.body.length).toBeLessThanOrEqual(120);
      }
    }
  });
  it('har 11 vigtige og 19 med kommentarer', () => {
    expect(satirePosts.filter((p) => p.important)).toHaveLength(11);
    expect(satirePosts.filter((p) => p.comments.length > 0)).toHaveLength(19);
  });
  it('har ingen links, @ eller lange cifferfølger', () => {
    for (const p of satirePosts) {
      for (const t of [p.title, p.body, ...p.comments.map((c) => c.body)]) {
        expect(t).not.toMatch(/http/i);
        expect(t).not.toContain('@');
        expect(t).not.toMatch(/\d{6,}/);
      }
    }
  });
  it('har ikke de gamle felter inspiration/sources efter indlæsning', () => {
    for (const p of satirePosts) {
      expect(p).not.toHaveProperty('inspiration');
      expect(p).not.toHaveProperty('sources');
    }
  });
});

describe('activeSatire (rotation)', () => {
  const ids = (d: string) => activeSatire(d).map((p) => p.id);
  it('har 20 unikke opslag', () => {
    expect(SATIRE_VISIBLE).toBe(20);
    expect(new Set(ids('2026-11-10')).size).toBe(20);
  });
  it('glider ét opslag frem pr. dag: ét ud, ét ind', () => {
    const a = ids('2026-11-10');
    const b = ids('2026-11-11');
    expect(b.slice(0, 19)).toEqual(a.slice(1));
    expect(b[19]).not.toBe(a[19]);
  });
  it('kommer rundt efter 60 dage og dækker alle opslag over 41 dage', () => {
    expect(ids('2027-01-09')).toEqual(ids('2026-11-10'));
    const seen = new Set<string>();
    for (let d = 0; d < 41; d++) ids(new Date(Date.UTC(2026, 10, 10 + d)).toISOString().slice(0, 10)).forEach((i) => seen.add(i));
    expect(seen.size).toBe(60);
  });
  it('går rent over årsskifte og skuddag', () => {
    expect(new Set(ids('2028-02-29')).size).toBe(20);
    expect(ids('2027-01-01').slice(0, 19)).toEqual(ids('2026-12-31').slice(1));
  });
});

describe('datedSatire', () => {
  const at = (iso: string) => new Date(iso);
  const days = (key: string, now: Date) => datedSatire(key, now).map((p) => utcToCopenhagen(p.at).date);
  it('dateres til dateKey − (size−1−k), ét pr. dag, og det seneste er fra i dag', () => {
    for (const [key, iso] of [['2026-11-10', '2026-11-10T20:00:00Z'], ['2026-07-01', '2026-07-01T20:00:00Z'], ['2026-03-30', '2026-03-30T20:00:00Z']] as const) {
      const d = datedSatire(key, at(iso));
      expect(d).toHaveLength(SATIRE_VISIBLE);
      expect(d.map((p) => p.id)).toEqual(activeSatire(key).map((p) => p.id));
      expect(days(key, at(iso))).toEqual(Array.from({ length: SATIRE_VISIBLE }, (_, k) => addDaysToDate(key, -(SATIRE_VISIBLE - 1 - k))));
    }
  });
  it('giver klokkeslæt mellem 07:30 og 21:30 i 5-minutters trin, uafhængigt af dagen (sommer og vinter)', () => {
    const late = at('2026-11-10T22:00:00Z');
    for (const p of datedSatire('2026-11-10', late).slice(0, 19)) {
      const [h, m] = utcToCopenhagen(p.at).time.split(':').map(Number);
      const min = h * 60 + m;
      expect(min).toBeGreaterThanOrEqual(450);
      expect(min).toBeLessThanOrEqual(1290);
      expect(min % 5).toBe(0);
    }
    for (const key of ['2026-07-15', '2026-12-15', '2026-03-29', '2026-10-25']) {
      const byId = new Map(datedSatire(key, at(`${key}T23:00:00Z`)).slice(0, -1).map((p) => [p.id, utcToCopenhagen(p.at).time]));
      const ref = new Map(datedSatire('2026-11-10', late).map((p) => [p.id, utcToCopenhagen(p.at).time]));
      for (const [id, t] of byId) if (ref.has(id)) expect(t).toBe(ref.get(id));
    }
  });
  it('er deterministisk inden for samme minut', () => {
    const a = datedSatire('2026-11-10', at('2026-11-10T07:00:05Z')).map((p) => p.at.toISOString());
    const b = datedSatire('2026-11-10', at('2026-11-10T07:00:55Z')).map((p) => p.at.toISOString());
    expect(a).toEqual(b);
  });
  it('lægger aldrig noget i fremtiden og klamper i dag til nu − 5 min', () => {
    for (const iso of ['2026-11-10T05:00:00Z', '2026-11-10T06:31:30Z', '2026-11-10T23:00:00Z', '2026-11-09T23:01:00Z', '2026-07-01T00:10:00Z']) {
      const now = at(iso);
      const key = todayInCopenhagen(now);
      const d = datedSatire(key, now);
      for (const p of d) expect(p.at.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(utcToCopenhagen(d[d.length - 1].at).date).toBe(key);
    }
    const now = at('2026-11-10T06:31:30Z'); // 07:31 dansk
    const today = datedSatire('2026-11-10', now).at(-1)!;
    expect(today.at.getTime()).toBeLessThanOrEqual(Date.UTC(2026, 10, 10, 6, 26));
  });
  it('lader et tidspunkt i dag uberørt, når det allerede er passeret', () => {
    const early = datedSatire('2026-11-10', at('2026-11-10T22:00:00Z')).at(-1)!;
    const later = datedSatire('2026-11-10', at('2026-11-10T22:30:00Z')).at(-1)!;
    expect(early.at.getTime()).toBe(later.at.getTime());
  });
  it('newestFirst sorterer nyeste først uden at ændre kilden', () => {
    const d = datedSatire('2026-11-10', at('2026-11-10T22:00:00Z'));
    const n = newestFirst(d);
    expect(n[0].id).toBe(d.at(-1)!.id);
    expect(d[0].at.getTime()).toBeLessThan(d.at(-1)!.at.getTime());
    for (let i = 1; i < n.length; i++) expect(n[i - 1].at.getTime()).toBeGreaterThan(n[i].at.getTime());
  });
});

describe('parseSatirePreference', () => {
  it('er til som standard og kun fra ved «off»', () => {
    expect(parseSatirePreference(undefined)).toBe(true);
    expect(parseSatirePreference('on')).toBe(true);
    expect(parseSatirePreference('rod')).toBe(true);
    expect(parseSatirePreference('off')).toBe(false);
  });
});

describe('fane til indhold', () => {
  it('indgår kun i tidslinjen i ALLE og vises kun fuldt i SATIRE', () => {
    expect(satireMode('alle', true)).toBe('timeline');
    expect(satireMode('satire', true)).toBe('all');
    for (const t of ['ulaeste', 'vigtige', 'egne', 'gemte'] as const) expect(satireMode(t, true)).toBe('none');
  });
  it('viser aldrig satire når det er slået fra', () => {
    for (const t of ['alle', 'ulaeste', 'vigtige', 'egne', 'gemte', 'satire'] as const) {
      expect(satireMode(t, false)).toBe('none');
    }
    expect(effectiveTab('satire', false)).toBe('alle');
    expect(effectiveTab('satire', true)).toBe('satire');
    expect(effectiveTab('gemte', false)).toBe('gemte');
  });
  it('parseTab kender satire', () => {
    expect(parseTab('satire')).toBe('satire');
  });
});
