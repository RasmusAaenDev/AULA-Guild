import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { clearRsvp, reassignUpcomingRsvps, setRsvp } from '@/lib/rsvps';
import { characters, events, rsvps, users, type RsvpStatus } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const NOW = new Date('2026-11-10T12:00:00Z');
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000);

let seq = 0;
async function seedChar(userId: number, name: string, active = false): Promise<number> {
  seq += 1;
  const [c] = await db.insert(characters).values({
    blizzardId: 9000 + seq, slug: name.toLowerCase(), name, className: 'Mage', role: 'dps', userId,
  }).returning({ id: characters.id });
  if (active) await db.update(users).set({ activeCharacterId: c.id }).where(eq(users.id, userId));
  return c.id;
}
async function seedEvent(startsAt: Date, cancelledAt: Date | null = null): Promise<number> {
  const [creator] = await db.select({ id: users.id }).from(users).limit(1);
  const [e] = await db.insert(events).values({
    type: 'aften', title: 'Aften', startsAt, cancelledAt, createdBy: creator.id,
  }).returning({ id: events.id });
  return e.id;
}
async function rows() {
  return db.select().from(rsvps).orderBy(rsvps.id);
}
async function insertRsvp(eventId: number, userId: number, characterId: number, status: RsvpStatus = 'deltager') {
  await db.insert(rsvps).values({ eventId, userId, characterId, status });
}

describe('setRsvp', () => {
  it('tilmelder første gang med den aktive karakter', async () => {
    const u = await seedUser(db, 'a');
    const c = await seedChar(u, 'Alfa', true);
    const e = await seedEvent(hours(5));
    expect(await setRsvp(db, u, e, 'deltager', NOW)).toEqual({ ok: true });
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ eventId: e, userId: u, characterId: c, status: 'deltager' });
  });

  it('ændrer status uden at lave en ny række', async () => {
    const u = await seedUser(db, 'a');
    await seedChar(u, 'Alfa', true);
    const e = await seedEvent(hours(5));
    await setRsvp(db, u, e, 'deltager', NOW);
    await setRsvp(db, u, e, 'afbud', NOW);
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe('afbud');
  });

  it('håndterer flere brugere på samme event', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    await seedChar(a, 'Alfa', true);
    await seedChar(b, 'Bravo', true);
    const e = await seedEvent(hours(5));
    await setRsvp(db, a, e, 'deltager', NOW);
    await setRsvp(db, b, e, 'afbud', NOW);
    expect(await rows()).toHaveLength(2);
  });

  it('afviser uden aktiv karakter', async () => {
    const u = await seedUser(db, 'a');
    const e = await seedEvent(hours(5));
    expect(await setRsvp(db, u, e, 'deltager', NOW)).toEqual({ ok: false, reason: 'no_character' });
    expect(await rows()).toHaveLength(0);
  });

  it('afviser en aktiv karakter, der ikke tilhører brugeren', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const theirs = await seedChar(b, 'Bravo');
    await db.update(users).set({ activeCharacterId: theirs }).where(eq(users.id, a));
    const e = await seedEvent(hours(5));
    expect(await setRsvp(db, a, e, 'deltager', NOW)).toEqual({ ok: false, reason: 'no_character' });
  });

  it('afviser startede og aflyste events', async () => {
    const u = await seedUser(db, 'a');
    await seedChar(u, 'Alfa', true);
    const started = await seedEvent(hours(-1));
    const atNow = await seedEvent(NOW);
    const cancelled = await seedEvent(hours(5), NOW);
    for (const id of [started, atNow, cancelled]) {
      expect(await setRsvp(db, u, id, 'deltager', NOW)).toEqual({ ok: false, reason: 'closed' });
    }
    expect(await rows()).toHaveLength(0);
  });

  it('afviser ukendt event', async () => {
    const u = await seedUser(db, 'a');
    await seedChar(u, 'Alfa', true);
    expect(await setRsvp(db, u, 999, 'deltager', NOW)).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('clearRsvp', () => {
  it('sletter egen tilmelding og rører ikke andres', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    await seedChar(a, 'Alfa', true);
    await seedChar(b, 'Bravo', true);
    const e = await seedEvent(hours(5));
    await setRsvp(db, a, e, 'deltager', NOW);
    await setRsvp(db, b, e, 'deltager', NOW);
    expect(await clearRsvp(db, a, e, NOW)).toEqual({ ok: true });
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0].userId).toBe(b);
  });

  it('er ok når der ingen tilmelding er, afviser ukendt og lukket', async () => {
    const u = await seedUser(db, 'a');
    await seedChar(u, 'Alfa', true);
    const open = await seedEvent(hours(5));
    const started = await seedEvent(hours(-1));
    const cancelled = await seedEvent(hours(5), NOW);
    expect(await clearRsvp(db, u, open, NOW)).toEqual({ ok: true });
    expect(await clearRsvp(db, u, 999, NOW)).toEqual({ ok: false, reason: 'not_found' });
    expect(await clearRsvp(db, u, started, NOW)).toEqual({ ok: false, reason: 'closed' });
    expect(await clearRsvp(db, u, cancelled, NOW)).toEqual({ ok: false, reason: 'closed' });
  });
});

