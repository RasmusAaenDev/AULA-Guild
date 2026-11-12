import { describe, expect, it } from 'vitest';
import type { SimItemResult } from '@/lib/sims';
import {
  capitalize, comparableRows, durationText, isActiveStatus, lastLogLine, logProgress, matchOwnCharacter, mergeGearRows, nextFieldValue, parseSubjectFilter, pickStreamerJob,
  playerDetail, previousDps, simSubject, statusStep, subjectFilterNames, subjectInitial, upgradeRows,
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

describe('streameren i panelet', () => {
  it('vælger kørende før ventende, ældste først, og tæller resten i køen', () => {
    const s = (id: number, status: 'queued' | 'running' | 'done' | 'failed') => ({ id, status });
    expect(pickStreamerJob([s(5, 'queued'), s(4, 'running'), s(3, 'done'), s(2, 'running'), s(1, 'failed')])).toEqual({ job: s(2, 'running'), queued: 1 });
    expect(pickStreamerJob([s(9, 'queued'), s(7, 'queued'), s(8, 'queued')])).toEqual({ job: s(7, 'queued'), queued: 2 });
    expect(pickStreamerJob([s(1, 'done'), s(2, 'failed')])).toBeNull();
    expect(pickStreamerJob([])).toBeNull();
  });
  it('lastLogLine giver seneste ikke-tomme linje, afkortet', () => {
    expect(lastLogLine(null)).toBeNull();
    expect(lastLogLine('\n  \n')).toBeNull();
    expect(lastLogLine('a\nb\n\n  c  \n\n')).toBe('c');
    expect(lastLogLine('x'.repeat(100), 10)).toBe('x'.repeat(9) + '…');
    expect(lastLogLine('æøå'.repeat(10), 7)).toBe('æøåæøå…');
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
  const chars = [
    { id: 7, name: 'Magi', fullName: 'Magi Far', className: 'Mage', spec: 'Frost' },
    { id: 8, name: 'Rød', fullName: 'Rød Hætte', className: 'Shaman', spec: null },
    { id: 9, name: 'Rød', fullName: 'Rød Grød', className: 'Warrior', spec: null },
    { id: 10, name: 'Dobbelt', fullName: 'Dobbelt Op', className: 'Mage', spec: null },
    { id: 11, name: 'dobbelt', fullName: 'Dobbelt Ned', className: 'Mage', spec: null },
  ];
  it('matchOwnCharacter: fornavn uanset store/små bogstaver, klasse når den kendes, kun ved præcis ét match', () => {
    expect(matchOwnCharacter({ name: 'magi', className: 'mage' }, chars)?.fullName).toBe('Magi Far');
    expect(matchOwnCharacter({ name: 'Magi', className: null }, chars)?.fullName).toBe('Magi Far');
    expect(matchOwnCharacter({ name: 'Magi', className: 'warrior' }, chars)).toBeNull();
    expect(matchOwnCharacter({ name: 'Rød', className: null }, chars)).toBeNull();
    expect(matchOwnCharacter({ name: 'Rød', className: 'shaman' }, chars)?.fullName).toBe('Rød Hætte');
    expect(matchOwnCharacter({ name: 'Dobbelt', className: 'mage' }, chars)).toBeNull();
    expect(matchOwnCharacter({ name: null, className: 'mage' }, chars)).toBeNull();
  });
  const player = { name: 'Magi', className: 'mage', spec: 'mage', level: 20 };
  type Player = typeof player | { name: string; className: string | null; spec: string; level: number };
  const sub = (o: { result?: Player | null; characterId?: number | null; characterName?: string | null; subjectName?: string | null }) =>
    simSubject({ result: o.result ? { player: o.result } : null, characterId: o.characterId ?? null, characterName: o.characterName ?? null, subjectName: o.subjectName ?? null }, chars);
  it('simSubject: registreret karakter går forud, så navnet gemt på jobbet, så match på fornavn, ellers fornavnet', () => {
    // Armory-job uden resultat endnu: det registrerede fulde navn (fra databasen) og karakterens klasse/spec.
    expect(sub({ characterId: 7, characterName: 'Magi Far' })).toEqual({ name: 'Magi Far', className: 'Mage', spec: 'Frost', level: null });
    // Navnet fra databasen vinder, selv hvis karakteren ikke er i listen (fx frakoblet fra en anden bruger).
    expect(sub({ characterId: 99, characterName: 'Gammel Ven' }).name).toBe('Gammel Ven');
    expect(sub({ characterId: 7 }).name).toBe('Magi Far');
    expect(sub({ characterId: 42 }).name).toBeNull();
    expect(sub({}).name).toBeNull();
    // Fremmed karakter fra armory: navnet gemt på jobbet, både før og efter resultatet.
    expect(sub({ subjectName: 'Rød Cecil' })).toEqual({ name: 'Rød Cecil', className: null, spec: null, level: null });
    expect(sub({ result: { ...player, name: 'Rød', className: 'shaman' }, subjectName: 'Rød Cecil' })).toEqual({ name: 'Rød Cecil', className: 'shaman', spec: 'mage', level: 20 });
    // Registreret navn slår navnet på jobbet.
    expect(sub({ characterId: 7, characterName: 'Magi Far', subjectName: 'Magi Gammel' }).name).toBe('Magi Far');
    // Færdigt armory-job: fuldt navn fra databasen, klasse/level fra resultatet; Forever-spec'en fra karakteren (simc
    // melder kun klassens eneste spec).
    expect(sub({ result: player, characterId: 7, characterName: 'Magi Far' })).toEqual({ name: 'Magi Far', className: 'mage', spec: 'Frost', level: 20 });
    // Paste-sim: fornavn + klasse matcher præcis én egen karakter → fuldt navn; tvetydigt eller ukendt → fornavnet.
    expect(sub({ result: player }).name).toBe('Magi Far');
    expect(sub({ result: { ...player, name: 'Rød', className: 'shaman' } }).name).toBe('Rød Hætte');
    expect(sub({ result: { ...player, name: 'Rød', className: null } }).name).toBe('Rød');
    expect(sub({ result: { ...player, name: 'Fiktivnavn', className: 'warrior' } }).name).toBe('Fiktivnavn');
    // Paste-sim, der matcher en egen karakter: spec'en fra karakteren.
    expect(sub({ result: player }).spec).toBe('Frost');
    expect(subjectInitial('rød')).toBe('R');
    expect(subjectInitial(null)).toBe('?');
  });
  it('simSubject: spec gemt fra armory på jobbet går forud for karakterens og for simcs klassenavn', () => {
    const r = simSubject({ result: { player: { name: 'Rød', className: 'druid', spec: 'druid', level: 20 } }, characterId: null, characterName: null, subjectName: 'Rød Cecil', subjectSpec: 'Feral Combat' }, chars);
    expect(r).toEqual({ name: 'Rød Cecil', className: 'druid', spec: 'Feral Combat', level: 20 });
    expect(simSubject({ result: null, characterId: 7, characterName: 'Magi Far', subjectName: null, subjectSpec: 'Arcane' }, chars).spec).toBe('Arcane');
    // Uden kendt spec: simcs værdi som før.
    expect(simSubject({ result: { player: { name: 'X', className: 'druid', spec: 'druid', level: 20 } }, characterId: null, characterName: null, subjectName: null }, chars).spec).toBe('druid');
  });
  it('nextFieldValue: feltet følger den primære karakter kun når det er uændret eller tomt', () => {
    expect(nextFieldValue('Magi Far', 'Magi Far', 'Rød Hætte')).toBe('Rød Hætte');
    expect(nextFieldValue('', 'Magi Far', 'Rød Hætte')).toBe('Rød Hætte');
    expect(nextFieldValue('  Magi Far ', 'Magi Far', 'Rød Hætte')).toBe('Rød Hætte');
    expect(nextFieldValue('Rød Cecil', 'Magi Far', 'Rød Hætte')).toBe('Rød Cecil');
    expect(nextFieldValue('Rød Cecil', '', 'Rød Hætte')).toBe('Rød Cecil');
    expect(nextFieldValue('', '', 'Rød Hætte')).toBe('Rød Hætte');
    // Primær fjernet (ingen primær): et uændret felt tømmes; egen tekst bevares.
    expect(nextFieldValue('Magi Far', 'Magi Far', '')).toBe('');
    expect(nextFieldValue('Rød Cecil', 'Magi Far', '')).toBe('Rød Cecil');
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
    name, status, createdAt,
    result: status === 'done' ? { styles: [{ fightStyle: 'Patchwerk' as const, dps: mean === null ? null : dps(mean) }] } : null,
  });
  const prev = (sims: ReturnType<typeof sim>[], index: number, fs: 'Patchwerk' | 'DungeonSlice') => previousDps(sims, sims.map((s) => s.name), index, fs);
  it('finder den nærmeste ældre færdige sim af samme karakter (samme navn) i samme kampstil', () => {
    const sims = [sim('Rød Hætte', 103), sim('Magi Far', 50), sim('Rød Hætte', null), sim('Rød Hætte', 100, 'failed'), sim('Rød Hætte', 100, 'done', '2026-11-11T10:00:00.000Z'), sim('Rød Hætte', 90)];
    expect(prev(sims, 0, 'Patchwerk')).toEqual({ mean: 100, createdAt: '2026-11-11T10:00:00.000Z', deltaPercent: 3 });
    expect(prev(sims, 0, 'DungeonSlice')).toBeNull();
    expect(prev(sims, 1, 'Patchwerk')).toBeNull();
    expect(prev(sims, 2, 'Patchwerk')).toBeNull();
    expect(prev(sims, 5, 'Patchwerk')).toBeNull();
    expect(prev([sim(null, 5), sim(null, 4)], 0, 'Patchwerk')).toBeNull();
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
