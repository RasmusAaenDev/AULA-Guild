import { eq } from 'drizzle-orm';
import { Shell } from '@/components/Shell';
import { listMyCharacters } from '@/lib/characters';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { requireMember } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const db = getDb();
  const [characters, [user]] = await Promise.all([
    listMyCharacters(db, member.userId),
    db.select({ active: users.activeCharacterId }).from(users).where(eq(users.id, member.userId)),
  ]);
  return (
    <Shell member={member} characters={characters} activeId={user?.active ?? null}>
      {children}
    </Shell>
  );
}
