import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { characters, events, rsvps, users, type RsvpStatus } from '@/lib/db/schema';

// Både `Db` og en transaktion fra `db.transaction(...)` har disse metoder.
type Tx = Pick<Db, 'select' | 'insert' | 'update' | 'delete'>;

export type SetRsvpResult = { ok: true } | { ok: false; reason: 'no_character' | 'not_found' | 'closed' };
export type ClearRsvpResult = { ok: true } | { ok: false; reason: 'not_found' | 'closed' };

async function openState(db: Tx, eventId: number, now: Date): Promise<'not_found' | 'closed' | 'open'> {
  const [e] = await db
    .select({ startsAt: events.startsAt, cancelledAt: events.cancelledAt })
    .from(events)
    .where(eq(events.id, eventId));
  if (!e) return 'not_found';
  if (e.cancelledAt !== null || e.startsAt.getTime() <= now.getTime()) return 'closed';
  return 'open';
}

export async function setRsvp(
  db: Db,
  userId: number,
  eventId: number,
  status: RsvpStatus,
  now: Date = new Date(),
): Promise<SetRsvpResult> {
  const [active] = await db
    .select({ id: characters.id })
    .from(users)
    .innerJoin(characters, and(eq(characters.id, users.activeCharacterId), eq(characters.userId, users.id)))
    .where(eq(users.id, userId));
  if (!active) return { ok: false, reason: 'no_character' };

  const state = await openState(db, eventId, now);
  if (state !== 'open') return { ok: false, reason: state };

  await db
    .insert(rsvps)
    .values({ eventId, userId, characterId: active.id, status, updatedAt: now })
    .onConflictDoUpdate({
      target: [rsvps.eventId, rsvps.userId],
      set: { characterId: active.id, status, updatedAt: now },
    });
  return { ok: true };
}

export async function clearRsvp(
  db: Db,
  userId: number,
  eventId: number,
  now: Date = new Date(),
): Promise<ClearRsvpResult> {
  const state = await openState(db, eventId, now);
  if (state !== 'open') return { ok: false, reason: state };
  await db.delete(rsvps).where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, userId)));
  return { ok: true };
}

/**
 * Flytter (eller sletter, ved `toCharacterId = null`) brugerens tilmeldinger til kommende,
 * ikke-aflyste events. Kan køre i en transaktion sammen med ændringen af den aktive karakter.
 */
export async function reassignUpcomingRsvps(
  tx: Tx,
  args: { userId: number; fromCharacterId?: number; toCharacterId: number | null; now?: Date },
): Promise<void> {
  const now = args.now ?? new Date();
  const upcoming = tx
    .select({ id: events.id })
    .from(events)
    .where(and(gt(events.startsAt, now), isNull(events.cancelledAt)));
  const where = and(
    eq(rsvps.userId, args.userId),
    inArray(rsvps.eventId, upcoming),
    args.fromCharacterId === undefined ? undefined : eq(rsvps.characterId, args.fromCharacterId),
  );
  if (args.toCharacterId === null) {
    await tx.delete(rsvps).where(where);
  } else {
    await tx.update(rsvps).set({ characterId: args.toCharacterId, updatedAt: now }).where(where);
  }
}

