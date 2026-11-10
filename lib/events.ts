import { and, asc, count, eq, gt, inArray, isNull, lte, notExists, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { characters, events, rsvps, users, type EventType, type Role, type RsvpStatus } from '@/lib/db/schema';

export type EventActor = { userId: number; isOfficer: boolean };
export type EventInput = {
  type: EventType;
  title: string;
  description: string | null;
  startsAt: Date;
  durationMinutes: number | null;
};
export type Counts = { tank: number; healer: number; dps: number; total: number };
export type EventListItem = {
  id: number;
  type: EventType;
  title: string;
  startsAt: Date;
  durationMinutes: number | null;
  cancelled: boolean;
  seriesId: number | null;
  counts: Counts;
  myStatus: RsvpStatus | null;
};
export type Attendee = {
  userId: number;
  userName: string;
  characterId: number;
  characterName: string;
  className: string;
  role: Role;
  status: RsvpStatus;
};
export type EventDetail = {
  id: number;
  type: EventType;
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number | null;
  cancelled: boolean;
  seriesId: number | null;
  createdBy: number;
  creatorName: string;
  attendees: Attendee[];
  counts: Counts;
};

const GRACE_MS = 3 * 60 * 60 * 1000;
const STATUS_ORDER: Record<RsvpStatus, number> = { deltager: 0, maaske: 1, afbud: 2 };
const ROLE_ORDER: Record<Role, number> = { tank: 0, healer: 1, dps: 2 };

export function validateEventFields(f: {
  title: string;
  description: string | null;
  durationMinutes: number | null;
}): 'ok' | 'invalid' {
  const title = f.title.trim();
  if (title.length < 1 || title.length > 100) return 'invalid';
  if (f.description !== null && f.description.trim().length > 2000) return 'invalid';
  if (f.durationMinutes !== null) {
    if (!Number.isInteger(f.durationMinutes) || f.durationMinutes < 15 || f.durationMinutes > 720) return 'invalid';
  }
  return 'ok';
}

function canManage(actor: EventActor, e: { type: EventType; createdBy: number }): boolean {
  return actor.isOfficer || (e.type === 'aften' && e.createdBy === actor.userId);
}

export async function createEvent(
  db: Db,
  actor: EventActor,
  input: EventInput,
  now: Date = new Date(),
): Promise<{ ok: true; eventId: number } | { ok: false; reason: 'forbidden' | 'invalid' | 'in_past' }> {
  if (input.type === 'raid' && !actor.isOfficer) return { ok: false, reason: 'forbidden' };
  if (validateEventFields(input) !== 'ok') return { ok: false, reason: 'invalid' };
  if (input.startsAt.getTime() <= now.getTime()) return { ok: false, reason: 'in_past' };
  const [row] = await db
    .insert(events)
    .values({
      type: input.type,
      title: input.title.trim(),
      description: (input.description ?? '').trim(),
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes,
      createdBy: actor.userId,
    })
    .returning({ id: events.id });
  return { ok: true, eventId: row.id };
}

export async function updateEvent(
  db: Db,
  actor: EventActor,
  eventId: number,
  patch: Omit<EventInput, 'type'>,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; reason: 'forbidden' | 'not_found' | 'invalid' | 'in_past' | 'cancelled' }> {
  const [e] = await db.select().from(events).where(eq(events.id, eventId));
  if (!e) return { ok: false, reason: 'not_found' };
  if (!canManage(actor, e)) return { ok: false, reason: 'forbidden' };
  if (e.cancelledAt) return { ok: false, reason: 'cancelled' };
  if (validateEventFields(patch) !== 'ok') return { ok: false, reason: 'invalid' };
  const changedStart = patch.startsAt.getTime() !== e.startsAt.getTime();
  if (changedStart && patch.startsAt.getTime() <= now.getTime()) return { ok: false, reason: 'in_past' };
  await db
    .update(events)
    .set({
      title: patch.title.trim(),
      description: (patch.description ?? '').trim(),
      startsAt: patch.startsAt,
      durationMinutes: patch.durationMinutes,
      ...(e.seriesId !== null ? { detached: true } : {}),
    })
    .where(eq(events.id, eventId));
  return { ok: true };
}

export async function cancelEvent(
  db: Db,
  actor: EventActor,
  eventId: number,
): Promise<{ ok: true } | { ok: false; reason: 'forbidden' | 'not_found' }> {
  const [e] = await db.select().from(events).where(eq(events.id, eventId));
  if (!e) return { ok: false, reason: 'not_found' };
  if (!canManage(actor, e)) return { ok: false, reason: 'forbidden' };
  if (!e.cancelledAt) {
    await db
      .update(events)
      .set({ cancelledAt: sql`now()` })
      .where(and(eq(events.id, eventId), isNull(events.cancelledAt)));
  }
  return { ok: true };
}

function emptyCounts(): Counts {
  return { tank: 0, healer: 0, dps: 0, total: 0 };
}

function addCount(c: Counts, role: Role) {
  c[role] += 1;
  c.total += 1;
}

export async function getEvent(db: Db, eventId: number): Promise<EventDetail | null> {
  const [e] = await db
    .select({ event: events, creatorName: users.name })
    .from(events)
    .innerJoin(users, eq(users.id, events.createdBy))
    .where(eq(events.id, eventId));
  if (!e) return null;
  const rows = await db
    .select({
      userId: rsvps.userId,
      userName: users.name,
      characterId: characters.id,
      characterName: characters.name,
      className: characters.className,
      role: characters.role,
      status: rsvps.status,
    })
    .from(rsvps)
    .innerJoin(users, eq(users.id, rsvps.userId))
    .innerJoin(characters, eq(characters.id, rsvps.characterId))
    .where(eq(rsvps.eventId, eventId));
  const attendees: Attendee[] = rows.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      a.characterName.localeCompare(b.characterName, 'da'),
  );
  const counts = emptyCounts();
  for (const a of attendees) if (a.status === 'deltager') addCount(counts, a.role);
  const ev = e.event;
  return {
    id: ev.id,
    type: ev.type,
    title: ev.title,
    description: ev.description,
    startsAt: ev.startsAt,
    durationMinutes: ev.durationMinutes,
    cancelled: ev.cancelledAt !== null,
    seriesId: ev.seriesId,
    createdBy: ev.createdBy,
    creatorName: e.creatorName,
    attendees,
    counts,
  };
}

