import { GuildStar } from '@/components/GuildStar';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { and, count, desc, eq, isNotNull } from 'drizzle-orm';
import { deletePostAction } from '@/app/(app)/opslag/actions';
import { BookmarkButton } from '@/app/(app)/opslag/BookmarkButton';
import { ChatItemCard } from '@/components/ChatItemCard';
import { GalleryItemCard } from '@/components/GalleryItemCard';
import { SatireCard } from '@/components/SatireCard';
import { setSatirePreferenceAction } from '@/app/(app)/satire-actions';
import { ConfirmForm } from '@/components/ConfirmForm';
import { armoryUrl } from '@/lib/armory';
import { FirstCharacterCard } from '@/components/FirstCharacterCard';
import { QuickSim } from '@/components/QuickSim';
import { CreateMenu } from '@/components/CreateMenu';
import { Icon } from '@/components/icons';
import { RsvpButtons } from '@/components/RsvpButtons';
import { UnansweredBanner } from '@/components/UnansweredBanner';
import { eventTypeLabel, formatDayHeading, formatDayMonth, formatTimeRange, pinnedEvent, rsvpLabel, selectNextEvents } from '@/lib/calendar-ui';
import { getDb } from '@/lib/db';
import { characters, highlights, users } from '@/lib/db/schema';
import { countUnansweredUpcoming, listUpcomingEvents } from '@/lib/events';
import { roleLabel } from '@/lib/messages';
import { fullName } from '@/lib/names';
import { countUnread, listPosts } from '@/lib/posts';
import type { PostTab } from '@/lib/posts';
import type { OverviewTab } from '@/lib/posts-ui';
import { authorLabel, excerptText, formatAbsolute, formatRelativeDay, parsePage, parseTab, tabLabels } from '@/lib/posts-ui';
import { statusClass } from '@/lib/rsvp-ui';
import { recentChatItems } from '@/lib/overview-chat';
import { recentGalleryItems } from '@/lib/overview-gallery';
import { mergeTimeline } from '@/lib/overview-feed';
import { SATIRE_COOKIE, datedSatire, effectiveTab, newestFirst, parseSatirePreference, satireMode } from '@/lib/satire';
import { todayInCopenhagen } from '@/lib/time';
import { getChat, isChatConfigured, isSimConfigured } from '@/lib/services';
import { requireMember } from '@/lib/session';

