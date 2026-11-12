'use client';

import { useLayoutEffect, useRef } from 'react';

const NEAR_BOTTOM_PX = 24;

/**
 * «Log fra SimulationCraft». Åben mens jobbet venter/kører, lukket når det er færdigt (men tilgængelig).
 * Teksten vises som ren tekst i <pre> (aldrig HTML). Mens jobbet kører, ruller visningen til bunden,
 * medmindre brugeren selv har rullet op.
 */
export function SimLog({ text, active }: { text: string | null; active: boolean }) {
  const pre = useRef<HTMLPreElement>(null);
  const stick = useRef(true);
  const toBottom = () => {
    const el = pre.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  useLayoutEffect(() => {
    if (active && stick.current) toBottom();
  }, [text, active]);
  if (!active && !text) return null;
  return (
    <details className="sim-log" open={active} onToggle={(e) => { if (e.currentTarget.open && active && stick.current) toBottom(); }}>
      <summary>
        <span className="sim-log-caret" aria-hidden="true">▸</span>
        Log fra SimulationCraft
      </summary>
      <pre
        ref={pre}
        className="sim-log-text"
        tabIndex={0}
        aria-label="Log fra SimulationCraft"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
        }}
      >
        {text || 'Venter på output …'}
      </pre>
    </details>
  );
}
