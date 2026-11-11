// Sim-kø i databasen. Ren DB-logik uden Next, så den kan testes. Autorisation håndhæves her, ikke kun i UI'et:
// brugere ser og sletter kun egne simulationer, og klienten får aldrig rå worker-svar, kun filtrerede felter.

import { and, count, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { simJobs, type SimStatus } from '@/lib/db/schema';
import { createSendLimiter, type SendLimiter } from '@/lib/chat-send';
import { parseId } from '@/lib/site-chat';
import { validateSimcInput } from '@/lib/simc-input';
import { BAG_SLOTS, MAX_BAG_ITEMS, MAX_ITEM_ID, cleanLabel, parseBagItems, sanitizeBagItems, type BagItem } from '@/lib/simc-bags';

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

export const FIGHT_STYLES = ['Patchwerk', 'DungeonSlice'] as const;
export type FightStyle = (typeof FIGHT_STYLES)[number];
const isFightStyle = (v: unknown): v is FightStyle => typeof v === 'string' && (FIGHT_STYLES as readonly string[]).includes(v);

export type SimDps = { mean: number; stdDev: number | null; meanStdDev: number | null };
export type SimItemResult = {
  index: number;
  slot: string;
  id: number;
  label: string;
  dpsMean: number | null;
  delta: number | null;
  deltaPercent: number | null;
  error?: string;
};
export type SimStyleResult = { fightStyle: FightStyle; dps: SimDps | null; items: SimItemResult[]; error?: string };

export type SimResult = {
  player: { name: string | null; className: string | null; spec: string | null; level: number | null; race: string | null };
  iterations: number | null;
  /** Første vellykkede kampstils DPS (også for gamle enkeltstils-resultater). */
  dps: SimDps;
  /** Pr. kampstil. Gamle resultater giver én post (Patchwerk) uden items. */
  styles: SimStyleResult[];
  elapsedMs: number | null;
  warnings: string[];
};

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() !== '' ? [...v.trim()].slice(0, max).join('') : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

function parseDps(v: unknown): SimDps | null {
  const d = obj(v);
  const mean = d ? num(d.mean) : null;
  if (!d || mean === null || mean < 0) return null;
  return { mean, stdDev: num(d.stdDev), meanStdDev: num(d.meanStdDev) };
}

function parseItem(v: unknown): SimItemResult | null {
  const o = obj(v);
  if (!o) return null;
  const index = num(o.index);
  const id = num(o.id);
  if (index === null || !Number.isInteger(index) || index < 0 || index >= MAX_BAG_ITEMS) return null;
  if (id === null || !Number.isInteger(id) || id < 1 || id > MAX_ITEM_ID) return null;
  if (typeof o.slot !== 'string' || !BAG_SLOTS.has(o.slot)) return null;
  const label = typeof o.label === 'string' ? cleanLabel(o.label) : '';
  const error = str(o.error, 200);
  const dpsMean = num(o.dpsMean);
  const delta = num(o.delta);
  const deltaPercent = num(o.deltaPercent);
  const broken = error !== null || dpsMean === null || delta === null || deltaPercent === null;
  return {
    index, slot: o.slot, id, label: label || `Genstand ${id}`,
    dpsMean: broken ? null : dpsMean, delta: broken ? null : delta, deltaPercent: broken ? null : deltaPercent,
    ...(broken ? { error: error ?? 'Intet resultat for denne genstand.' } : {}),
  };
}

function parseStyle(v: unknown): SimStyleResult | null {
  const o = obj(v);
  if (!o || !isFightStyle(o.fightStyle)) return null;
  const dps = parseDps(o.dps);
  const error = str(o.error, 200);
  if (!dps && !error) return null;
  const items = dps && Array.isArray(o.items) ? o.items.slice(0, MAX_BAG_ITEMS * 2).map(parseItem).filter((i): i is SimItemResult => i !== null) : [];
  return { fightStyle: o.fightStyle, dps, items, ...(error && !dps ? { error } : {}) };
}

/**
 * Filtrerer et (worker-)svar til kendte felter. Accepterer både den gamle enkeltstilsform (`dps`) og v2 (`results[]`)
 * samt vores egen gemte form (`styles[]`). Giver null hvis der ikke er et brugbart DPS-tal.
 */
export function parseSimResult(raw: unknown, extraWarnings?: unknown): SimResult | null {
  const r = obj(raw);
  if (!r) return null;
  const list = Array.isArray(r.results) ? r.results : Array.isArray(r.styles) ? r.styles : null;
  let styles: SimStyleResult[];
  if (list) {
    styles = list.map(parseStyle).filter((x): x is SimStyleResult => x !== null).slice(0, FIGHT_STYLES.length);
  } else {
    const dps = parseDps(r.dps);
    styles = dps ? [{ fightStyle: 'Patchwerk', dps, items: [] }] : [];
  }
  const first = styles.find((s) => s.dps);
  if (!first?.dps) return null;
  const p = obj(r.player) ?? {};
  const rawWarnings = Array.isArray(r.warnings) ? r.warnings : Array.isArray(extraWarnings) ? extraWarnings : [];
  const warnings = rawWarnings.map((w) => str(w, 200)).filter((w): w is string => w !== null).slice(0, 10);
  return {
    player: { name: str(p.name, 40), className: str(p.className, 30), spec: str(p.spec, 30), level: num(p.level), race: str(p.race, 30) },
    iterations: num(r.iterations),
    dps: first.dps,
    styles,
    elapsedMs: num(r.elapsedMs),
    warnings,
  };
}

export type SimOptions = {
  fightStyles: FightStyle[];
  optimizeBags: boolean;
  bagItems: BagItem[];
  bagFound: number;
  bagIgnored: number;
  bagTruncated: number;
};

const count0 = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10_000 ? v : 0);

