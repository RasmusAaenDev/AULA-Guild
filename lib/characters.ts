import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { characters, users, type Role } from '@/lib/db/schema';
import { BlizzardError, type ArmoryCharacter, type BlizzardClient, type RosterMember } from '@/lib/blizzard/types';
import type { AddFailure } from '@/lib/messages';
import { reassignUpcomingRsvps } from '@/lib/rsvps';
import { fullName } from '@/lib/names';
import { nameToSlug, normalizeName } from '@/lib/slug';

const byFullName = (a: { fullName: string; id: number }, b: { fullName: string; id: number }) =>
  a.fullName.localeCompare(b.fullName, 'da') || a.id - b.id;

export type CharactersDeps = { db: Db; blizzard: BlizzardClient; guildId: number; guildSlug: string };
export type AddResult = { ok: true; characterId: number } | { ok: false; reason: AddFailure };

type Looked = { found: ArmoryCharacter; roster?: RosterMember[] };

// Brugeren skriver «Fornavn Efternavn» (slug fornavn-efternavn, direkte profilopslag). Findes profilen ikke under
// den slug, matches kun rosterens fulde navn (fornavn + efternavn), hvis rosterens slug afviger. Kun fornavn afvises før opslag.
async function lookup(deps: CharactersDeps, slug: string, typedName: string): Promise<Looked> {
  try {
    return { found: await deps.blizzard.getCharacter(slug) };
  } catch (e) {
    if (!(e instanceof BlizzardError) || e.kind !== 'not_found') throw e;
    const roster = await deps.blizzard.getGuildRoster(deps.guildSlug);
    const wanted = normalizeName(typedName);
    // Kun fuldt navn (fornavn + efternavn) matches; et fuldt navn er entydigt i guilden.
    const hit = roster.find((m) => m.surname !== null && normalizeName(`${m.name} ${m.surname}`) === wanted);
    if (!hit || hit.slug === slug) throw e;
    return { found: await deps.blizzard.getCharacter(hit.slug), roster };
  }
}

// Profilen først; mangler den efternavnet, bruges rosterens (best effort: en roster-fejl stopper ikke tilføjelsen).
async function resolveSurname(deps: CharactersDeps, looked: Looked): Promise<string | null> {
  if (looked.found.surname !== null) return looked.found.surname;
  let roster = looked.roster;
  if (!roster) {
    try {
      roster = await deps.blizzard.getGuildRoster(deps.guildSlug);
    } catch {
      return null;
    }
  }
  return roster.find((m) => m.blizzardId === looked.found.blizzardId)?.surname ?? null;
}

export async function addCharacter(
  deps: CharactersDeps,
  input: { userId: number; name: string; role: Role },
): Promise<AddResult> {
  const slug = nameToSlug(input.name);
  // Både fornavn og efternavn kræves (afvises før noget Blizzard-kald).
  if (normalizeName(input.name).split(' ').length < 2) return { ok: false, reason: 'invalid_name' };
  if (!slug) return { ok: false, reason: 'invalid_characters' };

  let found: ArmoryCharacter;
  let surname: string | null;
  try {
    const looked = await lookup(deps, slug, input.name);
    found = looked.found;
    surname = found.guildId === deps.guildId ? await resolveSurname(deps, looked) : null;
  } catch (e) {
    if (e instanceof BlizzardError) return { ok: false, reason: e.kind === 'not_found' ? 'not_found' : 'unavailable' };
    throw e;
  }
  if (found.guildId !== deps.guildId) return { ok: false, reason: 'wrong_guild' };

  const values = {
    blizzardId: found.blizzardId,
    slug: found.slug,
    name: found.name,
    surname,
    className: found.className,
    spec: found.spec ?? null,
    role: input.role,
    level: found.level,
    itemLevel: found.itemLevel,
    inGuild: true,
    lastLogin: found.lastLogin,
    lastSynced: new Date(),
    userId: input.userId,
  };
  const { blizzardId, surname: _s, ...rest } = values;
  // Aldrig overskriv et kendt efternavn med null.
  const update = surname !== null ? { ...rest, surname } : rest;

  const rows = await deps.db
    .insert(characters)
    .values(values)
    .onConflictDoUpdate({ target: characters.blizzardId, set: update, setWhere: isNull(characters.userId) })
    .returning({ id: characters.id });

  if (rows.length === 0) {
    const [existing] = await deps.db
      .select({ userId: characters.userId })
      .from(characters)
      .where(eq(characters.blizzardId, blizzardId));
    return { ok: false, reason: existing?.userId === input.userId ? 'already_yours' : 'taken' };
  }

  await deps.db
    .update(users)
    .set({ activeCharacterId: rows[0].id })
    .where(and(eq(users.id, input.userId), isNull(users.activeCharacterId)));
  return { ok: true, characterId: rows[0].id };
}

