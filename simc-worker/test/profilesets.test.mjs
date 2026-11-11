import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, readFileSync as rf } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateRunOptions, buildProfilesets, equippedFromLines, parseProfilesetResults, buildItemResults,
  profilesetIterations, badProfilesetIndex,
} from '../profilesets.mjs';
import { sanitizeProfile } from '../sanitize.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const hunter = readFileSync(path.join(here, 'fixtures/hunter-11.simc'), 'utf8');
const item = (slot, id, label = 'Test') => ({ slot, id, label });

// ---- validering ----
test('standard: Patchwerk uden bagItems', () => {
  assert.deepEqual(validateRunOptions({}), { ok: true, fightStyles: ['Patchwerk'], bagItems: [] });
});
test('godkender gyldige felter', () => {
  const r = validateRunOptions({ fightStyles: ['DungeonSlice', 'Patchwerk'], bagItems: [item('head', 9999999, "Æble-hat (Øst), 1.0 d'Or")] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.fightStyles, ['DungeonSlice', 'Patchwerk']);
});
for (const [navn, body, re] of [
  ['ukendt kampstil', { fightStyles: ['Hecticc'] }, /fightStyles/],
  ['tom kampstilsliste', { fightStyles: [] }, /fightStyles/],
  ['tre kampstile', { fightStyles: ['Patchwerk', 'DungeonSlice', 'Patchwerk'] }, /fightStyles/],
  ['dublet kampstil', { fightStyles: ['Patchwerk', 'Patchwerk'] }, /dubletter/],
  ['kampstil ikke tekst', { fightStyles: [5] }, /fightStyles/],
  ['bagItems ikke liste', { bagItems: 'x' }, /bagItems/],
  ['for mange items', { bagItems: Array.from({ length: 41 }, (_, i) => item('head', i + 1)) }, /40 items/],
  ['ugyldig slot', { bagItems: [item('head', 1), item('shirt', 2)] }, /bagItems\[1\]: ugyldig slot/],
  ['slot ammo', { bagItems: [item('ammo', 2)] }, /bagItems\[0\]/],
  ['id 0', { bagItems: [item('head', 0)] }, /bagItems\[0\]: id/],
  ['id for stort', { bagItems: [item('head', 10000000)] }, /id/],
  ['id decimal', { bagItems: [item('head', 1.5)] }, /id/],
  ['id tekst', { bagItems: [item('head', '12')] }, /id/],
  ['tom label', { bagItems: [item('head', 1, '')] }, /label/],
  ['for lang label', { bagItems: [item('head', 1, 'a'.repeat(61))] }, /label/],
  ['label med linjeskift', { bagItems: [item('head', 1, 'a\nb')] }, /label/],
  ['label med semikolon', { bagItems: [item('head', 1, 'a;b')] }, /label/],
  ['label med lighed', { bagItems: [item('head', 1, 'x=1')] }, /label/],
  ['label med anførselstegn', { bagItems: [item('head', 1, 'a"b')] }, /label/],
  ['item ikke objekt', { bagItems: [null] }, /bagItems\[0\]/],
]) {
  test(`afviser ${navn}`, () => {
    const r = validateRunOptions(body);
    assert.equal(r.ok, false);
    assert.match(r.error, re);
  });
}

// ---- profileset-linjer ----
test('equippedFromLines læser slot og id', () => {
  const eq = equippedFromLines(sanitizeProfile(hunter).lines);
  assert.equal(eq.get('back'), 2905);
  assert.equal(eq.get('finger1'), 286737);
  assert.equal(eq.has('shirt'), false);
});
test('buildProfilesets: enkeltslot, navn pr. indeks, ingen brugertekst', () => {
  const { lines, entries } = buildProfilesets([item('hands', 3308, 'Handsker; rm -rf'), item('feet', 3307)], new Map());
  assert.deepEqual(lines, ['profileset.i0+=hands=,id=3308', 'profileset.i1+=feet=,id=3307']);
  assert.equal(entries.get('i0').label, 'Handsker; rm -rf');
  assert.ok(lines.every((l) => !l.includes('rm')));
});
test('buildProfilesets: finger og trinket giver to profilesets', () => {
  const { lines, entries } = buildProfilesets([item('finger2', 5), item('trinket1', 6)], new Map());
  assert.deepEqual(lines, [
    'profileset.i0a+=finger1=,id=5', 'profileset.i0b+=finger2=,id=5',
    'profileset.i1a+=trinket1=,id=6', 'profileset.i1b+=trinket2=,id=6',
  ]);
  assert.equal(entries.get('i0b').slot, 'finger2');
  assert.equal(entries.get('i1a').slot, 'trinket1');
});
test('buildProfilesets: springer udstyrede over (også på tværs af par) og skip', () => {
  const eq = new Map([['head', 10], ['finger1', 20], ['trinket2', 30]]);
  const { lines } = buildProfilesets([
    item('head', 10), item('head', 11), item('finger2', 20), item('finger1', 21), item('trinket1', 30), item('hands', 40),
  ], eq, 0, new Set([5]));
  assert.deepEqual(lines, ['profileset.i1+=head=,id=11', 'profileset.i3a+=finger1=,id=21', 'profileset.i3b+=finger2=,id=21']);
});
test('buildProfilesets: profileset-iterationer tilføjes pr. sæt', () => {
  const { lines } = buildProfilesets([item('head', 1)], new Map(), 1500);
  assert.deepEqual(lines, ['profileset.i0+=head=,id=1', 'profileset.i0+=iterations=1500']);
});
test('profilesetIterations: cap, budget og gulv', () => {
  assert.equal(profilesetIterations(5000, 0), 5000);
  assert.equal(profilesetIterations(5000, 4), 5000);
  assert.equal(profilesetIterations(5000, 10), 5000);
  assert.equal(profilesetIterations(5000, 40), 1500);
  assert.equal(profilesetIterations(5000, 80), 750);
  assert.equal(profilesetIterations(20000, 400), 500);
  assert.equal(profilesetIterations(100, 80), 100);
});
test('badProfilesetIndex', () => {
  assert.equal(badProfilesetIndex("Error: Profileset 'i12b': Player"), 12);
  assert.equal(badProfilesetIndex("Error: Profileset 'i3': x"), 3);
  assert.equal(badProfilesetIndex('Error: noget andet'), null);
  assert.equal(badProfilesetIndex(undefined), null);
});

// ---- parsing af json2 ----
test('parseProfilesetResults er defensiv', () => {
  assert.equal(parseProfilesetResults(null).size, 0);
  assert.equal(parseProfilesetResults({}).size, 0);
  assert.equal(parseProfilesetResults({ sim: { profilesets: { results: 'x' } } }).size, 0);
  const m = parseProfilesetResults({ sim: { profilesets: { results: [
    null, 5, { name: 7, mean: 1 }, { name: 'a', mean: 'x' }, { name: 'b', mean: 0 },
    { name: 'c', mean: 100, stddev: 'x' }, { name: 'd', mean: 200.5, stddev: 3, mean_stddev: 0.1 },
  ] } } });
  assert.deepEqual([...m.keys()], ['c', 'd']);
  assert.deepEqual(m.get('c'), { mean: 100, stdDev: null, meanStdDev: null });
  assert.equal(m.get('d').stdDev, 3);
});
test('buildItemResults: delta, procent, sortering, manglende resultat som fejl', () => {
  const { entries } = buildProfilesets([item('head', 1, 'A'), item('neck', 2, 'B'), item('back', 3, 'C'), item('legs', 4, 'D')], new Map());
  const res = new Map([['i0', { mean: 99, stdDev: 1, meanStdDev: 0.1 }], ['i1', { mean: 103.04, stdDev: 1, meanStdDev: 0.1 }], ['i3', { mean: 100, stdDev: 1, meanStdDev: 0.1 }]]);
  const items = buildItemResults(entries, res, 100);
  assert.deepEqual(items.map((i) => i.label), ['B', 'D', 'A', 'C']);
  assert.equal(items[0].deltaPercent, 3);
  assert.ok(Math.abs(items[0].delta - 3.04) < 1e-9);
  assert.equal(items[2].deltaPercent, -1);
  assert.equal(items[3].delta, null);
  assert.match(items[3].error, /Intet resultat/);
  assert.equal(buildItemResults(entries, res, 0)[0].deltaPercent, null);
});

// ---- HTTP-lag med falsk simc ----
let proc, base, logFile, proc2, base2;
async function start(env) {
  const port = 19000 + Math.floor(Math.random() * 900);
  const p = spawn(process.execPath, [path.join(here, '../server.mjs')], {
    env: { ...process.env, PORT: String(port), SIMC_BIN: path.join(here, 'fake-simc.sh'), ...env },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const b = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${b}/health`)).ok) return [p, b]; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('serveren startede ikke');
}
before(async () => {
  logFile = path.join(mkdtempSync(path.join(tmpdir(), 'fakelog-')), 'calls.log');
  [proc, base] = await start({ FAKE_SIMC_LOG: logFile });
  [proc2, base2] = await start({ SIMC_TOTAL_TIMEOUT_MS: '2500' });
});
after(() => { proc?.kill('SIGTERM'); proc2?.kill('SIGTERM'); });
const run = (body, b = base) => fetch(`${b}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const calls = () => { try { return rf(logFile, 'utf8').trim().split('\n'); } catch { return []; } };

test('bagudkompatibel: uden nye felter, plus apiVersion og results', async () => {
  const j = await (await run({ input: hunter, iterations: 500 })).json();
  assert.equal(j.result.apiVersion, 2);
  assert.equal(j.result.dps.mean, 1234.5);
  assert.equal(j.result.scaleFactors, null);
  assert.equal(j.result.results.length, 1);
  assert.equal(j.result.results[0].fightStyle, 'Patchwerk');
  assert.equal(j.result.results[0].items, undefined);
  assert.equal(j.warnings, undefined);
});
test('to kampstile giver to simc-kørsler og to resultater', async () => {
  const before = calls().length;
  const j = await (await run({ input: hunter, fightStyles: ['DungeonSlice', 'Patchwerk'] })).json();
  assert.deepEqual(j.result.results.map((r) => [r.fightStyle, r.dps.mean]), [['DungeonSlice', 900], ['Patchwerk', 1234.5]]);
  assert.equal(j.result.dps.mean, 900); // første stils basis
  assert.deepEqual(calls().slice(before), ['DungeonSlice 0', 'Patchwerk 0']);
});
test('en fejlende kampstil vælter ikke de andre', async () => {
  const j = await (await run({ input: 'hunter="A"\nrace=dsfail\n', fightStyles: ['DungeonSlice', 'Patchwerk'] })).json();
  assert.equal(j.ok, true);
  assert.match(j.result.results[0].error, /kampstil/);
  assert.doesNotMatch(JSON.stringify(j), /hemmelig/);
  assert.equal(j.result.results[1].dps.mean, 1234.5);
  assert.equal(j.result.dps.mean, 1234.5); // første vellykkede
});
test('alle kampstile fejler giver 422', async () => {
  assert.equal((await run({ input: 'hunter="A"\nrace=fail\n', fightStyles: ['Patchwerk', 'DungeonSlice'] })).status, 422);
});
test('DPS 0 for en stil giver advarsel med stilnavn', async () => {
  const j = await (await run({ input: 'hunter="A"\nrace=zero\n', fightStyles: ['Patchwerk', 'DungeonSlice'] })).json();
  assert.equal(j.warnings.length, 2);
  assert.match(j.warnings[1], /DungeonSlice/);
});
test('bagItems: delta, sortering, udstyret springes over, finger giver to', async () => {
  const j = await (await run({
    input: hunter,
    bagItems: [
      item('hands', 3105, 'Handsker (lav)'),         // +5
      item('back', 2905, 'Allerede udstyret'),         // sprunget over
      item('head', 3199, 'Hjelm'),                      // +99
      item('finger1', 286737, 'Samme ring'),           // udstyret: sprunget over
      item('finger1', 4150, 'Ny ring'),                 // +50 begge
    ],
  })).json();
  assert.equal(j.ok, true);
  const items = j.result.results[0].items;
  assert.deepEqual(items.map((i) => [i.index, i.slot, i.id, i.label, i.dpsMean]),
    [[2, 'head', 3199, 'Hjelm', 1333.5], [4, 'finger1', 4150, 'Ny ring', 1284.5], [4, 'finger2', 4150, 'Ny ring', 1284.5], [0, 'hands', 3105, 'Handsker (lav)', 1239.5]]);
  assert.equal(items[0].delta, 99);
  assert.equal(items[0].deltaPercent, 8);
  assert.equal(items[3].deltaPercent, 0.4);
  assert.equal(items[0].dpsStdDev, 9);
});
test('bagItems køres i samme kørsel som basis, én gang pr. kampstil', async () => {
  const before = calls().length;
  await run({ input: hunter, fightStyles: ['Patchwerk', 'DungeonSlice'], bagItems: [item('head', 11), item('trinket1', 12)] });
  assert.deepEqual(calls().slice(before), ['Patchwerk 4', 'DungeonSlice 4'].map((l) => l.replace(/ 4$/, ' 6')));
});
test('item som simc ikke kan indlæse udelades med fejl, resten får resultat', async () => {
  const j = await (await run({ input: hunter, bagItems: [item('head', 21, 'God'), item('neck', 999, 'Ukendt'), item('legs', 22, 'God2')] })).json();
  assert.equal(j.ok, true);
  const items = j.result.results[0].items;
  assert.deepEqual(items.map((i) => i.label), ['God2', 'God', 'Ukendt']);
  assert.match(items[2].error, /ikke indlæse/);
  assert.equal(items[2].delta, null);
  assert.doesNotMatch(JSON.stringify(j), /hemmelig/);
});
test('manglende profileset-resultat markeres som fejl', async () => {
  const j = await (await run({ input: hunter, bagItems: [item('head', 666, 'Intet'), item('legs', 22, 'Fint')] })).json();
  const items = j.result.results[0].items;
  assert.equal(items[0].label, 'Fint');
  assert.match(items[1].error, /Intet resultat/);
});
test('ugyldige nye felter giver 400 med dansk fejl', async () => {
  const r = await run({ input: hunter, bagItems: [item('head', 1), item('shirt', 2)] });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /bagItems\[1\]/);
  assert.equal((await run({ input: hunter, fightStyles: ['Nej'] })).status, 400);
});
test('samlet tidsgrænse: simc dræbes og senere kampstile får fejl', async () => {
  const t = Date.now();
  const r = await run({ input: 'hunter="A"\nrace=slow\n', fightStyles: ['Patchwerk', 'DungeonSlice'] }, base2);
  const dt = Date.now() - t;
  assert.equal(r.status, 422);
  assert.match((await r.json()).error, /for lang tid/);
  assert.ok(dt < 4500, `tog ${dt} ms`);
});
