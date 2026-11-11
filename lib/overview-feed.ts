// Den samlede tidslinje i ALLE (side 1): ægte opslag, chatbeskeder og dateret satire i én liste, nyeste først. Ren logik.

export type TimelineEntry<R, C, S> =
  | { kind: 'real'; item: R; at: Date }
  | { kind: 'chat'; item: C; at: Date }
  | { kind: 'satire'; item: S; at: Date };

export const TIMELINE_FALLBACK_DAYS = 14;
export const TIMELINE_MIN_REAL = 3;

const RANK = { real: 0, chat: 1, satire: 2 } as const;

/**
 * Fletter siden af ægte opslag med chat og satire. Fastgjorte ægte opslag ligger øverst i den rækkefølge, de har fået; resten sorteres efter
 * tidspunkt (nyeste først; ved lighed ægte, chat, satire; ellers stabilt). Chat og satire får kun plads, hvis de er nyere end vinduets start:
 * det ældste ikke-fastgjorte ægte opslag på siden, eller nu − 14 dage, hvis siden har under 3 sådanne eller der ikke er en ældre side.
 */
export function mergeTimeline<R, C, S>(input: {
  real: ReadonlyArray<{ item: R; at: Date; pinned: boolean }>;
  chat: ReadonlyArray<{ item: C; at: Date }>;
  satire: ReadonlyArray<{ item: S; at: Date }>;
  hasOlder: boolean;
  now: Date;
}): Array<TimelineEntry<R, C, S>> {
  const pinned: Array<TimelineEntry<R, C, S>> = [];
  const rest: Array<TimelineEntry<R, C, S>> = [];
  let oldest = Infinity;
  let unpinned = 0;
  for (const r of input.real) {
    if (r.pinned) {
      pinned.push({ kind: 'real', item: r.item, at: r.at });
    } else {
      rest.push({ kind: 'real', item: r.item, at: r.at });
      unpinned++;
      oldest = Math.min(oldest, r.at.getTime());
    }
  }
  const fallback = input.now.getTime() - TIMELINE_FALLBACK_DAYS * 86_400_000;
  const since = unpinned < TIMELINE_MIN_REAL || !input.hasOlder ? fallback : oldest;
  for (const c of input.chat) if (c.at.getTime() > since) rest.push({ kind: 'chat', item: c.item, at: c.at });
  for (const s of input.satire) if (s.at.getTime() > since) rest.push({ kind: 'satire', item: s.item, at: s.at });
  const indexed = rest.map((e, i) => ({ e, i }));
  indexed.sort((a, b) => b.e.at.getTime() - a.e.at.getTime() || RANK[a.e.kind] - RANK[b.e.kind] || a.i - b.i);
  return [...pinned, ...indexed.map((x) => x.e)];
}
