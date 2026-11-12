import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createSendLimiter } from '@/lib/chat-send';
import { characters, simJobs, users } from '@/lib/db/schema';
import { BlizzardError, type SimProfile } from '@/lib/blizzard/types';
import { ARMORY_NOT_FOUND, ARMORY_UNAVAILABLE, UNSUPPORTED_CLASS, enqueueArmorySim, enqueueArmorySimByName } from '@/lib/sims-armory';
import { addCharacterMessage } from '@/lib/messages';
import { sanitizeSubjectName } from '@/lib/sims';
import { buildSimInput, buildSimProfile, cleanPlayerName, raceToken } from '@/lib/simc-armory';
import { encodeTalents } from '@/lib/simc-talents';
import { SIMC_TALENTS } from '@/lib/simc-talents.generated';
import { validateSimcInput } from '@/lib/simc-input';
import { claimNextSim, finishSim, listMySims, parseSimResult } from '@/lib/sims';
import { NO_ROTATION_TEXT, SOURCE_LABELS, hasNoDps, noRotationMessages, visibleWarnings } from '@/lib/sims-ui';
import { fakeBlizzard } from './helpers';
import { resetDb, testDb } from './db';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const warrior: SimProfile = {
  name: 'Krigeren', className: 'Warrior', race: 'Dwarf', level: 21, faction: 'alliance',
  equipment: [
    { slot: 'HEAD', id: 1001 }, { slot: 'NECK', id: 1002 }, { slot: 'SHOULDER', id: 1003 }, { slot: 'BACK', id: 1004 },
    { slot: 'CHEST', id: 1005 }, { slot: 'SHIRT', id: 1006 }, { slot: 'TABARD', id: 1007 }, { slot: 'WRIST', id: 1008 },
    { slot: 'HANDS', id: 1009 }, { slot: 'WAIST', id: 1010 }, { slot: 'LEGS', id: 1011 }, { slot: 'FEET', id: 1012 },
    { slot: 'FINGER_1', id: 1013 }, { slot: 'FINGER_2', id: 1014 }, { slot: 'TRINKET_1', id: 1015 }, { slot: 'TRINKET_2', id: 1016 },
    { slot: 'MAIN_HAND', id: 1017 }, { slot: 'OFF_HAND', id: 1018 }, { slot: 'RANGED', id: 1019 }, { slot: 'AMMO', id: 1020 },
  ],
  // 135462 Enrage (max 5), 135458 Death Wish (max 1); 900001 findes ikke i simcs data og udelades med en advarsel.
  talents: [{ id: 135462, rank: 5 }, { id: 135458, rank: 1 }, { id: 900001, rank: 2 }],
};

