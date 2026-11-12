import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { deriveAccess } from '@/lib/access';
import { characters } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

let seq = 0;
async function char(userId: number | null, over: Partial<typeof characters.$inferInsert> = {}) {
  seq += 1;
  await db.insert(characters).values({
    blizzardId: seq, slug: `c-${seq}`, name: `C${seq}`, className: 'Mage', role: 'dps', userId,
    inGuild: true, guildRank: 5, verifiedAt: new Date(), ...over,
  });
}
const opts = { officerMaxRank: 1 };

describe('deriveAccess', () => {
  it('ingen karakterer giver hverken medlem eller officer', async () => {
    const u = await seedUser(db);
    expect(await deriveAccess(db, u, opts)).toEqual({ isGuildMember: false, isOfficer: false });
  });

  it('uverificeret guild-karakter tæller ikke', async () => {
    const u = await seedUser(db);
    await char(u, { verifiedAt: null, guildRank: 0 });
    expect(await deriveAccess(db, u, opts)).toEqual({ isGuildMember: false, isOfficer: false });
  });

  it('verificeret karakter uden for guilden tæller ikke', async () => {
    const u = await seedUser(db);
    await char(u, { inGuild: false, guildRank: 0 });
    expect(await deriveAccess(db, u, opts)).toEqual({ isGuildMember: false, isOfficer: false });
  });

  it('verificeret guild-karakter med rang 5 giver medlem, ikke officer', async () => {
    const u = await seedUser(db);
    await char(u, { guildRank: 5 });
    expect(await deriveAccess(db, u, opts)).toEqual({ isGuildMember: true, isOfficer: false });
  });

  it('rang 1 og rang 0 giver officer', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    await char(a, { guildRank: 1 });
    await char(b, { guildRank: 0 });
    expect(await deriveAccess(db, a, opts)).toEqual({ isGuildMember: true, isOfficer: true });
    expect(await deriveAccess(db, b, opts)).toEqual({ isGuildMember: true, isOfficer: true });
  });

  it('bruger den laveste rang blandt brugerens verificerede guild-karakterer', async () => {
    const u = await seedUser(db);
    await char(u, { guildRank: 5 });
    await char(u, { guildRank: 1 });
    await char(u, { guildRank: 0, verifiedAt: null });
    expect(await deriveAccess(db, u, opts)).toEqual({ isGuildMember: true, isOfficer: true });
  });

  it('en rang-1-karakter tilhørende en anden bruger giver ikke officer', async () => {
    const u = await seedUser(db, 'u');
    const other = await seedUser(db, 'o');
    await char(u, { guildRank: 5 });
    await char(other, { guildRank: 1 });
    expect(await deriveAccess(db, u, opts)).toEqual({ isGuildMember: true, isOfficer: false });
  });

  it('guildRank = null giver medlem, ikke officer', async () => {
    const u = await seedUser(db);
    await char(u, { guildRank: null });
    expect(await deriveAccess(db, u, opts)).toEqual({ isGuildMember: true, isOfficer: false });
  });

  it('respekterer officerMaxRank', async () => {
    const u = await seedUser(db);
    await char(u, { guildRank: 2 });
    expect(await deriveAccess(db, u, { officerMaxRank: 1 })).toEqual({ isGuildMember: true, isOfficer: false });
    expect(await deriveAccess(db, u, { officerMaxRank: 2 })).toEqual({ isGuildMember: true, isOfficer: true });
  });

  it('ukendt bruger giver ingen adgang', async () => {
    expect(await deriveAccess(db, 999999, opts)).toEqual({ isGuildMember: false, isOfficer: false });
  });
});


describe('OFFICER_MAX_RANK', () => {
  it('er 1 som standard og afviser ugyldige værdier', async () => {
    const { officerMaxRank } = await import('@/lib/env');
    expect(officerMaxRank.parse(undefined)).toBe(1);
    expect(officerMaxRank.parse('')).toBe(1);
    expect(officerMaxRank.parse('0')).toBe(0);
    expect(officerMaxRank.parse('3')).toBe(3);
    for (const bad of ['-1', 'abc', '1.5', '10']) expect(officerMaxRank.safeParse(bad).success).toBe(false);
  });
});
