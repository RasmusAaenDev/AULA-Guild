import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { RecentAchievement } from '@/lib/blizzard/types';
import { syncRoster } from '@/lib/sync';
import { BlizzardError } from '@/lib/blizzard/types';
import { characters, highlights } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { armory, fakeBlizzard, member, seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const NOW = new Date('2026-11-10T12:00:00Z');
const OLD = new Date('2026-11-01T00:00:00Z');
const noSleep = async () => {};

async function seed(blizzardId: number, name: string, userId: number | null, extra: Partial<typeof characters.$inferInsert> = {}) {
  await db.insert(characters).values({
    blizzardId, slug: name.toLowerCase(), name, className: 'Mage', role: 'dps',
    itemLevel: 5, spec: 'Fire', guildRank: 9, inGuild: true, lastSynced: OLD, userId, ...extra,
  });
}
const row = async (blizzardId: number) => (await db.select().from(characters).where(eq(characters.blizzardId, blizzardId)))[0];
const run = (blizzard: ReturnType<typeof fakeBlizzard>, extra = {}) =>
  syncRoster({ db, blizzard, guildSlug: 'aula', now: () => NOW, sleep: noSleep, ...extra });

describe('syncRoster: efternavn', () => {
  it('skriver efternavnet fra profilen, og rosterens som fallback når profilen mangler det', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    await seed(2, 'Beta', u);
    const blizzard = fakeBlizzard({
      roster: [
        member({ blizzardId: 1, slug: 'alpha', name: 'Alpha', surname: 'Roster' }),
        member({ blizzardId: 2, slug: 'beta', name: 'Beta', surname: 'Fallback' }),
      ],
      characters: {
        alpha: armory({ blizzardId: 1, slug: 'alpha', name: 'Alpha', surname: 'Profil' }),
        beta: armory({ blizzardId: 2, slug: 'beta', name: 'Beta', surname: null }),
      },
    });
    await run(blizzard);
    expect((await row(1)).surname).toBe('Profil');
    expect((await row(2)).surname).toBe('Fallback');
  });

  it('overskriver aldrig et kendt efternavn med null', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u, { surname: 'Kendt' });
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha', name: 'Alpha', surname: null })],
      characters: { alpha: armory({ blizzardId: 1, slug: 'alpha', name: 'Alpha', surname: null }) },
    });
    expect(await run(blizzard)).toEqual({ skipped: false, updated: 1, failed: 0 });
    expect((await row(1)).surname).toBe('Kendt');
  });

  it('udfylder efternavn på en eksisterende række uden', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    expect((await row(1)).surname).toBeNull();
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha', name: 'Alpha', surname: 'Ny' })],
      characters: { alpha: armory({ blizzardId: 1, slug: 'alpha', name: 'Alpha', surname: 'Ny' }) },
    });
    await run(blizzard);
    expect((await row(1)).surname).toBe('Ny');
  });
});

