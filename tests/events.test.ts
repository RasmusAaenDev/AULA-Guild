import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  cancelEvent, countUnansweredUpcoming, createEvent, getEvent, listUpcomingEvents, updateEvent, validateEventFields,
  type EventActor, type EventInput,
} from '@/lib/events';
import { characters, eventSeries, events, rsvps, users, type Role, type RsvpStatus } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const NOW = new Date('2026-11-10T12:00:00Z');
const FUTURE = new Date('2026-11-12T18:00:00Z');
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000);

const officer = (userId: number): EventActor => ({ userId, isOfficer: true });
const plain = (userId: number): EventActor => ({ userId, isOfficer: false });
const input = (over: Partial<EventInput> = {}): EventInput => ({
  type: 'aften', title: 'Spilaften', description: null, startsAt: FUTURE, durationMinutes: 120, ...over,
});

let charSeq = 0;
async function seedChar(userId: number, role: Role, name: string, className = 'Mage'): Promise<number> {
  charSeq += 1;
  const [c] = await db.insert(characters).values({
    blizzardId: 5000 + charSeq, slug: name.toLowerCase(), name, className, role, userId,
  }).returning({ id: characters.id });
  return c.id;
}
async function rsvp(eventId: number, userId: number, characterId: number, status: RsvpStatus) {
  await db.insert(rsvps).values({ eventId, userId, characterId, status });
}
async function mk(actor: EventActor, over: Partial<EventInput> = {}): Promise<number> {
  const r = await createEvent(db, actor, input(over), NOW);
  if (!r.ok) throw new Error(r.reason);
  return r.eventId;
}
async function row(id: number) {
  const [e] = await db.select().from(events).where(eq(events.id, id));
  return e;
}

describe('validateEventFields', () => {
  const ok = { title: 'Titel', description: null, durationMinutes: 60 };
  it('accepterer gyldige felter og grænseværdier', () => {
    expect(validateEventFields(ok)).toBe('ok');
    expect(validateEventFields({ title: 'x'.repeat(100), description: 'y'.repeat(2000), durationMinutes: 15 })).toBe('ok');
    expect(validateEventFields({ ...ok, durationMinutes: 720 })).toBe('ok');
    expect(validateEventFields({ ...ok, durationMinutes: null })).toBe('ok');
  });
  it('afviser ugyldig titel, beskrivelse og varighed', () => {
    expect(validateEventFields({ ...ok, title: '   ' })).toBe('invalid');
    expect(validateEventFields({ ...ok, title: 'x'.repeat(101) })).toBe('invalid');
    expect(validateEventFields({ ...ok, description: 'y'.repeat(2001) })).toBe('invalid');
    expect(validateEventFields({ ...ok, durationMinutes: 14 })).toBe('invalid');
    expect(validateEventFields({ ...ok, durationMinutes: 721 })).toBe('invalid');
    expect(validateEventFields({ ...ok, durationMinutes: 30.5 })).toBe('invalid');
  });
});

describe('createEvent', () => {
  it('lader en officer oprette raid og aften', async () => {
    const o = await seedUser(db);
    const raid = await createEvent(db, officer(o), input({ type: 'raid', title: '  Raid  ' }), NOW);
    expect(raid.ok).toBe(true);
    if (!raid.ok) return;
    const e = await row(raid.eventId);
    expect(e.type).toBe('raid');
    expect(e.title).toBe('Raid');
    expect(e.description).toBe('');
    expect(e.createdBy).toBe(o);
    expect((await createEvent(db, officer(o), input(), NOW)).ok).toBe(true);
  });
  it('lader ikke-officerer oprette aften, men ikke raid', async () => {
    const u = await seedUser(db);
    expect(await createEvent(db, plain(u), input({ type: 'raid' }), NOW)).toEqual({ ok: false, reason: 'forbidden' });
    expect((await createEvent(db, plain(u), input(), NOW)).ok).toBe(true);
  });
  it('afviser ugyldige felter', async () => {
    const u = await seedUser(db);
    expect(await createEvent(db, plain(u), input({ title: ' ' }), NOW)).toEqual({ ok: false, reason: 'invalid' });
    expect(await createEvent(db, plain(u), input({ durationMinutes: 5 }), NOW)).toEqual({ ok: false, reason: 'invalid' });
    expect(await createEvent(db, plain(u), input({ description: 'z'.repeat(2001) }), NOW)).toEqual({ ok: false, reason: 'invalid' });
  });
  it('afviser tidspunkter i fortiden og nu', async () => {
    const u = await seedUser(db);
    expect(await createEvent(db, plain(u), input({ startsAt: hours(-1) }), NOW)).toEqual({ ok: false, reason: 'in_past' });
    expect(await createEvent(db, plain(u), input({ startsAt: NOW }), NOW)).toEqual({ ok: false, reason: 'in_past' });
  });
  it('gemmer trimmet beskrivelse', async () => {
    const u = await seedUser(db);
    const id = await mk(plain(u), { description: '  hej  ' });
    expect((await row(id)).description).toBe('hej');
  });
});

