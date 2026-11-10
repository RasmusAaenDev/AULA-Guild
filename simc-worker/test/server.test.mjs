import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeProfile } from '../sanitize.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const hunter = readFileSync(path.join(here, 'fixtures/hunter-11.simc'), 'utf8');
const P = 'hunter="Abe"\nlevel=11\n';

test('godkender eksempelprofilen', () => {
  const r = sanitizeProfile(hunter);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.className, 'hunter');
  assert.ok(r.lines.includes('hunter="Fallochli"'));
  assert.ok(r.lines.every((l) => !l.startsWith('#')));
});

for (const bad of ['input=/etc/passwd', 'html=x', 'json2=x', 'json=x', 'output=x', 'log=1', 'apikey=x', 'armory=eu,x,y', 'save=x', 'xml=x', 'csv=x', 'local_json=x', 'iterations=1', 'foo=bar']) {
  test(`afviser ${bad}`, () => {
    const r = sanitizeProfile(`${P}${bad}\n`);
    assert.equal(r.ok, false);
    assert.match(r.error, /Linje 3/);
  });
}

test('afviser flere spillere', () => {
  assert.equal(sanitizeProfile('hunter="A"\nmage="B"\n').ok, false);
});
test('kræver en spiller', () => {
  assert.equal(sanitizeProfile('level=11\n').ok, false);
});
test('afviser null-bytes og kontroltegn', () => {
  assert.equal(sanitizeProfile('hunter="A"\nrace=dw\u0000arf\n').ok, false);
  assert.equal(sanitizeProfile('hunter="A"\nrace=dw\u001barf\n').ok, false);
});
test('afviser ugyldigt navn', () => {
  assert.equal(sanitizeProfile('hunter="A;rm"\n').ok, false);
  assert.equal(sanitizeProfile('hunter=A\n').ok, false);
  assert.equal(sanitizeProfile(`hunter="${'a'.repeat(41)}"\n`).ok, false);
});
test('afviser for lange linjer og filer', () => {
  assert.equal(sanitizeProfile(`${P}talents=${'a'.repeat(513)}\n`).ok, false);
  assert.equal(sanitizeProfile(`${P}# ${'a'.repeat(40000)}\n`).ok, false);
  assert.equal(sanitizeProfile(123).ok, false);
});
test('afviser URL-værdier og linjer uden =', () => {
  assert.equal(sanitizeProfile(`${P}talents=http://x\n`).ok, false);
  assert.equal(sanitizeProfile(`${P}garbage\n`).ok, false);
});
test('ekkoer højst 40 tegn', () => {
  const r = sanitizeProfile(`${P}${'x'.repeat(200)}=1\n`);
  assert.equal(r.ok, false);
  assert.ok(r.error.length < 120);
});

// ---- HTTP-lag med falsk simc ----
let proc, base;
before(async () => {
  const port = 18000 + Math.floor(Math.random() * 1000);
  base = `http://127.0.0.1:${port}`;
  proc = spawn(process.execPath, [path.join(here, '../server.mjs')], {
    env: { ...process.env, PORT: String(port), SIMC_BIN: path.join(here, 'fake-simc.sh') },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('serveren startede ikke');
});
after(() => proc?.kill('SIGTERM'));

const post = (body, headers = { 'content-type': 'application/json' }) =>
  fetch(`${base}/run`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('GET /health', async () => {
  const j = await (await fetch(`${base}/health`)).json();
  assert.deepEqual(j, { ok: true, simc: 'SimulationCraft FAKE-1' });
});
test('POST /run ok', async () => {
  const res = await post({ input: hunter, iterations: 500 });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.ok, true);
  assert.equal(j.result.dps.mean, 1234.5);
  assert.equal(j.result.dps.stdDev, 10);
  assert.equal(j.result.iterations, 500);
  assert.equal(j.result.player.className, 'hunter');
  assert.equal(j.result.player.spec, 'Beast Mastery');
  assert.equal(j.result.scaleFactors, null);
  assert.equal(j.warnings, undefined);
});
test('DPS 0 giver advarsel', async () => {
  const j = await (await post({ input: 'hunter="A"\nrace=zero\n' })).json();
  assert.equal(j.ok, true);
  assert.equal(j.warnings.length, 1);
});
test('simc-fejl giver 422 uden at afsløre stderr', async () => {
  const res = await post({ input: 'hunter="A"\nrace=fail\n' });
  assert.equal(res.status, 422);
  const t = await res.text();
  assert.match(t, /Simulationen kunne ikke køre/);
  assert.doesNotMatch(t, /hemmelig/);
});
test('afviser forbudt nøgle med 400', async () => {
  const res = await post({ input: 'hunter="A"\ninput=/etc/passwd\n' });
  assert.equal(res.status, 400);
});
test('validerer iterations, content-type og JSON', async () => {
  assert.equal((await post({ input: P, iterations: 50 })).status, 400);
  assert.equal((await post({ input: P, iterations: 1.5 })).status, 400);
  assert.equal((await post({ input: P, iterations: 99999 })).status, 400);
  assert.equal((await post({ input: 5 })).status, 400);
  assert.equal((await post('{', { 'content-type': 'application/json' })).status, 400);
  assert.equal((await post({ input: P }, { 'content-type': 'text/plain' })).status, 415);
});
test('for stor body giver 413', async () => {
  const res = await post({ input: 'a'.repeat(70 * 1024) }).catch((e) => e);
  if (res instanceof Error) return; // forbindelsen blev lukket før svar: også acceptabelt
  assert.equal(res.status, 413);
});
test('ukendt sti giver 404', async () => {
  assert.equal((await fetch(`${base}/x`)).status, 404);
});
