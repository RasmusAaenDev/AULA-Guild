'use client';

import { Fragment, startTransition, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { loadRandomSatireAction } from '@/app/(app)/satire-feed-actions';
import { Icon } from '@/components/icons';

type Loaded = { id: string; node: ReactNode };

const noopSubscribe = () => () => {};
/** false under server-rendering og hydrering, true bagefter: uden JavaScript er der ingen knap at trykke på. */
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

/**
 * Bunden af satire-listen i Overblik: knappen (`label`) henter `step` tilfældige satire-opslag (med kommentarer) og
 * tilføjer dem nedenunder, ligesom «Vis flere beskeder». `shownIds` er de satire-opslag, siden selv har vist; de og alle allerede hentede
 * springes over, så intet opslag vises to gange. Knappen forsvinder, når hele samlingen (`total`) er set. Fokus bliver på knappen, og
 * statusfeltet fortæller, hvor mange der kom.
 *
 * Knappen er bevidst klædt som et satire-kort (gul baggrund, stiplet kant, klovn), så den ikke forveksles med «Vis flere beskeder»
 * til ægte opslag. Under hentning viser knappen en snurrer og et skeletkort, og til sidst står en slutbesked i samme stil.
 */
export function SatireMore({ shownIds, label, total, step }: { shownIds: string[]; label: string; total: number; step: number }) {
  const hydrated = useHydrated();
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [added, setAdded] = useState<number | null>(null);
  const [more, setMore] = useState(true);
  /** Antal ikke-viste opslag ifølge serveren; null indtil første svar (så regnes det ud fra `total`). */
  const [remaining, setRemaining] = useState<number | null>(null);
  const busy = useRef(false);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const hintId = useId();

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
        setRemaining(r.remaining);
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

  const loading = status === 'loading';
  const seen = Math.min(total, remaining === null ? new Set(shownIds).size + loaded.length : total - remaining);
  const next = Math.max(1, Math.min(step, total - seen));
  const statusText = loading ? 'Henter flere satire-opslag …' : !more ? 'Der er ikke flere satire-opslag.' : '';
  const hint = loading
    ? `${seen} af ${total} set`
    : status === 'error'
      ? 'Forbindelsen svigtede, prøv igen'
      : `+${next} ${next === 1 ? 'tilfældigt' : 'tilfældige'} · ${seen} af ${total} set`;
  return (
    <div className="feed-more satire-feed-more">
      {loaded.map((p) => <Fragment key={p.id}>{p.node}</Fragment>)}
      {loading && (
        <div className="card satire-card satire-skeleton" aria-hidden="true">
          <span className="satire-skeleton-bar is-head" />
          <span className="satire-skeleton-bar" />
          <span className="satire-skeleton-bar is-short" />
        </div>
      )}
      <p
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className={`muted feed-status${!more ? ' satire-feed-end' : ''}${loading ? ' sr-only' : ''}`}
      >
        {!more && <span className="satire-feed-end-icon"><Icon name="klovn" size={28} /></span>}
        {statusText && (
          <span className="satire-feed-end-text">
            {statusText}
            {!more && <span className="satire-feed-end-sub">Du har set alle {total} i samlingen.</span>}
          </span>
        )}
        {added !== null && more && <span className="sr-only">{added === 1 ? 'Viser 1 satire-opslag mere.' : `Viser ${added} satire-opslag mere.`}</span>}
      </p>
      {status === 'error' && (
        <div className="feed-error">
          <p className="error" role="alert">Kunne ikke hente flere satire-opslag.</p>
        </div>
      )}
      {more && (
        <nav className="satire-more-nav" aria-label="Flere satire-opslag">
          <button
            type="button"
            className="satire-more-btn"
            aria-disabled={loading}
            aria-describedby={hintId}
            data-state={status}
            onClick={loadMore}
          >
            <span className="satire-more-icon" aria-hidden="true">
              {loading ? <span className="sim-spinner satire-more-spinner" /> : <Icon name="klovn" size={26} />}
            </span>
            <span className="satire-more-text">
              {/* Under hentning står «Henter …» synligt, men knappens navn er det samme, så skærmlæseren ikke læser knappen op igen. */}
              <span className="satire-more-label" aria-hidden={loading || undefined}>
                {loading ? 'Henter …' : status === 'error' ? 'Prøv igen' : label}
              </span>
              {loading && <span className="sr-only">{label}</span>}
              <span id={hintId} className="satire-more-hint" aria-hidden="true">{hint}</span>
            </span>
          </button>
        </nav>
      )}
    </div>
  );
}
