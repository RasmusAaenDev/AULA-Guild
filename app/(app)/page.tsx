import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { characters, users } from '@/lib/db/schema';
import { NextEvents } from '@/components/NextEvents';
import { roleLabel } from '@/lib/messages';
import { countUnread, listPosts } from '@/lib/posts';
import { excerptText, formatRelative, parsePage, parseTab, tabLabels } from '@/lib/posts-ui';
import type { PostTab } from '@/lib/posts';
import { requireMember } from '@/lib/session';

const TAB_ORDER: PostTab[] = ['alle', 'ulaeste', 'vigtige'];
const EMPTY: Record<PostTab, string> = {
  alle: 'Der er ingen opslag endnu. Skriv det første.',
  ulaeste: 'Du har læst alle opslag.',
  vigtige: 'Der er ingen fastgjorte opslag.',
  egne: 'Du har ikke skrevet nogen opslag endnu.',
  gemte: 'Du har ikke gemt nogen opslag.',
};

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ fane?: string | string[]; side?: string | string[] }>;
}) {
  const member = await requireMember();
  const sp = await searchParams;
  const tab = parseTab(sp.fane);
  const page = parsePage(sp.side);
  const db = getDb();
  const now = new Date();
  const [{ items, hasMore }, unreadCount] = await Promise.all([
    listPosts(db, member.userId, tab, page),
    countUnread(db, member.userId),
  ]);
  const [row] = await db
    .select({ name: characters.name, className: characters.className, spec: characters.spec, role: characters.role, itemLevel: characters.itemLevel })
    .from(users)
    .innerJoin(characters, and(eq(characters.id, users.activeCharacterId), eq(characters.userId, users.id)))
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
      <NextEvents userId={member.userId} hasCharacter={Boolean(row)} />
      <div className="section-head">
        <h2>Opslag</h2>
        <Link href="/opslag/ny" className="btn">Nyt opslag</Link>
      </div>
      <nav className="tabs" aria-label="Opslagsfaner">
        {TAB_ORDER.map((t) => (
          <Link key={t} href={`/?fane=${t}`} className="tab" aria-current={t === tab ? 'page' : undefined}>
            {tabLabels[t]}
            {t === 'ulaeste' && unreadCount > 0 ? ` (${unreadCount})` : ''}
          </Link>
        ))}
      </nav>
      {items.length === 0 && (
        <section className="card">
          <p className="muted">{page > 1 ? 'Der er ikke flere opslag.' : EMPTY[tab]}</p>
        </section>
      )}
      {items.map((p) => (
        <Link key={p.id} href={`/opslag/${p.id}`} className={p.unread ? 'card post-card unread' : 'card post-card'}>
          <p className="muted">
            {p.pinned && <span className="badge">Fastgjort</span>}
            {p.unread && <> <span className="badge new">Ny</span></>} {p.authorName} · {formatRelative(p.createdAt, now)}
          </p>
          <h3>{p.title}</h3>
          <p className="excerpt">{excerptText(p.excerpt)}</p>
          <p className="muted">
            {p.commentCount === 1 ? '1 kommentar' : `${p.commentCount} kommentarer`}
          </p>
        </Link>
      ))}
      {(page > 1 || hasMore) && (
        <nav className="actions" aria-label="Sider med opslag">
          {page > 1 && (
            <Link href={page === 2 ? `/?fane=${tab}` : `/?fane=${tab}&side=${page - 1}`} className="btn secondary">Nyere opslag</Link>
          )}
          {hasMore && <Link href={`/?fane=${tab}&side=${page + 1}`} className="btn secondary">Ældre opslag</Link>}
          <span className="muted">Side {page}</span>
        </nav>
      )}
    </>
  );
}
