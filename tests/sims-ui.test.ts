import { describe, expect, it } from 'vitest';
import type { SimItemResult } from '@/lib/sims';
import {
  capitalize, comparableRows, durationText, isActiveStatus, logProgress, mergeGearRows, parseSubjectFilter, playerDetail, previousDps,
  simSubject, statusStep, subjectFilterNames, subjectInitial, upgradeRows,
} from '@/lib/sims-ui';

const item = (over: Partial<SimItemResult> = {}): SimItemResult => ({ index: 0, slot: 'head', id: 1, label: 'Hjelm', dpsMean: 100, delta: 5, deltaPercent: 5, ...over });
const dps = (mean: number) => ({ mean, stdDev: 1, meanStdDev: 1 });

describe('status og forløb', () => {
  it('trin: kø → kører → færdig/fejlet', () => {
    expect(statusStep('queued')).toBe(1);
    expect(statusStep('running')).toBe(2);
    expect(statusStep('done')).toBe(3);
    expect(statusStep('failed')).toBe(3);
    expect(isActiveStatus('queued')).toBe(true);
    expect(isActiveStatus('done')).toBe(false);
  });
});

describe('logProgress', () => {
  const baseline = (n: number, steps = 1) => `Generating Baseline: 1/${steps} [=====>......] ${n}/5000 1738.092 1sec`;
  it('intet uden log eller uden kendte linjer', () => {
    expect(logProgress(null)).toBeNull();
    expect(logProgress('SimulationCraft 160-01\nSimulating...')).toBeNull();
  });
  it('kø-noten fra workeren giver 0 % med tekst', () => {
    expect(logProgress('Venter i kø …\n')).toEqual({ fraction: 0, text: 'Venter på simulatoren' });
  });
  it('grundkørsel uden gear: brøken følger gennemløbene', () => {
    const p = logProgress(`== Kampstil: Patchwerk ==\n${baseline(2500)}`)!;
    expect(p.fraction).toBeCloseTo(0.5, 5);
    expect(p.text).toBe('Patchwerk: grundkørsel 2.500/5.000');
  });
  it('med gear tæller grundkørslen som ét af N trin og hver genstand som ét', () => {
    const log = `== Kampstil: DungeonSlice ==\n${baseline(5000, 10)}\nProfilesets (1*1): 3/9 [======>.............] avg=5.2s done=16s left=31s`;
    const p = logProgress(log)!;
    expect(p.fraction).toBeCloseTo(0.4, 5);
    expect(p.text).toBe('Dungeon Slice: genstand 3 af 9');
    expect(logProgress(`== Kampstil: DungeonSlice ==\n${baseline(1000, 10)}`)!.fraction).toBeCloseTo(0.02, 5);
  });
  it('to kampstile vægtes ens; rapporttrinnet fylder kampstilen op', () => {
    const log = `== Kampstil: Patchwerk ==\n${baseline(5000)}\nGenerating reports...\n== Kampstil: DungeonSlice ==\n${baseline(2500)}`;
    expect(logProgress(log, 2)!.fraction).toBeCloseTo(0.75, 5);
    expect(logProgress(`== Kampstil: Patchwerk ==\n${baseline(5000)}\nGenerating reports...`, 2)).toEqual({ fraction: 0.5, text: 'Patchwerk: laver rapport' });
    expect(logProgress('== Kampstil: Patchwerk ==\n')).toEqual({ fraction: 0, text: 'Patchwerk: starter' });
  });
  it('holder sig mellem 0 og 1 også ved mærkelige tal', () => {
    expect(logProgress(`== Kampstil: Patchwerk ==\n${baseline(9999)}`, 0)!.fraction).toBe(1);
    expect(logProgress('== Kampstil: Patchwerk ==\nGenerating Baseline: 1/0 [>] 0/0', 1)!.fraction).toBe(0);
  });
});

describe('gear-rækker på tværs af kampstile', () => {
  it('fletter samme genstand fra to kampstile og sorterer efter bedste ændring', () => {
    const rows = mergeGearRows([
      { fightStyle: 'Patchwerk', items: [item(), item({ index: 1, slot: 'back', id: 2, label: 'Kappe', delta: -2, deltaPercent: -2 }), item({ index: 2, slot: 'feet', id: 3, label: 'Støvler', dpsMean: null, delta: null, deltaPercent: null, error: 'x' })] },
      { fightStyle: 'DungeonSlice', items: [item({ delta: 1, deltaPercent: 1 }), item({ index: 1, slot: 'back', id: 2, label: 'Kappe', delta: 8, deltaPercent: 8 })] },
    ]);
    expect(rows.map((r) => [r.label, r.best])).toEqual([['Kappe', 8], ['Hjelm', 5], ['Støvler', null]]);
    expect(rows[0].cells.Patchwerk?.deltaPercent).toBe(-2);
    expect(rows[0].cells.DungeonSlice?.deltaPercent).toBe(8);
    expect(rows[1].cells.DungeonSlice?.deltaPercent).toBe(1);
    expect(rows[2].cells.DungeonSlice).toBeUndefined();
    expect(comparableRows(rows).map((r) => r.label)).toEqual(['Kappe', 'Hjelm']);
  });
  it('upgradeRows tager kun rækker der er en opgradering et sted, højst 10', () => {
    const many = Array.from({ length: 14 }, (_, i) => item({ index: i, id: i + 1, label: `I${i}`, delta: 14 - i, deltaPercent: 14 - i }));
    const rows = mergeGearRows([{ fightStyle: 'Patchwerk', items: [...many, item({ index: 20, id: 99, label: 'Nedgradering', delta: -1, deltaPercent: -1 }), item({ index: 21, id: 98, label: 'Lige', delta: 0.1, deltaPercent: 0.1 })] }]);
    const top = upgradeRows(rows);
    expect(top).toHaveLength(10);
    expect(top[0].label).toBe('I0');
    expect(rows.map((r) => r.label)).toContain('Nedgradering');
    expect(upgradeRows(mergeGearRows([{ fightStyle: 'Patchwerk', items: [item({ deltaPercent: -3, delta: -3 })] }]))).toEqual([]);
  });
});

