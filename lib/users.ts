import type { Db } from '@/lib/db';
import { users } from '@/lib/db/schema';

/** Visningsnavn ud fra et battletag: «Magi#1234» → «Magi». */
export function displayName(battletag: string): string {
  const t = battletag.trim();
  if (t === '') return 'Ukendt';
  const i = t.lastIndexOf('#');
  return i > 0 ? t.slice(0, i) : t;
}

/** Opretter eller opdaterer brugeren for en Battle.net-konto og returnerer brugerens id. */
export async function upsertUser(db: Db, u: { battlenetId: string; battletag: string }): Promise<number> {
  const name = displayName(u.battletag);
  const [row] = await db
    .insert(users)
    .values({ battlenetId: u.battlenetId, battletag: u.battletag, name })
    .onConflictDoUpdate({ target: users.battlenetId, set: { battletag: u.battletag, name } })
    .returning({ id: users.id });
  return row.id;
}