describe('syncRoster', () => {
  it('opdaterer rang, slug, item level, spec og last_synced for karakterer i rosteren', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha-ny', name: 'Alpha', rank: 2 })],
      characters: { 'alpha-ny': armory({ blizzardId: 1, slug: 'alpha-ny', name: 'Alpha', level: 41, itemLevel: 42, spec: 'Frost', className: 'Mage' }) },
    });
    expect(await run(blizzard)).toEqual({ skipped: false, updated: 1, failed: 0 });
    expect(await row(1)).toMatchObject({ guildRank: 2, slug: 'alpha-ny', level: 41, itemLevel: 42, spec: 'Frost', inGuild: true, lastSynced: NOW });
  });

  it('beholder gemt spec når spec er undefined, men opdaterer øvrige felter; skriver null når spec er null', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    await seed(2, 'Beta', u);
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha', name: 'Alpha' }), member({ blizzardId: 2, slug: 'beta', name: 'Beta' })],
      characters: {
        alpha: armory({ blizzardId: 1, slug: 'alpha', name: 'Alpha', itemLevel: 42, spec: undefined }),
        beta: armory({ blizzardId: 2, slug: 'beta', name: 'Beta', itemLevel: 43, spec: null }),
      },
    });
    expect(await run(blizzard)).toEqual({ skipped: false, updated: 2, failed: 0 });
    expect(await row(1)).toMatchObject({ spec: 'Fire', itemLevel: 42 });
    expect(await row(2)).toMatchObject({ spec: null, itemLevel: 43 });
  });

  it('markerer karakterer, der ikke står i rosteren, som forladt og beholder deres data', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    const blizzard = fakeBlizzard({ roster: [member({ blizzardId: 99, slug: 'andre', name: 'Andre' })] });
    expect(await run(blizzard)).toEqual({ skipped: false, updated: 0, failed: 0 });
    expect(await row(1)).toMatchObject({ inGuild: false, itemLevel: 5, spec: 'Fire', lastSynced: OLD });
    expect(blizzard.calls).toEqual(['roster']);
  });

  it('sætter forladt karakter tilbage i guilden, når den står i rosteren igen', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u, { inGuild: false });
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha', name: 'Alpha' })],
      characters: { alpha: armory({ blizzardId: 1, slug: 'alpha', name: 'Alpha' }) },
    });
    await run(blizzard);
    expect((await row(1)).inGuild).toBe(true);
  });

  it('ændrer intet og springer over, når roster-kaldet fejler', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    const blizzard = fakeBlizzard({ roster: new BlizzardError('unavailable', 'nede') });
    expect(await run(blizzard)).toEqual({ skipped: true, updated: 0, failed: 0 });
    expect(await row(1)).toMatchObject({ inGuild: true, lastSynced: OLD });
  });

  it('beholder gamle data for en karakter, der fejler, og fortsætter med resten', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    await seed(2, 'Beta', u);
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha', name: 'Alpha' }), member({ blizzardId: 2, slug: 'beta', name: 'Beta' })],
      characters: {
        alpha: new BlizzardError('unavailable', 'x'),
        beta: armory({ blizzardId: 2, slug: 'beta', name: 'Beta', itemLevel: 77 }),
      },
    });
    expect(await run(blizzard)).toEqual({ skipped: false, updated: 1, failed: 1 });
    expect(await row(1)).toMatchObject({ itemLevel: 5, lastSynced: OLD });
    expect(await row(2)).toMatchObject({ itemLevel: 77, lastSynced: NOW });
  });

  it('venter og prøver én gang igen ved rate limit', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    const waits: number[] = [];
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha', name: 'Alpha' })],
      characters: { alpha: [new BlizzardError('rate_limited', 'x'), armory({ blizzardId: 1, slug: 'alpha', name: 'Alpha', itemLevel: 50 })] },
    });
    const result = await run(blizzard, { sleep: async (ms: number) => void waits.push(ms) });
    expect(result).toEqual({ skipped: false, updated: 1, failed: 0 });
    expect(waits).toEqual([2000]);
    expect((await row(1)).itemLevel).toBe(50);
  });

  it('giver op efter ét genforsøg ved vedvarende rate limit', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha', name: 'Alpha' })],
      characters: { alpha: new BlizzardError('rate_limited', 'x') },
    });
    expect(await run(blizzard)).toEqual({ skipped: false, updated: 0, failed: 1 });
    expect(blizzard.calls.filter((c) => c === 'character:alpha')).toHaveLength(2);
  });

  it('tæller en profil med et andet blizzard-id som fejlet og skriver intet fra den', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha-ny', name: 'Alpha', rank: 2 })],
      characters: { 'alpha-ny': armory({ blizzardId: 999, slug: 'alpha-ny', name: 'Fremmed', itemLevel: 99 }) },
    });
    expect(await run(blizzard)).toEqual({ skipped: false, updated: 0, failed: 1 });
    expect(await row(1)).toMatchObject({ slug: 'alpha', name: 'Alpha', itemLevel: 5, lastSynced: OLD });
  });

  it('beholder den gamle slug, når profilen fejler, selv om rosteren har en ny', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha-ny', name: 'Alpha', rank: 2 })],
      characters: { 'alpha-ny': new BlizzardError('unavailable', 'x') },
    });
    expect(await run(blizzard)).toEqual({ skipped: false, updated: 0, failed: 1 });
    expect(await row(1)).toMatchObject({ slug: 'alpha', guildRank: 2, inGuild: true, lastSynced: OLD });
  });

  it('springer over og lader registrerede stå i guilden, når rosteren er tom', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    const blizzard = fakeBlizzard({ roster: [] });
    expect(await run(blizzard)).toEqual({ skipped: true, updated: 0, failed: 0 });
    expect(await row(1)).toMatchObject({ inGuild: true, lastSynced: OLD });
  });

  it('rører ikke frakoblede karakterer', async () => {
    await seed(1, 'Orphan', null);
    const blizzard = fakeBlizzard({ roster: [member({ blizzardId: 99, slug: 'andre', name: 'Andre' })] });
    await run(blizzard);
    expect(await row(1)).toMatchObject({ inGuild: true, lastSynced: OLD });
  });
});

describe('syncRoster level', () => {
  it('beholder kendt level, når profilen ikke giver et', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    await db.update(characters).set({ level: 30 }).where(eq(characters.blizzardId, 1));
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha', name: 'Alpha', rank: 2 })],
      characters: { alpha: armory({ blizzardId: 1, slug: 'alpha', name: 'Alpha', level: null }) },
    });
    await run(blizzard);
    expect(await row(1)).toMatchObject({ level: 30 });
  });
});

