import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  createSeries, deactivateSeries, generateSeriesEvents, listSeries, updateSeries, type SeriesInput,
} from '@/lib/series';
import { runJobs } from '@/lib/jobs';
import { utcToCopenhagen } from '@/lib/time';
import type { EventActor } from '@/lib/events';
import { characters, eventSeries, events, rsvps } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

// Tirsdag 10. november 2026, kl. 12:00 UTC. Onsdag = weekday 2.
const NOW = new Date('2026-11-10T12:00:00Z');
const officer = (userId: number): EventActor => ({ userId, isOfficer: true });
const plain = (userId: number): EventActor => ({ userId, isOfficer: false });
const input = (over: Partial<SeriesInput> = {}): SeriesInput => ({
  type: 'raid', title: 'Raid', description: null, weekday: 2, startTime: '20:00', durationMinutes: 180, ...over,
});

async function seedOfficer() {
  const u = await seedUser(db);
  return { userId: typeof u === 'number' ? u : (u as { id: number }).id };
}
async function mkSeries(over: Partial<SeriesInput> = {}, now = NOW) {
  const { userId } = await seedOfficer();
  const r = await createSeries(db, officer(userId), input(over), now);
  if (!r.ok) throw new Error(r.reason);
  return { userId, seriesId: r.seriesId, generated: r.generated };
}
const seriesEvents = (seriesId: number) =>
  db.select().from(events).where(eq(events.seriesId, seriesId)).orderBy(events.startsAt);

describe('createSeries', () => {
  it('genererer 4 eller 5 forekomster inden for 28 dage', async () => {
    const { seriesId, generated } = await mkSeries();
    const rows = await seriesEvents(seriesId);
    expect(generated).toBe(rows.length);
    expect([4, 5]).toContain(rows.length);
    for (const e of rows) {
      expect(utcToCopenhagen(e.startsAt).weekday).toBe(2);
      expect(utcToCopenhagen(e.startsAt).time).toBe('20:00');
      expect(e.type).toBe('raid');
      expect(e.detached).toBe(false);
      expect(e.durationMinutes).toBe(180);
      expect(e.description).toBe('');
    }
  });

  it('kun officerer og validerer input', async () => {
    const u = await seedOfficer();
    expect(await createSeries(db, plain(u.userId), input(), NOW)).toEqual({ ok: false, reason: 'forbidden' });
    for (const bad of [
      input({ weekday: 7 }), input({ weekday: -1 }), input({ weekday: 1.5 }), input({ startTime: '25:00' }),
      input({ startTime: '8:00' }), input({ title: '  ' }), input({ durationMinutes: 5 }), input({ durationMinutes: null as unknown as number }),
    ]) {
      expect(await createSeries(db, officer(u.userId), bad, NOW)).toEqual({ ok: false, reason: 'invalid' });
    }
  });
});

describe('generateSeriesEvents', () => {
  it('er idempotent', async () => {
    const { seriesId } = await mkSeries();
    const before = (await seriesEvents(seriesId)).length;
    expect(await generateSeriesEvents(db, NOW)).toEqual({ created: 0 });
    expect(await generateSeriesEvents(db, NOW)).toEqual({ created: 0 });
    expect((await seriesEvents(seriesId)).length).toBe(before);
  });

  it('samtidige kørsler opretter ingen dubletter', async () => {
    const { userId } = await seedOfficer();
    const [s] = await db.insert(eventSeries).values({
      type: 'raid', title: 'R', weekday: 2, startTime: '20:00', durationMinutes: 60, createdBy: userId,
    }).returning({ id: eventSeries.id });
    const results = await Promise.all([1, 2, 3].map(() => generateSeriesEvents(db, NOW)));
    const total = results.reduce((a, r) => a + r.created, 0);
    const rows = await seriesEvents(s.id);
    expect(total).toBe(rows.length);
  });

  it('inaktive serier genererer ikke', async () => {
    const { userId, seriesId } = await mkSeries();
    await deactivateSeries(db, officer(userId), seriesId, NOW);
    const later = new Date(NOW.getTime() + 14 * 86400_000);
    expect(await generateSeriesEvents(db, later)).toEqual({ created: 0 });
  });

  it('samme danske klokkeslæt men forskellig UTC over sommertid (okt 2026)', async () => {
    // Søndag 25. okt 2026 er skiftet. Lørdag = weekday 5.
    const now = new Date('2026-10-20T12:00:00Z');
    const { seriesId } = await mkSeries({ weekday: 5, startTime: '19:00' }, now);
    const rows = await seriesEvents(seriesId);
    const utcTimes = rows.map((e) => e.startsAt.toISOString().slice(11, 16));
    expect(rows.map((e) => utcToCopenhagen(e.startsAt).time)).toEqual(rows.map(() => '19:00'));
    expect(utcTimes).toContain('17:00'); // 24. okt, sommertid
    expect(utcTimes).toContain('18:00'); // 31. okt, vintertid
  });

  it('hul-dato springes over (28. marts 2027, 02:30)', async () => {
    // Søndag 28. marts 2027 er skiftet; 02:30 findes ikke den dag. Søndag = weekday 6.
    const now = new Date('2027-03-20T12:00:00Z');
    const { seriesId } = await mkSeries({ weekday: 6, startTime: '02:30' }, now);
    const dates = (await seriesEvents(seriesId)).map((e) => utcToCopenhagen(e.startsAt).date);
    expect(dates).not.toContain('2027-03-28');
    expect(dates).toContain('2027-03-21');
    expect(dates).toContain('2027-04-04');
  });

  it('aflyst forekomst genskabes ikke', async () => {
    const { seriesId, generated } = await mkSeries();
    const [first] = await seriesEvents(seriesId);
    await db.update(events).set({ cancelledAt: NOW }).where(eq(events.id, first.id));
    expect(await generateSeriesEvents(db, NOW)).toEqual({ created: 0 });
    expect((await seriesEvents(seriesId)).length).toBe(generated);
  });

  it('forekomster der allerede er startet i dag oprettes ikke', async () => {
    // Onsdag 11. nov 2026 kl. 21:00 dansk = 20:00 UTC; starten 20:00 dansk er passeret.
    const now = new Date('2026-11-11T19:30:00Z');
    const { seriesId } = await mkSeries({}, now);
    const rows = await seriesEvents(seriesId);
    expect(rows.every((e) => e.startsAt.getTime() > now.getTime())).toBe(true);
    expect(utcToCopenhagen(rows[0].startsAt).date).not.toBe('2026-11-11');
  });
});