describe('karakter og tekster', () => {
  it('playerDetail gentager ikke klassen som spec og sætter stort begyndelsesbogstav', () => {
    expect(playerDetail({ className: 'shaman', spec: 'shaman', level: 41 })).toBe('Shaman · level 41');
    expect(playerDetail({ className: 'mage', spec: 'Frost', level: null })).toBe('Mage · Frost');
    expect(playerDetail({ className: null, spec: null, level: null })).toBe('');
    expect(capitalize('')).toBe('');
  });
  it('simSubject: resultatets spiller, ellers karakteren, ellers ukendt', () => {
    const chars = [{ id: 7, name: 'Magi', className: 'Mage', spec: 'Frost' }];
    expect(simSubject({ result: null, characterId: 7 }, chars)).toEqual({ name: 'Magi', className: 'Mage', spec: 'Frost', level: null });
    expect(simSubject({ result: null, characterId: 8 }, chars).name).toBeNull();
    expect(simSubject({ result: null, characterId: null }, chars).name).toBeNull();
    const player = { name: 'Rød', className: 'shaman', spec: 'shaman', level: 41 };
    expect(simSubject({ result: { player }, characterId: 7 }, chars)).toEqual(player);
    expect(subjectInitial('rød')).toBe('R');
    expect(subjectInitial(null)).toBe('?');
  });
  it('durationText', () => {
    expect(durationText(null)).toBeNull();
    expect(durationText(-1)).toBeNull();
    expect(durationText(3200)).toBe('3 s');
    expect(durationText(60_000)).toBe('1 min');
    expect(durationText(83_000)).toBe('1 min 23 s');
  });
});

describe('sammenligning med forrige sim', () => {
  const sim = (name: string | null, mean: number | null, status: 'done' | 'failed' = 'done', createdAt = '2026-11-12T10:00:00.000Z') => ({
    status, createdAt,
    result: status === 'done' ? { player: { name }, styles: [{ fightStyle: 'Patchwerk' as const, dps: mean === null ? null : dps(mean) }] } : null,
  });
  it('finder den nærmeste ældre færdige sim af samme karakter i samme kampstil', () => {
    const sims = [sim('Rød', 103), sim('Magi', 50), sim('Rød', null), sim('Rød', 100, 'failed'), sim('Rød', 100, 'done', '2026-11-11T10:00:00.000Z'), sim('Rød', 90)];
    expect(previousDps(sims, 0, 'Patchwerk')).toEqual({ mean: 100, createdAt: '2026-11-11T10:00:00.000Z', deltaPercent: 3 });
    expect(previousDps(sims, 0, 'DungeonSlice')).toBeNull();
    expect(previousDps(sims, 1, 'Patchwerk')).toBeNull();
    expect(previousDps(sims, 2, 'Patchwerk')).toBeNull();
    expect(previousDps(sims, 5, 'Patchwerk')).toBeNull();
    expect(previousDps([sim(null, 5), sim(null, 4)], 0, 'Patchwerk')).toBeNull();
  });
});

describe('filter efter karakter', () => {
  it('kun ved mindst to navne, i rækkefølge efter første forekomst, uden dubletter', () => {
    const s = (name: string | null) => ({ name, className: null, spec: null, level: null });
    expect(subjectFilterNames([s('Rød'), s(null), s('Magi'), s('Rød')])).toEqual(['Rød', 'Magi']);
    expect(subjectFilterNames([s('Rød'), s('Rød'), s(null)])).toEqual([]);
  });
  it('accepterer kun kendte navne fra URL-parametret', () => {
    expect(parseSubjectFilter('Magi', ['Rød', 'Magi'])).toBe('Magi');
    expect(parseSubjectFilter(['Rød', 'Magi'], ['Rød', 'Magi'])).toBe('Rød');
    expect(parseSubjectFilter('Ukendt', ['Rød'])).toBeNull();
    expect(parseSubjectFilter(undefined, ['Rød'])).toBeNull();
  });
});
