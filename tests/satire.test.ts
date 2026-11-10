import { describe, expect, it } from 'vitest';
import {
  activeSatire, composeAlleFeed, interleave, SATIRE_VISIBLE, parseSatirePreference, pickSatire, satireMode, effectiveTab, satirePosts, satireNeeded,
} from '@/lib/satire';
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

describe('pickSatire', () => {
  it('er deterministisk og har den rette bredde uden dubletter', () => {
    const a = pickSatire('2026-11-10', 1, 5);
    const b = pickSatire('2026-11-10', 1, 5);
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
    expect(a).toHaveLength(5);
    expect(new Set(a.map((p) => p.id)).size).toBe(5);
  });
  it('afkorter til 0..antal opslag', () => {
    expect(pickSatire('2026-11-10', 1, 0)).toEqual([]);
    expect(pickSatire('2026-11-10', 1, -3)).toEqual([]);
    expect(new Set(pickSatire('2026-11-10', 1, 99).map((p) => p.id)).size).toBe(SATIRE_VISIBLE);
  });
  it('giver forskellige valg for forskellige sider og dage', () => {
    const ids = (d: string, p: number) => pickSatire(d, p, 6).map((x) => x.id).join(',');
    expect(ids('2026-11-10', 1)).not.toBe(ids('2026-11-10', 2));
    expect(ids('2026-11-10', 1)).not.toBe(ids('2026-11-11', 1));
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

describe('interleave', () => {
  const real = (n: number) => Array.from({ length: n }, (_, i) => `r${i + 1}`);
  const sat = ['s1', 's2', 's3'];
  const show = (r: string[]) => interleave(r, sat).map((x) => (x.kind === 'real' ? x.item : x.item)).join(' ');
  it('indsætter ét efter hvert 3. ægte', () => {
    expect(show(real(7))).toBe('r1 r2 r3 s1 r4 r5 r6 s2 r7');
  });
  it('slutter uden satire ved færre end 3 ægte og håndterer tom liste', () => {
    expect(show(real(2))).toBe('r1 r2');
    expect(interleave([], sat)).toEqual([]);
  });
  it('indsætter også efter et eksakt multiplum', () => {
    expect(show(real(6))).toBe('r1 r2 r3 s1 r4 r5 r6 s2');
  });
  it('stopper når satire løber tør og respekterer every', () => {
    expect(interleave(real(9), ['s1']).filter((x) => x.kind === 'satire')).toHaveLength(1);
    expect(interleave(real(4), sat, 2).map((x) => x.item).join(' ')).toBe('r1 r2 s1 r3 r4 s2');
    expect(interleave(real(3), sat, 0).map((x) => x.item).join(' ')).toBe('r1 r2 r3');
  });
});

describe('satireNeeded', () => {
  it('giver mindst 5 på side 1 og ellers ét pr. 3. ægte', () => {
    expect(satireNeeded(0, 1)).toBe(5);
    expect(satireNeeded(2, 1)).toBe(5);
    expect(satireNeeded(30, 1)).toBe(10);
    expect(satireNeeded(0, 2)).toBe(0);
    expect(satireNeeded(2, 2)).toBe(1);
    expect(satireNeeded(9, 2)).toBe(3);
  });
});

describe('composeAlleFeed', () => {
  const sat = pickSatire('2026-11-10', 1, 4);
  it('flette ét efter hvert 3. ægte', () => {
    const f = composeAlleFeed(['a', 'b', 'c', 'd'], sat, 1);
    expect(f.map((x) => x.kind)).toEqual(['real', 'real', 'real', 'satire', 'real', 'satire', 'satire', 'satire']);
  });
  it('lægger resten af satire sidst på side 1, når der er få ægte opslag', () => {
    expect(composeAlleFeed(['a', 'b'], sat, 1).map((x) => x.kind)).toEqual(['real', 'real', 'satire', 'satire', 'satire', 'satire']);
    expect(composeAlleFeed([], sat, 1).map((x) => x.kind)).toEqual(['satire', 'satire', 'satire', 'satire']);
  });
  it('viser ét satire-opslag på side 2 med få ægte opslag', () => {
    expect(composeAlleFeed(['a', 'b'], sat, 2).map((x) => x.kind)).toEqual(['real', 'real', 'satire']);
  });
  it('viser ingen satire på tom side 2 eller når det er slået fra', () => {
    expect(composeAlleFeed([], sat, 2)).toEqual([]);
    expect(composeAlleFeed(['a', 'b', 'c', 'd'], [], 1).every((x) => x.kind === 'real')).toBe(true);
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
  it('flettes kun ind i ALLE og vises kun fuldt i SATIRE', () => {
    expect(satireMode('alle', true)).toBe('interleaved');
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
