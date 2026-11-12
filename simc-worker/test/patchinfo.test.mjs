// Workerens læsning af /opt/simc/PATCHES_APPLIED (skrevet af patches/apply.sh) og markering af resultater.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readPatchesApplied, parsePatchesApplied, modelInfo } from '../patchinfo.mjs';

test('parsePatchesApplied læser kendte klasser og statusser, ignorerer resten', () => {
  assert.deepEqual(parsePatchesApplied('mage applied\nwarrior dropped-upstream\n\nfoo applied\nmage bogus\n# x\n'), [
    { class: 'mage', status: 'applied' },
    { class: 'warrior', status: 'dropped-upstream' },
  ]);
  assert.deepEqual(parsePatchesApplied(''), []);
});
test('readPatchesApplied: manglende fil giver []', async () => {
  assert.deepEqual(await readPatchesApplied('/findes/ikke/PATCHES_APPLIED'), []);
  const d = mkdtempSync(path.join(tmpdir(), 'pa-'));
  try {
    writeFileSync(path.join(d, 'P'), 'mage applied\n');
    assert.deepEqual(await readPatchesApplied(path.join(d, 'P')), [{ class: 'mage', status: 'applied' }]);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
test('modelInfo: kun klasser med anvendt rettelse får aula-rettelse', () => {
  const p = [{ class: 'mage', status: 'applied' }, { class: 'warrior', status: 'dropped-upstream' }];
  assert.equal(modelInfo(p, 'mage').model, 'aula-rettelse');
  assert.match(modelInfo(p, 'mage').warning, /^Grov model/);
  assert.equal(modelInfo(p, 'warrior'), null);
  assert.equal(modelInfo(p, 'hunter'), null);
  assert.equal(modelInfo([], 'mage'), null);
  // rogue.patch: rogue-resultater markeres også som grov model
  const pr = parsePatchesApplied('mage applied\nrogue applied\n');
  assert.equal(modelInfo(pr, 'rogue').model, 'aula-rettelse');
  assert.match(modelInfo(pr, 'rogue').warning, /^Grov model/);
  assert.equal(modelInfo(parsePatchesApplied('rogue dropped-upstream\n'), 'rogue'), null);
});
test('modelInfo: paladin med anvendt rettelse markeres som «Grov model» (flere rettelser i samme fil)', () => {
  const p = parsePatchesApplied('mage applied\npaladin applied\n');
  assert.equal(modelInfo(p, 'paladin').model, 'aula-rettelse');
  assert.match(modelInfo(p, 'paladin').warning, /^Grov model/);
  assert.equal(modelInfo(p, 'mage').model, 'aula-rettelse');
  assert.equal(modelInfo(parsePatchesApplied('mage applied\npaladin dropped-upstream\n'), 'paladin'), null);
});
test('modelInfo: druid og priest er rettelser oven på upstream og får sin egen «Grov model»-tekst', () => {
  const p = parsePatchesApplied('druid applied\nmage applied\npriest applied\n');
  for (const cls of ['druid', 'priest']) {
    assert.equal(modelInfo(p, cls).model, 'aula-rettelse');
    assert.match(modelInfo(p, cls).warning, /^Grov model: SimulationCraft's grundmodel med Aulas rettelser/);
  }
  assert.match(modelInfo(p, 'mage').warning, /implementeret af Aula/);
  assert.equal(modelInfo(parsePatchesApplied('druid dropped-upstream\n'), 'druid'), null);
});
