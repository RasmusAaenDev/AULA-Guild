import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { characters, users, type Role } from '@/lib/db/schema';
import { BlizzardError, type ArmoryCharacter, type BlizzardClient } from '@/lib/blizzard/types';
import type { AddFailure } from '@/lib/messages';
import { nameToSlug, normalizeName } from '@/lib/slug';

export type CharactersDeps = { db: Db; blizzard: BlizzardClient; guildId: number; guildSlug: string };
export type AddResult = { ok: true; characterId: number } | { ok: false; reason: AddFailure };

async function lookup(deps: CharactersDeps, slug: string, typedName: string): Promise<ArmoryCharacter> {
  try {
    return await deps.blizzard.getCharacter(slug);
  } catch (e) {
    if (!(e instanceof BlizzardError) || e.kind !== 'not_found') throw e;
    const roster = await deps.blizzard.getGuildRoster(deps.guildSlug);
    const wanted = normalizeName(typedName);
    const hit = roster.find((m) => normalizeName(m.name) === wanted);
    if (!hit || hit.slug === slug) throw e;
    return deps.blizzard.getCharacter(hit.slug);
  }
}

export async function addCharacter(
  deps: CharactersDeps,
  input: { userId: number; name: string; role: Role },
): Promise<AddResult> {
  const slug = nameToSlug(input.name);
  if (!slug) return { ok: false, reason: 'invalid_name' };

  let found: ArmoryCharacter;
  try {
    found = await lookup(deps, slug, input.name);
  } catch (e) {
    if (e instanceof BlizzardError) return { ok: false, reason: e.kind === 'not_found' ? 'not_found' : 'unavailable' };
    throw e;
  }
  if (found.guildId !== deps.guildId) return { ok: false, reason: 'wrong_guild' };

  const values = {
    blizzardId: found.blizzardId,
    slug: found.slug,
    name: found.name,
    className: found.className,
    spec: found.spec,
    role: input.role,
    itemLevel: found.itemLevel,
    inGuild: true,
    lastLogin: found.lastLogin,
    lastSynced: new Date(),
    userId: input.userId,
  };
  const { blizzardId, ...update } = values;

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

export async function unlinkCharacter(db: Db, characterId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(characters).set({ userId: null }).where(eq(characters.id, characterId));
    // Peg ejerens aktive pointer på en anden af hans egne karakterer (laveste navn), ellers NULL.
    await tx
      .update(users)
      .set({
        activeCharacterId: sql`(select ${characters.id} from ${characters} where ${characters.userId} = ${users.id} order by ${characters.name} asc, ${characters.id} asc limit 1)`,
      })
      .where(eq(users.activeCharacterId, characterId));
  });
}

export type MyCharacter = { id: number; name: string; className: string; spec: string | null; role: Role };

export async function listMyCharacters(db: Db, userId: number): Promise<MyCharacter[]> {
  return db
    .select({ id: characters.id, name: characters.name, className: characters.className, spec: characters.spec, role: characters.role })
    .from(characters)
    .where(eq(characters.userId, userId))
    .orderBy(asc(characters.name));
}

export type Contact = {
  id: number;
  name: string;
  className: string;
  spec: string | null;
  role: Role;
  itemLevel: number | null;
  guildRank: number | null;
  inGuild: boolean;
  lastSynced: Date | null;
  ownerName: string;
  ownerAvatar: string | null;
};

export async function listContacts(db: Db): Promise<Contact[]> {
  return db
    .select({
      id: characters.id,
      name: characters.name,
      className: characters.className,
      spec: characters.spec,
      role: characters.role,
      itemLevel: characters.itemLevel,
      guildRank: characters.guildRank,
      inGuild: characters.inGuild,
      lastSynced: characters.lastSynced,
      ownerName: users.name,
      ownerAvatar: users.avatar,
    })
    .from(characters)
    .innerJoin(users, eq(characters.userId, users.id))
    .orderBy(desc(characters.inGuild), asc(characters.name));
}