describe('syncRoster: highlights', () => {
  const DAY = 24 * 3600 * 1000;
  const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
  const ach = (id: number, name: string, completedAt: Date): RecentAchievement => ({ id, name, completedAt });
  const rosterA = [member({ blizzardId: 1, slug: 'alpha', name: 'Alpha', surname: 'Navn' })];
  const prof = (level: number | null) => ({ alpha: armory({ blizzardId: 1, slug: 'alpha', name: 'Alpha', surname: 'Navn', level }) });
  const all = () => db.select().from(highlights);

  it.each([
    [10, 11, true],
    [10, 12, true],
    [10, 10, false],
    [10, 9, false],
    [null, 12, false],
  ])('level %s -> %s: highlight=%s', async (stored, next, expected) => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u, { level: stored, highlightsBaselineAt: OLD });
    await run(fakeBlizzard({ roster: rosterA, characters: prof(next) }));
    const h = await all();
    if (!expected) return expect(h).toHaveLength(0);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ type: 'level_up', title: `Alpha Navn nåede level ${next}`, dedupeKey: `level:${next}`, occurredAt: NOW });
  });

  it('opretter kun achievements nyere end 7 dage, med achievementens tidspunkt', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u, { level: 5, highlightsBaselineAt: ago(30) });
    const fresh = ago(2);
    await run(fakeBlizzard({ roster: rosterA, characters: prof(5), achievements: { alpha: [ach(7, 'Udforsker', fresh), ach(8, 'Gammel', ago(8))] } }));
    const h = await all();
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ type: 'achievement', title: 'Alpha Navn: Udforsker', dedupeKey: 'ach:7', occurredAt: fresh });
  });

  it('baseline: første kørsel sætter kun markøren, næste kørsel tager nyere', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u, { level: 5 });
    const blizzard = fakeBlizzard({ roster: rosterA, characters: prof(5), achievements: { alpha: [ach(1, 'Før', ago(1))] } });
    await run(blizzard);
    expect(await all()).toHaveLength(0);
    expect((await row(1)).highlightsBaselineAt).toEqual(NOW);
    expect(blizzard.calls.filter((c) => c.startsWith('achievements'))).toHaveLength(0);
    const later = new Date(NOW.getTime() + 3600_000);
    const b2 = fakeBlizzard({ roster: rosterA, characters: prof(5), achievements: { alpha: [ach(1, 'Før', ago(1)), ach(2, 'Ny', new Date(NOW.getTime() + 1800_000))] } });
    await run(b2, { now: () => later });
    const h = await all();
    expect(h.map((x) => x.dedupeKey)).toEqual(['ach:2']);
  });

  it('dedupe: samme kørsel to gange giver ingen dubletter', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u, { level: 5, highlightsBaselineAt: ago(30) });
    const blizzard = fakeBlizzard({ roster: rosterA, characters: prof(6), achievements: { alpha: [ach(7, 'A', ago(1))] } });
    await run(blizzard);
    await db.update(characters).set({ level: 5, highlightsBaselineAt: ago(30) }).where(eq(characters.blizzardId, 1));
    await run(blizzard);
    expect(await all()).toHaveLength(2);
  });

  it('fejl i achievements-kaldet påvirker hverken opdatering eller tællinger', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u, { level: 5, highlightsBaselineAt: ago(30) });
    const blizzard = fakeBlizzard({ roster: rosterA, characters: prof(6), achievements: { alpha: new BlizzardError('unavailable', 'x') } });
    expect(await run(blizzard)).toEqual({ skipped: false, updated: 1, failed: 0 });
    expect((await row(1)).level).toBe(6);
    expect((await all()).map((h) => h.type)).toEqual(['level_up']);
  });

  it('ved 429 på achievements ventes og forsøges igen én gang', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u, { level: 5, highlightsBaselineAt: ago(30) });
    const blizzard = fakeBlizzard({ roster: rosterA, characters: prof(5), achievements: { alpha: new BlizzardError('rate_limited', 'x') } });
    expect(await run(blizzard)).toEqual({ skipped: false, updated: 1, failed: 0 });
    expect(blizzard.calls.filter((c) => c.startsWith('achievements'))).toHaveLength(2);
  });

  it('rydder highlights ældre end 30 dage', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u, { level: 5, highlightsBaselineAt: OLD });
    const [c] = await db.select().from(characters);
    await db.insert(highlights).values([
      { characterId: c.id, type: 'level_up', title: 'gammel', occurredAt: ago(31), dedupeKey: 'level:2' },
      { characterId: c.id, type: 'level_up', title: 'ny', occurredAt: ago(29), dedupeKey: 'level:3' },
    ]);
    await run(fakeBlizzard({ roster: rosterA, characters: prof(5) }));
    expect((await all()).map((h) => h.title)).toEqual(['ny']);
  });
});