describe('buildSimInput', () => {
  it('bygger profil med slot-mapping og ignorerer shirt, tabard og ukendte pladser', () => {
    const input = buildSimInput(warrior);
    expect(input.split('\n')).toEqual([
      'warrior="Krigeren"', 'level=21', 'race=dwarf', 'region=eu', 'server=forever', 'spec=unknown',
      `talents=${encodeTalents('warrior', [{ id: 135462, rank: 5 }, { id: 135458, rank: 1 }]).talents}`,
      'head=,id=1001', 'neck=,id=1002', 'shoulders=,id=1003', 'back=,id=1004', 'chest=,id=1005', 'wrist=,id=1008',
      'hands=,id=1009', 'waist=,id=1010', 'legs=,id=1011', 'feet=,id=1012', 'finger1=,id=1013', 'finger2=,id=1014',
      'trinket1=,id=1015', 'trinket2=,id=1016', 'main_hand=,id=1017', 'off_hand=,id=1018', 'ranged=,id=1019',
    ]);
    expect(input).not.toContain('1006');
    expect(input).not.toContain('1007');
    expect(input).not.toContain('1020');
  });
  it('består appens egen validering uændret', () => {
    const r = validateSimcInput(buildSimInput(warrior));
    expect(r).toMatchObject({ ok: true, className: 'warrior' });
    const shaman = buildSimInput({ ...warrior, name: 'Shamy', className: 'Shaman', race: 'Mag\'har Orc', faction: 'horde', talents: [], equipment: [] });
    expect(validateSimcInput(shaman)).toMatchObject({ ok: true, className: 'shaman' });
    expect(shaman).toContain('race=maghar_orc');
    expect(shaman).not.toContain('talents=');
  });
  it('renser navnet til tilladte tegn og afkorter til 40', () => {
    expect(cleanPlayerName('Tørn"; rm -rf /\n$x')).toBe('Tørn rm -rf x');
    expect(cleanPlayerName('1234')).toBe('Karakter');
    expect(cleanPlayerName('A'.repeat(100))).toHaveLength(40);
    const weird = buildSimInput({ ...warrior, name: 'Åse "Ø" <b>\t\u0007Ætheling-O\'Neil' });
    expect(validateSimcInput(weird)).toMatchObject({ ok: true });
    expect(weird.split('\n')[0]).toBe('warrior="Åse Ø b Ætheling-O\'Neil"');
  });
  it('mapper Forever-racer simc ikke kender via fraktion (hunter-fejlen) og falder ellers tilbage til lowercase', () => {
    expect(raceToken('High Order Skyborne', 'alliance')).toBe('skyborne_alliance');
    expect(raceToken('High Order Skyborne', 'horde')).toBe('skyborne_horde');
    expect(raceToken('Earthen', 'horde')).toBe('earthen_horde');
    expect(raceToken('Night Elf')).toBe('night_elf');
    expect(raceToken('Ny Ukendt Race', null)).toBe('ny_ukendt_race');
    expect(raceToken('!!!')).toBe('unknown');
  });
  it('skriver talents= (ikke legacy_talents) og advarer om talenter der ikke kunne oversættes', () => {
    const { input, warnings } = buildSimProfile(warrior);
    expect(input).not.toContain('legacy_talents');
    expect(input).not.toContain('900001');
    expect(warnings).toEqual(['1 talent kunne ikke oversættes; simuleringen kører uden det.']);
    // Alle 53 warrior-talenter på max rank: strengen holder sig langt under værdigrænsen.
    const nodes = SIMC_TALENTS.classes.warrior.nodes;
    const all = Array.from({ length: nodes.length / 4 }, (_, i) => ({ id: nodes[i * 4 + 2], rank: 3 }));
    const r = validateSimcInput(buildSimInput({ ...warrior, talents: all }));
    expect(r.ok).toBe(true);
  });
});

let seq = 0;
async function mkUser() {
  seq++;
  const [u] = await db.insert(users).values({ battletag: 'X#1', battlenetId: `a${seq}`, name: `A${seq}` }).returning();
  return u;
}
async function mkChar(userId: number | null, slug = `krigeren-${++seq}`) {
  const [c] = await db.insert(characters).values({ blizzardId: 5000 + ++seq, slug, name: 'Krigeren', className: 'Warrior', role: 'dps', userId }).returning();
  return c;
}
const free = () => createSendLimiter({ max: 1000, windowMs: 1, minGapMs: 0 });
const mkDeps = (userId: number, blizzard = fakeBlizzard({})) => ({ userId, limiter: free(), now: Date.now(), blizzard });

