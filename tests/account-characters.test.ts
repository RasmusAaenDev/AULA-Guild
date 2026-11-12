import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { syncAccountCharacters } from '@/lib/account-characters';
import { deriveAccess } from '@/lib/access';
import type { AccountCharacter } from '@/lib/blizzard/account';
import { BlizzardError } from '@/lib/blizzard/types';
import type { CharactersDeps } from '@/lib/characters';
import { characters, users } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { armory, fakeBlizzard, member, seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const GUILD_ID = 304114;
const NOW = new Date('2026-11-12T12:00:00Z');
const deps = (blizzard: CharactersDeps['blizzard']): CharactersDeps => ({ db, blizzard, guildId: GUILD_ID, guildSlug: 'aula' });
const acc = (over: Partial<AccountCharacter> = {}): AccountCharacter => ({
  blizzardId: 1001, name: 'Magi', surname: 'Far', slug: 'magi-far', className: 'Mage', level: 20, ...over,
});
const sync = (blizzard: CharactersDeps['blizzard'], userId: number, list: AccountCharacter[]) =>
  syncAccountCharacters(deps(blizzard), userId, list, { now: () => NOW });

async function row(blizzardId: number) {
  const [r] = await db.select().from(characters).where(eq(characters.blizzardId, blizzardId));
  return r;
}
async function activeOf(userId: number) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  return u.activeCharacterId;
}
async function seedChar(over: Partial<typeof characters.$inferInsert>) {
  const [r] = await db
    .insert(characters)
    .values({ blizzardId: 1001, slug: 'magi-far', name: 'Magi', surname: 'Far', className: 'Mage', role: 'dps', inGuild: true, guildRank: 4, ...over })
    .returning({ id: characters.id });
  return r.id;
}

