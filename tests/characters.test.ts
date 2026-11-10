import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  addCharacter, listContacts, listMyCharacters, setActiveCharacter, setRole, unlinkCharacter,
  type CharactersDeps,
} from '@/lib/characters';
import { BlizzardError } from '@/lib/blizzard/types';
import { characters, events, rsvps, users } from '@/lib/db/schema';
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
    expect(row).toMatchObject({ blizzardId: 1001, slug: 'magi-far', name: 'Magi', surname: 'Far', className: 'Mage', spec: 'Frost', role: 'dps', itemLevel: 8, inGuild: true, userId });
    expect(row.lastSynced).toBeInstanceOf(Date);
    expect(await activeOf(userId)).toBe(res.characterId);
  });

  it('ændrer ikke aktiv karakter, når der tilføjes en ekstra', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({
      characters: { 'magi-far': armory(), 'ezzek': armory({ blizzardId: 1002, slug: 'ezzek', name: 'Ezzek', surname: 'Svumpukkel' }) },
    });
    const first = await addCharacter(deps(blizzard), { userId, name: 'Magi Far', role: 'dps' });
    await addCharacter(deps(blizzard), { userId, name: 'Ezzek', role: 'tank' });
    if (!first.ok) throw new Error('forventede ok');
    expect(await activeOf(userId)).toBe(first.characterId);
    const mine = await listMyCharacters(db, userId);
    expect(mine).toHaveLength(2);
    expect(mine.map((c) => c.fullName)).toEqual(['Ezzek Svumpukkel', 'Magi Far']);
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
      roster: [member({ blizzardId: 1002, name: 'Ezzek', surname: 'Svumpukkel', slug: 'ezzek-svumpukkel' })],
      characters: { 'ezzek-svumpukkel': armory({ blizzardId: 1002, slug: 'ezzek-svumpukkel', name: 'Ezzek', surname: 'Svumpukkel' }) },
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
      characters: { 'magi-far': armory(), ezzek: armory({ blizzardId: 1002, slug: 'ezzek', name: 'Ezzek', surname: 'Svumpukkel' }) },
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
      characters: { 'magi-far': armory(), ezzek: armory({ blizzardId: 1002, slug: 'ezzek', name: 'Ezzek', surname: 'Svumpukkel' }) },
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

  it('peger ejerens aktive karakter på en anden af hans egne (laveste navn), når den aktive frakobles', async () => {
    const a = await seedUser(db, 'a');
    const blizzard = fakeBlizzard({
      characters: {
        'magi-far': armory(),
        ezzek: armory({ blizzardId: 1002, slug: 'ezzek', name: 'Ezzek', surname: 'Svumpukkel' }),
        zorro: armory({ blizzardId: 1003, slug: 'zorro', name: 'Zorro', surname: 'Zygote' }),
      },
    });
    const first = await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' });
    const second = await addCharacter(deps(blizzard), { userId: a, name: 'Zorro', role: 'dps' });
    const third = await addCharacter(deps(blizzard), { userId: a, name: 'Ezzek', role: 'dps' });
    if (!first.ok || !second.ok || !third.ok) throw new Error('forventede ok');
    expect(await activeOf(a)).toBe(first.characterId);
    await unlinkCharacter(db, first.characterId);
    expect(await activeOf(a)).toBe(third.characterId);
  });
});

