import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { characters, users } from '@/lib/db/schema';
import { roleLabel } from '@/lib/messages';
import { requireMember } from '@/lib/session';

export default async function OverviewPage() {
  const member = await requireMember();
  const db = getDb();
  const [row] = await db
    .select({ name: characters.name, className: characters.className, spec: characters.spec, role: characters.role, itemLevel: characters.itemLevel })
    .from(users)
    .innerJoin(characters, eq(characters.id, users.activeCharacterId))
    .where(eq(users.id, member.userId));

  return (
    <>
      <h1>Velkommen, {member.name}</h1>
      <section className="card">
        <h2>Din aktive karakter</h2>
        {row ? (
          <p>
            <strong>{row.name}</strong> · {row.className}
            {row.spec ? ` (${row.spec})` : ''} · {roleLabel(row.role)}
            {row.itemLevel != null ? ` · item level ${row.itemLevel}` : ''}
          </p>
        ) : (
          <p>
            Du har ingen karakter endnu. <Link href="/karakter/ny">Tilføj din første karakter</Link>.
          </p>
        )}
      </section>
      <section className="card">
        <p className="muted">Opslag og næste raid kommer snart.</p>
      </section>
    </>
  );
}
