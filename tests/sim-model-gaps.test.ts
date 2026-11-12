import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SimCard } from '@/app/(app)/sim/SimCard';
import { MODEL_GAPS, isAulaModel, modelGap, specKey } from '@/lib/sim-model-gaps';
import type { SimView } from '@/lib/sims';

vi.mock('@/app/(app)/sim/actions', () => ({ deleteSimAction: async () => ({}) }));

const GROV = 'Grov model: klassen er implementeret af Aula, ikke af SimulationCraft. Tallene er vejledende.';
const GROV_FIX = "Grov model: SimulationCraft's grundmodel med Aulas rettelser. Tallene er vejledende.";

describe('modelGap (ren logik)', () => {
  it('upstream-klasser uden vores rettelse får en konkret advarsel', () => {
    for (const cls of ['warrior', 'hunter', 'shaman', 'druid', 'priest', 'warlock']) {
      const g = modelGap({ className: cls, spec: cls }, []);
      expect(g?.kind, cls).toBe('upstream');
      expect(g?.title).toMatch(/^Simulatoren mangler vigtige evner for /);
      expect(g?.text).toMatch(/bør ikke bruges til at sammenligne med andre klasser/);
    }
    expect(modelGap({ className: 'warlock', spec: null }, [])?.missing).toMatch(/Life Tap og wand/);
    expect(modelGap({ className: 'shaman', spec: 'Elemental Combat' }, [])?.missing).toMatch(/Lightning Bolt/);
    expect(modelGap({ className: 'priest', spec: 'Shadow Magic' }, [])?.title).toBe('Simulatoren mangler vigtige evner for Priest (Shadow Magic)');
    expect(modelGap({ className: 'hunter', spec: 'Beast Mastery' }, [])?.missing).toMatch(/^pet/);
  });
  it('klassenavn uanset store/små bogstaver; ukendt spec giver klassens fælles tekst', () => {
    expect(modelGap({ className: 'Warrior', spec: 'Ukendt' }, [])?.missing).toBe(`${MODEL_GAPS.warrior['*'].upstream}.`);
    expect(modelGap({ className: 'Warrior', spec: 'Ukendt' }, [])?.title).toBe('Simulatoren mangler vigtige evner for Warrior');
  });
  it('med «Grov model» (vores rettelse) falder upstream-advarslen væk', () => {
    expect(modelGap({ className: 'priest', spec: 'Holy' }, [GROV])).toBeNull();
    expect(modelGap({ className: 'druid', spec: 'Balance' }, [GROV])).toBeNull();
    expect(modelGap({ className: 'druid', spec: null }, [GROV])).toBeNull();
    // Warlock og shaman (rettelse oven på upstream): ukendt spec giver ingen advarsel.
    expect(modelGap({ className: 'warlock', spec: null }, [GROV_FIX])).toBeNull();
    expect(modelGap({ className: 'shaman', spec: 'shaman' }, [GROV_FIX])).toBeNull();
  });
  it('warlock og shaman med vores rettelse: gul advarsel med det, rettelsen ikke dækker', () => {
    const demo = modelGap({ className: 'warlock', spec: 'Demonology' }, [GROV_FIX]);
    expect(demo).toMatchObject({ kind: 'partial', title: 'Aulas model dækker ikke Warlock (Demonology) fuldt ud' });
    expect(demo?.missing).toMatch(/Voidwalker/);
    for (const spec of ['Affliction', 'Destruction']) {
      expect(modelGap({ className: 'warlock', spec }, [GROV_FIX])?.missing, spec).toMatch(/Life Tap koster ikke liv/);
    }
    const ele = modelGap({ className: 'shaman', spec: 'Elemental Combat' }, [GROV_FIX]);
    expect(ele).toMatchObject({ kind: 'partial', title: 'Aulas model dækker ikke Shaman (Elemental Combat) fuldt ud' });
    expect(ele?.missing).toMatch(/Under level 26 \(før Mana Spring Totem\)/);
    expect(ele?.missing).not.toMatch(/^Mana Spring/);
    expect(modelGap({ className: 'shaman', spec: 'Enhancement' }, [GROV_FIX])?.missing).toMatch(/Windfury Weapon/);
    expect(modelGap({ className: 'shaman', spec: 'Restoration' }, [GROV_FIX])?.missing).toMatch(/healing/);
    expect(modelGap({ className: 'shaman', spec: 'Restoration' }, [GROV_FIX])?.missing).toMatch(/med Mana Spring og Mana Tide Totem/);
    // Uden rettelsen er det stadig den røde upstream-advarsel.
    expect(modelGap({ className: 'warlock', spec: 'Demonology' }, [])?.kind).toBe('upstream');
  });
  it('specs vores rettelse ikke dækker: delvis advarsel kun sammen med «Grov model»', () => {
    const holy = modelGap({ className: 'paladin', spec: 'Holy' }, [GROV]);
    expect(holy).toMatchObject({ kind: 'partial', title: 'Aulas model dækker ikke Paladin (Holy) fuldt ud' });
    // Holy Shock er nu med i rettelsen; advarslen nævner kun, hvordan den bruges.
    expect(holy?.missing).toMatch(/^healing \(kun skade simuleres\)/);
    expect(holy?.missing).toMatch(/Holy Shock bruges kun over halv mana/);
    const prot = modelGap({ className: 'paladin', spec: 'Protection' }, [GROV]);
    expect(prot?.missing).toMatch(/^Reckoning/);
    expect(prot?.missing).toMatch(/Shieldsworn/);
    // Rogue Combat/Subtlety: Backstab, Hemorrhage og Ghostly Strike er nu med; resten står i advarslen.
    const sub = modelGap({ className: 'rogue', spec: 'Subtlety' }, [GROV]);
    expect(sub).toMatchObject({ kind: 'partial', title: 'Aulas model dækker ikke Rogue (Subtlety) fuldt ud' });
    expect(sub?.missing).toMatch(/^Death Mark/);
    expect(sub?.missing).not.toMatch(/Hemorrhage|Ghostly Strike/);
    expect(modelGap({ className: 'rogue', spec: 'Combat' }, [GROV])?.missing).toMatch(/^Riposte/);
    expect(modelGap({ className: 'rogue', spec: 'Combat' }, [GROV])?.missing).not.toMatch(/Hack and Slash/);
    expect(modelGap({ className: 'druid', spec: 'Feral Combat' }, [GROV])?.missing).toMatch(/kat/);
    // Dækket spec, mage og ukendt spec: ingen advarsel.
    expect(modelGap({ className: 'paladin', spec: 'Retribution' }, [GROV])).toBeNull();
    expect(modelGap({ className: 'paladin', spec: 'paladin' }, [GROV])).toBeNull();
    expect(modelGap({ className: 'rogue', spec: 'Assassination' }, [GROV])).toBeNull();
    expect(modelGap({ className: 'mage', spec: 'Frost' }, [GROV])).toBeNull();
    expect(modelGap({ className: 'mage', spec: 'Frost' }, [])).toBeNull();
    // Paladin uden rettelse (0 DPS) har sin egen «ingen rotation»-tekst.
    expect(modelGap({ className: 'paladin', spec: 'Holy' }, [])).toBeNull();
  });
  it('specKey og isAulaModel', () => {
    expect(specKey(' Feral  Combat ')).toBe('feral');
    expect(specKey('Elemental Combat')).toBe('elemental');
    expect(specKey('')).toBeNull();
    expect(specKey(null)).toBeNull();
    expect(isAulaModel([GROV])).toBe(true);
    expect(isAulaModel(['DPS er 0 eller mangler'])).toBe(false);
  });
  it('hver tekst er en kort, konkret liste (ingen tomme felter)', () => {
    for (const [cls, specs] of Object.entries(MODEL_GAPS)) {
      for (const [spec, g] of Object.entries(specs)) {
        for (const t of [g.upstream, g.withFix]) if (t !== undefined) expect(t.length, `${cls}/${spec}`).toBeGreaterThan(10);
        expect(g.upstream ?? g.withFix, `${cls}/${spec}`).toBeDefined();
      }
    }
  });
});

