'use client';

import Link from 'next/link';
import { Fragment, startTransition, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { loadPostsAction } from '@/app/(app)/feed-actions';
import { FEED_STEP, offsetChunks, uniqueById } from '@/lib/post-feed-ui';

type Loaded = { id: number; node: ReactNode };
type Feed = {
  loaded: Loaded[];
  /** Antal opslag i fanens liste, der er forbrugt (vist eller sorteret fra som dublet). */
  offset: number;
  more: boolean;
  status: 'idle' | 'loading' | 'error';
  /** Antal nye kort fra seneste tryk; læses op af statusfeltet. */
  added: number | null;
};

const noopSubscribe = () => () => {};
/** false under server-rendering og hydrering, true bagefter: uden JavaScript bliver sidelinkene stående. */
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

/** Højst så mange kald pr. tryk, hvis svarene kun indeholder dubletter (nye opslag har forskudt listen). */
const MAX_ATTEMPTS = 3;

/**
 * Bunden af opslagslisten i Overblik. Uden JavaScript: de gamle «Nyere/Ældre opslag»-links. Med JavaScript: knappen
 * «Vis flere beskeder», der henter FEED_STEP opslag ad gangen og tilføjer kortene nedenunder. Fokus bliver på knappen,
 * og statusfeltet fortæller, hvor mange der kom. Revalideres siden (fx efter gem eller slet), hentes de viste
 * opslag igen, så kortene er friske.
 */
export function PostFeedMore({
  tab, page, hasMore, startOffset, initialIds, renderedAt,
}: {
  tab: string;
  page: number;
  hasMore: boolean;
  /** Antal opslag før og på den viste side, dvs. hvor næste hentning starter. */
  startOffset: number;
  /** Id'er på opslag, siden selv har vist; de springes over (dubletter, hvis nye opslag har forskudt listen). */
  initialIds: number[];
  /** Ændrer sig ved hver server-rendering af siden. */
  renderedAt: number;
}) {
  const hydrated = useHydrated();
  const [feed, setFeed] = useState<Feed>({ loaded: [], offset: startOffset, more: hasMore, status: 'idle', added: null });
  const feedRef = useRef(feed);
  useEffect(() => {
    feedRef.current = feed;
  });
  const busy = useRef(false);
  const generation = useRef(0);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const focusStatus = useRef(false);
  const initialKey = initialIds.join(',');
  const initialSet = useMemo(() => new Set(initialKey ? initialKey.split(',').map(Number) : []), [initialKey]);
  const visible = feed.loaded.filter((p) => !initialSet.has(p.id));

  function loadMore() {
    const start = feedRef.current;
    if (busy.current || !start.more) return;
    busy.current = true;
    const gen = generation.current;
    setFeed((f) => ({ ...f, status: 'loading', added: null }));
    startTransition(async () => {
      try {
        const known = [...initialSet, ...start.loaded.map((p) => p.id)];
        const fresh: Loaded[] = [];
        let offset = start.offset;
        let more: boolean = start.more;
        for (let attempt = 0; attempt < MAX_ATTEMPTS && more && fresh.length < FEED_STEP; attempt++) {
          const r = await loadPostsAction(tab, offset, FEED_STEP - fresh.length);
          if (!r.ok) throw new Error('invalid');
          fresh.push(...uniqueById(r.posts, [...known, ...fresh.map((p) => p.id)]));
          offset = r.nextOffset;
          more = r.hasMore;
        }
        if (gen !== generation.current) return;
        // Forsvinder knappen, flyttes fokus til slutmeldingen, så tastaturfokus ikke tabes.
        if (!more) focusStatus.current = true;
        setFeed((f) => ({ loaded: [...f.loaded, ...fresh], offset, more, status: 'idle', added: fresh.length }));
      } catch {
        if (gen === generation.current) setFeed((f) => ({ ...f, status: 'error' }));
      } finally {
        if (gen === generation.current) busy.current = false;
      }
    });
  }

  // Efter en revalidering (gem, slet, nyt opslag …) hentes de viste opslag igen; de gamle kort bliver stående til svaret er her.
  const seenRenderedAt = useRef(renderedAt);
  useEffect(() => {
    if (seenRenderedAt.current === renderedAt) return;
    seenRenderedAt.current = renderedAt;
    const end = feedRef.current.offset;
    if (end <= startOffset) return;
    const gen = ++generation.current;
    busy.current = true;
    startTransition(async () => {
      try {
        const posts: Loaded[] = [];
        let more = false;
        let offset = startOffset;
        for (const [o, limit] of offsetChunks(startOffset, end)) {
          const r = await loadPostsAction(tab, o, limit);
          if (!r.ok) throw new Error('invalid');
          posts.push(...r.posts);
          more = r.hasMore;
          offset = r.nextOffset;
          if (!r.hasMore) break;
        }
        if (gen !== generation.current) return;
        setFeed({ loaded: uniqueById(posts), offset, more, status: 'idle', added: null });
      } catch {
        // Behold de viste kort; næste tryk fortsætter derfra.
        if (gen === generation.current) setFeed((f) => ({ ...f, status: 'idle' }));
      } finally {
        if (gen === generation.current) busy.current = false;
      }
    });
  }, [renderedAt, startOffset, tab]);

  useEffect(() => {
    if (!focusStatus.current) return;
    focusStatus.current = false;
    statusRef.current?.focus();
  }, [feed.more]);

  const newer =
    page > 1 ? (
      <Link href={page === 2 ? `/?fane=${tab}` : `/?fane=${tab}&side=${page - 1}`} className="btn secondary">Nyere opslag</Link>
    ) : null;

  if (!hydrated) {
    if (page <= 1 && !hasMore) return null;
    return (
      <nav className="actions" aria-label="Sider med opslag">
        {newer}
        {hasMore && <Link href={`/?fane=${tab}&side=${page + 1}`} className="btn secondary">Ældre opslag</Link>}
        <span className="muted">Side {page}</span>
      </nav>
    );
  }

  const hasCards = initialIds.length > 0 || visible.length > 0;
  const added = feed.added === null || !feed.more ? '' : feed.added === 1 ? 'Viser 1 besked mere.' : `Viser ${feed.added} beskeder mere.`;
  const statusText = feed.status === 'loading' ? 'Henter flere beskeder …' : !feed.more && hasCards ? 'Der er ikke flere beskeder.' : '';
  const showButton = feed.more && feed.status !== 'error';
  return (
    <div className="feed-more">
      {visible.map((p) => <Fragment key={p.id}>{p.node}</Fragment>)}
      <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className="muted feed-status">
        {statusText}
        {added && <span className="sr-only">{added}</span>}
      </p>
      {feed.status === 'error' && (
        <div className="feed-error">
          <p className="error" role="alert">Kunne ikke hente flere beskeder.</p>
          <button type="button" className="btn secondary" onClick={loadMore}>Prøv igen</button>
        </div>
      )}
      {(newer || showButton) && (
        <nav className="actions" aria-label="Flere opslag">
          {showButton && (
            <button type="button" className="btn secondary" aria-disabled={feed.status === 'loading'} onClick={loadMore}>
              Vis flere beskeder
            </button>
          )}
          {newer}
        </nav>
      )}
    </div>
  );
}