describe('enqueueArmorySim', () => {
  it('lægger egen karakter i kø med character_id, source og uden bagItems', async () => {
    const u = await mkUser();
    const c = await mkChar(u.id, 'krigeren-far');
    const blizzard = fakeBlizzard({ simProfiles: { 'krigeren-far': warrior } });
    const r = await enqueueArmorySim(db, mkDeps(u.id, blizzard), String(c.id), { fightStyles: ['Patchwerk', 'DungeonSlice'] });
    expect(r).toMatchObject({ ok: true, bags: { requested: false, found: 0 }, notices: ['1 talent kunne ikke oversættes; simuleringen kører uden det.'] });
    expect(blizzard.calls).toEqual(['simprofile:krigeren-far']);
    const [row] = await db.select().from(simJobs);
    expect(row).toMatchObject({ userId: u.id, characterId: c.id, status: 'queued' });
    expect(row.options).toMatchObject({ source: 'armory', fightStyles: ['Patchwerk', 'DungeonSlice'], optimizeBags: false });
    expect(row.options).not.toHaveProperty('bagItems');
    expect(row.input).toBe(buildSimInput(warrior));
    const [view] = await listMySims(db, u.id);
    expect(view.source).toBe('armory');
    expect(SOURCE_LABELS[view.source]).toBe('Armory');
    expect(view.notices).toEqual(['1 talent kunne ikke oversættes; simuleringen kører uden det.']);
    expect(view.characterId).toBe(c.id);
    expect(view.characterName).toBe('Krigeren Far');
    expect(view.fightStyles).toEqual(['Patchwerk', 'DungeonSlice']);
    expect(row.input).toMatch(/^talents=[A-Za-z0-9+/]+$/m);
  });
  it('listMySims giver det fulde karakternavn (efternavn fra feltet eller sluggen) og null når karakteren er væk', async () => {
    const u = await mkUser();
    const c = await mkChar(u.id, 'krigeren-far');
    await db.update(characters).set({ surname: 'Fjeld' }).where(eq(characters.id, c.id));
    const blizzard = fakeBlizzard({ simProfiles: { 'krigeren-far': warrior } });
    expect(await enqueueArmorySim(db, mkDeps(u.id, blizzard), String(c.id), { fightStyles: ['Patchwerk'] })).toMatchObject({ ok: true });
    // Indsat tekst uden karakter.
    await db.insert(simJobs).values({ userId: u.id, input: 'warrior="Krigeren"', status: 'done', result: { dps: { mean: 1, stdDev: 1, meanStdDev: 1 }, player: { name: 'Krigeren' } } });
    let views = await listMySims(db, u.id);
    expect(views.map((v) => [v.characterId, v.characterName])).toEqual([[null, null], [c.id, 'Krigeren Fjeld']]);
    // Karakteren slettes → character_id bliver null (on delete set null), og navnet falder bort.
    await db.delete(characters).where(eq(characters.id, c.id));
    views = await listMySims(db, u.id);
    expect(views[1]).toMatchObject({ characterId: null, characterName: null, source: 'armory' });
  });
  it('afviser en andens karakter, ukendt id og karakter uden ejer — uden at kalde Blizzard', async () => {
    const a = await mkUser();
    const b = await mkUser();
    const theirs = await mkChar(b.id, 'hans');
    const orphan = await mkChar(null, 'ingens');
    const blizzard = fakeBlizzard({ simProfiles: { hans: warrior, ingens: warrior } });
    for (const id of [String(theirs.id), String(orphan.id), '999999', 'abc', null, '']) {
      expect(await enqueueArmorySim(db, mkDeps(a.id, blizzard), id, { fightStyles: ['Patchwerk'] }), String(id)).toMatchObject({ ok: false });
    }
    expect(blizzard.calls).toEqual([]);
    expect(await db.select().from(simJobs)).toHaveLength(0);
  });
  it('kræver mindst én gyldig kampstil', async () => {
    const u = await mkUser();
    const c = await mkChar(u.id, 'x-y');
    const blizzard = fakeBlizzard({ simProfiles: { 'x-y': warrior } });
    expect(await enqueueArmorySim(db, mkDeps(u.id, blizzard), String(c.id), { fightStyles: [] })).toMatchObject({ ok: false, error: 'Vælg mindst én kampstil.' });
    expect(await enqueueArmorySim(db, mkDeps(u.id, blizzard), String(c.id), { fightStyles: ['Raid'] })).toMatchObject({ ok: false, error: 'Ugyldig kampstil.' });
    expect(blizzard.calls).toEqual([]);
  });
  it('oversætter Blizzard-fejl til danske beskeder', async () => {
    const u = await mkUser();
    const c = await mkChar(u.id, 'x-y');
    const cases: [Error, string][] = [
      [new BlizzardError('not_found', 'x'), ARMORY_NOT_FOUND],
      [new BlizzardError('unavailable', 'x'), ARMORY_UNAVAILABLE],
      [new BlizzardError('rate_limited', 'x'), ARMORY_UNAVAILABLE],
      [new Error('boom'), ARMORY_UNAVAILABLE],
    ];
    for (const [err, msg] of cases) {
      const blizzard = fakeBlizzard({ simProfiles: { 'x-y': err } });
      expect(await enqueueArmorySim(db, mkDeps(u.id, blizzard), String(c.id), { fightStyles: ['Patchwerk'] })).toMatchObject({ ok: false, error: msg });
    }
    expect(await db.select().from(simJobs)).toHaveLength(0);
  });
  it('bruger samme grænser som indsat tekst (2 samtidige)', async () => {
    const u = await mkUser();
    const c = await mkChar(u.id, 'x-y');
    const blizzard = fakeBlizzard({ simProfiles: { 'x-y': warrior } });
    const rs = [];
    for (let i = 0; i < 3; i++) rs.push(await enqueueArmorySim(db, mkDeps(u.id, blizzard), String(c.id), { fightStyles: ['Patchwerk'] }));
    expect(rs.map((r) => r.ok)).toEqual([true, true, false]);
    expect(rs[2]).toMatchObject({ reason: 'limit' });
  });
  it('afviser klasser simulatoren ikke kender med en forståelig besked', async () => {
    const u = await mkUser();
    const c = await mkChar(u.id, 'x-y');
    const blizzard = fakeBlizzard({ simProfiles: { 'x-y': { ...warrior, className: 'Death Knight' } } });
    expect(await enqueueArmorySim(db, mkDeps(u.id, blizzard), String(c.id), { fightStyles: ['Patchwerk'] })).toMatchObject({ ok: false, error: UNSUPPORTED_CLASS });
  });
  it('gemmer karakterens fulde navn (subjectName) på jobbet, så det overlever en frakobling', async () => {
    const u = await mkUser();
    const c = await mkChar(u.id, 'krigeren-far');
    const blizzard = fakeBlizzard({ simProfiles: { 'krigeren-far': warrior } });
    expect(await enqueueArmorySim(db, mkDeps(u.id, blizzard), String(c.id), { fightStyles: ['Patchwerk'] })).toMatchObject({ ok: true });
    const [row] = await db.select().from(simJobs);
    expect(row.options).toMatchObject({ subjectName: 'Krigeren Far' });
    await db.delete(characters).where(eq(characters.id, c.id));
    const [view] = await listMySims(db, u.id);
    expect(view).toMatchObject({ characterId: null, characterName: null, subjectName: 'Krigeren Far' });
  });
  it('gemmer armory-spec\'en (subjectSpec) på jobbet; uden den bruges den registrerede karakters spec', async () => {
    const u = await mkUser();
    const c = await mkChar(u.id, 'krigeren-far');
    const blizzard = fakeBlizzard({ simProfiles: { 'krigeren-far': { ...warrior, spec: 'Fury' } } });
    expect(await enqueueArmorySim(db, mkDeps(u.id, blizzard), String(c.id), { fightStyles: ['Patchwerk'] })).toMatchObject({ ok: true });
    const [row] = await db.select().from(simJobs);
    expect(row.options).toMatchObject({ subjectSpec: 'Fury' });
    expect((await listMySims(db, u.id))[0].subjectSpec).toBe('Fury');
    await db.update(simJobs).set({ options: { fightStyles: ['Patchwerk'], source: 'armory' } });
    await db.update(characters).set({ spec: 'Arms' }).where(eq(characters.id, c.id));
    expect((await listMySims(db, u.id))[0].subjectSpec).toBe('Arms');
  });
});