describe('reassignUpcomingRsvps', () => {
  it('flytter kun kommende, ikke-aflyste tilmeldinger og kun brugerens egne', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const a1 = await seedChar(a, 'Alfa');
    const a2 = await seedChar(a, 'Alfa2');
    const b1 = await seedChar(b, 'Bravo');
    const upcoming = await seedEvent(hours(5));
    const past = await seedEvent(hours(-5));
    const cancelled = await seedEvent(hours(6), NOW);
    for (const e of [upcoming, past, cancelled]) await insertRsvp(e, a, a1);
    await insertRsvp(upcoming, b, b1);
    await reassignUpcomingRsvps(db, { userId: a, toCharacterId: a2, now: NOW });
    const r = await rows();
    const by = (e: number, u: number) => r.find((x) => x.eventId === e && x.userId === u)!;
    expect(by(upcoming, a).characterId).toBe(a2);
    expect(by(past, a).characterId).toBe(a1);
    expect(by(cancelled, a).characterId).toBe(a1);
    expect(by(upcoming, b).characterId).toBe(b1);
  });

  it('respekterer fromCharacterId', async () => {
    const a = await seedUser(db, 'a');
    const a1 = await seedChar(a, 'Alfa');
    const a2 = await seedChar(a, 'Alfa2');
    const a3 = await seedChar(a, 'Alfa3');
    const e1 = await seedEvent(hours(5));
    const e2 = await seedEvent(hours(6));
    await insertRsvp(e1, a, a1);
    await insertRsvp(e2, a, a2);
    await reassignUpcomingRsvps(db, { userId: a, fromCharacterId: a1, toCharacterId: a3, now: NOW });
    const r = await rows();
    expect(r.find((x) => x.eventId === e1)!.characterId).toBe(a3);
    expect(r.find((x) => x.eventId === e2)!.characterId).toBe(a2);
  });

  it('sletter kommende tilmeldinger ved null, men ikke tidligere eller andres', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const a1 = await seedChar(a, 'Alfa');
    const b1 = await seedChar(b, 'Bravo');
    const upcoming = await seedEvent(hours(5));
    const past = await seedEvent(hours(-5));
    await insertRsvp(upcoming, a, a1);
    await insertRsvp(past, a, a1);
    await insertRsvp(upcoming, b, b1);
    await reassignUpcomingRsvps(db, { userId: a, toCharacterId: null, now: NOW });
    const r = await rows();
    expect(r.map((x) => [x.eventId, x.userId])).toEqual([[past, a], [upcoming, b]]);
  });
});
