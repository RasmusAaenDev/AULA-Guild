import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SIMC_TALENTS } from '@/lib/simc-talents.generated';
import { decodeTalentHeader, encodeTalents, talentWarning } from '@/lib/simc-talents';
import { buildSimProfile } from '@/lib/simc-armory';
import { validateSimcInput } from '@/lib/simc-input';
import type { SimProfile } from '@/lib/blizzard/types';

const root = path.resolve(__dirname, '..');
const read = (f: string) => readFileSync(path.join(root, f), 'utf8');
const talentsLine = (f: string) => /^talents=(\S+)$/m.exec(read(f))![1];
async function workerSanitize() {
  const p = path.join(root, 'simc-worker', 'sanitize.mjs');
  return ((await import(/* @vite-ignore */ p)) as { sanitizeProfile: (s: string) => { ok: boolean; lines?: string[] } }).sanitizeProfile;
}
const picks = (s: string) => s.split('/').map((x) => { const [id, rank] = x.split(':').map(Number); return { id, rank }; });

describe('simc-talents.generated.ts', () => {
  it('er genereret for samme simc-commit som workeren bygges af (SIMC_REF i simc-worker/Dockerfile)', () => {
    const ref = /ARG SIMC_REF=([0-9a-f]{40})/.exec(read('simc-worker/Dockerfile'))?.[1];
    expect(ref, 'SIMC_REF mangler i simc-worker/Dockerfile').toBeDefined();
    expect(
      SIMC_TALENTS.simcRef,
      `lib/simc-talents.generated.ts er lavet for simc ${SIMC_TALENTS.simcRef.slice(0, 8)}, men SIMC_REF er ${ref!.slice(0, 8)}. ` +
        'Talenttabellen skal svare til workerens simc, ellers indlæser simc forkerte talenter. ' +
        'Kør `node scripts/gen-simc-talents.mjs <simc-mappe>` (en simc-forever-klon tjekket ud på SIMC_REF) og commit filen.',
    ).toBe(ref);
    expect(SIMC_TALENTS.source).toContain(SIMC_TALENTS.simcRef.slice(0, 8));
  });
  it('har alle ni Forever-klasser med én spec og noder i stigende id_node', () => {
    expect(Object.keys(SIMC_TALENTS.classes).sort()).toEqual(['druid', 'hunter', 'mage', 'paladin', 'priest', 'rogue', 'shaman', 'warlock', 'warrior']);
    for (const [k, c] of Object.entries(SIMC_TALENTS.classes)) {
      expect(c.nodes.length % 4, k).toBe(0);
      const ids = c.nodes.filter((_, i) => i % 4 === 0);
      expect([...ids].sort((a, b) => a - b), k).toEqual(ids);
      expect(new Set(ids).size, k).toBe(ids.length);
    }
    expect(SIMC_TALENTS.classes.mage.spec).toBe(1482);
    expect(SIMC_TALENTS.classes.warrior.spec).toBe(1491);
  });
});

describe('encodeTalents: spillets egne strenge (addon-profiler)', () => {
  // Talent-id/ranks som undersøgelsen afkodede fra strengene (talents/RAPPORT.md 1.5); træ-hashen er spillets egen.
  const cases: [string, string, string, string][] = [
    ['hunter', 'simc-worker/test/fixtures/hunter-11.simc', '134437:1/134438:5', 'C0cBAAAAAAAAAAAAAAAAAAAAAAAwDMAAAAAA'],
    ['shaman', 'tests/fixtures/bags-shaman-20.simc', '134204:1/134210:1/134211:3/134213:2/134214:5/134216:3/134217:1', 'CEdBAAAAAAAAAAAAAAAAAAAAAAAAYAzYGzDAAAA'],
    ['warrior', 'tests/fixtures/bags-warrior-11.simc', '135485:1/135487:3/135489:2', 'CMdBAAAAAAAAAAAAAAAAAAAAAAAAAeAjLAAAAA'],
    ['warlock', 'tests/fixtures/bags-warlock-10.simc', '135455:5', 'CIdBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYA'],
  ];
  for (const [cls, file, list, zeroHash] of cases) {
    it(`${cls}: genskaber ${path.basename(file)} bit for bit`, () => {
      const game = talentsLine(file);
      const h = decodeTalentHeader(game);
      expect(h.version).toBe(2);
      expect(h.spec).toBe(SIMC_TALENTS.classes[cls].spec);
      const r = encodeTalents(cls, picks(list), h.treeHash);
      expect(r.talents).toBe(game);
      expect(r.dropped).toEqual([]);
      // Appen sender træ-hash 0 (simc ignorerer den); resten af strengen er den samme.
      expect(encodeTalents(cls, picks(list)).talents).toBe(zeroHash);
    });
  }
});

describe('encodeTalents: armory-karakterer, verificeret mod simc (RAPPORT.md 1.5)', () => {
  // Strengene er dem simc selv genererer fra class_talents=, og simc indlæste 11/12/13 talenter med rette ranks.
  const cases: [string, string, string][] = [
    ['mage', '135345:2/135309:5/135308:2/135307:5/135304:3/135302:1/135297:1/135299:1/135298:3/135296:1/135294:2', 'CocBAAAAAAAAAAAAAAAAAAAAAwYmZ4BGmLYAAAAAgB'],
    ['paladin', '134830:5/134828:2/142623:2/134829:5/134822:2/134820:1/135234:2/134825:1/142624:1/134818:1/134827:5/135163:3', 'C4cBAAAAAAAAAAAAAAAAAAAAAwYGj5CmBAGAgBzDAA'],
    ['rogue', '135238:3/135271:2/145370:1/135267:3/135262:2/135266:2/135289:2/138268:1/135256:1/135260:3/145965:2/135258:1/135257:1', 'CAdBAAAAAAAAAAAAAAAAAAAAAMAAwD8AzMMDGAAMM8AG'],
  ];
  for (const [cls, list, expected] of cases) {
    it(cls, () => {
      const r = encodeTalents(cls, picks(list));
      expect(r.talents).toBe(expected);
      expect(r.used).toHaveLength(picks(list).length);
      expect(r.dropped).toEqual([]);
    });
  }
});