describe('enqueueArmorySimByName (fritekst: enhver karakter på WoW Forever)', () => {
  const shaman: SimProfile = { ...warrior, name: 'Rød', className: 'Shaman', level: 41 };
  it('en fremmed karakter: ingen characterId, fuldt navn gemmes som subjectName og vises i listen', async () => {
    const u = await mkUser();
    const blizzard = fakeBlizzard({ simProfiles: { 'rød-cecil': shaman } });
    const r = await enqueueArmorySimByName(db, mkDeps(u.id, blizzard), '  rød   CECIL ', { fightStyles: ['DungeonSlice'] });
    expect(r).toMatchObject({ ok: true });
    expect(blizzard.calls).toEqual(['simprofile:rød-cecil']);
    const [row] = await db.select().from(simJobs);
    expect(row.characterId).toBeNull();
    expect(row.options).toMatchObject({ source: 'armory', fightStyles: ['DungeonSlice'], optimizeBags: false, subjectName: 'Rød Cecil' });
    const [view] = await listMySims(db, u.id);
    expect(view).toMatchObject({ source: 'armory', characterId: null, characterName: null, subjectName: 'Rød Cecil', fightStyles: ['DungeonSlice'] });
  });
  it('brugerens egen registrerede karakter (match på slug) får characterId; en andens gør ikke', async () => {
    const a = await mkUser();
    const b = await mkUser();
    const mine = await mkChar(a.id, 'krigeren-far');
    await mkChar(b.id, 'krigeren-fjeld');
    const blizzard = fakeBlizzard({ simProfiles: { 'krigeren-far': warrior, 'krigeren-fjeld': warrior } });
    expect(await enqueueArmorySimByName(db, mkDeps(a.id, blizzard), 'Krigeren Far', { fightStyles: ['Patchwerk'] })).toMatchObject({ ok: true });
    expect(await enqueueArmorySimByName(db, mkDeps(a.id, blizzard), 'Krigeren Fjeld', { fightStyles: ['Patchwerk'] })).toMatchObject({ ok: true });
    const rows = await db.select().from(simJobs).orderBy(simJobs.id);
    expect(rows.map((r) => r.characterId)).toEqual([mine.id, null]);
    expect(rows.map((r) => (r.options as { subjectName: string }).subjectName)).toEqual(['Krigeren Far', 'Krigeren Fjeld']);
  });
  it('afviser navne uden efternavn og med ugyldige tegn med samme beskeder som «Tilføj karakter» – uden Blizzard-kald', async () => {
    const u = await mkUser();
    const blizzard = fakeBlizzard({ simProfiles: { 'krigeren-far': warrior } });
    for (const name of ['Krigeren', '  ', '', null, undefined, 42]) {
      expect(await enqueueArmorySimByName(db, mkDeps(u.id, blizzard), name, { fightStyles: ['Patchwerk'] }), String(name)).toMatchObject({ ok: false, reason: 'invalid', error: addCharacterMessage('invalid_name') });
    }
    for (const name of ['Krigeren F@r', 'Krig3ren Far', 'Krigeren Far!', `${'a'.repeat(60)} b`]) {
      expect(await enqueueArmorySimByName(db, mkDeps(u.id, blizzard), name, { fightStyles: ['Patchwerk'] }), name).toMatchObject({ ok: false, reason: 'invalid', error: addCharacterMessage('invalid_characters') });
    }
    expect(await enqueueArmorySimByName(db, mkDeps(u.id, blizzard), 'Krigeren Far', { fightStyles: [] })).toMatchObject({ ok: false, error: 'Vælg mindst én kampstil.' });
    expect(blizzard.calls).toEqual([]);
    expect(await db.select().from(simJobs)).toHaveLength(0);
  });
  it('ukendt karakter, armory nede og ikke-understøttet klasse giver de kendte beskeder', async () => {
    const u = await mkUser();
    const blizzard = fakeBlizzard({ simProfiles: { nede: new BlizzardError('unavailable', 'x'), 'død-ridder': { ...warrior, className: 'Death Knight' } } });
    expect(await enqueueArmorySimByName(db, mkDeps(u.id, blizzard), 'Ukendt Person', { fightStyles: ['Patchwerk'] })).toMatchObject({ ok: false, error: ARMORY_NOT_FOUND });
    expect(await enqueueArmorySimByName(db, mkDeps(u.id, blizzard), 'Død Ridder', { fightStyles: ['Patchwerk'] })).toMatchObject({ ok: false, error: UNSUPPORTED_CLASS });
    const down = fakeBlizzard({ simProfiles: { 'krigeren-far': new BlizzardError('unavailable', 'x') } });
    expect(await enqueueArmorySimByName(db, mkDeps(u.id, down), 'Krigeren Far', { fightStyles: ['Patchwerk'] })).toMatchObject({ ok: false, error: ARMORY_UNAVAILABLE });
    expect(await db.select().from(simJobs)).toHaveLength(0);
  });
  it('samme grænser som indsat tekst (2 samtidige) og køens kampstile valideres', async () => {
    const u = await mkUser();
    const blizzard = fakeBlizzard({ simProfiles: { 'rød-cecil': shaman } });
    const rs = [];
    for (let i = 0; i < 3; i++) rs.push(await enqueueArmorySimByName(db, mkDeps(u.id, blizzard), 'Rød Cecil', { fightStyles: ['Patchwerk'] }));
    expect(rs.map((r) => r.ok)).toEqual([true, true, false]);
    expect(rs[2]).toMatchObject({ reason: 'limit' });
    expect(await enqueueArmorySimByName(db, mkDeps(u.id, blizzard), 'Rød Cecil', { fightStyles: ['Raid'] })).toMatchObject({ ok: false, error: 'Ugyldig kampstil.' });
  });
  it('sanitizeSubjectName renser og afkorter; gamle jobs uden feltet giver null', () => {
    expect(sanitizeSubjectName('  Rød \u0000 Cecil  ')).toBe('Rød Cecil');
    expect(sanitizeSubjectName('x'.repeat(100))).toHaveLength(60);
    expect(sanitizeSubjectName('')).toBeNull();
    expect(sanitizeSubjectName(5)).toBeNull();
  });
});