const now = new Date('2026-11-12T12:00:00Z');
function sim(over: Partial<SimView> & { warnings?: string[]; className?: string } = {}): SimView {
  const { warnings = [], className = 'warlock', ...rest } = over;
  return {
    id: 5, status: 'done', createdAt: '2026-11-12T11:00:00Z', finishedAt: '2026-11-12T11:01:00Z', error: null, log: null,
    source: 'armory', characterId: null, characterName: null, subjectName: 'Rød Cecil', subjectSpec: null, fightStyles: ['Patchwerk'],
    bags: { requested: false, found: 0, ignored: 0, truncated: 0 }, notices: [],
    result: {
      player: { name: 'Rød', className, spec: className, level: 20, race: 'human' }, iterations: 1000,
      dps: { mean: 9.9, stdDev: 1, meanStdDev: 0.1 }, styles: [{ fightStyle: 'Patchwerk', dps: { mean: 9.9, stdDev: 1, meanStdDev: 0.1 }, items: [] }],
      elapsedMs: 1000, warnings,
    },
    ...rest,
  };
}
const render = (s: SimView, spec: string | null = null) =>
  renderToStaticMarkup(createElement(SimCard, { sim: s, subject: { name: 'Rød Cecil', className: s.result?.player.className ?? null, spec, level: 20 }, previous: {}, now }));

describe('SimCard: advarsel om modellens huller', () => {
  it('warlock (upstream-grundmodel): tydelig advarsel med hvad der mangler, adskilt fra noterne', () => {
    const html = render(sim(), 'Affliction');
    expect(html).toContain('class="sim-gap sim-gap-upstream"');
    expect(html).toContain('aria-labelledby="sim-5-gap"');
    expect(html).toContain('Simulatoren mangler vigtige evner for Warlock (Affliction)');
    expect(html).toContain('<strong>Mangler:</strong> Life Tap og wand');
    expect(html).not.toContain('sim-notes');
  });
  it('priest med vores rettelse: kun «Grov model»-noten, ingen advarsel', () => {
    const html = render(sim({ className: 'priest', warnings: [GROV] }), 'Holy');
    expect(html).not.toContain('sim-gap');
    expect(html).toContain('Grov model');
  });
  it('paladin Holy med vores rettelse: både «Grov model» og den delvise advarsel', () => {
    const html = render(sim({ className: 'paladin', warnings: [GROV] }), 'Holy');
    expect(html).toContain('sim-gap sim-gap-partial');
    expect(html).toContain('Holy Shock bruges kun over halv mana');
    expect(html).toContain('Grov model');
  });
  it('ingen advarsel før resultatet er færdigt', () => {
    expect(render(sim({ status: 'running', result: null }), 'Affliction')).not.toContain('sim-gap');
  });
});
