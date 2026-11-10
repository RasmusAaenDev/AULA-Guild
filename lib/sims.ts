// Sim-kø i databasen. Ren DB-logik uden Next, så den kan testes. Autorisation håndhæves her, ikke kun i UI'et:
// brugere ser og sletter kun egne simulationer, og klienten får aldrig rå worker-svar, kun filtrerede felter.

import { and, count, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { simJobs, type SimStatus } from '@/lib/db/schema';
import { createSendLimiter, type SendLimiter } from '@/lib/chat-send';
import { parseId } from '@/lib/site-chat';
import { validateSimcInput } from '@/lib/simc-input';

export const MAX_ACTIVE_PER_USER = 2;
export const MAX_PER_HOUR = 10;
export const MAX_QUEUED_GLOBAL = 20;
export const STALE_RUNNING_MS = 5 * 60_000;
export const KEEP_DAYS = 30;

export function createSimLimiter(): SendLimiter {
  return createSendLimiter({ max: MAX_PER_HOUR, windowMs: 3_600_000, minGapMs: 0 });
}

export type SimReason = 'invalid' | 'not_found' | 'limit' | 'rate_limited' | 'queue_full';
export type SimFail = { ok: false; reason: SimReason; error: string };
const fail = (reason: SimReason, error: string): SimFail => ({ ok: false, reason, error });

export type SimResult = {
  player: { name: string | null; className: string | null; spec: string | null; level: number | null; race: string | null };
  iterations: number | null;
  dps: { mean: number; stdDev: number | null; meanStdDev: number | null };
  elapsedMs: number | null;
  warnings: string[];
};

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() !== '' ? [...v.trim()].slice(0, max).join('') : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Filtrerer et (worker-)svar til kendte felter. Giver null hvis der ikke er et brugbart DPS-tal. */
export function parseSimResult(raw: unknown, extraWarnings?: unknown): SimResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const d = r.dps && typeof r.dps === 'object' ? (r.dps as Record<string, unknown>) : null;
  const mean = d ? num(d.mean) : null;
  if (!d || mean === null || mean < 0) return null;
  const p = r.player && typeof r.player === 'object' ? (r.player as Record<string, unknown>) : {};
  const rawWarnings = Array.isArray(r.warnings) ? r.warnings : Array.isArray(extraWarnings) ? extraWarnings : [];
  const warnings = rawWarnings.map((w) => str(w, 200)).filter((w): w is string => w !== null).slice(0, 10);
  return {
    player: { name: str(p.name, 40), className: str(p.className, 30), spec: str(p.spec, 30), level: num(p.level), race: str(p.race, 30) },
    iterations: num(r.iterations),
    dps: { mean, stdDev: num(d.stdDev), meanStdDev: num(d.meanStdDev) },
    elapsedMs: num(r.elapsedMs),
    warnings,
  };
}

export type SimView = {
  id: number;
  status: SimStatus;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
  result: SimResult | null;
};

