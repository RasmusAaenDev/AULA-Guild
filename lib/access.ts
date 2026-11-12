import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { characters } from '@/lib/db/schema';

export type Access = { isGuildMember: boolean; isOfficer: boolean };

/**
 * Medlem: brugeren har en verificeret karakter i guilden. Officer: en af dem har guild-rang <= officerMaxRank.
 * Afledes kun af databasen (ingen eksterne kald), så det kan genberegnes ved hver revalidering af sessionen.
 */
export async function deriveAccess(db: Db, userId: number, opts: { officerMaxRank: number }): Promise<Access> {
  const [row] = await db
    .select({
      n: sql<number>`count(*)::int`,
      minRank: sql<number | null>`min(${characters.guildRank})`,
    })
    .from(characters)
    .where(and(eq(characters.userId, userId), isNotNull(characters.verifiedAt), eq(characters.inGuild, true)));
  const isGuildMember = (row?.n ?? 0) > 0;
  const minRank = row?.minRank ?? null;
  return { isGuildMember, isOfficer: isGuildMember && minRank !== null && minRank <= opts.officerMaxRank };
}
