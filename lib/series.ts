import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
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
  durationMinutes: number | null;
};
export type SeriesRow = {
  id: number;
  type: EventType;
  title: string;
  description: string;
  weekday: number;
  startTime: string;
  durationMinutes: number | null;
  active: boolean;
  createdBy: number;
  upcomingCount: number;
};

const HORIZON_DAYS = 28;

function validate(input: SeriesInput): boolean {
  if (input.type !== 'raid' && input.type !== 'aften') return false;
  if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) return false;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) return false;
  // event_series.duration_minutes er NOT NULL i databasen, så serier kræver en varighed.
  if (input.durationMinutes === null) return false;
  return validateEventFields(input) === 'ok';
}

function values(input: SeriesInput) {
  return {
    type: input.type,
    title: input.title.trim(),
    description: (input.description ?? '').trim(),
    weekday: input.weekday,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes as number,
  };
}

/** Opretter manglende forekomster for aktive serier inden for horisonten. Idempotent og race-sikker. */
export async function generateSeriesEvents(
  db: Db,
  now: Date = new Date(),
  horizonDays: number = HORIZON_DAYS,
): Promise<{ created: number }> {
  const series = await db.select().from(eventSeries).where(eq(eventSeries.active, true));
  const today = todayInCopenhagen(now);
  let created = 0;
  for (const s of series) {
    const rows: (typeof events.$inferInsert)[] = [];
    for (let i = 0; i <= horizonDays; i++) {
      const date = addDaysToDate(today, i);
      const probe = copenhagenToUtc(date, '12:00');
      if (!probe.ok || utcToCopenhagen(probe.utc).weekday !== s.weekday) continue;
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
    if (rows.length === 0) continue;
    const inserted = await db
      .insert(events)
      .values(rows)
      .onConflictDoNothing({ target: [events.seriesId, events.startsAt], where: sql`${events.seriesId} is not null` })
      .returning({ id: events.id });
    created += inserted.length;
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
  // Generatoren dækker alle serier; antallet for denne serie er nyoprettet, så alle dens events tælles.
  await generateSeriesEvents(db, now);
  return { ok: true, seriesId: row.id, generated: await countEvents(db, row.id) };
}

/** Sletter fremtidige, urørte events uden tilmeldinger (i SQL, så tilmeldinger aldrig cascade-slettes). */
async function removeUntouched(
  tx: Db,
  seriesId: number,
  now: Date,
): Promise<{ removed: number; keptWithRsvps: number }> {
  const untouched = and(
    eq(events.seriesId, seriesId),
    gt(events.startsAt, now),
    isNull(events.cancelledAt),
    eq(events.detached, false),
  );
  const removedRows = await tx
    .delete(events)
    .where(and(untouched, sql`not exists (select 1 from rsvps where rsvps.event_id = ${events.id})`))
    .returning({ id: events.id });
  const [{ n }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(untouched, sql`exists (select 1 from rsvps where rsvps.event_id = ${events.id})`));
  return { removed: removedRows.length, keptWithRsvps: n };
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
    const updated = await tx.update(eventSeries).set(values(input)).where(eq(eventSeries.id, seriesId)).returning({ id: eventSeries.id });
    if (updated.length === 0) return null;
    return removeUntouched(tx as unknown as Db, seriesId, now);
  });
  if (!res) return { ok: false, reason: 'not_found' };
  const before = await countEvents(db, seriesId);
  await generateSeriesEvents(db, now);
  const after = await countEvents(db, seriesId);
  return { ok: true, regenerated: after - before, keptWithRsvps: res.keptWithRsvps };
}

async function countEvents(db: Db, seriesId: number): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(events).where(eq(events.seriesId, seriesId));
  return n;
}

export async function deactivateSeries(
  db: Db,
  actor: EventActor,
  seriesId: number,
  now: Date = new Date(),
): Promise<{ ok: true; removed: number; keptWithRsvps: number } | { ok: false; reason: 'forbidden' | 'not_found' }> {
  if (!actor.isOfficer) return { ok: false, reason: 'forbidden' };
  const res = await db.transaction(async (tx) => {
    const updated = await tx.update(eventSeries).set({ active: false }).where(eq(eventSeries.id, seriesId)).returning({ id: eventSeries.id });
    if (updated.length === 0) return null;
    return removeUntouched(tx as unknown as Db, seriesId, now);
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
