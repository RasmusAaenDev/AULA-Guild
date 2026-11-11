// Afvikler sim-køen mod simc-worker, ét job ad gangen. Låsen er proces-global (globalThis), så flere
// samtidige kald (enqueue, opstart, timejob) aldrig kører to jobs parallelt.

import type { Db } from '@/lib/db';
import { claimNextSim, type SimOptions, failSim, finishSim, updateSimLog } from '@/lib/sims';

export const SIM_ITERATIONS = 5000;
export const SIM_TIMEOUT_MS = 300_000 // workerens egen grænse er 240 s;
export const UNREACHABLE = 'Simulatoren svarer ikke. Prøv igen om lidt.';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
type RunnerState = { running?: Promise<void>; again?: boolean };
const g = globalThis as unknown as { __aulaSimRunner?: RunnerState };

export const LOG_TAIL_CHARS = 16 * 1024;
export const LOG_WRITE_INTERVAL_MS = 1000;
// Kontroltegn undtagen \n og \t (workeren renser allerede; det her er forsvar i dybden).
// eslint-disable-next-line no-control-regex
const LOG_CONTROL_RE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;

const cleanLogText = (t: string): string => t.replace(LOG_CONTROL_RE, '');
const tail = (t: string): string => (t.length > LOG_TAIL_CHARS ? t.slice(t.length - LOG_TAIL_CHARS) : t);

type WorkerBody = { status: number; body: Record<string, unknown> };

/**
 * Læser en NDJSON-strøm linje for linje (robust over for delte chunks; ugyldige linjer ignoreres).
 * onLog får hvert log-brudstykke. Returnerer slutlinjen, eller null hvis den mangler.
 */
async function readNdjson(res: Response, onLog: (text: string) => void): Promise<Record<string, unknown> | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let result: Record<string, unknown> | null = null;
  const handle = (line: string) => {
    const t = line.trim();
    if (!t) return;
    let o: unknown;
    try { o = JSON.parse(t); } catch { return; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return;
    const r = o as Record<string, unknown>;
    if (r.type === 'log') { if (typeof r.text === 'string') onLog(r.text); } else if (r.type === 'result' || (r.type === undefined && 'ok' in r)) result = r;
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      handle(buf.slice(0, i));
      buf = buf.slice(i + 1);
    }
  }
  buf += decoder.decode();
  handle(buf);
  return result;
}

async function runOne(db: Db, workerUrl: string, f: Fetch, job: { id: number; input: string; options: SimOptions }): Promise<void> {
  let log = '';
  let dirty = false;
  let lastWrite = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing: Promise<void> = Promise.resolve();
  const writeLog = () => {
    timer = null;
    if (!dirty) return;
    dirty = false;
    lastWrite = Date.now();
    const snapshot = log;
    writing = writing.then(() => updateSimLog(db, job.id, snapshot)).catch(() => undefined);
  };
  const onLog = (text: string) => {
    log = tail(log + cleanLogText(text));
    dirty = true;
    if (!timer) timer = setTimeout(writeLog, Math.max(0, lastWrite + LOG_WRITE_INTERVAL_MS - Date.now()));
  };
  /** Stopper den løbende skrivning; den endelige log følger med finishSim/failSim. */
  const settle = async (): Promise<string | undefined> => {
    if (timer) { clearTimeout(timer); timer = null; }
    await writing;
    return log === '' ? undefined : log;
  };
  const fail = async (msg: string) => { await failSim(db, job.id, msg, await settle()); };

  let res: Response;
  let wb: WorkerBody | null = null;
  try {
    res = await f(`${workerUrl.replace(/\/+$/, '')}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' },
      body: JSON.stringify({
        input: job.input,
        iterations: SIM_ITERATIONS,
        fightStyles: job.options.fightStyles,
        ...(job.options.bagItems.length > 0 ? { bagItems: job.options.bagItems } : {}),
      }),
      signal: AbortSignal.timeout(SIM_TIMEOUT_MS),
    });
    if (/ndjson/i.test(res.headers.get('content-type') ?? '')) {
      const last = await readNdjson(res, onLog);
      wb = last ? { status: res.status, body: last } : null;
      if (!wb) { await fail(UNREACHABLE); return; }
    }
  } catch {
    await fail(UNREACHABLE);
    return;
  }
  if (!wb) {
    // Ældre worker: almindeligt JSON-svar uden log.
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ikke-JSON (fx fejlside fra en proxy)
    }
    wb = { status: res.status, body: body && typeof body === 'object' ? (body as Record<string, unknown>) : {} };
  }
  const b = wb.body;
  if (res.ok && b.ok === true && b.result) {
    await finishSim(db, job.id, b.result, b.warnings, await settle());
    return;
  }
  const msg = typeof b.error === 'string' && b.error.trim() !== '' && wb.status < 500 ? b.error.trim() : UNREACHABLE;
  await fail(msg);
}

/** Løber køen igennem. Kaldes under en igangværende kørsel, får man samme løfte, og køen gennemløbes igen til sidst. */
export function processQueue(opts: { db: Db; workerUrl: string; fetch?: Fetch }): Promise<void> {
  const state = (g.__aulaSimRunner ??= {});
  if (state.running) {
    state.again = true;
    return state.running;
  }
  const f: Fetch = opts.fetch ?? ((u, i) => fetch(u, i));
  state.running = (async () => {
    try {
      do {
        state.again = false;
        for (;;) {
          const job = await claimNextSim(opts.db);
          if (!job) break;
          try {
            await runOne(opts.db, opts.workerUrl, f, job);
          } catch (err) {
            console.error('Sim-job fejlede uventet', err);
            await failSim(opts.db, job.id, UNREACHABLE).catch(() => undefined);
          }
        }
      } while (state.again);
    } finally {
      state.running = undefined;
    }
  })();
  return state.running;
}
