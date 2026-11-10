import { eq } from 'drizzle-orm';
import { Shell } from '@/components/Shell';
import { listMyCharacters } from '@/lib/characters';
import { countUnansweredUpcoming } from '@/lib/events';
import { countUnread } from '@/lib/posts';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { isSimConfigured } from '@/lib/services';
import { requireMember } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const db = getDb();
  const [characters, [user], unread, unanswered] = await Promise.all([
    listMyCharacters(db, member.userId),
    db.select({ active: users.activeCharacterId }).from(users).where(eq(users.id, member.userId)),
    countUnread(db, member.userId),
    countUnansweredUpcoming(db, member.userId),
  ]);
  return (
    <Shell member={member} characters={characters} activeId={user?.active ?? null} unreadPosts={unread} unansweredEvents={unanswered} simEnabled={isSimConfigured()}>
      {children}
    </Shell>
  );
}