describe('updateEvent', () => {
  const patch = (over = {}) => ({ title: 'Nyt navn', description: 'Ny', startsAt: FUTURE, durationMinutes: 90, ...over });

  it('lader opretteren redigere sin egen aften', async () => {
    const u = await seedUser(db);
    const id = await mk(plain(u));
    expect(await updateEvent(db, plain(u), id, patch(), NOW)).toEqual({ ok: true });
    const e = await row(id);
    expect(e.title).toBe('Nyt navn');
    expect(e.description).toBe('Ny');
    expect(e.durationMinutes).toBe(90);
    expect(e.type).toBe('aften');
  });
  it('nægter andre ikke-officerer', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const id = await mk(plain(a));
    expect(await updateEvent(db, plain(b), id, patch(), NOW)).toEqual({ ok: false, reason: 'forbidden' });
  });
  it('lader en officer redigere en andens aften', async () => {
    const a = await seedUser(db, 'a');
    const o = await seedUser(db, 'o');
    const id = await mk(plain(a));
    expect(await updateEvent(db, officer(o), id, patch(), NOW)).toEqual({ ok: true });
  });
  it('nægter ikke-officer at redigere raid, også egen', async () => {
    const o = await seedUser(db, 'o');
    const id = await mk(officer(o), { type: 'raid' });
    expect(await updateEvent(db, plain(o), id, patch(), NOW)).toEqual({ ok: false, reason: 'forbidden' });
    expect(await updateEvent(db, officer(o), id, patch(), NOW)).toEqual({ ok: true });
  });
  it('returnerer not_found, invalid og cancelled', async () => {
    const u = await seedUser(db);
    expect(await updateEvent(db, officer(u), 999, patch(), NOW)).toEqual({ ok: false, reason: 'not_found' });
    const id = await mk(plain(u));
    expect(await updateEvent(db, plain(u), id, patch({ title: '' }), NOW)).toEqual({ ok: false, reason: 'invalid' });
    await cancelEvent(db, plain(u), id);
    expect(await updateEvent(db, plain(u), id, patch(), NOW)).toEqual({ ok: false, reason: 'cancelled' });
  });
  it('kræver fremtidigt tidspunkt kun når starttidspunktet ændres', async () => {
    const u = await seedUser(db);
    const id = await mk(plain(u));
    expect(await updateEvent(db, plain(u), id, patch({ startsAt: hours(-2) }), NOW)).toEqual({ ok: false, reason: 'in_past' });
    // uændret starttidspunkt er ok, selv hvis det nu ligger i fortiden
    const later = new Date(FUTURE.getTime() + 3600_000);
    expect(await updateEvent(db, plain(u), id, patch(), later)).toEqual({ ok: true });
  });
  it('sætter detached kun for serie-events', async () => {
    const o = await seedUser(db);
    const [s] = await db.insert(eventSeries).values({
      type: 'raid', title: 'Serie', weekday: 3, startTime: '20:00', durationMinutes: 180, createdBy: o,
    }).returning({ id: eventSeries.id });
    const [ev] = await db.insert(events).values({
      type: 'raid', title: 'Fra serie', startsAt: FUTURE, createdBy: o, seriesId: s.id,
    }).returning({ id: events.id });
    const free = await mk(officer(o));
    await updateEvent(db, officer(o), free, patch(), NOW);
    expect((await row(free)).detached).toBe(false);
    expect((await row(ev.id)).detached).toBe(false);
    await updateEvent(db, officer(o), ev.id, patch(), NOW);
    expect((await row(ev.id)).detached).toBe(true);
  });
});

