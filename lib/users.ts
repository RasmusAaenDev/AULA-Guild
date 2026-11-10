import type { Db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export async function upsertUser(
  db: Db,
  u: { discordId: string; name: string; avatar: string | null },
): Promise<number> {
  const [row] = await db
    .insert(users)
    .values(u)
    .onConflictDoUpdate({ target: users.discordId, set: { name: u.name, avatar: u.avatar } })
    .returning({ id: users.id });
  return row.id;
}
