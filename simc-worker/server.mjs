import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sanitizeProfile } from './sanitize.mjs';
import {
  validateRunOptions, equippedFromLines, buildProfilesets, profilesetIterations,
  parseProfilesetResults, buildItemResults, badProfilesetIndex,
} from './profilesets.mjs';

const SIMC_BIN = process.env.SIMC_BIN || '/opt/simc/simc';
const PORT = Number(process.env.PORT) || 8080;
const MAX_BODY = 64 * 1024;
const MAX_PENDING = 10;
// Samlet tidsbudget for hele /run (alle kampstile); hver simc-kørsel får resten. Env kun til tests.
const TOTAL_TIMEOUT_MS = Number(process.env.SIMC_TOTAL_TIMEOUT_MS) || 240_000;
const MIN_RUN_MS = 1_000;
const LOG_CAP = 20 * 1024;

let simcVersion = 'ukendt';
let shuttingDown = false;

function detectVersion() {
  return new Promise((resolve) => {
    execFile(SIMC_BIN, ['--version'], { timeout: 10_000, maxBuffer: 64 * 1024 }, (err, stdout, stderr) => {
      const text = `${stdout || ''}${stderr || ''}`;
      const m = /SimulationCraft[^\n]*/i.exec(text) || /\S[^\n]*/.exec(text);
      resolve(m ? m[0].trim().slice(0, 100) : 'ukendt');
    });
  });
}

// ---- kø: FIFO, én ad gangen, højst MAX_PENDING (kørende + ventende) ----
let pending = 0;
let chain = Promise.resolve();
function enqueue(task) {
  if (pending >= MAX_PENDING) return null;
  pending++;
  const p = chain.then(task, task);
  chain = p.catch(() => {}).finally(() => { pending--; });
  return p;
}

function runSimc(inputFile, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(SIMC_BIN, [inputFile], { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let out = '', err = '', timedOut = false;
    const cap = (cur, d) => (cur.length >= LOG_CAP ? cur : (cur + d.toString('utf8')).slice(0, LOG_CAP));
    child.stdout.on('data', (d) => { out = cap(out, d); });
    child.stderr.on('data', (d) => { err = cap(err, d); });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.on('error', () => { clearTimeout(timer); resolve({ code: -1, timedOut, out, err }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, timedOut, out, err }); });
  });
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === 'string' ? v : null);

// En simc-kørsel for én kampstil (basisprofil + evt. profilesets i samme kørsel).
async function runStyle(dir, lines, iterations, fightStyle, ps, timeoutMs) {
  const outFile = path.join(dir, `out-${fightStyle}.json`);
  const inFile = path.join(dir, `in-${fightStyle}.simc`);
  const content = [
    ...lines,
    `iterations=${iterations}`, 'threads=1', 'default_actions=1', `fight_style=${fightStyle}`,
    // DungeonSlice sætter selv max_time (360 s) og mål (raid events); Patchwerk bruger fast 300 s.
    ...(fightStyle === 'DungeonSlice' ? [] : ['max_time=300']),
    'vary_combat_length=0.2',
    ...(ps.lines.length ? ['profileset_work_threads=1', ...ps.lines] : []),
    `json2=${outFile}`, '',
  ].join('\n');
  await writeFile(inFile, content, { mode: 0o600 });
  const r = await runSimc(inFile, timeoutMs);
  if (r.timedOut || r.code !== 0) {
    console.error(`simc fejlede: stil=${fightStyle} kode=${r.code} timeout=${r.timedOut} stderr_bytes=${r.err.length}`);
    const bad = r.timedOut ? null : badProfilesetIndex(r.err);
    if (bad !== null) return { badIndex: bad };
    return { timedOut: r.timedOut, error: r.timedOut ? 'Simulationen tog for lang tid og blev afbrudt.' : 'Simulationen kunne ikke køre for denne kampstil.' };
  }
  let json;
  try { json = JSON.parse(await readFile(outFile, 'utf8')); } catch { return { error: 'Simc gav ikke noget læsbart resultat for denne kampstil.' }; }
  const p = json?.sim?.players?.[0];
  if (!p) return { error: 'Simc gav ikke noget resultat for denne kampstil.' };
  const d = p.collected_data?.dps;
  const dps = { mean: num(d?.mean), stdDev: num(d?.std_dev), meanStdDev: num(d?.mean_std_dev) };
  const entry = { fightStyle, dps };
  if (ps.entries.size) entry.items = buildItemResults(ps.entries, parseProfilesetResults(json), dps.mean || 0);
  return { entry, player: p };
}

