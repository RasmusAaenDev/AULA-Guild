import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
const pidFile = path.join(tmpdir(), `fake-simc-pid-${process.pid}`);
before(async () => {
  const port = 18000 + Math.floor(Math.random() * 1000);
  base = `http://127.0.0.1:${port}`;
  proc = spawn(process.execPath, [path.join(here, '../server.mjs')], {
    env: { ...process.env, PORT: String(port), SIMC_BIN: path.join(here, 'fake-simc.sh'), FAKE_SIMC_PID: pidFile },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('serveren startede ikke');
});
after(() => { proc?.kill('SIGTERM'); try { rmSync(pidFile, { force: true }); } catch {} });

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

// ---- NDJSON-stream ----
const NDJSON = { 'content-type': 'application/json', accept: 'application/x-ndjson' };
async function readNdjson(res) {
  const text = await res.text();
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
const simcDirs = () => readdirSync(tmpdir()).filter((n) => n.startsWith('simc-'));

test('ndjson: log-linjer og præcis én slutlinje med samme krop som før', async () => {
  const res = await post({ input: 'hunter="A"\nrace=logs\n', iterations: 500 }, NDJSON);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/x-ndjson');
  const lines = await readNdjson(res);
  const results = lines.filter((l) => l.type === 'result');
  assert.equal(results.length, 1);
  assert.equal(lines.at(-1).type, 'result');
  assert.equal(results[0].ok, true);
  assert.equal(results[0].result.dps.mean, 1234.5);
  const log = lines.filter((l) => l.type === 'log').map((l) => l.text).join('');
  assert.match(log, /SimulationCraft FAKE-1 starter/);
  assert.match(log, /== Kampstil: Patchwerk ==/);
  assert.match(log, /Generating Baseline: 100\/100\n/);
  assert.doesNotMatch(log, /Baseline: 10\/100/);
  assert.match(log, /farlig rødtekst\ttab <mappe>/);
  assert.match(log, /slutlinje uden linjeskift\n$/);
  assert.doesNotMatch(log, /[\u0000-\u0008\u000b-\u001f\u007f]/);
  assert.doesNotMatch(log, /\/tmp\/|\/opt\//);
  assert.match(log, /Læser <mappe> og skriver til <mappe>/);
  assert.ok(log.split('\n').every((l) => l.length <= 300));
});
test('ndjson: fejl giver fejl-slutlinje uden at afsløre mere end simc-loggen', async () => {
  const lines = await readNdjson(await post({ input: 'hunter="A"\nrace=fail\n' }, NDJSON));
  const last = lines.at(-1);
  assert.equal(last.type, 'result');
  assert.equal(last.ok, false);
  assert.match(last.error, /Simulationen kunne ikke køre/);
  assert.equal(lines.filter((l) => l.type === 'result').length, 1);
});
test('ndjson: valideringsfejl før streamen er almindelig JSON med statuskode', async () => {
  const res = await post({ input: 'hunter="A"\ninput=/etc/passwd\n' }, NDJSON);
  assert.equal(res.status, 400);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  assert.equal((await res.json()).ok, false);
});
test('ndjson: samlet logvolumen er højst 64 KB og afkortes med note', async () => {
  const lines = await readNdjson(await post({ input: 'hunter="A"\nrace=flood\n' }, NDJSON));
  const log = lines.filter((l) => l.type === 'log').map((l) => l.text).join('');
  assert.ok(Buffer.byteLength(log) <= 64 * 1024 + 20, String(log.length));
  assert.equal(log.split('[log afkortet]\n').length - 1, 1);
  assert.equal(lines.at(-1).type, 'result');
  assert.equal(lines.at(-1).ok, true);
});
test('ndjson: log kommer løbende, før slutlinjen', async () => {
  const t0 = Date.now();
  const res = await post({ input: 'hunter="A"\nrace=logs\n' }, NDJSON);
  const reader = res.body.getReader();
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /"type":"log"/);
  assert.ok(Date.now() - t0 < 3000);
  await reader.cancel();
  await new Promise((r) => setTimeout(r, 500)); // lad den afbrudte kørsel rydde op, før næste test tager sit øjebliksbillede
});
test('uden Accept-headeren er svaret uændret (almindelig JSON)', async () => {
  const res = await post({ input: 'hunter="A"\nrace=logs\n' });
  assert.match(res.headers.get('content-type'), /^application\/json/);
  const j = await res.json();
  assert.equal(j.type, undefined);
  assert.equal(j.ok, true);
  assert.equal(j.result.dps.mean, 1234.5);
});
test('ndjson: klient der afbryder midt i dræber simc og rydder temp-mappen', async () => {
  const ac = new AbortController();
  const before = new Set(simcDirs());
  const res = await fetch(`${base}/run`, { method: 'POST', headers: NDJSON, signal: ac.signal, body: JSON.stringify({ input: 'hunter="A"\nrace=slowlog\n' }) });
  const reader = res.body.getReader();
  await reader.read(); // første log-brudstykke
  for (let i = 0; i < 50 && !existsSync(pidFile); i++) await new Promise((r) => setTimeout(r, 100));
  const pid = Number(readFileSync(pidFile, 'utf8').trim());
  assert.ok(pid > 0);
  ac.abort();
  let alive = true;
  for (let i = 0; i < 40 && alive; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try { process.kill(pid, 0); } catch { alive = false; }
  }
  assert.equal(alive, false, 'simc-processen blev ikke dræbt');
  for (let i = 0; i < 20 && simcDirs().some((d) => !before.has(d)); i++) await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(simcDirs().filter((d) => !before.has(d)), []);
});
test('ndjson: job der venter i køen får «Venter i kø»-linjer', async () => {
  const slow = post({ input: 'hunter="A"\nrace=slow\n' }).then((r) => r.text());
  await new Promise((r) => setTimeout(r, 300));
  const lines = await readNdjson(await post({ input: 'hunter="A"\n' }, NDJSON));
  await slow;
  const waits = lines.filter((l) => l.type === 'log' && l.text === 'Venter i kø …\n');
  assert.ok(waits.length >= 2 && waits.length <= 6, String(waits.length));
  assert.equal(lines.at(-1).type, 'result');
});
