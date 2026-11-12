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
    surname = found.guildId === deps.guildId ? await resolveSurname(deps, looked) : found.surname;
  } catch (e) {
    if (e instanceof BlizzardError) return { ok: false, reason: e.kind === 'not_found' ? 'not_found' : 'unavailable' };
    throw e;
  }
  const stored = await storeCharacter(deps.db, found, surname, {
    userId: input.userId, role: input.role, inGuild: found.guildId === deps.guildId, verifiedAt: null,
  });
  if (stored === null) {
    const [existing] = await deps.db
      .select({ userId: characters.userId })
      .from(characters)
      .where(eq(characters.blizzardId, found.blizzardId));
    return { ok: false, reason: existing?.userId === input.userId ? 'already_yours' : 'taken' };
  }

  await deps.db
    .update(users)
    .set({ activeCharacterId: stored })
    .where(and(eq(users.id, input.userId), isNull(users.activeCharacterId)));
  return { ok: true, characterId: stored };
}

/**
 * Gemmer en armory-profil på brugeren: ny række, eller en eksisterende uden ejer. null = karakteren ejes allerede af nogen.
 * Fælles vej for fritekst (verifiedAt null) og Battle.net-kontoen (verifiedAt = nu).
 */
async function storeCharacter(
  db: Db,
  found: ArmoryCharacter,
  surname: string | null,
  opts: { userId: number; role: Role; inGuild: boolean; verifiedAt: Date | null; guildRank?: number | null },
): Promise<number | null> {
  const values = {
    blizzardId: found.blizzardId,
    slug: found.slug,
    name: found.name,
    surname,
    className: found.className,
    spec: found.spec ?? null,
    role: opts.role,
    level: found.level,
    itemLevel: found.itemLevel,
    inGuild: opts.inGuild,
    ...(opts.guildRank !== undefined ? { guildRank: opts.guildRank } : {}),
    lastLogin: found.lastLogin,
    lastSynced: new Date(),
    userId: opts.userId,
    verifiedAt: opts.verifiedAt,
  };
  const { blizzardId: _b, surname: _s, ...rest } = values;
  // Aldrig overskriv et kendt efternavn med null.
  const update = surname !== null ? { ...rest, surname } : rest;

  const rows = await db
    .insert(characters)
    .values(values)
    .onConflictDoUpdate({ target: characters.blizzardId, set: update, setWhere: isNull(characters.userId) })
    .returning({ id: characters.id });
  return rows[0]?.id ?? null;
}

/** Standardrolle ud fra spec (kan ændres i profilmenuen): healer-specs → healer, Protection → tank, ellers DPS. */
export function defaultRole(spec: string | null | undefined): Role {
  if (spec === 'Holy' || spec === 'Discipline' || spec === 'Restoration') return 'healer';
  if (spec === 'Protection') return 'tank';
  return 'dps';
}

/**
 * Opretter en karakter fra brugerens Battle.net-konto som verificeret (profilopslag i armory som ved «tilføj karakter»).
 * `roster` (hvis hentet) giver medlemskab og rang; ellers afgøres medlemskab af profilens guild. Fejl fra Blizzard kastes
 * videre (kalderen springer karakteren over). null = karakteren findes allerede på en anden bruger.
 */
export async function addVerifiedCharacter(
  deps: CharactersDeps,
  input: { userId: number; slug: string; blizzardId: number; surname: string | null; roster: RosterMember[] | null; now: Date },
): Promise<number | null> {
  const found = await deps.blizzard.getCharacter(input.slug);
  if (found.blizzardId !== input.blizzardId) throw new BlizzardError('not_found', `${input.slug}: anden karakter i armory`);
  const inRoster = input.roster?.find((m) => m.blizzardId === found.blizzardId) ?? null;
  // Profil, så kontoen, så rosteren (ingen ekstra kald).
  const surname = found.surname ?? input.surname ?? inRoster?.surname ?? null;
  return storeCharacter(deps.db, found, surname, {
    userId: input.userId,
    role: defaultRole(found.spec),
    inGuild: input.roster ? inRoster !== null : found.guildId === deps.guildId,
    guildRank: input.roster ? (inRoster?.rank ?? null) : null,
    verifiedAt: input.now,
  });
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
    // Verificeringen hører til ejeren; en frakoblet karakter er uverificeret, til nogen beviser ejerskab igen.
    await tx.update(characters).set({ userId: null, verifiedAt: null }).where(eq(characters.id, characterId));
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
  inGuild: boolean;
  /** Står på brugerens egen Battle.net-konto. Uverificerede tæller ikke til medlemskab eller officer. */
  verified: boolean;
};

export async function listMyCharacters(db: Db, userId: number): Promise<MyCharacter[]> {
  const rows = await db
    .select({
      id: characters.id, name: characters.name, surname: characters.surname, slug: characters.slug,
      className: characters.className, spec: characters.spec, role: characters.role, inGuild: characters.inGuild,
      verifiedAt: characters.verifiedAt,
    })
    .from(characters)
    .where(eq(characters.userId, userId));
  return rows
    .map(({ surname, slug, verifiedAt, ...r }) => ({ ...r, verified: verifiedAt !== null, fullName: fullName({ name: r.name, surname, slug }) }))
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
  verified: boolean;
  lastSynced: Date | null;
  ownerName: string;
  ownerId: number;
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
      verifiedAt: characters.verifiedAt,
      lastSynced: characters.lastSynced,
      ownerName: users.name,
      ownerId: users.id,
    })
    .from(characters)
    .innerJoin(users, eq(characters.userId, users.id));
  return rows
    .map(({ surname, verifiedAt, ...r }) => ({ ...r, verified: verifiedAt !== null, fullName: fullName({ name: r.name, surname, slug: r.slug }) }))
    .sort((a, b) => Number(b.inGuild) - Number(a.inGuild) || byFullName(a, b));
}