describe('syncAccountCharacters', () => {
  it('opretter en ukendt karakter fra armory, verificerer den og tager rangen fra rosteren', async () => {
    const u = await seedUser(db);
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory({ spec: 'Holy' }) }, roster: [member({ rank: 2 })] });
    await sync(blizzard, u, [acc()]);
    const r = await row(1001);
    expect(r).toMatchObject({ userId: u, name: 'Magi', surname: 'Far', className: 'Mage', spec: 'Holy', role: 'healer', level: 32, inGuild: true, guildRank: 2 });
    expect(r.verifiedAt).toEqual(NOW);
    expect(await activeOf(u)).toBe(r.id);
  });

  it('giver en kendt roster-karakter uden ejer userId og verifiedAt (uden nyt profilopslag)', async () => {
    const u = await seedUser(db);
    const id = await seedChar({ userId: null, guildRank: 5 });
    const blizzard = fakeBlizzard({ roster: [member({ rank: 1 })] });
    await sync(blizzard, u, [acc()]);
    const r = await row(1001);
    expect(r).toMatchObject({ id, userId: u, inGuild: true, guildRank: 1 });
    expect(r.verifiedAt).toEqual(NOW);
    expect(blizzard.calls.filter((c) => c.startsWith('character:'))).toEqual([]);
  });

  it('verificerer brugerens egen fritekst-karakter', async () => {
    const u = await seedUser(db);
    await seedChar({ userId: u, verifiedAt: null });
    await sync(fakeBlizzard({ roster: [member()] }), u, [acc()]);
    expect((await row(1001)).verifiedAt).toEqual(NOW);
  });

  it('flytter aldrig en karakter, der er verificeret på en anden bruger, og logger det', async () => {
    const other = await seedUser(db, 'o1');
    const u = await seedUser(db, 'u1');
    const then = new Date('2026-11-01T00:00:00Z');
    await seedChar({ userId: other, verifiedAt: then });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sync(fakeBlizzard({ roster: [member({ rank: 0 })] }), u, [acc()]);
    const r = await row(1001);
    expect(r.userId).toBe(other);
    expect(r.verifiedAt).toEqual(then);
    expect(warn).toHaveBeenCalled();
    expect(await deriveAccess(db, u, { officerMaxRank: 1 })).toEqual({ isGuildMember: false, isOfficer: false });
    warn.mockRestore();
  });

  it('overtager en uverificeret (fritekst-)karakter fra en anden bruger: kontoen beviser ejerskabet', async () => {
    const squatter = await seedUser(db, 's1');
    const u = await seedUser(db, 'u1');
    const id = await seedChar({ userId: squatter, verifiedAt: null });
    await db.update(users).set({ activeCharacterId: id }).where(eq(users.id, squatter));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sync(fakeBlizzard({ roster: [member()] }), u, [acc()]);
    const r = await row(1001);
    expect(r.userId).toBe(u);
    expect(r.verifiedAt).toEqual(NOW);
    expect(await activeOf(squatter)).toBeNull();
    expect(await activeOf(u)).toBe(id);
    warn.mockRestore();
  });

  it('springer level-0-karakterer og karakterer armory ikke kender over uden at vælte resten', async () => {
    const u = await seedUser(db);
    const blizzard = fakeBlizzard({
      characters: {
        'magi-far': armory(),
        'fejl-alt': new BlizzardError('unavailable', 'nede'),
      },
      roster: [member()],
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sync(blizzard, u, [
      acc({ blizzardId: 5, slug: 'ny-alt', level: 0 }),
      acc({ blizzardId: 6, slug: 'ukendt-alt', level: 1 }),
      acc({ blizzardId: 7, slug: 'fejl-alt', level: 3 }),
      acc(),
    ]);
    expect(blizzard.calls).not.toContain('character:ny-alt');
    const rows = await db.select().from(characters);
    expect(rows.map((r) => r.blizzardId)).toEqual([1001]);
    vi.restoreAllMocks();
  });

  it('kaster ikke, når Blizzard fejler (profil og roster)', async () => {
    const u = await seedUser(db);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const blizzard = fakeBlizzard({
      characters: { 'magi-far': new BlizzardError('unavailable', 'nede') },
      roster: new BlizzardError('unavailable', 'nede'),
    });
    await expect(sync(blizzard, u, [acc()])).resolves.toBeUndefined();
    expect(await db.select().from(characters)).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it('uden roster: ny karakter får inGuild fra profilens guild, kendt karakter beholder sin rang', async () => {
    const u = await seedUser(db);
    await seedChar({ blizzardId: 2002, slug: 'kendt-alt', userId: null, guildRank: 3 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const blizzard = fakeBlizzard({
      characters: { 'magi-far': armory({ guildId: 999 }) },
      roster: new BlizzardError('unavailable', 'nede'),
    });
    await sync(blizzard, u, [acc(), acc({ blizzardId: 2002, slug: 'kendt-alt' })]);
    expect(await row(1001)).toMatchObject({ inGuild: false, guildRank: null, userId: u });
    expect(await row(2002)).toMatchObject({ inGuild: true, guildRank: 3, userId: u });
    vi.restoreAllMocks();
  });

  it('ændrer ikke en eksisterende aktiv karakter og vælger ellers en guild-karakter', async () => {
    const u = await seedUser(db);
    const outside = await seedChar({ blizzardId: 3003, slug: 'aa-ude', name: 'Aa', userId: u, inGuild: false, verifiedAt: NOW });
    const blizzard = fakeBlizzard({
      characters: { 'magi-far': armory() },
      roster: [member()],
    });
    await sync(blizzard, u, [acc(), acc({ blizzardId: 3003, slug: 'aa-ude' })]);
    // Ingen aktiv før: guild-karakteren vælges frem for den (alfabetisk første) uden for guilden.
    const magi = (await row(1001)).id;
    expect(await activeOf(u)).toBe(magi);
    await db.update(users).set({ activeCharacterId: outside }).where(eq(users.id, u));
    await sync(blizzard, u, [acc(), acc({ blizzardId: 3003, slug: 'aa-ude' })]);
    expect(await activeOf(u)).toBe(outside);
  });

  it('efter synk afledes adgangen: rang 1 → officer, rang 5 → medlem, uden for guilden → gæst', async () => {
    const opts = { officerMaxRank: 1 };
    const officer = await seedUser(db, 'a');
    const plain = await seedUser(db, 'b');
    const guest = await seedUser(db, 'c');
    const blizzard = fakeBlizzard({
      characters: {
        'off-icer': armory({ blizzardId: 1, slug: 'off-icer', name: 'Off', surname: 'Icer' }),
        'mem-ber': armory({ blizzardId: 2, slug: 'mem-ber', name: 'Mem', surname: 'Ber' }),
        'gu-est': armory({ blizzardId: 3, slug: 'gu-est', name: 'Gu', surname: 'Est', guildId: null, guildName: null }),
      },
      roster: [member({ blizzardId: 1, slug: 'off-icer', rank: 1 }), member({ blizzardId: 2, slug: 'mem-ber', rank: 5 })],
    });
    await sync(blizzard, officer, [acc({ blizzardId: 1, slug: 'off-icer' })]);
    await sync(blizzard, plain, [acc({ blizzardId: 2, slug: 'mem-ber' })]);
    await sync(blizzard, guest, [acc({ blizzardId: 3, slug: 'gu-est' })]);
    expect(await deriveAccess(db, officer, opts)).toEqual({ isGuildMember: true, isOfficer: true });
    expect(await deriveAccess(db, plain, opts)).toEqual({ isGuildMember: true, isOfficer: false });
    expect(await deriveAccess(db, guest, opts)).toEqual({ isGuildMember: false, isOfficer: false });
  });

  it('gør intet uden karakterer (og kalder ikke Blizzard)', async () => {
    const u = await seedUser(db);
    const blizzard = fakeBlizzard({});
    await sync(blizzard, u, []);
    expect(blizzard.calls).toEqual([]);
  });
});
