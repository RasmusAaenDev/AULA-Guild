// Afvikler sim-køen mod simc-worker, ét job ad gangen. Låsen er proces-global (globalThis), så flere
// samtidige kald (enqueue, opstart, timejob) aldrig kører to jobs parallelt.

import type { Db } from '@/lib/db';
import { claimNextSim, type SimOptions, failSim, finishSim } from '@/lib/sims';

export const SIM_ITERATIONS = 5000;
export const SIM_TIMEOUT_MS = 300_000 // workerens egen grænse er 240 s;
export const UNREACHABLE = 'Simulatoren svarer ikke. Prøv igen om lidt.';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
type RunnerState = { running?: Promise<void>; again?: boolean };
const g = globalThis as unknown as { __aulaSimRunner?: RunnerState };

async function runOne(db: Db, workerUrl: string, f: Fetch, job: { id: number; input: string; options: SimOptions }): Promise<void> {
  let res: Response;
  try {
    res = await f(`${workerUrl.replace(/\/+$/, '')}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input: job.input,
        iterations: SIM_ITERATIONS,
        fightStyles: job.options.fightStyles,
        ...(job.options.bagItems.length > 0 ? { bagItems: job.options.bagItems } : {}),
      }),
      signal: AbortSignal.timeout(SIM_TIMEOUT_MS),
    });
  } catch {
    await failSim(db, job.id, UNREACHABLE);
    return;
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // ikke-JSON (fx fejlside fra en proxy)
  }
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (res.ok && b.ok === true && b.result) {
    await finishSim(db, job.id, b.result, b.warnings);
    return;
  }
  const msg = typeof b.error === 'string' && b.error.trim() !== '' && res.status < 500 ? b.error.trim() : UNREACHABLE;
  await failSim(db, job.id, msg);
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