describe('encodeTalents: robusthed', () => {
  const mage = (list: { id: number; rank: number }[]) => encodeTalents('mage', list);
  it('udelader ukendte id\'er og id\'er fra en anden klasse, uden at strengen ændres for resten', () => {
    const base = mage([{ id: 135309, rank: 5 }]);
    const r = mage([{ id: 999999, rank: 1 }, { id: 135309, rank: 5 }, { id: 135457, rank: 2 } /* warrior */]);
    expect(r.talents).toBe(base.talents);
    expect(r.dropped).toEqual([999999, 135457]);
    expect(r.used).toEqual([{ id: 135309, rank: 5 }]);
  });
  it('klipper rank over max til max og koder delvis rank', () => {
    const over = mage([{ id: 135309, rank: 9 }]);
    expect(over.talents).toBe(mage([{ id: 135309, rank: 5 }]).talents);
    expect(over.clipped).toEqual([135309]);
    expect(mage([{ id: 135309, rank: 3 }]).talents).not.toBe(over.talents);
  });
  it('afviser dubletter på samme node og ugyldige ranks', () => {
    const r = mage([{ id: 135309, rank: 2 }, { id: 135309, rank: 5 }, { id: 135308, rank: 0 }]);
    expect(r.used).toEqual([{ id: 135309, rank: 2 }]);
    expect(r.dropped).toEqual([135309, 135308]);
  });
  it('ingen talenter: kun header og tomme noder; ukendt klasse giver ingen streng', () => {
    const r = mage([]);
    expect(decodeTalentHeader(r.talents!)).toMatchObject({ version: 2, spec: 1482 });
    expect(r.talents!.length).toBe(Math.ceil((152 + SIMC_TALENTS.classes.mage.nodes.length / 4) / 6));
    expect(encodeTalents('monk', [{ id: 1, rank: 1 }])).toMatchObject({ talents: null, dropped: [1] });
  });
  it('stub-klasser i simc (paladin, rogue) giver stadig en gyldig streng', () => {
    for (const cls of ['paladin', 'rogue']) {
      const r = encodeTalents(cls, []);
      expect(r.talents).toMatch(/^[A-Za-z0-9+/]+$/);
      expect(decodeTalentHeader(r.talents!).spec).toBe(SIMC_TALENTS.classes[cls].spec);
    }
  });
  it('dansk advarsel med ental/flertal', () => {
    expect(talentWarning(0)).toBeNull();
    expect(talentWarning(1)).toBe('1 talent kunne ikke oversættes; simuleringen kører uden det.');
    expect(talentWarning(3)).toBe('3 talenter kunne ikke oversættes; simuleringen kører uden dem.');
  });
});

describe('buildSimProfile med talenter', () => {
  const ezzek: SimProfile = {
    name: 'Testmage', className: 'Mage', race: 'Human', level: 35, faction: 'alliance', equipment: [{ slot: 'HEAD', id: 1 }],
    talents: picks('135345:2/135309:5/135308:2/135307:5/135304:3/135302:1/135297:1/135299:1/135298:3/135296:1/135294:2'),
  };
  it('skriver spec=unknown og talents= og består både appens og workerens hvidliste', async () => {
    const sanitizeProfile = await workerSanitize();
    const { input, warnings } = buildSimProfile(ezzek);
    expect(input.split('\n')).toContain('spec=unknown');
    expect(input.split('\n')).toContain('talents=CocBAAAAAAAAAAAAAAAAAAAAAwYmZ4BGmLYAAAAAgB');
    expect(input).not.toContain('legacy_talents');
    expect(warnings).toEqual([]);
    expect(validateSimcInput(input)).toMatchObject({ ok: true, className: 'mage' });
    const w = sanitizeProfile(input);
    expect(w).toMatchObject({ ok: true });
    expect(w.lines).toContain('talents=CocBAAAAAAAAAAAAAAAAAAAAAwYmZ4BGmLYAAAAAgB');
  });
  it('ukendte talenter udelades med en advarsel; kun ukendte giver ingen talents=-linje', () => {
    const some = buildSimProfile({ ...ezzek, talents: [...ezzek.talents, { id: 999998, rank: 1 }, { id: 999999, rank: 2 }] });
    expect(some.input).toContain('talents=CocBAAAAAAAAAAAAAAAAAAAAAwYmZ4BGmLYAAAAAgB');
    expect(some.warnings).toEqual(['2 talenter kunne ikke oversættes; simuleringen kører uden dem.']);
    const none = buildSimProfile({ ...ezzek, talents: [{ id: 999999, rank: 1 }] });
    expect(none.input).not.toMatch(/^talents=/m);
    expect(none.warnings).toEqual(['1 talent kunne ikke oversættes; simuleringen kører uden det.']);
    expect(buildSimProfile({ ...ezzek, talents: [] })).toMatchObject({ warnings: [] });
  });
});