describe('addCharacter: efternavn og opslag på fuldt navn', () => {
  const ezzek = () => armory({ blizzardId: 1002, slug: 'ezzek-svumpukkel', name: 'Ezzek', surname: 'Svumpukkel' });

  it('gemmer efternavnet fra profilen', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory() } });
    await addCharacter(deps(blizzard), { userId, name: 'Magi Far', role: 'dps' });
    const [row] = await db.select().from(characters);
    expect(row.surname).toBe('Far');
  });

  it('bruger rosterens efternavn, når profilen mangler det', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({
      characters: { 'knud-klunkekløe': armory({ blizzardId: 1003, slug: 'knud-klunkekløe', name: 'Knud', surname: null }) },
      roster: [member({ blizzardId: 1003, name: 'Knud', surname: 'Klunkekløe', slug: 'knud-klunkekløe' })],
    });
    expect((await addCharacter(deps(blizzard), { userId, name: 'Knud Klunkekløe', role: 'dps' })).ok).toBe(true);
    const [row] = await db.select().from(characters);
    expect(row.surname).toBe('Klunkekløe');
  });

  it('skriver null, når hverken profil eller roster kender efternavnet', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory({ surname: null }) }, roster: [] });
    await addCharacter(deps(blizzard), { userId, name: 'Magi Far', role: 'dps' });
    const [row] = await db.select().from(characters);
    expect(row.surname).toBeNull();
  });

  it('virker med det fulde navn (slug fornavn-efternavn) uden at slå op i rosteren', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({ characters: { 'ezzek-svumpukkel': ezzek() } });
    expect((await addCharacter(deps(blizzard), { userId, name: 'Ezzek Svumpukkel', role: 'dps' })).ok).toBe(true);
    expect(blizzard.calls).toEqual(['character:ezzek-svumpukkel']);
  });

  it('finder via kun fornavn i rosteren (matcher roster-name)', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1002, name: 'Ezzek', surname: 'Svumpukkel', slug: 'ezzek-svumpukkel' })],
      characters: { 'ezzek-svumpukkel': ezzek() },
    });
    expect((await addCharacter(deps(blizzard), { userId, name: 'Ezzek', role: 'dps' })).ok).toBe(true);
    const [row] = await db.select().from(characters);
    expect(row).toMatchObject({ slug: 'ezzek-svumpukkel', name: 'Ezzek', surname: 'Svumpukkel' });
  });

  it('finder via fuldt navn i rosteren, når profilopslag på sluggen fejler men rosteren har navn og efternavn', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1002, name: 'Ezzek', surname: 'Svumpukkel', slug: 'ezzek-svumpukkel-2' })],
      characters: { 'ezzek-svumpukkel-2': ezzek() },
    });
    expect((await addCharacter(deps(blizzard), { userId, name: 'Ezzek Svumpukkel', role: 'dps' })).ok).toBe(true);
    expect(blizzard.calls).toEqual(['character:ezzek-svumpukkel', 'roster', 'character:ezzek-svumpukkel-2']);
  });
});

describe('listMyCharacters: fuldt navn og rækkefølge', () => {
  it('sorterer efter fuldt navn (da) og leverer fullName', async () => {
    const a = await seedUser(db, 'a');
    await db.insert(characters).values([
      { blizzardId: 1, slug: 'anna-ølund', name: 'Anna', surname: 'Ølund', className: 'Mage', role: 'dps', userId: a },
      { blizzardId: 2, slug: 'anna-berg', name: 'Anna', surname: 'Berg', className: 'Mage', role: 'dps', userId: a },
      { blizzardId: 3, slug: 'bo-ek', name: 'Bo', surname: null, className: 'Mage', role: 'dps', userId: a },
    ]);
    const mine = await listMyCharacters(db, a);
    expect(mine.map((c) => c.fullName)).toEqual(['Anna Berg', 'Anna Ølund', 'Bo Ek']);
    expect(mine.map((c) => c.name)).toEqual(['Anna', 'Anna', 'Bo']);
  });
});

describe('listContacts', () => {
  it('viser kun tilknyttede karakterer, guild-medlemmer først, med ejerens navn', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    await db.insert(characters).values([
      { blizzardId: 1, slug: 'zed-zorn', name: 'Zed', surname: 'Zorn', className: 'Rogue', role: 'dps', userId: a, inGuild: false },
      { blizzardId: 2, slug: 'abe-aaen', name: 'Abe', surname: 'Aaen', className: 'Mage', role: 'dps', userId: b },
      { blizzardId: 3, slug: 'bob-bygger', name: 'Bob', className: 'Priest', role: 'healer', userId: a },
      { blizzardId: 4, slug: 'orphan', name: 'Orphan', className: 'Priest', role: 'healer', userId: null },
    ]);
    const contacts = await listContacts(db);
    expect(contacts.map((c) => c.name)).toEqual(['Abe', 'Bob', 'Zed']);
    // Bob har intet surname i databasen: fuldt navn udledes af sluggen.
    expect(contacts.map((c) => c.fullName)).toEqual(['Abe Aaen', 'Bob Bygger', 'Zed Zorn']);
    expect(contacts[0]).toMatchObject({ ownerName: 'Bruger b', inGuild: true });
    expect(contacts[2].inGuild).toBe(false);
  });
});

