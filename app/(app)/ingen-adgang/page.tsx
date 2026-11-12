import { GuestAccess } from '@/components/GuestAccess';
import { listMyCharacters } from '@/lib/characters';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Gæstesiden: hertil sendes gæster fra lukkede områder (requireGuildMember) og låste menupunkter. */
export default async function NoAccessPage() {
  const member = await requireUser();
  const characters = await listMyCharacters(getDb(), member.userId);
  return <GuestAccess viewer={member} characters={characters} />;
}