async function simulate(lines, className, iterations, fightStyles, bagItems) {
  const started = Date.now();
  const deadline = started + TOTAL_TIMEOUT_MS;
  const dir = await mkdtemp(path.join(tmpdir(), 'simc-'), { mode: 0o700 });
  try {
    const equipped = equippedFromLines(lines);
    // Items simc ikke kan indlæse (fx ukendt id) får simc til at afbryde hele kørslen med det samme;
    // vi udelader dem og kører igen, så resten stadig får resultat.
    const badIdx = new Set();
    const buildPs = () => {
      const n = buildProfilesets(bagItems, equipped, 0, badIdx).entries.size;
      return buildProfilesets(bagItems, equipped, profilesetIterations(iterations, n), badIdx);
    };
    const badItems = () => [...badIdx].sort((a, b) => a - b).map((i) => ({
      index: i, slot: bagItems[i].slot, id: bagItems[i].id, label: bagItems[i].label,
      dpsMean: null, dpsStdDev: null, delta: null, deltaPercent: null,
      error: 'Simc kunne ikke indlæse dette item (ukendt eller ugyldigt item-id for slotten).',
    }));
    const results = [];
    const warnings = [];
    let firstPlayer = null, anyTimeout = false;
    const noDps = (fightStyle) => (fightStyles.length === 1
      ? 'DPS er 0 eller mangler – spec eller rotation er muligvis ikke understøttet endnu.'
      : `DPS er 0 eller mangler for ${fightStyle} – spec eller rotation er muligvis ikke understøttet endnu.`);
    for (const fightStyle of fightStyles) {
      const left = deadline - Date.now();
      if (left < MIN_RUN_MS) {
        anyTimeout = true;
        results.push({ fightStyle, dps: { mean: null, stdDev: null, meanStdDev: null }, error: 'Der var ikke tid nok tilbage til denne kampstil.' });
        continue;
      }
      let r;
      for (;;) {
        const ps = buildPs();
        const remaining = deadline - Date.now();
        if (remaining < MIN_RUN_MS) { r = { timedOut: true, error: 'Der var ikke tid nok tilbage til denne kampstil.' }; break; }
        r = await runStyle(dir, lines, iterations, fightStyle, ps, remaining);
        if (r.badIndex === undefined) break;
        if (!(r.badIndex < bagItems.length) || badIdx.has(r.badIndex)) { r = { error: 'Simulationen kunne ikke køre for denne kampstil.' }; break; }
        badIdx.add(r.badIndex);
      }
      if (r.timedOut) anyTimeout = true;
      if (r.error) {
        results.push({ fightStyle, dps: { mean: null, stdDev: null, meanStdDev: null }, error: r.error });
        continue;
      }
      if (!firstPlayer) firstPlayer = r.player;
      if (!r.entry.dps.mean) warnings.push(noDps(fightStyle));
      if (badIdx.size) r.entry.items = [...(r.entry.items || []), ...badItems()];
      results.push(r.entry);
    }
    const good = results.find((x) => !x.error);
    if (!good) return { fail: anyTimeout ? 'Simulationen tog for lang tid og blev afbrudt.' : null };
    const p = firstPlayer;
    const result = {
      apiVersion: 2,
      simc: simcVersion,
      player: { name: str(p.name), className, spec: str(p.specialization), level: num(p.level), race: str(p.race) },
      iterations,
      dps: good.dps,
      scaleFactors: null,
      results,
      elapsedMs: Date.now() - started,
    };
    return { result, warnings };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), connection: 'close' });
  res.end(body);
}

function readBody(req, res) {
  return new Promise((resolve) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_BODY) {
      send(res, 413, { ok: false, error: 'Anmodningen er for stor (højst 64 KB).' });
      req.destroy();
      return resolve(null);
    }
    const chunks = [];
    let size = 0, done = false;
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > MAX_BODY) {
        done = true;
        send(res, 413, { ok: false, error: 'Anmodningen er for stor (højst 64 KB).' });
        req.destroy();
        return resolve(null);
      }
      chunks.push(c);
    });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks).toString('utf8')); } });
    req.on('error', () => { if (!done) { done = true; resolve(null); } });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = (req.url || '').split('?')[0];
    if (req.method === 'GET' && url === '/health') {
      return send(res, 200, { ok: true, simc: simcVersion });
    }
    if (req.method === 'POST' && url === '/run') {
      if (shuttingDown) return send(res, 503, { ok: false, error: 'Tjenesten lukker ned.' });
      if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
        return send(res, 415, { ok: false, error: 'Content-Type skal være application/json.' });
      }
      const raw = await readBody(req, res);
      if (raw === null) return;
      let body;
      try { body = JSON.parse(raw); } catch { return send(res, 400, { ok: false, error: 'Ugyldig JSON.' }); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return send(res, 400, { ok: false, error: 'Forventede et JSON-objekt.' });
      }
      const iterations = body.iterations === undefined ? 5000 : body.iterations;
      if (!Number.isInteger(iterations) || iterations < 100 || iterations > 20000) {
        return send(res, 400, { ok: false, error: 'iterations skal være et heltal mellem 100 og 20000.' });
      }
      const s = sanitizeProfile(body.input);
      if (!s.ok) return send(res, 400, { ok: false, error: s.error });
      const o = validateRunOptions(body);
      if (!o.ok) return send(res, 400, { ok: false, error: o.error });
      const job = enqueue(() => simulate(s.lines, s.className, iterations, o.fightStyles, o.bagItems));
      if (!job) return send(res, 429, { ok: false, error: 'Køen er fuld. Prøv igen om lidt.' });
      let r;
      try { r = await job; } catch (e) {
        console.error('intern fejl i kørsel:', e?.code || e?.name || 'ukendt');
        r = { fail: null };
      }
      if (r.fail !== undefined) {
        return send(res, 422, { ok: false, error: `Simulationen kunne ikke køre. ${r.fail || 'Tjek at profilen er en gyldig eksport fra SimulationCraft-addonen.'}` });
      }
      const payload = { ok: true, result: r.result };
      if (r.warnings.length) payload.warnings = r.warnings;
      return send(res, 200, payload);
    }
    send(res, 404, { ok: false, error: 'Ikke fundet.' });
  } catch (e) {
    console.error('uventet fejl:', e?.code || e?.name || 'ukendt');
    if (!res.headersSent) send(res, 500, { ok: false, error: 'Intern fejl.' });
  }
});
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error('SIGTERM: lukker ned');
  server.close(() => process.exit(0));
  server.closeIdleConnections?.();
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

simcVersion = await detectVersion();
server.listen(PORT, '0.0.0.0', () => console.error(`simc-worker lytter på ${PORT} (simc: ${simcVersion})`));