describe('tilmeldinger følger karakterskift og frakobling', () => {
  const NOW = new Date('2026-11-10T12:00:00Z');
  const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000);

  async function setup() {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const blizzard = fakeBlizzard({
      characters: {
        'magi-far': armory(),
        ezzek: armory({ blizzardId: 1002, slug: 'ezzek', name: 'Ezzek', surname: 'Svumpukkel' }),
        zorro: armory({ blizzardId: 1003, slug: 'zorro', name: 'Zorro', surname: 'Zygote' }),
        bob: armory({ blizzardId: 1004, slug: 'bob', name: 'Bob', surname: 'Bygger' }),
      },
    });
    const add = async (u: number, name: string) => {
      const r = await addCharacter(deps(blizzard), { userId: u, name, role: 'dps' });
      if (!r.ok) throw new Error('forventede ok');
      return r.characterId;
    };
    const magi = await add(a, 'Magi Far');
    const ezzek = await add(a, 'Ezzek');
    const zorro = await add(a, 'Zorro');
    const bob = await add(b, 'Bob');
    const ev = async (h: number, cancelled = false) => {
      const [e] = await db.insert(events).values({
        type: 'aften', title: 'Aften', startsAt: hours(h), cancelledAt: cancelled ? NOW : null, createdBy: a,
      }).returning({ id: events.id });
      return e.id;
    };
    const rs = async (eventId: number, userId: number, characterId: number) => {
      await db.insert(rsvps).values({ eventId, userId, characterId, status: 'deltager' });
    };
    const charOf = async (eventId: number, userId: number) => {
      const [r] = await db.select().from(rsvps).where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, userId)));
      return r?.characterId ?? null;
    };
    return { a, b, magi, ezzek, zorro, bob, ev, rs, charOf };
  }

  it('skift af aktiv karakter flytter kommende tilmeldinger, men ikke tidligere eller aflyste', async () => {
    const t = await setup();
    const up = await t.ev(5);
    const past = await t.ev(-5);
    const cancelled = await t.ev(6, true);
    for (const e of [up, past, cancelled]) await t.rs(e, t.a, t.magi);
    await t.rs(up, t.b, t.bob);
    expect(await setActiveCharacter(db, t.a, t.ezzek, NOW)).toBe(true);
    expect(await t.charOf(up, t.a)).toBe(t.ezzek);
    expect(await t.charOf(past, t.a)).toBe(t.magi);
    expect(await t.charOf(cancelled, t.a)).toBe(t.magi);
    expect(await t.charOf(up, t.b)).toBe(t.bob);
  });

  it('afvist skift (fremmed karakter) rører ikke tilmeldinger', async () => {
    const t = await setup();
    const up = await t.ev(5);
    await t.rs(up, t.a, t.magi);
    expect(await setActiveCharacter(db, t.a, t.bob, NOW)).toBe(false);
    expect(await t.charOf(up, t.a)).toBe(t.magi);
  });

  it('frakobling af den aktive karakter flytter kommende tilmeldinger til ejerens næste karakter', async () => {
    const t = await setup();
    const up = await t.ev(5);
    const past = await t.ev(-5);
    await t.rs(up, t.a, t.magi);
    await t.rs(past, t.a, t.magi);
    await t.rs(up, t.b, t.bob);
    await unlinkCharacter(db, t.magi, NOW);
    expect(await activeOf(t.a)).toBe(t.ezzek);
    expect(await t.charOf(up, t.a)).toBe(t.ezzek);
    expect(await t.charOf(past, t.a)).toBe(t.magi);
    expect(await t.charOf(up, t.b)).toBe(t.bob);
  });

  it('frakobling uden anden karakter sletter kommende tilmeldinger', async () => {
    const t = await setup();
    const up = await t.ev(5);
    const past = await t.ev(-5);
    await t.rs(up, t.b, t.bob);
    await t.rs(past, t.b, t.bob);
    await t.rs(up, t.a, t.magi);
    await unlinkCharacter(db, t.bob, NOW);
    expect(await t.charOf(up, t.b)).toBeNull();
    expect(await t.charOf(past, t.b)).toBe(t.bob);
    expect(await t.charOf(up, t.a)).toBe(t.magi);
  });

  it('frakobling af en ikke-aktiv karakter flytter kun tilmeldinger med netop den karakter', async () => {
    const t = await setup();
    const e1 = await t.ev(5);
    const e2 = await t.ev(6);
    const e3 = await t.ev(7);
    await t.rs(e1, t.a, t.zorro);
    await t.rs(e2, t.a, t.magi);
    await t.rs(e3, t.a, t.ezzek);
    await unlinkCharacter(db, t.zorro, NOW);
    expect(await activeOf(t.a)).toBe(t.magi);
    expect(await t.charOf(e1, t.a)).toBe(t.magi);
    expect(await t.charOf(e2, t.a)).toBe(t.magi);
    expect(await t.charOf(e3, t.a)).toBe(t.ezzek);
  });
});
