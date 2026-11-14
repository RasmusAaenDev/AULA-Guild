import { describe, expect, it } from 'vitest';
import {
  activeSatire, clockFor, datedSatire, newestFirst, SATIRE_CYCLE_DAYS, SATIRE_PER_DAY, SATIRE_TIMELINE_DAYS, SATIRE_VISIBLE,
  SATIRE_RANDOM_COUNT, SATIRE_WINDOW_DAYS, parseSatirePreference, randomSatire, satireMode, effectiveTab, satirePosts, timelineSatire,
} from '@/lib/satire';
import { addDaysToDate, todayInCopenhagen, utcToCopenhagen } from '@/lib/time';
import { parseTab } from '@/lib/posts-ui';

describe('satire-data', () => {
  const N = satirePosts.length;
  it('har 200 opslag med unikke id\'er satire-01..satire-200 og alle felter', () => {
    expect(N).toBe(200);
    expect(SATIRE_CYCLE_DAYS).toBe(40);
    expect(satirePosts.map((p) => p.id)).toEqual(Array.from({ length: 200 }, (_, i) => `satire-${String(i + 1).padStart(2, '0')}`));
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
  it('har 35 vigtige og kommentarer på alle opslag', () => {
    expect(satirePosts.filter((p) => p.important)).toHaveLength(35);
    expect(satirePosts.filter((p) => p.comments.length > 0)).toHaveLength(200);
    expect(satirePosts.filter((p) => p.comments.length === 0)).toHaveLength(0);
  });
  it('har unikke titler', () => {
    expect(new Set(satirePosts.map((p) => p.title)).size).toBe(N);
  });
  it('har højst 10 kommentarer pr. opslag', () => {
    for (const p of satirePosts) expect(p.comments.length).toBeLessThanOrEqual(10);
    expect(Math.max(...satirePosts.map((p) => p.comments.length))).toBe(10);
  });
  it('bruger et fast persongalleri af kommentarforfattere, alle med «(fiktiv)»', () => {
    const gallery = new Set([
      'Oscars far', 'Oscars mor', 'Oscars mormor', 'Idas mor', 'Idas far', 'Idas mormor', 'Emils far',
      'Storms mor', 'Storms far', 'Valdemars mor', 'Valdemars far', 'Majas mor', 'Majas far', 'Sofies mor',
      'Alberts mor', "Lucas' far", 'Frejas mormor', 'Noahs mor', 'Karls mor', 'Wilmas far', 'Malthes far',
      'Naboen Preben', 'Klasselærer Anja', 'SFO-personalet', 'Pædagog Bent', 'Skolelederen', 'Skolens pedel',
      'Skolens bibliotekar', 'Kageudvalget', 'Klasseforældrerådet', 'Skolekøkkenet', 'Vikaren', 'Skolesekretæren',
      'Ebbas mor', 'Lærer Klausen', 'Tvillingernes mor',
    ].map((n) => `${n} (fiktiv)`));
    for (const p of satirePosts) for (const c of p.comments) expect(gallery).toContain(c.author);
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

const key = (base: string, d: number) => {
  const [y, m, dd] = base.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd + d)).toISOString().slice(0, 10);
};

describe('activeSatire (rotation)', () => {
  const ids = (d: string) => activeSatire(d).map((p) => p.id);
  const today = (d: string) => ids(d).slice(-SATIRE_PER_DAY);
  it('har 5 opslag pr. dag og et vindue på hele 5 dage = 25 unikke opslag', () => {
    expect(SATIRE_PER_DAY).toBe(5);
    expect(SATIRE_WINDOW_DAYS).toBe(5);
    expect(SATIRE_VISIBLE).toBe(25);
    expect(SATIRE_VISIBLE % SATIRE_PER_DAY).toBe(0);
    for (const d of ['2026-11-10', '2026-12-31', '2027-01-01', '2028-02-29']) expect(new Set(ids(d)).size).toBe(25);
  });
  it('glider 5 opslag frem pr. dag: fem ud, fem nye ind', () => {
    for (const d of ['2026-11-10', '2026-12-31', '2028-02-28', '2028-02-29', '2026-03-28', '2026-10-24']) {
      const a = ids(d);
      const b = ids(key(d, 1));
      expect(b.slice(0, 20)).toEqual(a.slice(5));
      for (const id of today(key(d, 1))) expect(a).not.toContain(id);
    }
  });
  it('har en cyklus på pulje/5 dage, og alle opslag kommer med i den', () => {
    const N = satirePosts.length;
    const C = SATIRE_CYCLE_DAYS;
    expect(N % SATIRE_PER_DAY).toBe(0);
    expect(C).toBe(N / SATIRE_PER_DAY);
    expect(ids(key('2026-11-10', C))).toEqual(ids('2026-11-10'));
    for (let d = 1; d < C; d++) expect(ids(key('2026-11-10', d))).not.toEqual(ids('2026-11-10'));
    const news = new Set<string>();
    for (let d = 0; d < C; d++) today(key('2026-11-10', d)).forEach((i) => news.add(i));
    expect(news.size).toBe(N);
    const seen = new Set<string>();
    for (let d = 0; d <= C - SATIRE_WINDOW_DAYS; d++) ids(key('2026-11-10', d)).forEach((i) => seen.add(i));
    expect(seen.size).toBe(N);
    const short = new Set<string>();
    for (let d = 0; d < C - SATIRE_WINDOW_DAYS; d++) ids(key('2026-11-10', d)).forEach((i) => short.add(i));
    expect(short.size).toBe(N - SATIRE_PER_DAY);
  });
  it('går rent over årsskifte og skuddag', () => {
    expect(ids('2027-01-01').slice(0, 20)).toEqual(ids('2026-12-31').slice(5));
    expect(ids('2028-02-29').slice(0, 20)).toEqual(ids('2028-02-28').slice(5));
    expect(ids('2028-03-01').slice(0, 20)).toEqual(ids('2028-02-29').slice(5));
  });
});

describe('datedSatire', () => {
  const at = (iso: string) => new Date(iso);
  const local = (d: Date) => utcToCopenhagen(d);
  const days = (k: string, now: Date) => datedSatire(k, now).map((p) => local(p.at).date);
  it('dateres fem pr. dag: de 5 nyeste i dag, de 5 før i går osv.', () => {
    for (const [k, iso] of [['2026-11-10', '2026-11-10T22:00:00Z'], ['2026-07-01', '2026-07-01T21:00:00Z'], ['2026-03-30', '2026-03-30T21:00:00Z'], ['2027-01-01', '2027-01-01T22:00:00Z'], ['2028-02-29', '2028-02-29T22:00:00Z']] as const) {
      const d = datedSatire(k, at(iso));
      expect(d).toHaveLength(SATIRE_VISIBLE);
      expect(d.map((p) => p.id)).toEqual(activeSatire(k).map((p) => p.id));
      expect(days(k, at(iso))).toEqual(Array.from({ length: SATIRE_VISIBLE }, (_, i) => addDaysToDate(k, -(SATIRE_WINDOW_DAYS - 1 - Math.floor(i / SATIRE_PER_DAY)))));
    }
    expect(days('2027-01-01', at('2027-01-01T22:00:00Z')).slice(15, 20)).toEqual(Array(5).fill('2026-12-31'));
    expect(days('2028-03-01', at('2028-03-01T22:00:00Z')).slice(15, 20)).toEqual(Array(5).fill('2028-02-29'));
  });
  it('giver klokkeslæt mellem 07:30 og 21:30 i 5-minutters trin, fem forskellige pr. dag og stigende', () => {
    const d = datedSatire('2026-11-10', at('2026-11-10T22:00:00Z'));
    for (const p of d) {
      const [h, m] = local(p.at).time.split(':').map(Number);
      const min = h * 60 + m;
      expect(min).toBeGreaterThanOrEqual(450);
      expect(min).toBeLessThanOrEqual(1290);
      expect(min % 5).toBe(0);
    }
    for (let i = 1; i < d.length; i++) expect(d[i].at.getTime()).toBeGreaterThan(d[i - 1].at.getTime());
  });
  it('har samme klokkeslæt pr. opslag uanset dag og sommer-/vintertid', () => {
    const ref = new Map(datedSatire('2026-11-10', at('2026-11-10T22:00:00Z')).map((p) => [p.id, local(p.at).time]));
    for (const k of ['2026-07-15', '2026-12-15', '2026-03-29', '2026-10-25', '2026-12-10']) {
      for (const p of datedSatire(k, at(`${k}T23:00:00Z`))) {
        if (ref.has(p.id)) expect(local(p.at).time).toBe(ref.get(p.id));
      }
    }
  });
  it('følger id\'ets klokkeslæt, undtagen når to i samme dag falder sammen', () => {
    const all = Array.from({ length: SATIRE_CYCLE_DAYS }, (_, d) => datedSatire(key('2026-11-10', d), at(`${key('2026-11-10', d)}T23:00:00Z`)).slice(-5)).flat();
    const same = all.filter((p) => local(p.at).time === clockFor(p.id)).length;
    expect(all).toHaveLength(satirePosts.length);
    expect(same).toBeGreaterThanOrEqual(satirePosts.length - 10);
  });
  it('er deterministisk inden for samme minut', () => {
    const a = datedSatire('2026-11-10', at('2026-11-10T07:00:05Z')).map((p) => p.at.toISOString());
    const b = datedSatire('2026-11-10', at('2026-11-10T07:00:55Z')).map((p) => p.at.toISOString());
    expect(a).toEqual(b);
  });
  it('lægger aldrig noget i fremtiden, holder dagens fem i dag og i rækkefølge', () => {
    for (const iso of ['2026-11-10T05:00:00Z', '2026-11-10T06:31:30Z', '2026-11-10T12:00:00Z', '2026-11-10T23:00:00Z', '2026-11-09T23:01:00Z', '2026-11-09T23:30:00Z', '2026-07-01T00:10:00Z', '2026-12-31T23:20:00Z', '2028-02-28T23:45:00Z', '2026-03-29T01:30:00Z']) {
      const now = at(iso);
      const k = todayInCopenhagen(now);
      const d = datedSatire(k, now);
      for (const p of d) expect(p.at.getTime()).toBeLessThanOrEqual(now.getTime());
      for (const p of d.slice(-5)) expect(local(p.at).date).toBe(k);
      for (let i = 1; i < d.length; i++) expect(d[i].at.getTime()).toBeGreaterThanOrEqual(d[i - 1].at.getTime());
    }
  });
  it('flytter fremtidige tider i dag til nu − 5, − 10 … min i hele minutter', () => {
    const now = at('2026-11-10T06:31:30Z'); // 07:31 dansk: alle fem ligger senere
    const today = datedSatire('2026-11-10', now).slice(-5).map((p) => p.at.getTime());
    const nowMin = Date.UTC(2026, 10, 10, 6, 31);
    expect(today).toEqual([25, 20, 15, 10, 5].map((m) => nowMin - m * 60_000));
    const noon = at('2026-11-10T11:00:20Z'); // 12:00 dansk
    const d = datedSatire('2026-11-10', noon).slice(-5);
    const late = datedSatire('2026-11-10', at('2026-11-10T22:00:00Z')).slice(-5);
    for (let i = 0; i < 5; i++) {
      if (late[i].at.getTime() <= noon.getTime()) expect(d[i].at.getTime()).toBe(late[i].at.getTime());
      else expect(d[i].at.getTime() % 60_000).toBe(0);
    }
    for (let i = 1; i < 5; i++) expect(d[i].at.getTime()).toBeGreaterThan(d[i - 1].at.getTime());
  });
  it('mindsker trinnet lige efter midnat, men bliver i dag og ikke i fremtiden', () => {
    const now = at('2026-11-09T23:12:00Z'); // 00:12 dansk
    const d = datedSatire('2026-11-10', now).slice(-5);
    const start = Date.UTC(2026, 10, 9, 23, 0);
    for (const p of d) {
      expect(p.at.getTime()).toBeGreaterThanOrEqual(start);
      expect(p.at.getTime()).toBeLessThanOrEqual(now.getTime());
    }
    for (let i = 1; i < 5; i++) expect(d[i].at.getTime()).toBeGreaterThan(d[i - 1].at.getTime());
  });
  it('lader et tidspunkt i dag uberørt, når det allerede er passeret', () => {
    const early = datedSatire('2026-11-10', at('2026-11-10T22:00:00Z')).slice(-5);
    const later = datedSatire('2026-11-10', at('2026-11-10T22:30:00Z')).slice(-5);
    expect(early.map((p) => p.at.getTime())).toEqual(later.map((p) => p.at.getTime()));
  });
  it('newestFirst sorterer nyeste først uden at ændre kilden, og ved samme tid det seneste i puljen først', () => {
    const d = datedSatire('2026-11-10', at('2026-11-10T22:00:00Z'));
    const n = newestFirst(d);
    expect(n[0].id).toBe(d.at(-1)!.id);
    expect(d[0].at.getTime()).toBeLessThan(d.at(-1)!.at.getTime());
    for (let i = 1; i < n.length; i++) expect(n[i - 1].at.getTime()).toBeGreaterThan(n[i].at.getTime());
    const t = new Date(0);
    expect(newestFirst([{ id: 'a', at: t }, { id: 'b', at: t }]).map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('timelineSatire (Alle-fanen)', () => {
  it('giver kun de seneste 2 dages 10 opslag, nyeste først', () => {
    expect(SATIRE_TIMELINE_DAYS).toBe(2);
    const now = new Date('2026-11-10T22:00:00Z');
    const t = timelineSatire('2026-11-10', now);
    expect(t).toHaveLength(10);
    const pool = datedSatire('2026-11-10', now);
    expect(t.map((p) => p.id)).toEqual(pool.slice(-10).reverse().map((p) => p.id));
    expect(t.map((p) => utcToCopenhagen(p.at).date)).toEqual([...Array(5).fill('2026-11-10'), ...Array(5).fill('2026-11-09')]);
  });
  it('har dagens fem øverst, også om morgenen hvor de er flyttet til lige før nu', () => {
    const now = new Date('2026-11-10T06:31:30Z');
    const t = timelineSatire('2026-11-10', now);
    expect(t.slice(0, 5).map((p) => p.id)).toEqual(activeSatire('2026-11-10').slice(-5).reverse().map((p) => p.id));
    for (const p of t) expect(p.at.getTime()).toBeLessThanOrEqual(now.getTime());
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

describe('randomSatire (knappen «Vis flere» nederst i satire-listen)', () => {
  const now = new Date('2026-11-14T10:00:00Z');
  const pick = (seed: string) => randomSatire(seed, '2026-11-14', now);
  it('giver fem forskellige opslag med alle deres kommentarer', () => {
    expect(SATIRE_RANDOM_COUNT).toBe(5);
    const r = pick('abc123');
    expect(r).toHaveLength(5);
    expect(new Set(r.map((p) => p.id)).size).toBe(5);
    for (const p of r) expect(p.comments).toEqual(satirePosts.find((x) => x.id === p.id)!.comments);
  });
  it('giver det samme udvalg for samme frø og et andet for et nyt', () => {
    expect(pick('abc123').map((p) => p.id)).toEqual(pick('abc123').map((p) => p.id));
    const ids = new Set<string>();
    for (const seed of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8']) pick(seed).forEach((p) => ids.add(p.id));
    expect(ids.size).toBeGreaterThan(20);
    expect(pick('a1').map((p) => p.id)).not.toEqual(pick('b2').map((p) => p.id));
  });
  it('trækker fra hele puljen, ikke kun dagens vindue', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) pick(`s${i}`).forEach((p) => seen.add(p.id));
    expect(seen.size).toBeGreaterThan(190);
  });
  it('lægger intet i fremtiden', () => {
    for (let i = 0; i < 50; i++) for (const p of pick(`t${i}`)) expect(p.at.getTime()).toBeLessThanOrEqual(now.getTime());
  });
  it('springer de allerede viste opslag over og stopper, når samlingen er brugt', () => {
    const shown = satirePosts.slice(0, 40).map((p) => p.id);
    for (let i = 0; i < 30; i++) for (const p of randomSatire(`x${i}`, '2026-11-14', now, 5, shown)) expect(shown).not.toContain(p.id);
    const all = satirePosts.map((p) => p.id);
    expect(randomSatire('x', '2026-11-14', now, 5, all)).toEqual([]);
    expect(randomSatire('x', '2026-11-14', now, 5, all.slice(2)).map((p) => p.id).sort()).toEqual(all.slice(0, 2).sort());
  });
});