export async function listUpcomingEvents(
  db: Db,
  userId: number,
  now: Date = new Date(),
  opts: { limit?: number } = {},
): Promise<EventListItem[]> {
  const limit = opts.limit ?? 50;
  const cutoff = new Date(now.getTime() - GRACE_MS);
  const list = await db
    .select()
    .from(events)
    .where(gt(events.startsAt, cutoff))
    .orderBy(asc(events.startsAt), asc(events.id))
    .limit(limit);
  if (list.length === 0) return [];
  const ids = list.map((e) => e.id);
  const rs = await db
    .select({ eventId: rsvps.eventId, userId: rsvps.userId, status: rsvps.status, role: characters.role })
    .from(rsvps)
    .innerJoin(characters, eq(characters.id, rsvps.characterId))
    .where(inArray(rsvps.eventId, ids));
  const counts = new Map<number, Counts>();
  const mine = new Map<number, RsvpStatus>();
  for (const r of rs) {
    if (r.userId === userId) mine.set(r.eventId, r.status);
    if (r.status !== 'deltager') continue;
    let c = counts.get(r.eventId);
    if (!c) counts.set(r.eventId, (c = emptyCounts()));
    addCount(c, r.role);
  }
  return list.map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    startsAt: e.startsAt,
    durationMinutes: e.durationMinutes,
    cancelled: e.cancelledAt !== null,
    seriesId: e.seriesId,
    counts: counts.get(e.id) ?? emptyCounts(),
    myStatus: mine.get(e.id) ?? null,
  }));
}

/** Kommende, ikke-aflyste events inden for `days` dage (inklusive), som brugeren ikke har tilmeldt sig eller meldt afbud til. */
export async function countUnansweredUpcoming(
  db: Db,
  userId: number,
  now: Date = new Date(),
  days = 14,
): Promise<number> {
  const until = new Date(now.getTime() + days * 24 * 3600_000);
  const [r] = await db
    .select({ n: count() })
    .from(events)
    .where(
      and(
        gt(events.startsAt, now),
        lte(events.startsAt, until),
        isNull(events.cancelledAt),
        notExists(db.select({ one: sql`1` }).from(rsvps).where(and(eq(rsvps.eventId, events.id), eq(rsvps.userId, userId)))),
      ),
    );
  return r.n;
}
