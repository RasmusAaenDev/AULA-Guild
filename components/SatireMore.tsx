'use client';

import { Fragment, startTransition, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { loadRandomSatireAction } from '@/app/(app)/satire-feed-actions';

type Loaded = { id: string; node: ReactNode };

const noopSubscribe = () => () => {};
/** false under server-rendering og hydrering, true bagefter: uden JavaScript er der ingen knap at trykke på. */
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

/**
 * Bunden af satire-listen i Overblik: knappen (`label`) henter fem tilfældige satire-opslag (med kommentarer) og
 * tilføjer dem nedenunder, ligesom «Vis flere beskeder». `shownIds` er de satire-opslag, siden selv har vist; de og alle allerede hentede
 * springes over, så intet opslag vises to gange. Knappen forsvinder, når hele samlingen er set. Fokus bliver på knappen, og statusfeltet
 * fortæller, hvor mange der kom.
 */
export function SatireMore({ shownIds, label }: { shownIds: string[]; label: string }) {
  const hydrated = useHydrated();
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [added, setAdded] = useState<number | null>(null);
  const [more, setMore] = useState(true);
  const busy = useRef(false);
  const statusRef = useRef<HTMLParagraphElement>(null);

  if (!hydrated) return null;

  function loadMore() {
    if (busy.current || !more) return;
    busy.current = true;
    setStatus('loading');
    setAdded(null);
    const known = [...shownIds, ...loaded.map((p) => p.id)];
    startTransition(async () => {
      try {
        const r = await loadRandomSatireAction(known);
        if (!r.ok) throw new Error('invalid');
        setLoaded((l) => [...l, ...r.posts]);
        setAdded(r.posts.length);
        setMore(r.remaining > 0 && r.posts.length > 0);
        if (r.remaining === 0 || r.posts.length === 0) setTimeout(() => statusRef.current?.focus(), 0);
        setStatus('idle');
      } catch {
        setStatus('error');
      } finally {
        busy.current = false;
      }
    });
  }

  const statusText = status === 'loading' ? 'Henter flere satire-opslag …' : !more ? 'Der er ikke flere satire-opslag.' : '';
  return (
    <div className="feed-more satire-feed-more">
      {loaded.map((p) => <Fragment key={p.id}>{p.node}</Fragment>)}
      <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className="muted feed-status">
        {statusText}
        {added !== null && more && <span className="sr-only">{added === 1 ? 'Viser 1 satire-opslag mere.' : `Viser ${added} satire-opslag mere.`}</span>}
      </p>
      {status === 'error' && (
        <div className="feed-error">
          <p className="error" role="alert">Kunne ikke hente flere satire-opslag.</p>
        </div>
      )}
      {more && (
        <nav className="actions" aria-label="Flere satire-opslag">
          <button type="button" className="btn secondary" aria-disabled={status === 'loading'} onClick={loadMore}>
            {status === 'error' ? 'Prøv igen' : label}
          </button>
        </nav>
      )}
    </div>
  );
}