/**
 * Vælger brugerens primære (aktive) karakter. Rører IKKE eksisterende tilmeldinger: en tilmelding hører til den karakter, der
 * var valgt, da man meldte til/fra, og ændres først, når man selv melder igen (så bruges den karakter, der er valgt da).
 */
export async function setActiveCharacter(db: Db, userId: number, characterId: number): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ activeCharacterId: characterId })
    .where(
      and(
        eq(users.id, userId),
        sql`exists (select 1 from ${characters} where ${characters.id} = ${characterId} and ${characters.userId} = ${userId})`,
      ),
    )
    .returning({ id: users.id });
  return rows.length > 0;
}

export async function setRole(db: Db, userId: number, characterId: number, role: Role): Promise<boolean> {
  const rows = await db
    .update(characters)
    .set({ role })
    .where(and(eq(characters.id, characterId), eq(characters.userId, userId)))
    .returning({ id: characters.id });
  return rows.length > 0;
}

export async function unlinkCharacter(db: Db, characterId: number, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ userId: characters.userId })
      .from(characters)
      .where(eq(characters.id, characterId))
      .for('update');
    await tx.update(characters).set({ userId: null }).where(eq(characters.id, characterId));
    // Peg ejerens aktive pointer på en anden af hans egne karakterer (laveste navn), ellers NULL.
    await tx
      .update(users)
      .set({
        activeCharacterId: sql`(select ${characters.id} from ${characters} where ${characters.userId} = ${users.id} order by ${characters.name} asc, ${characters.surname} asc nulls last, ${characters.id} asc limit 1)`,
      })
      .where(eq(users.activeCharacterId, characterId));
    if (!owned?.userId) return;
    // Tilmeldinger med den frakoblede karakter følger ejerens aktive karakter efter frakoblingen.
    const [owner] = await tx.select({ active: users.activeCharacterId }).from(users).where(eq(users.id, owned.userId));
    await reassignUpcomingRsvps(tx, {
      userId: owned.userId,
      fromCharacterId: characterId,
      toCharacterId: owner?.active ?? null,
      now,
    });
  });
}

export type MyCharacter = {
  id: number;
  /** Fornavn (Blizzard `name`). */
  name: string;
  /** Fornavn + efternavn (efternavn udledes af sluggen, hvis det ikke er gemt endnu). */
  fullName: string;
  className: string;
  spec: string | null;
  role: Role;
};

export async function listMyCharacters(db: Db, userId: number): Promise<MyCharacter[]> {
  const rows = await db
    .select({
      id: characters.id, name: characters.name, surname: characters.surname, slug: characters.slug,
      className: characters.className, spec: characters.spec, role: characters.role,
    })
    .from(characters)
    .where(eq(characters.userId, userId));
  return rows
    .map(({ surname, slug, ...r }) => ({ ...r, fullName: fullName({ name: r.name, surname, slug }) }))
    .sort(byFullName);
}

export type Contact = {
  id: number;
  name: string;
  slug: string;
  fullName: string;
  className: string;
  spec: string | null;
  role: Role;
  level: number | null;
  itemLevel: number | null;
  guildRank: number | null;
  inGuild: boolean;
  lastSynced: Date | null;
  ownerName: string;
  ownerId: number;
  ownerAvatar: string | null;
};

export async function listContacts(db: Db): Promise<Contact[]> {
  const rows = await db
    .select({
      id: characters.id,
      name: characters.name,
      surname: characters.surname,
      slug: characters.slug,
      className: characters.className,
      spec: characters.spec,
      role: characters.role,
      level: characters.level,
      itemLevel: characters.itemLevel,
      guildRank: characters.guildRank,
      inGuild: characters.inGuild,
      lastSynced: characters.lastSynced,
      ownerName: users.name,
      ownerId: users.id,
      ownerAvatar: users.avatar,
    })
    .from(characters)
    .innerJoin(users, eq(characters.userId, users.id));
  return rows
    .map(({ surname, ...r }) => ({ ...r, fullName: fullName({ name: r.name, surname, slug: r.slug }) }))
    .sort((a, b) => Number(b.inGuild) - Number(a.inGuild) || byFullName(a, b));
}