describe('cancelEvent', () => {
  it('aflyser, er idempotent og bevarer første tidspunkt', async () => {
    const u = await seedUser(db);
    const id = await mk(plain(u));
    expect(await cancelEvent(db, plain(u), id)).toEqual({ ok: true });
    const first = (await row(id)).cancelledAt;
    expect(first).not.toBeNull();
    expect(await cancelEvent(db, plain(u), id)).toEqual({ ok: true });
    expect((await row(id)).cancelledAt).toEqual(first);
  });
  it('følger rettighederne fra updateEvent', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const o = await seedUser(db, 'o');
    const aften = await mk(plain(a));
    expect(await cancelEvent(db, plain(b), aften)).toEqual({ ok: false, reason: 'forbidden' });
    expect(await cancelEvent(db, officer(o), aften)).toEqual({ ok: true });
    const raid = await mk(officer(o), { type: 'raid' });
    expect(await cancelEvent(db, plain(o), raid)).toEqual({ ok: false, reason: 'forbidden' });
    expect(await cancelEvent(db, plain(a), 999)).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('listUpcomingEvents', () => {
  it('sorterer stigende, har 3-timers vindue og viser aflyste', async () => {
    const u = await seedUser(db);
    const late = await mk(plain(u), { title: 'Sen', startsAt: hours(48) });
    const soon = await mk(plain(u), { title: 'Snart', startsAt: hours(5) });
    const cancelled = await mk(plain(u), { title: 'Aflyst', startsAt: hours(10) });
    await cancelEvent(db, plain(u), cancelled);
    // direkte indsat: startet for 2 t siden (med) og 4 t siden (ude)
    await db.insert(events).values([
      { type: 'aften', title: 'Igang', startsAt: hours(-2), createdBy: u },
      { type: 'aften', title: 'Forbi', startsAt: hours(-4), createdBy: u },
    ]);
    const list = await listUpcomingEvents(db, u, NOW);
    expect(list.map((e) => e.title)).toEqual(['Igang', 'Snart', 'Aflyst', 'Sen']);
    expect(list.find((e) => e.id === cancelled)!.cancelled).toBe(true);
    expect(list.find((e) => e.id === soon)!.cancelled).toBe(false);
    expect(list.find((e) => e.id === late)!.seriesId).toBeNull();
  });
  it('tæller kun deltagere pr. rolle og giver myStatus', async () => {
    const me = await seedUser(db, 'me');
    const u2 = await seedUser(db, 'u2');
    const u3 = await seedUser(db, 'u3');
    const u4 = await seedUser(db, 'u4');
    const id = await mk(plain(me));
    const empty = await mk(plain(me), { startsAt: hours(100) });
    await rsvp(id, me, await seedChar(me, 'tank', 'Tanky'), 'deltager');
    await rsvp(id, u2, await seedChar(u2, 'dps', 'Dpsy'), 'deltager');
    await rsvp(id, u3, await seedChar(u3, 'healer', 'Healy'), 'maaske');
    await rsvp(id, u4, await seedChar(u4, 'dps', 'Afbudsy'), 'afbud');
    const list = await listUpcomingEvents(db, me, NOW);
    const item = list.find((e) => e.id === id)!;
    expect(item.counts).toEqual({ tank: 1, healer: 0, dps: 1, total: 2 });
    expect(item.myStatus).toBe('deltager');
    const other = (await listUpcomingEvents(db, u3, NOW)).find((e) => e.id === id)!;
    expect(other.myStatus).toBe('maaske');
    const e = list.find((x) => x.id === empty)!;
    expect(e.counts).toEqual({ tank: 0, healer: 0, dps: 0, total: 0 });
    expect(e.myStatus).toBeNull();
  });
  it('respekterer limit', async () => {
    const u = await seedUser(db);
    await mk(plain(u), { startsAt: hours(5) });
    await mk(plain(u), { startsAt: hours(6) });
    await mk(plain(u), { startsAt: hours(7) });
    expect(await listUpcomingEvents(db, u, NOW, { limit: 2 })).toHaveLength(2);
  });
});

describe('getEvent', () => {
  it('returnerer null for ukendt id', async () => {
    expect(await getEvent(db, 12345)).toBeNull();
  });
  it('returnerer detaljer med sorterede deltagere og tællinger', async () => {
    const creator = await seedUser(db, 'c');
    const id = await mk(plain(creator), { description: 'Beskrivelse' });
    const specs: [string, Role, RsvpStatus, string][] = [
      ['Zed', 'dps', 'deltager', 'z'], ['Abe', 'dps', 'deltager', 'a'], ['Tor', 'tank', 'deltager', 't'],
      ['Hel', 'healer', 'maaske', 'h'], ['Bob', 'tank', 'afbud', 'b'], ['Mia', 'healer', 'deltager', 'm'],
      ['Per', 'tank', 'maaske', 'p'],
    ];
    for (const [name, role, status, d] of specs) {
      const uid = await seedUser(db, d);
      await rsvp(id, uid, await seedChar(uid, role, name), status);
    }
    const d = (await getEvent(db, id))!;
    expect(d.attendees.map((a) => a.characterName)).toEqual(['Tor', 'Mia', 'Abe', 'Zed', 'Per', 'Hel', 'Bob']);
    expect(d.counts).toEqual({ tank: 1, healer: 1, dps: 2, total: 4 });
    expect(d.creatorName).toBe('Bruger c');
    expect(d.createdBy).toBe(creator);
    expect(d.description).toBe('Beskrivelse');
    expect(d.attendees[0]).toMatchObject({ userName: 'Bruger t', className: 'Mage', role: 'tank', status: 'deltager' });
  });
});

describe('countUnansweredUpcoming', () => {
  async function plainEvent(startsAt: Date, extra: Partial<typeof events.$inferInsert> = {}) {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.discordId, 'creator'));
    const creator = existing?.id ?? (await seedUser(db, 'creator'));
    const [e] = await db.insert(events).values({
      type: 'aften', title: 'E', description: '', startsAt, durationMinutes: 60, createdBy: creator, ...extra,
    }).returning({ id: events.id });
    return e.id;
  }

  it('tæller kun kommende, ikke aflyste events uden svar inden for 14 dage', async () => {
    const u = await seedUser(db, 'u');
    await plainEvent(hours(24));
    await plainEvent(hours(48));
    await plainEvent(hours(-1)); // startet
    await plainEvent(hours(30), { cancelledAt: NOW }); // aflyst
    await plainEvent(hours(24 * 15)); // uden for vinduet
    expect(await countUnansweredUpcoming(db, u, NOW)).toBe(2);
  });

  it('har en grænse på præcis 14 dage (inklusive) og et valgfrit vindue', async () => {
    const u = await seedUser(db, 'u');
    await plainEvent(hours(24 * 14));
    await plainEvent(hours(24 * 14 + 1));
    expect(await countUnansweredUpcoming(db, u, NOW)).toBe(1);
    expect(await countUnansweredUpcoming(db, u, NOW, 15)).toBe(2);
    expect(await countUnansweredUpcoming(db, u, NOW, 1)).toBe(0);
  });

  it('tæller ikke starttidspunktet nu som kommende', async () => {
    const u = await seedUser(db, 'u');
    await plainEvent(NOW);
    expect(await countUnansweredUpcoming(db, u, NOW)).toBe(0);
  });

  it('tæller egen tilmelding som besvaret uanset status, men ikke andres', async () => {
    const u = await seedUser(db, 'u');
    const v = await seedUser(db, 'v');
    const cu = await seedChar(u, 'dps', 'Uffe');
    const cv = await seedChar(v, 'dps', 'Vera');
    const e1 = await plainEvent(hours(24));
    const e2 = await plainEvent(hours(25));
    const e3 = await plainEvent(hours(26));
    const e4 = await plainEvent(hours(27));
    await rsvp(e1, u, cu, 'deltager');
    await rsvp(e2, u, cu, 'maaske');
    await rsvp(e3, u, cu, 'afbud');
    await rsvp(e4, v, cv, 'deltager');
    expect(await countUnansweredUpcoming(db, u, NOW)).toBe(1);
    expect(await countUnansweredUpcoming(db, v, NOW)).toBe(3);
  });
});