export async function enqueueSim(
  db: Db,
  deps: { userId: number; limiter: SendLimiter; now: number },
  rawInput: unknown,
): Promise<({ ok: true; id: number } | SimFail)> {
  const valid = validateSimcInput(rawInput);
  if (!valid.ok) return fail('invalid', valid.error);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7302)`); // serialiserer grænserne
    const [{ mine }] = await tx
      .select({ mine: count() })
      .from(simJobs)
      .where(and(eq(simJobs.userId, deps.userId), inArray(simJobs.status, ['queued', 'running'])));
    if (mine >= MAX_ACTIVE_PER_USER) {
      return fail('limit', `Du har allerede ${MAX_ACTIVE_PER_USER} simulationer i gang. Vent til en af dem er færdig.`);
    }
    const [{ queued }] = await tx.select({ queued: count() }).from(simJobs).where(eq(simJobs.status, 'queued'));
    if (queued >= MAX_QUEUED_GLOBAL) return fail('queue_full', 'Køen er fuld lige nu. Prøv igen om lidt.');
    const limit = deps.limiter.take(deps.userId, deps.now);
    if (!limit.ok) return fail('rate_limited', `Du kan højst starte ${MAX_PER_HOUR} simulationer i timen. Prøv igen senere.`);
    const [row] = await tx
      .insert(simJobs)
      .values({ userId: deps.userId, input: valid.input, status: 'queued' })
      .returning({ id: simJobs.id });
    return { ok: true as const, id: row.id };
  });
}

/** Brugerens egne seneste simulationer, nyeste først. Input og rå resultater sendes aldrig videre. */
export async function listMySims(db: Db, userId: number, limit = 10): Promise<SimView[]> {
  const rows = await db
    .select({
      id: simJobs.id, status: simJobs.status, createdAt: simJobs.createdAt, finishedAt: simJobs.finishedAt,
      error: simJobs.error, result: simJobs.result,
    })
    .from(simJobs)
    .where(eq(simJobs.userId, userId))
    .orderBy(desc(simJobs.id))
    .limit(Math.min(Math.max(Math.trunc(limit), 1), 100));
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
    error: r.error,
    result: r.status === 'done' ? parseSimResult(r.result) : null,
  }));
}

/** Sletter kun brugerens egen simulation (hård sletning). */
export async function deleteMySim(db: Db, userId: number, id: unknown): Promise<{ ok: true } | SimFail> {
  const sid = parseId(id);
  if (sid === null) return fail('not_found', 'Simulationen findes ikke.');
  const rows = await db.delete(simJobs).where(and(eq(simJobs.id, sid), eq(simJobs.userId, userId))).returning({ id: simJobs.id });
  return rows.length === 0 ? fail('not_found', 'Simulationen findes ikke.') : { ok: true };
}

export type ClaimedSim = { id: number; userId: number; input: string };

/** Atomisk: tager det ældste køede job og markerer det som kørende. Samtidige kald får forskellige jobs. */
export async function claimNextSim(db: Db): Promise<ClaimedSim | null> {
  const rows = await db.execute(sql`
    update sim_jobs set status = 'running', started_at = now()
    where id = (select id from sim_jobs where status = 'queued' order by id limit 1 for update skip locked)
    returning id, user_id, input`);
  const r = rows[0] as { id: number; user_id: number; input: string } | undefined;
  return r ? { id: r.id, userId: r.user_id, input: r.input } : null;
}

/** Gemmer kun et filtreret resultat; er svaret ubrugeligt, fejler jobbet. Kun kørende jobs ændres. */
export async function finishSim(db: Db, id: number, rawResult: unknown, extraWarnings?: unknown): Promise<boolean> {
  const result = parseSimResult(rawResult, extraWarnings);
  if (!result) return failSim(db, id, 'Simulatoren gav et uventet svar.');
  const rows = await db
    .update(simJobs)
    .set({ status: 'done', result, error: null, finishedAt: new Date() })
    .where(and(eq(simJobs.id, id), eq(simJobs.status, 'running')))
    .returning({ id: simJobs.id });
  return rows.length > 0;
}

export async function failSim(db: Db, id: number, error: string): Promise<boolean> {
  const rows = await db
    .update(simJobs)
    .set({ status: 'failed', result: null, error: [...error].slice(0, 300).join(''), finishedAt: new Date() })
    .where(and(eq(simJobs.id, id), eq(simJobs.status, 'running')))
    .returning({ id: simJobs.id });
  return rows.length > 0;
}

/** Kørende jobs ældre end 5 minutter (fx efter en genstart) lægges tilbage i køen. Returnerer antallet. */
export async function resetStaleRunning(db: Db, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_RUNNING_MS);
  const rows = await db
    .update(simJobs)
    .set({ status: 'queued', startedAt: null })
    .where(and(eq(simJobs.status, 'running'), lt(simJobs.startedAt, cutoff)))
    .returning({ id: simJobs.id });
  return rows.length;
}

/** Sletter færdige og fejlede simulationer ældre end 30 dage. Returnerer antallet. */
export async function deleteOldSims(db: Db, now: Date = new Date(), days = KEEP_DAYS): Promise<number> {
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  const rows = await db
    .delete(simJobs)
    .where(and(inArray(simJobs.status, ['done', 'failed']), lt(simJobs.createdAt, cutoff)))
    .returning({ id: simJobs.id });
  return rows.length;
}
