import { and, asc, eq, gt, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { eventSeries, events, type EventType } from '@/lib/db/schema';
import { validateEventFields, type EventActor } from '@/lib/events';
import { addDaysToDate, copenhagenToUtc, todayInCopenhagen, utcToCopenhagen } from '@/lib/time';

export type SeriesInput = {
  type: EventType;
  title: string;
  description: string | null;
  weekday: number;
  startTime: string;
  /** Påkrævet: event_series.duration_minutes er NOT NULL. */
  durationMinutes: number;
};
export type SeriesRow = {
  id: number;
  type: EventType;
  title: string;
  description: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  active: boolean;
  createdBy: number;
  upcomingCount: number;
};

const HORIZON_DAYS = 28;
type Tx = Pick<Db, 'select' | 'insert' | 'update' | 'delete'>;

function validate(input: SeriesInput): boolean {
  if (input.type !== 'raid' && input.type !== 'aften') return false;
  if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) return false;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) return false;
  if (typeof input.durationMinutes !== 'number') return false; // runtime-værn for utypet input
  return validateEventFields(input) === 'ok';
}

function values(input: SeriesInput) {
  return {
    type: input.type,
    title: input.title.trim(),
    description: (input.description ?? '').trim(),
    weekday: input.weekday,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
  };
}

/**
 * Genererer manglende forekomster for én serie og returnerer antal faktisk indsatte rækker.
 * Kører i en transaktion, der først låser serierækken (FOR UPDATE) og bruger dens aktuelle værdier,
 * så samtidige kørsler og ændringer serialiseres. En dato springes over, hvis serien allerede har
 * et event den dag (aflyst og detached medregnet).
 */
export async function generateForSeries(db: Db, seriesId: number, now: Date, horizonDays: number): Promise<number> {
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(eventSeries).where(eq(eventSeries.id, seriesId)).for('update');
    if (!s || !s.active) return 0;
    const today = todayInCopenhagen(now);
    const existing = await tx
      .select({ startsAt: events.startsAt })
      .from(events)
      .where(and(eq(events.seriesId, s.id), gte(events.startsAt, new Date(now.getTime() - 36 * 3600_000))));
    const taken = new Set(existing.map((e) => utcToCopenhagen(e.startsAt).date));
    const rows: (typeof events.$inferInsert)[] = [];
    for (let i = 0; i <= horizonDays; i++) {
      const date = addDaysToDate(today, i);
      const probe = copenhagenToUtc(date, '12:00');
      if (!probe.ok || utcToCopenhagen(probe.utc).weekday !== s.weekday) continue;
      if (taken.has(date)) continue;
      const at = copenhagenToUtc(date, s.startTime);
      if (!at.ok || at.utc.getTime() <= now.getTime()) continue;
      rows.push({
        type: s.type,
        title: s.title,
        description: s.description,
        startsAt: at.utc,
        durationMinutes: s.durationMinutes,
        seriesId: s.id,
        detached: false,
        createdBy: s.createdBy,
      });
    }
    if (rows.length === 0) return 0;
    const inserted = await tx
      .insert(events)
      .values(rows)
      .onConflictDoNothing({ target: [events.seriesId, events.startsAt], where: sql`${events.seriesId} is not null` })
      .returning({ id: events.id });
    return inserted.length;
  });
}

/** Opretter manglende forekomster for aktive serier inden for horisonten. Idempotent og race-sikker. */
export async function generateSeriesEvents(
  db: Db,
  now: Date = new Date(),
  horizonDays: number = HORIZON_DAYS,
  generate: typeof generateForSeries = generateForSeries,
): Promise<{ created: number }> {
  const series = await db.select({ id: eventSeries.id }).from(eventSeries).where(eq(eventSeries.active, true));
  let created = 0;
  for (const s of series) {
    // En defekt serie må ikke stoppe de øvrige; fejlen logges med serie-id (ingen data fra rækken).
    try {
      created += await generate(db, s.id, now, horizonDays);
    } catch (e) {
      console.error(`Serie ${s.id}: generering fejlede`, e instanceof Error ? e.message : 'ukendt fejl');
    }
  }
  return { created };
}

