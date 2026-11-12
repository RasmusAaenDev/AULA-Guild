import type { BlizzardClient } from '@/lib/blizzard/types';
import type { Db } from '@/lib/db';

/** En karakter fra brugerens egen Battle.net-konto (kun WoW Forever EU). */
export type AccountCharacter = { blizzardId: number; name: string; slug: string; realmSlug: string };

/**
 * Knytter karaktererne fra brugerens Battle.net-konto til brugeren som verificerede.
 *
 * TODO(opgave 5): placeholder uden virkning. Skal for hver karakter oprette den (via addCharacter-vejen) hvis den er
 * ukendt, sætte userId og verifiedAt = now, opdatere inGuild/guildRank fra roster, og ikke flytte en karakter, der
 * allerede er verificeret på en anden bruger. Hentningen (fetchAccountCharacters i lib/blizzard/account.ts) kobles på
 * i authDeps i lib/services.ts.
 */
export async function syncAccountCharacters(
  _db: Db,
  _blizzard: BlizzardClient,
  _userId: number,
  _accountChars: AccountCharacter[],
): Promise<void> {}
