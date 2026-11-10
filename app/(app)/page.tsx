import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { BookmarkButton } from '@/app/(app)/opslag/BookmarkButton';
import { CreateMenu } from '@/components/CreateMenu';
import { Icon } from '@/components/icons';
import { RsvpButtons } from '@/components/RsvpButtons';
import { UnansweredBanner } from '@/components/UnansweredBanner';
import { eventTypeLabel, formatDayMonth, formatTimeRange, rsvpLabel, selectNextEvents } from '@/lib/calendar-ui';
import { getDb } from '@/lib/db';
import { characters, users } from '@/lib/db/schema';
import { countUnansweredUpcoming, listUpcomingEvents } from '@/lib/events';
import { roleLabel } from '@/lib/messages';
import { countUnread, listPosts } from '@/lib/posts';
import type { PostTab } from '@/lib/posts';
import { excerptText, formatAbsolute, formatRelativeDay, parsePage, parseTab, tabLabels } from '@/lib/posts-ui';
import { statusClass } from '@/lib/rsvp-ui';
import { requireMember } from '@/lib/session';

const TAB_ORDER: PostTab[] = ['alle', 'ulaeste', 'vigtige', 'egne', 'gemte'];
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
  const [{ items, hasMore }, unreadCount, unanswered, upcoming] = await Promise.all([
    listPosts(db, member.userId, tab, page),
    countUnread(db, member.userId),
    countUnansweredUpcoming(db, member.userId, now),
    listUpcomingEvents(db, member.userId, now, { limit: 100 }),
  ]);
  // Hurtig tilmelding til næste raid og næste aften; de er altid med i udvalget.
  const { shown: nextEvents, rsvpIds } = selectNextEvents(upcoming, now);
  const [row] = await db
    .select({ name: characters.name, className: characters.className, spec: characters.spec, role: characters.role, itemLevel: characters.itemLevel })
    .from(users)
    .innerJoin(characters, and(eq(characters.id, users.activeCharacterId), eq(characters.userId, users.id)))
    .where(eq(users.id, member.userId));

  return (
    <>
      <UnansweredBanner count={unanswered} />
      <div className="section-head">
        <h1>Overblik</h1>
        <CreateMenu />
      </div>
      <div className="overview-grid">
        <div className="overview-main">
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
            <article key={p.id} className={p.unread ? 'card post-card unread' : 'card post-card'}>
              {(p.pinned || p.unread) && (
                <p className="post-badges">
                  {p.pinned && <span className="badge">Vigtig</span>}
                  {p.unread && <span className="badge new">Ny</span>}
                </p>
              )}
              <div className="post-head">
                <p className="post-meta">
                  <strong>{p.authorCharacter ? `${p.authorName} (${p.authorCharacter})` : p.authorName}</strong>
                  <span className="muted">Delt med hele guilden</span>
                  <time className="muted" dateTime={p.createdAt.toISOString()} title={formatAbsolute(p.createdAt)}>
                    {formatRelativeDay(p.createdAt, now)}
                  </time>
                </p>
                <BookmarkButton postId={p.id} bookmarked={p.bookmarked} />
              </div>
              <h3><Link href={`/opslag/${p.id}`}>{p.title}</Link></h3>
              <p className="excerpt">{excerptText(p.excerpt)}</p>
              <p className="muted">{p.commentCount === 1 ? '1 kommentar' : `${p.commentCount} kommentarer`}</p>
            </article>
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
        </div>
        <aside className="overview-aside" aria-label="Næste begivenheder og karakterer">
          <section className="card">
            <h2>Næste begivenheder</h2>
            {nextEvents.length === 0 ? (
              <p className="muted">Ingen kommende begivenheder.</p>
            ) : (
              <ul className="date-list">
                {nextEvents.map((e) => {
                  const dm = formatDayMonth(e.startsAt);
                  return (
                    <li key={e.id} className={`date-row ${statusClass(e.myStatus)}`}>
                      <div className="date-block" aria-hidden="true">
                        <span className="date-day">{dm.day}</span>
                        <span className="date-month">{dm.month}</span>
                      </div>
                      <div>
                        <Link href={`/kalender/${e.id}`}><strong>{e.title}</strong></Link>
                        <div className="muted">{eventTypeLabel(e.type)} · {formatTimeRange(e.startsAt, e.durationMinutes)}</div>
                        <div className="date-status">
                          <Icon name={e.myStatus ?? 'udraab'} size={16} />
                          {e.myStatus ? rsvpLabel(e.myStatus) : 'Ikke svaret'}
                        </div>
                        {rsvpIds.has(e.id) &&
                          (row ? (
                            <div className="rsvp-compact">
                              <RsvpButtons eventId={e.id} current={e.myStatus} />
                            </div>
                          ) : (
                            <p><Link href="/karakter/ny">Tilføj karakter</Link> for at tilmelde dig.</p>
                          ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="card">
            <h2>Dine karakterer</h2>
            {row ? (
              <p>
                <strong>{row.name}</strong> · {row.className}
                {row.spec ? ` (${row.spec})` : ''}
                <br />
                <span className="muted">
                  {roleLabel(row.role)}
                  {row.itemLevel != null ? ` · item level ${row.itemLevel}` : ''}
                </span>
              </p>
            ) : (
              <p>
                Du har ingen karakter endnu. <Link href="/karakter/ny">Tilføj din første karakter</Link>.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
