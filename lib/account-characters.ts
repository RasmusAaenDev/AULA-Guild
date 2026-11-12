import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { AccountCharacter } from '@/lib/blizzard/account';
import type { RosterMember } from '@/lib/blizzard/types';
import { addVerifiedCharacter, unlinkCharacter, type CharactersDeps } from '@/lib/characters';
import { characters, users } from '@/lib/db/schema';

export type { AccountCharacter };

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Rosteren hentes én gang pr. synk (best effort): et udfald eller et tomt svar giver null, og så bevares kendte rang-data.
async function loadRoster(deps: CharactersDeps): Promise<RosterMember[] | null> {
  try {
    const roster = await deps.blizzard.getGuildRoster(deps.guildSlug);
    return roster.length > 0 ? roster : null;
  } catch (e) {
    console.warn('Roster kunne ikke hentes under synk af Battle.net-karakterer', reason(e));
    return null;
  }
}

/**
 * Knytter karaktererne fra brugerens Battle.net-konto til brugeren som verificerede (beviset er kontoen selv):
 * - kendt karakter (på blizzardId): sæt ejer og verifiedAt; medlemskab og rang fra rosteren, hvis den kunne hentes.
 *   En karakter, der er VERIFICERET på en anden bruger, flyttes aldrig (logges). En uverificeret (fritekst-)kobling på en
 *   anden bruger frakobles derimod, så ingen kan blokere den rette ejer ved at skrive karakterens navn først.
 * - ukendt karakter: profilopslag i armory og oprettes som ved «tilføj karakter», men verificeret.
 * Level 0 og karakterer, armory ikke kan slå op, springes over uden at vælte resten. Har brugeren ingen aktiv karakter,
 * vælges en verificeret guild-karakter (ellers en anden verificeret). Kaster ikke ved Blizzard-fejl.
 */
export async function syncAccountCharacters(
  deps: CharactersDeps,
  userId: number,
  accountChars: AccountCharacter[],
  opts: { now?: () => Date } = {},
): Promise<void> {
  const now = (opts.now ?? (() => new Date()))();
  const wanted = accountChars.filter((c) => c.level !== 0);
  if (wanted.length === 0) return;
  const { db } = deps;
  const roster = await loadRoster(deps);
  const rankOf = new Map(roster?.map((m) => [m.blizzardId, m.rank]) ?? []);

  const known = await db
    .select({ id: characters.id, blizzardId: characters.blizzardId, userId: characters.userId, verifiedAt: characters.verifiedAt })
    .from(characters)
    .where(inArray(characters.blizzardId, wanted.map((c) => c.blizzardId)));
  const byBlizzardId = new Map(known.map((k) => [k.blizzardId, k]));

  for (const acc of wanted) {
    try {
      const k = byBlizzardId.get(acc.blizzardId);
      if (!k) {
        const id = await addVerifiedCharacter(deps, { userId, slug: acc.slug, blizzardId: acc.blizzardId, surname: acc.surname, roster, now });
        if (id === null) console.warn(`Battle.net-karakter ${acc.blizzardId} blev oprettet af en anden bruger undervejs; springes over`);
        continue;
      }
      if (k.userId !== null && k.userId !== userId) {
        if (k.verifiedAt !== null) {
          console.warn(`Battle.net-karakter ${acc.blizzardId} er allerede verificeret på bruger ${k.userId}; flyttes ikke til ${userId}`);
          continue;
        }
        console.warn(`Battle.net-karakter ${acc.blizzardId} var tilføjet som fritekst af bruger ${k.userId}; overtages af kontoens ejer ${userId}`);
        await unlinkCharacter(db, k.id, now);
      }
      const guild = roster ? { inGuild: rankOf.has(acc.blizzardId), guildRank: rankOf.get(acc.blizzardId) ?? null } : {};
      await db
        .update(characters)
        .set({ userId, verifiedAt: now, ...guild })
        // Kun hvis ingen anden har fået den i mellemtiden.
        .where(and(eq(characters.id, k.id), sql`(${characters.userId} is null or ${characters.userId} = ${userId})`));
    } catch (e) {
      console.warn(`Battle.net-karakter ${acc.blizzardId} (${acc.slug}) kunne ikke synkroniseres; springes over`, reason(e));
    }
  }

  // Aktiv karakter kun, hvis brugeren ingen har: en verificeret guild-karakter først, ellers en anden verificeret.
  const [pick] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(and(eq(characters.userId, userId), isNotNull(characters.verifiedAt)))
    .orderBy(sql`${characters.inGuild} desc`, asc(characters.name), asc(characters.surname), asc(characters.id))
    .limit(1);
  if (pick) {
    await db.update(users).set({ activeCharacterId: pick.id }).where(and(eq(users.id, userId), isNull(users.activeCharacterId)));
  }
}