const TAB_ORDER: OverviewTab[] = ['alle', 'ulaeste', 'vigtige', 'egne', 'gemte', 'satire'];
const EMPTY: Record<OverviewTab, string> = {
  satire: 'Der er ingen satire-opslag.',
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
  const satireOn = parseSatirePreference((await cookies()).get(SATIRE_COOKIE)?.value);
  const tab = effectiveTab(parseTab(sp.fane), satireOn);
  const mode = satireMode(tab, satireOn);
  const page = mode === 'all' ? 1 : parsePage(sp.side);
  const timeline = tab === 'alle' && page === 1;
  const db = getDb();
  const now = new Date();
  const dateKey = todayInCopenhagen(now);
  const [{ items, hasMore }, unreadCount, unanswered, upcoming, chatItems, galleryItems] = await Promise.all([
    tab === 'satire' ? Promise.resolve({ items: [], hasMore: false }) : listPosts(db, member.userId, tab, page),
    countUnread(db, member.userId),
    countUnansweredUpcoming(db, member.userId, now),
    listUpcomingEvents(db, member.userId, now, { limit: 100 }),
    timeline ? recentChatItems({ chat: isChatConfigured() ? getChat() : null, db }, now).catch(() => []) : Promise.resolve([]),
    timeline ? recentGalleryItems({ db }, now).catch(() => []) : Promise.resolve([]),
  ]);
  // Hurtig tilmelding til næste raid og næste aften; de er altid med i udvalget.
  const { shown: nextEvents, rsvpIds } = selectNextEvents(upcoming, now);
  const pinned = pinnedEvent(upcoming, now);
  const [{ n: characterCount }] = await db.select({ n: count() }).from(characters).where(eq(characters.userId, member.userId));
  const [row] = await db
    .select({ id: characters.id, name: characters.name, surname: characters.surname, slug: characters.slug, className: characters.className, spec: characters.spec, role: characters.role, level: characters.level, itemLevel: characters.itemLevel, inGuild: characters.inGuild })
    .from(users)
    .innerJoin(characters, and(eq(characters.id, users.activeCharacterId), eq(characters.userId, users.id)))
    .where(eq(users.id, member.userId));

  const recentHighlights = await db
    .select({ id: highlights.id, title: highlights.title, occurredAt: highlights.occurredAt })
    .from(highlights)
    .innerJoin(characters, eq(characters.id, highlights.characterId))
    .where(and(eq(characters.inGuild, true), isNotNull(characters.userId)))
    .orderBy(desc(highlights.occurredAt), desc(highlights.id))
    .limit(8);

  type Entry =
    | { kind: 'real'; item: (typeof items)[number] }
    | { kind: 'chat'; item: (typeof chatItems)[number] }
    | { kind: 'gallery'; item: (typeof galleryItems)[number] }
    | { kind: 'satire'; item: ReturnType<typeof datedSatire>[number] };
  const feed: Entry[] =
    mode === 'all'
      ? newestFirst(datedSatire(dateKey, now)).map((item) => ({ kind: 'satire' as const, item }))
      : timeline
        ? mergeTimeline({
            real: items.map((item) => ({ item, at: item.createdAt, pinned: item.pinned })),
            chat: chatItems.map((item) => ({ item, at: item.at })),
            gallery: galleryItems.map((item) => ({ item, at: item.at })),
            satire: mode === 'timeline' ? datedSatire(dateKey, now).map((item) => ({ item, at: item.at })) : [],
            hasOlder: hasMore,
            now,
          })
        : items.map((item) => ({ kind: 'real' as const, item }));

  return (
    <>
      {characterCount === 0 && <FirstCharacterCard />}
      <UnansweredBanner count={unanswered} />
      <div className="section-head">
        <h1>Overblik</h1>
        <CreateMenu />
      </div>
      <div className="overview-grid">
        <div className="overview-main">
          {pinned && (
            <section className="card pinned-event" aria-label="Næste begivenhed, fastsat øverst">
              <p className="pinned-label"><Icon name="kalender" size={16} /> Fastsat øverst · starter snart</p>
              <h2><Link href={`/kalender/${pinned.id}`}>{pinned.title}</Link></h2>
              <p>
                {eventTypeLabel(pinned.type)} · {formatDayHeading(pinned.startsAt)} · {formatTimeRange(pinned.startsAt, pinned.durationMinutes)}
              </p>
              <div className="date-status">
                <Icon name={pinned.myStatus ?? 'udraab'} size={16} />
                {pinned.myStatus ? rsvpLabel(pinned.myStatus) : 'Ikke svaret'}
              </div>
              {row ? (
                <div className="rsvp-compact">
                  <RsvpButtons eventId={pinned.id} current={pinned.myStatus} />
                </div>
              ) : (
                <p><Link href="/karakter/ny">Tilføj karakter</Link> for at tilmelde dig.</p>
              )}
            </section>
          )}
          <nav className="tabs" aria-label="Opslagsfaner">
            {TAB_ORDER.filter((t) => t !== 'satire' || satireOn).map((t) => (
              <Link key={t} href={`/?fane=${t}`} className="tab" aria-current={t === tab ? 'page' : undefined}>
                {tabLabels[t]}
                {t === 'ulaeste' && unreadCount > 0 ? ` (${unreadCount})` : ''}
              </Link>
            ))}
          </nav>
          <div className="satire-note">
            <form action={setSatirePreferenceAction} className="satire-toggle">
              <input type="hidden" name="satire" value={satireOn ? 'off' : 'on'} />
              <button type="submit" className="btn secondary">{satireOn ? 'Skjul satire' : 'Vis satire'}</button>
            </form>
          </div>
          {mode === 'all' && (
            <section className="card satire-explain">
              <h2>Satire</h2>
              <p>
                Her er alle de fiktive opslag samlet. De er opdigtede for sjov, efterligner genren fra skolebeskeder og
                handler ikke om rigtige personer. I Alle-fanen er de flettet ind mellem de ægte opslag efter dato.
                De tæller ikke som ulæste, kan ikke gemmes og kan ikke kommenteres. Du kan skjule dem med knappen ovenfor.
              </p>
            </section>
          )}
          {tab !== 'satire' && items.length === 0 && (
            <section className="card">
              <p className="muted">{page > 1 ? 'Der er ikke flere opslag.' : EMPTY[tab]}</p>
            </section>
          )}
          {feed.map((entry) => {
            if (entry.kind === 'satire') return <SatireCard key={`satire-${entry.item.id}`} post={entry.item} now={now} />;
            if (entry.kind === 'chat') return <ChatItemCard key={`chat-${entry.item.id}`} item={entry.item} now={now} />;
            if (entry.kind === 'gallery') return <GalleryItemCard key={`gallery-${entry.item.id}`} item={entry.item} now={now} />;
            const p = entry.item;
            return (
              <article key={p.id} className={p.unread ? 'card post-card unread' : 'card post-card'}>
                {(p.pinned || p.unread) && (
                  <p className="post-badges">
                    {p.pinned && <span className="badge">Vigtig</span>}
                    {p.unread && <span className="badge new">Ny</span>}
                  </p>
                )}
                <div className="post-head">
                  <p className="post-meta">
                    <strong>{authorLabel(p.authorName, p.authorCharacterFullName)}</strong>
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
                {(member.isOfficer || p.authorId === member.userId) && (
                  <div className="actions">
                    <ConfirmForm
                      action={deletePostAction}
                      fields={{ postId: p.id }}
                      label="Slet opslag"
                      confirmText="Slet opslaget og dets kommentarer? Det kan ikke fortrydes."
                    />
                  </div>
                )}
              </article>
            );
          })}
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
          <section className="card" aria-label="Highlights">
            <h2>Highlights</h2>
            {recentHighlights.length === 0 ? (
              <p className="muted">Ingen highlights endnu.</p>
            ) : (
              <ul className="date-list">
                {recentHighlights.map((h) => (
                  <li key={h.id} className="date-row">
                    <Icon name="udraab" size={16} />
                    <div>
                      <span>{h.title}</span>
                      <div className="muted">
                        <time dateTime={h.occurredAt.toISOString()} title={formatAbsolute(h.occurredAt)}>{formatRelativeDay(h.occurredAt, now)}</time>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <h2>Dine karakterer</h2>
            {row ? (
              <>
              <p>
                <strong>{armoryUrl(row.slug) ? <a href={armoryUrl(row.slug)!} target="_blank" rel="noopener noreferrer" title="Åbn i WoW-armory">{fullName(row)}</a> : fullName(row)}</strong>{row.inGuild && <GuildStar />} · {row.className}
                {row.spec ? ` (${row.spec})` : ''}
                <br />
                <span className="muted">
                  {roleLabel(row.role)}
                  {row.level != null ? ` · level ${row.level}` : ''}
                  {row.itemLevel != null ? ` · item level ${row.itemLevel}` : ''}
                </span>
              </p>
              {isSimConfigured() && <QuickSim characterId={row.id} />}
              </>
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