export async function createSeries(
  db: Db,
  actor: EventActor,
  input: SeriesInput,
  now: Date = new Date(),
): Promise<{ ok: true; seriesId: number; generated: number } | { ok: false; reason: 'forbidden' | 'invalid' }> {
  if (!actor.isOfficer) return { ok: false, reason: 'forbidden' };
  if (!validate(input)) return { ok: false, reason: 'invalid' };
  const [row] = await db
    .insert(eventSeries)
    .values({ ...values(input), createdBy: actor.userId })
    .returning({ id: eventSeries.id });
  return { ok: true, seriesId: row.id, generated: await generateForSeries(db, row.id, now, HORIZON_DAYS) };
}

/**
 * Sletter fremtidige, urørte events uden tilmeldinger. Først låses kandidaterne (FOR UPDATE), så en
 * samtidig tilmelding enten er committet før sletningen (og ses af NOT EXISTS i det næste statement)
 * eller blokeres, til vi er færdige. Tilmeldinger cascade-slettes dermed aldrig.
 */
async function removeUntouched(
  tx: Tx,
  seriesId: number,
  now: Date,
): Promise<{ removed: number; keptWithRsvps: number }> {
  const candidates = await tx
    .select({ id: events.id })
    .from(events)
    .where(
      and(eq(events.seriesId, seriesId), gt(events.startsAt, now), isNull(events.cancelledAt), eq(events.detached, false)),
    )
    .for('update');
  const ids = candidates.map((c) => c.id);
  if (ids.length === 0) return { removed: 0, keptWithRsvps: 0 };
  const removedRows = await tx
    .delete(events)
    .where(and(inArray(events.id, ids), sql`not exists (select 1 from rsvps where rsvps.event_id = ${events.id})`))
    .returning({ id: events.id });
  return { removed: removedRows.length, keptWithRsvps: ids.length - removedRows.length };
}

async function lockSeries(tx: Tx, seriesId: number): Promise<boolean> {
  const rows = await tx.select({ id: eventSeries.id }).from(eventSeries).where(eq(eventSeries.id, seriesId)).for('update');
  return rows.length > 0;
}

export async function updateSeries(
  db: Db,
  actor: EventActor,
  seriesId: number,
  input: SeriesInput,
  now: Date = new Date(),
): Promise<
  { ok: true; regenerated: number; keptWithRsvps: number } | { ok: false; reason: 'forbidden' | 'not_found' | 'invalid' }
> {
  if (!actor.isOfficer) return { ok: false, reason: 'forbidden' };
  if (!validate(input)) return { ok: false, reason: 'invalid' };
  const res = await db.transaction(async (tx) => {
    if (!(await lockSeries(tx, seriesId))) return null;
    await tx.update(eventSeries).set(values(input)).where(eq(eventSeries.id, seriesId));
    return removeUntouched(tx, seriesId, now);
  });
  if (!res) return { ok: false, reason: 'not_found' };
  const regenerated = await generateForSeries(db, seriesId, now, HORIZON_DAYS);
  return { ok: true, regenerated, keptWithRsvps: res.keptWithRsvps };
}

export async function deactivateSeries(
  db: Db,
  actor: EventActor,
  seriesId: number,
  now: Date = new Date(),
): Promise<{ ok: true; removed: number; keptWithRsvps: number } | { ok: false; reason: 'forbidden' | 'not_found' }> {
  if (!actor.isOfficer) return { ok: false, reason: 'forbidden' };
  const res = await db.transaction(async (tx) => {
    if (!(await lockSeries(tx, seriesId))) return null;
    await tx.update(eventSeries).set({ active: false }).where(eq(eventSeries.id, seriesId));
    return removeUntouched(tx, seriesId, now);
  });
  if (!res) return { ok: false, reason: 'not_found' };
  return { ok: true, ...res };
}

export async function listSeries(db: Db, now: Date = new Date()): Promise<SeriesRow[]> {
  const rows = await db
    .select({
      id: eventSeries.id,
      type: eventSeries.type,
      title: eventSeries.title,
      description: eventSeries.description,
      weekday: eventSeries.weekday,
      startTime: eventSeries.startTime,
      durationMinutes: eventSeries.durationMinutes,
      active: eventSeries.active,
      createdBy: eventSeries.createdBy,
      upcomingCount: sql<number>`(select count(*)::int from events e where e.series_id = event_series.id and e.starts_at > ${now.toISOString()}::timestamptz and e.cancelled_at is null)`,
    })
    .from(eventSeries)
    .orderBy(asc(eventSeries.id));
  return rows;
}
