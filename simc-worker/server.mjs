import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sanitizeProfile } from './sanitize.mjs';

const SIMC_BIN = process.env.SIMC_BIN || '/opt/simc/simc';
const PORT = Number(process.env.PORT) || 8080;
const MAX_BODY = 64 * 1024;
const MAX_PENDING = 10;
const TIMEOUT_MS = 90_000;
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

function runSimc(inputFile) {
  return new Promise((resolve) => {
    const child = spawn(SIMC_BIN, [inputFile], { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let out = '', err = '', timedOut = false;
    const cap = (cur, d) => (cur.length >= LOG_CAP ? cur : (cur + d.toString('utf8')).slice(0, LOG_CAP));
    child.stdout.on('data', (d) => { out = cap(out, d); });
    child.stderr.on('data', (d) => { err = cap(err, d); });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, TIMEOUT_MS);
    child.on('error', () => { clearTimeout(timer); resolve({ code: -1, timedOut, out, err }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, timedOut, out, err }); });
  });
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === 'string' ? v : null);

async function simulate(lines, className, iterations) {
  const started = Date.now();
  const dir = await mkdtemp(path.join(tmpdir(), 'simc-'), { mode: 0o700 });
  try {
    const outFile = path.join(dir, 'out.json');
    const inFile = path.join(dir, 'in.simc');
    const content = [
      ...lines,
      `iterations=${iterations}`, 'threads=1', 'default_actions=1', 'fight_style=Patchwerk',
      'max_time=300', 'vary_combat_length=0.2', `json2=${outFile}`, '',
    ].join('\n');
    await writeFile(inFile, content, { mode: 0o600 });
    const r = await runSimc(inFile);
    if (r.timedOut || r.code !== 0) {
      console.error(`simc fejlede: kode=${r.code} timeout=${r.timedOut} stderr_bytes=${r.err.length}`);
      return { fail: r.timedOut ? 'Simulationen tog for lang tid og blev afbrudt.' : null };
    }
    let json;
    try { json = JSON.parse(await readFile(outFile, 'utf8')); } catch { return { fail: null }; }
    const p = json?.sim?.players?.[0];
    if (!p) return { fail: null };
    const d = p.collected_data?.dps;
    const dps = { mean: num(d?.mean), stdDev: num(d?.std_dev), meanStdDev: num(d?.mean_std_dev) };
    const result = {
      simc: simcVersion,
      player: { name: str(p.name), className, spec: str(p.specialization), level: num(p.level), race: str(p.race) },
      iterations,
      dps,
      scaleFactors: null,
      elapsedMs: Date.now() - started,
    };
    const warnings = [];
    if (!dps.mean) warnings.push('DPS er 0 eller mangler – spec eller rotation er muligvis ikke understøttet endnu.');
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
      const job = enqueue(() => simulate(s.lines, s.className, iterations));
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