describe('ingen rotation', () => {
  const none = { mean: null, stdDev: null, meanStdDev: null };
  const workerNoDps = {
    player: { name: 'Mig', className: 'mage', spec: 'mage', level: 21, race: 'human' },
    iterations: 500, dps: none,
    results: [{ fightStyle: 'Patchwerk', dps: none }, { fightStyle: 'DungeonSlice', dps: none }],
  };
  const warn = ['DPS er 0 eller mangler for Patchwerk – spec eller rotation er muligvis ikke understøttet endnu.'];
  it('gemmer et resultat uden DPS i stedet for at fejle jobbet', async () => {
    const u = await mkUser();
    const c = await mkChar(u.id, 'x-y');
    await enqueueArmorySim(db, mkDeps(u.id, fakeBlizzard({ simProfiles: { 'x-y': warrior } })), String(c.id), { fightStyles: ['Patchwerk', 'DungeonSlice'] });
    const job = (await claimNextSim(db))!;
    expect(await finishSim(db, job.id, workerNoDps, warn)).toBe(true);
    const [row] = await db.select().from(simJobs).where(eq(simJobs.id, job.id));
    expect(row.status).toBe('done');
    const [view] = await listMySims(db, u.id);
    expect(view.result!.styles.map((s) => s.dps)).toEqual([null, null]);
    expect(noRotationMessages(view.result!.styles)).toEqual([
      { fightStyle: 'Patchwerk', text: NO_ROTATION_TEXT }, { fightStyle: 'DungeonSlice', text: NO_ROTATION_TEXT },
    ]);
    expect(visibleWarnings(view.result!.warnings)).toEqual([]);
  });
  it('hjælperen: null, 0 og manglende DPS giver teksten; rigtig DPS og fejl gør ikke', () => {
    expect(NO_ROTATION_TEXT).toBe('Simulatoren til WoW Forever har endnu ikke en rotation for denne klasse og spec. Den virker automatisk, når den kommer.');
    const d = (mean: number) => ({ mean, stdDev: null, meanStdDev: null });
    const styles = [
      { fightStyle: 'Patchwerk' as const, dps: null }, { fightStyle: 'DungeonSlice' as const, dps: d(0) },
    ];
    expect(noRotationMessages(styles).map((m) => m.fightStyle)).toEqual(['Patchwerk', 'DungeonSlice']);
    expect(hasNoDps({ dps: d(43.2) })).toBe(false);
    expect(hasNoDps({ dps: null, error: 'Der var ikke tid nok' })).toBe(false);
    expect(noRotationMessages([{ fightStyle: 'Patchwerk', dps: d(10) }])).toEqual([]);
    expect(visibleWarnings(['andet', ...warn])).toEqual(['andet']);
  });
  it('et resultat uden kampstile eller kun med fejl er stadig et uventet svar', () => {
    expect(parseSimResult({ dps: none })).toBeNull();
    expect(parseSimResult({ results: [{ fightStyle: 'Patchwerk', dps: none, error: 'x' }] })).toBeNull();
  });
});
