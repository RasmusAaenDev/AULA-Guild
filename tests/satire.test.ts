import { describe, expect, it } from 'vitest';
import {
  composeAlleFeed, interleave, parseSatirePreference, pickSatire, satireMode, effectiveTab, satirePosts,
} from '@/lib/satire';
import { parseTab } from '@/lib/posts-ui';

describe('satire-data', () => {
  it('har 24 opslag med unikke id\'er og alle felter', () => {
    expect(satirePosts).toHaveLength(24);
    expect(new Set(satirePosts.map((p) => p.id)).size).toBe(24);
    for (const p of satirePosts) {
      expect(p.id).toMatch(/^satire-\d{2}$/);
      expect(p.title.trim()).not.toBe('');
      expect(p.author.trim()).not.toBe('');
      expect(typeof p.important).toBe('boolean');
      expect(Array.isArray(p.comments)).toBe(true);
      expect(Array.isArray(p.tags)).toBe(true);
    }
  });
  it('har brødtekst på 200-600 tegn og «fiktiv» i alle afsendere og kommentarforfattere', () => {
    for (const p of satirePosts) {
      expect(p.body.length).toBeGreaterThanOrEqual(200);
      expect(p.body.length).toBeLessThanOrEqual(600);
      expect(p.author).toContain('fiktiv');
      for (const c of p.comments) {
        expect(c.author).toContain('fiktiv');
        expect(c.body.trim()).not.toBe('');
      }
    }
  });
  it('har præcis 6 vigtige og 8 med kommentarer', () => {
    expect(satirePosts.filter((p) => p.important)).toHaveLength(6);
    expect(satirePosts.filter((p) => p.comments.length > 0)).toHaveLength(8);
  });
  it('har ingen e-mailadresser, links eller telefonlignende tal', () => {
    for (const p of satirePosts) {
      const texts = [p.title, p.body, ...p.comments.map((c) => c.body)];
      for (const t of texts) {
        expect(t).not.toMatch(/\S+@\S+/);
        expect(t).not.toMatch(/https?:\/\/|www\./i);
        expect(t).not.toMatch(/\d[\d .-]{6,}\d/);
        expect(t).not.toMatch(/\d{5,}/);
      }
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
  it('afkorter til 0..24', () => {
    expect(pickSatire('2026-11-10', 1, 0)).toEqual([]);
    expect(pickSatire('2026-11-10', 1, -3)).toEqual([]);
    expect(new Set(pickSatire('2026-11-10', 1, 99).map((p) => p.id)).size).toBe(24);
  });
  it('giver forskellige valg for forskellige sider og dage', () => {
    const ids = (d: string, p: number) => pickSatire(d, p, 6).map((x) => x.id).join(',');
    expect(ids('2026-11-10', 1)).not.toBe(ids('2026-11-10', 2));
    expect(ids('2026-11-10', 1)).not.toBe(ids('2026-11-11', 1));
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

describe('composeAlleFeed', () => {
  const sat = pickSatire('2026-11-10', 1, 4);
  it('flette ét efter hvert 3. ægte', () => {
    const f = composeAlleFeed(['a', 'b', 'c', 'd'], sat, 1);
    expect(f.map((x) => x.kind)).toEqual(['real', 'real', 'real', 'satire', 'real']);
  });
  it('viser mindst ét satire-opslag sidst, når der er færre end 3 ægte på side 1', () => {
    expect(composeAlleFeed(['a', 'b'], sat, 1).map((x) => x.kind)).toEqual(['real', 'real', 'satire']);
    expect(composeAlleFeed([], sat, 1).map((x) => x.kind)).toEqual(['satire']);
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
