import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  addCharacter, listContacts, listMyCharacters, setActiveCharacter, setRole, unlinkCharacter,
  type CharactersDeps,
} from '@/lib/characters';
import { BlizzardError } from '@/lib/blizzard/types';
import { characters, users } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { armory, fakeBlizzard, member, seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const GUILD_ID = 304114;
const deps = (blizzard: CharactersDeps['blizzard']): CharactersDeps => ({ db, blizzard, guildId: GUILD_ID, guildSlug: 'aula' });

async function activeOf(userId: number) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  return u.activeCharacterId;
}

describe('addCharacter', () => {
  it('gemmer karakteren på brugeren og gør den aktiv, når det er den første', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory() } });
    const res = await addCharacter(deps(blizzard), { userId, name: 'Magi Far', role: 'dps' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [row] = await db.select().from(characters);
    expect(row).toMatchObject({ blizzardId: 1001, slug: 'magi-far', name: 'Magi Far', className: 'Mage', spec: 'Frost', role: 'dps', itemLevel: 8, inGuild: true, userId });
    expect(row.lastSynced).toBeInstanceOf(Date);
    expect(await activeOf(userId)).toBe(res.characterId);
  });

  it('ændrer ikke aktiv karakter, når der tilføjes en ekstra', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({
      characters: { 'magi-far': armory(), 'ezzek': armory({ blizzardId: 1002, slug: 'ezzek', name: 'Ezzek' }) },
    });
    const first = await addCharacter(deps(blizzard), { userId, name: 'Magi Far', role: 'dps' });
    await addCharacter(deps(blizzard), { userId, name: 'Ezzek', role: 'tank' });
    if (!first.ok) throw new Error('forventede ok');
    expect(await activeOf(userId)).toBe(first.characterId);
    expect(await listMyCharacters(db, userId)).toHaveLength(2);
  });

  it('afviser ugyldigt navn uden at kalde Blizzard', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({});
    expect(await addCharacter(deps(blizzard), { userId, name: 'a/b', role: 'dps' })).toEqual({ ok: false, reason: 'invalid_name' });
    expect(blizzard.calls).toEqual([]);
  });

  it('giver not_found, når karakteren hverken findes i armory eller roster', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({ roster: [member({ name: 'Andre', slug: 'andre' })] });
    expect(await addCharacter(deps(blizzard), { userId, name: 'Ukendt Navn', role: 'dps' })).toEqual({ ok: false, reason: 'not_found' });
    expect(await db.select().from(characters)).toHaveLength(0);
  });

  it('bruger rosterens slug, når navnet står i rosteren men slug afviger', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1002, name: 'Ezzek', slug: 'ezzek-svumpukkel' })],
      characters: { 'ezzek-svumpukkel': armory({ blizzardId: 1002, slug: 'ezzek-svumpukkel', name: 'Ezzek' }) },
    });
    const res = await addCharacter(deps(blizzard), { userId, name: 'ezzek', role: 'healer' });
    expect(res.ok).toBe(true);
    const [row] = await db.select().from(characters);
    expect(row.slug).toBe('ezzek-svumpukkel');
    expect(blizzard.calls).toEqual(['character:ezzek', 'roster', 'character:ezzek-svumpukkel']);
  });

  it('afviser karakter i en anden guild eller uden guild', async () => {
    const userId = await seedUser(db);
    const other = fakeBlizzard({ characters: { 'magi-far': armory({ guildId: 999 }) } });
    expect(await addCharacter(deps(other), { userId, name: 'Magi Far', role: 'dps' })).toEqual({ ok: false, reason: 'wrong_guild' });
    const none = fakeBlizzard({ characters: { 'magi-far': armory({ guildId: null, guildName: null }) } });
    expect(await addCharacter(deps(none), { userId, name: 'Magi Far', role: 'dps' })).toEqual({ ok: false, reason: 'wrong_guild' });
    expect(await db.select().from(characters)).toHaveLength(0);
  });

  it('giver unavailable og gemmer intet, når armory er nede eller rate-limiter', async () => {
    const userId = await seedUser(db);
    for (const kind of ['unavailable', 'rate_limited'] as const) {
      const blizzard = fakeBlizzard({ characters: { 'magi-far': new BlizzardError(kind, 'x') } });
      expect(await addCharacter(deps(blizzard), { userId, name: 'Magi Far', role: 'dps' })).toEqual({ ok: false, reason: 'unavailable' });
    }
    expect(await db.select().from(characters)).toHaveLength(0);
  });

  it('afviser karakter, som en anden bruger har', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory() } });
    await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' });
    expect(await addCharacter(deps(blizzard), { userId: b, name: 'Magi Far', role: 'tank' })).toEqual({ ok: false, reason: 'taken' });
    const [row] = await db.select().from(characters);
    expect(row.userId).toBe(a);
    expect(row.role).toBe('dps');
  });

  it('siger already_yours, når brugeren selv har karakteren', async () => {
    const a = await seedUser(db, 'a');
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory() } });
    await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' });
    expect(await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' })).toEqual({ ok: false, reason: 'already_yours' });
  });

  it('lader to samtidige forsøg ende med præcis én ejer', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory() } });
    const results = await Promise.all([
      addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' }),
      addCharacter(deps(blizzard), { userId: b, name: 'Magi Far', role: 'dps' }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === 'taken')).toHaveLength(1);
    expect(await db.select().from(characters)).toHaveLength(1);
  });

  it('lader en anden bruger overtage en frakoblet karakter', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory() } });
    const first = await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' });
    if (!first.ok) throw new Error('forventede ok');
    await unlinkCharacter(db, first.characterId);
    const res = await addCharacter(deps(blizzard), { userId: b, name: 'Magi Far', role: 'healer' });
    expect(res).toEqual({ ok: true, characterId: first.characterId });
    const [row] = await db.select().from(characters);
    expect(row).toMatchObject({ userId: b, role: 'healer' });
    expect(await activeOf(b)).toBe(first.characterId);
  });
});

