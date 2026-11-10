import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { characters, eventSeries, events, rsvps } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

async function setup() {
  const userId = await seedUser(db);
  const [c] = await db
    .insert(characters)
    .values({ blizzardId: 1, slug: 'magi', name: 'Magi', className: 'Mage', role: 'dps', userId })
    .returning();
  const characterId = c.id;
  const [ev] = await db
    .insert(events)
    .values({ type: 'aften', title: 'Aften', startsAt: new Date('2026-12-01T19:00:00Z'), createdBy: userId })
    .returning();
  return { userId, characterId, ev };
}

describe('kalenderskema', () => {
  it('afviser dublet på (event_id, user_id)', async () => {
    const { userId, characterId, ev } = await setup();
    const v = { eventId: ev.id, userId, characterId, status: 'deltager' as const };
    await db.insert(rsvps).values(v);
    await expect(db.insert(rsvps).values(v)).rejects.toThrow();
  });

  it('afviser dublet på (series_id, starts_at) men tillader flere uden serie', async () => {
    const { userId } = await setup();
    const [s] = await db
      .insert(eventSeries)
      .values({ type: 'raid', title: 'Raid', weekday: 1, startTime: '20:00', durationMinutes: 180, createdBy: userId })
      .returning();
    const v = { type: 'raid' as const, title: 'Raid', startsAt: new Date('2026-12-02T19:00:00Z'), createdBy: userId, seriesId: s.id };
    await db.insert(events).values(v);
    await expect(db.insert(events).values(v)).rejects.toThrow();
    const free = { type: 'aften' as const, title: 'x', startsAt: new Date('2026-12-02T19:00:00Z'), createdBy: userId };
    await db.insert(events).values(free);
    await db.insert(events).values(free);
  });

  it('sletter tilmeldinger når eventet slettes', async () => {
    const { userId, characterId, ev } = await setup();
    await db.insert(rsvps).values({ eventId: ev.id, userId, characterId, status: 'maaske' });
    await db.delete(events).where(eq(events.id, ev.id));
    expect(await db.select().from(rsvps)).toHaveLength(0);
  });
});