describe('mandag og samme-dag-dubletter', () => {
  it('serie på mandag (0) giver mandage i dansk tid', async () => {
    const { seriesId } = await mkSeries({ weekday: 0 });
    const rows = await seriesEvents(seriesId);
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows.every((e) => utcToCopenhagen(e.startsAt).weekday === 0)).toBe(true);
  });

  it('flyttet (detached) event genskabes ikke på den oprindelige plads', async () => {
    const { seriesId, generated } = await mkSeries();
    const [first] = await seriesEvents(seriesId);
    await db.update(events).set({ detached: true, startsAt: new Date(first.startsAt.getTime() + 3600_000) }).where(eq(events.id, first.id));
    expect(await generateSeriesEvents(db, NOW)).toEqual({ created: 0 });
    expect((await seriesEvents(seriesId)).length).toBe(generated);
  });
});

describe('updateSeries', () => {
  it('rører ikke fortidige events', async () => {
    const { userId, seriesId } = await mkSeries();
    const [old] = await db.insert(events).values({
      type: 'raid', title: 'Gammel', startsAt: new Date('2026-11-04T19:00:00Z'), seriesId, createdBy: userId,
    }).returning({ id: events.id });
    await updateSeries(db, officer(userId), seriesId, input({ title: 'Nyt' }), NOW);
    await deactivateSeries(db, officer(userId), seriesId, NOW);
    expect(await db.select().from(events).where(eq(events.id, old.id))).toHaveLength(1);
  });

  it('flytter fremtidige uberørte events ved ændret klokkeslæt', async () => {
    const { userId, seriesId, generated } = await mkSeries();
    const r = await updateSeries(db, officer(userId), seriesId, input({ startTime: '21:00' }), NOW);
    expect(r).toEqual({ ok: true, regenerated: generated, keptWithRsvps: 0 });
    const rows = await seriesEvents(seriesId);
    expect(rows.length).toBe(generated);
    expect(rows.every((e) => utcToCopenhagen(e.startsAt).time === '21:00')).toBe(true);
  });

  it('event med tilmelding forbliver uændret og tælles', async () => {
    const { userId, seriesId, generated } = await mkSeries();
    const [first] = await seriesEvents(seriesId);
    const [c] = await db.insert(characters).values({
      blizzardId: 1, slug: 'a', name: 'A', className: 'Mage', role: 'dps', userId,
    }).returning({ id: characters.id });
    await db.insert(rsvps).values({ eventId: first.id, userId, characterId: c.id, status: 'deltager' });
    const r = await updateSeries(db, officer(userId), seriesId, input({ startTime: '21:00', title: 'Nyt' }), NOW);
    expect(r).toEqual({ ok: true, regenerated: generated - 1, keptWithRsvps: 1 });
    const dates = (await seriesEvents(seriesId)).map((e) => utcToCopenhagen(e.startsAt).date);
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates.filter((d) => d === utcToCopenhagen(first.startsAt).date)).toHaveLength(1);
    const kept = await db.select().from(events).where(eq(events.id, first.id));
    expect(kept[0].title).toBe('Raid');
    expect(kept[0].id).toBe(first.id);
    expect(utcToCopenhagen(kept[0].startsAt).time).toBe('20:00');
    expect(await db.select().from(rsvps)).toHaveLength(1);
  });

  it('detached og aflyste events røres ikke', async () => {
    const { userId, seriesId } = await mkSeries();
    const [a, b] = await seriesEvents(seriesId);
    await db.update(events).set({ detached: true, title: 'Special' }).where(eq(events.id, a.id));
    await db.update(events).set({ cancelledAt: NOW }).where(eq(events.id, b.id));
    await updateSeries(db, officer(userId), seriesId, input({ title: 'Nyt' }), NOW);
    const [a2] = await db.select().from(events).where(eq(events.id, a.id));
    const [b2] = await db.select().from(events).where(eq(events.id, b.id));
    expect(a2.title).toBe('Special');
    expect(b2.title).toBe('Raid');
    expect(b2.cancelledAt).not.toBeNull();
  });

  it('forbidden, not_found, invalid', async () => {
    const { userId, seriesId } = await mkSeries();
    expect(await updateSeries(db, plain(userId), seriesId, input(), NOW)).toEqual({ ok: false, reason: 'forbidden' });
    expect(await updateSeries(db, officer(userId), 9999, input(), NOW)).toEqual({ ok: false, reason: 'not_found' });
    expect(await updateSeries(db, officer(userId), seriesId, input({ weekday: 9 }), NOW)).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('deactivateSeries', () => {
  it('fjerner kun uberørte fremtidige events', async () => {
    const { userId, seriesId, generated } = await mkSeries();
    const [first, second] = await seriesEvents(seriesId);
    const [c] = await db.insert(characters).values({
      blizzardId: 1, slug: 'a', name: 'A', className: 'Mage', role: 'dps', userId,
    }).returning({ id: characters.id });
    await db.insert(rsvps).values({ eventId: first.id, userId, characterId: c.id, status: 'maaske' });
    await db.update(events).set({ detached: true }).where(eq(events.id, second.id));
    const r = await deactivateSeries(db, officer(userId), seriesId, NOW);
    expect(r).toEqual({ ok: true, removed: generated - 2, keptWithRsvps: 1 });
    expect((await seriesEvents(seriesId)).length).toBe(2);
    expect(await db.select().from(rsvps)).toHaveLength(1);
    const [s] = await db.select().from(eventSeries).where(eq(eventSeries.id, seriesId));
    expect(s.active).toBe(false);
  });

  it('forbidden og not_found', async () => {
    const { userId, seriesId } = await mkSeries();
    expect(await deactivateSeries(db, plain(userId), seriesId, NOW)).toEqual({ ok: false, reason: 'forbidden' });
    expect(await deactivateSeries(db, officer(userId), 9999, NOW)).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('tilmelding under sletning', () => {
  it('en samtidig tilmelding i en åben transaktion cascade-slettes ikke', async () => {
    const { userId, seriesId } = await mkSeries();
    const [first] = await seriesEvents(seriesId);
    const [c] = await db.insert(characters).values({
      blizzardId: 1, slug: 'a', name: 'A', className: 'Mage', role: 'dps', userId,
    }).returning({ id: characters.id });
    const other = testDb();
    try {
      let release!: () => void;
      const gate = new Promise<void>((r) => { release = r; });
      let inserted!: () => void;
      const ready = new Promise<void>((r) => { inserted = r; });
      const holder = other.db.transaction(async (tx) => {
        await tx.insert(rsvps).values({ eventId: first.id, userId, characterId: c.id, status: 'deltager' });
        inserted();
        await gate;
      });
      await ready;
      const pending = deactivateSeries(db, officer(userId), seriesId, NOW);
      await new Promise((r) => setTimeout(r, 300));
      release();
      await holder;
      const r = await pending;
      expect(r).toMatchObject({ ok: true, keptWithRsvps: 1 });
      expect(await db.select().from(rsvps)).toHaveLength(1);
      expect(await db.select().from(events).where(eq(events.id, first.id))).toHaveLength(1);
    } finally {
      await other.close();
    }
  });
});

describe('listSeries', () => {
  it('returnerer serier med antal kommende events', async () => {
    const { seriesId, generated } = await mkSeries({ description: ' hej ' });
    const list = await listSeries(db, NOW);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: seriesId, upcomingCount: generated, active: true, description: 'hej', weekday: 2 });
  });
});

describe('runJobs', () => {
  it('kører generatoren selv om synkroniseringen fejler', async () => {
    const r = await runJobs({
      sync: async () => { throw new Error('blizzard nede'); },
      generate: async () => ({ created: 3 }),
      log: () => {},
    });
    expect(r).toEqual({ sync: { error: 'blizzard nede' }, series: { created: 3 } });
  });

  it('kører synkroniseringen selv om generatoren fejler', async () => {
    const r = await runJobs({
      sync: async () => ({ skipped: false, updated: 1, failed: 0 }),
      generate: async () => { throw new Error('db nede'); },
      log: () => {},
    });
    expect(r).toEqual({ sync: { skipped: false, updated: 1, failed: 0 }, series: { error: 'db nede' } });
  });
});