/** Læser gemte valg defensivt. Tomme/gamle rækker giver den gamle adfærd: kun Patchwerk, ingen optimering. */
export function parseSimOptions(raw: unknown): SimOptions {
  const o = obj(raw) ?? {};
  const fs = Array.isArray(o.fightStyles) ? [...new Set(o.fightStyles.filter(isFightStyle))] : [];
  const bagItems = sanitizeBagItems(o.bagItems);
  return {
    fightStyles: fs.length > 0 ? fs : ['Patchwerk'],
    optimizeBags: o.optimizeBags === true,
    bagItems: o.optimizeBags === true ? bagItems : [],
    bagFound: count0(o.bagFound),
    bagIgnored: count0(o.bagIgnored),
    bagTruncated: count0(o.bagTruncated),
  };
}

export type SimEnqueueOptions = { fightStyles?: unknown; optimizeBags?: unknown };

export type SimView = {
  id: number;
  status: SimStatus;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
  result: SimResult | null;
  /** Hvad brugeren bad om og hvad der blev fundet i taskerne. */
  bags: { requested: boolean; found: number; ignored: number; truncated: number };
};

export async function enqueueSim(
  db: Db,
  deps: { userId: number; limiter: SendLimiter; now: number },
  rawInput: unknown,
  rawOptions: SimEnqueueOptions = {},
): Promise<({ ok: true; id: number; bags: SimView['bags'] } | SimFail)> {
  const valid = validateSimcInput(rawInput);
  if (!valid.ok) return fail('invalid', valid.error);
  let fightStyles: FightStyle[] = ['Patchwerk'];
  if (rawOptions.fightStyles !== undefined) {
    const fs = rawOptions.fightStyles;
    if (!Array.isArray(fs) || fs.length === 0) return fail('invalid', 'Vælg mindst én kampstil.');
    if (fs.length > FIGHT_STYLES.length || !fs.every(isFightStyle) || new Set(fs).size !== fs.length) {
      return fail('invalid', 'Ugyldig kampstil.');
    }
    fightStyles = FIGHT_STYLES.filter((s) => fs.includes(s));
  }
  if (rawOptions.optimizeBags !== undefined && typeof rawOptions.optimizeBags !== 'boolean') return fail('invalid', 'Ugyldigt valg for gear-optimering.');
  const optimizeBags = rawOptions.optimizeBags === true;
  const bag = optimizeBags ? parseBagItems(rawInput) : { items: [], ignored: 0, truncated: 0 };
  const options = {
    fightStyles, optimizeBags,
    ...(bag.items.length > 0 ? { bagItems: bag.items } : {}),
    bagFound: bag.items.length, bagIgnored: bag.ignored, bagTruncated: bag.truncated,
  };
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
      .values({ userId: deps.userId, input: valid.input, options, status: 'queued' })
      .returning({ id: simJobs.id });
    return { ok: true as const, id: row.id, bags: { requested: optimizeBags, found: bag.items.length, ignored: bag.ignored, truncated: bag.truncated } };
  });
}

/** Brugerens egne seneste simulationer, nyeste først. Input og rå resultater sendes aldrig videre. */
export async function listMySims(db: Db, userId: number, limit = 10): Promise<SimView[]> {
  const rows = await db
    .select({
      id: simJobs.id, status: simJobs.status, createdAt: simJobs.createdAt, finishedAt: simJobs.finishedAt,
      error: simJobs.error, result: simJobs.result, options: simJobs.options,
    })
    .from(simJobs)
    .where(eq(simJobs.userId, userId))
    .orderBy(desc(simJobs.id))
    .limit(Math.min(Math.max(Math.trunc(limit), 1), 100));
  return rows.map((r) => {
    const o = parseSimOptions(r.options);
    return {
    id: r.id,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
    error: r.error,
    result: r.status === 'done' ? parseSimResult(r.result) : null,
    bags: { requested: o.optimizeBags, found: o.bagFound, ignored: o.bagIgnored, truncated: o.bagTruncated },
  };
  });
}

/** Sletter kun brugerens egen simulation (hård sletning). */
export async function deleteMySim(db: Db, userId: number, id: unknown): Promise<{ ok: true } | SimFail> {
  const sid = parseId(id);
  if (sid === null) return fail('not_found', 'Simulationen findes ikke.');
  const rows = await db.delete(simJobs).where(and(eq(simJobs.id, sid), eq(simJobs.userId, userId))).returning({ id: simJobs.id });
  return rows.length === 0 ? fail('not_found', 'Simulationen findes ikke.') : { ok: true };
}

export type ClaimedSim = { id: number; userId: number; input: string; options: SimOptions };

/** Atomisk: tager det ældste køede job og markerer det som kørende. Samtidige kald får forskellige jobs. */
export async function claimNextSim(db: Db): Promise<ClaimedSim | null> {
  const rows = await db.execute(sql`
    update sim_jobs set status = 'running', started_at = now()
    where id = (select id from sim_jobs where status = 'queued' order by id limit 1 for update skip locked)
    returning id, user_id, input, options`);
  const r = rows[0] as { id: number; user_id: number; input: string; options: unknown } | undefined;
  return r ? { id: r.id, userId: r.user_id, input: r.input, options: parseSimOptions(r.options) } : null;
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