describe('setActiveCharacter og setRole', () => {
  it('virker kun på egne karakterer', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const blizzard = fakeBlizzard({
      characters: { 'magi-far': armory(), ezzek: armory({ blizzardId: 1002, slug: 'ezzek', name: 'Ezzek' }) },
    });
    const mine = await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' });
    const theirs = await addCharacter(deps(blizzard), { userId: b, name: 'Ezzek', role: 'dps' });
    if (!mine.ok || !theirs.ok) throw new Error('forventede ok');

    expect(await setActiveCharacter(db, a, theirs.characterId)).toBe(false);
    expect(await activeOf(a)).toBe(mine.characterId);
    expect(await setRole(db, a, theirs.characterId, 'tank')).toBe(false);
    expect(await setRole(db, a, mine.characterId, 'tank')).toBe(true);
    const [row] = await db.select().from(characters).where(eq(characters.id, mine.characterId));
    expect(row.role).toBe('tank');
  });

  it('skifter aktiv karakter til en anden af egne', async () => {
    const a = await seedUser(db, 'a');
    const blizzard = fakeBlizzard({
      characters: { 'magi-far': armory(), ezzek: armory({ blizzardId: 1002, slug: 'ezzek', name: 'Ezzek' }) },
    });
    await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' });
    const second = await addCharacter(deps(blizzard), { userId: a, name: 'Ezzek', role: 'dps' });
    if (!second.ok) throw new Error('forventede ok');
    expect(await setActiveCharacter(db, a, second.characterId)).toBe(true);
    expect(await activeOf(a)).toBe(second.characterId);
  });
});

describe('unlinkCharacter', () => {
  it('fjerner ejer og nulstiller ejerens aktive karakter', async () => {
    const a = await seedUser(db, 'a');
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory() } });
    const res = await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' });
    if (!res.ok) throw new Error('forventede ok');
    await unlinkCharacter(db, res.characterId);
    const [row] = await db.select().from(characters);
    expect(row.userId).toBeNull();
    expect(await activeOf(a)).toBeNull();
    expect(await listMyCharacters(db, a)).toEqual([]);
  });
});

describe('listContacts', () => {
  it('viser kun tilknyttede karakterer, guild-medlemmer først, med ejerens navn', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    await db.insert(characters).values([
      { blizzardId: 1, slug: 'zed', name: 'Zed', className: 'Rogue', role: 'dps', userId: a, inGuild: false },
      { blizzardId: 2, slug: 'abe', name: 'Abe', className: 'Mage', role: 'dps', userId: b },
      { blizzardId: 3, slug: 'bob', name: 'Bob', className: 'Priest', role: 'healer', userId: a },
      { blizzardId: 4, slug: 'orphan', name: 'Orphan', className: 'Priest', role: 'healer', userId: null },
    ]);
    const contacts = await listContacts(db);
    expect(contacts.map((c) => c.name)).toEqual(['Abe', 'Bob', 'Zed']);
    expect(contacts[0]).toMatchObject({ ownerName: 'Bruger b', inGuild: true });
    expect(contacts[2].inGuild).toBe(false);
  });
});
