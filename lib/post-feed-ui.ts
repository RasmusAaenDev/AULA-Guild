/** Ren logik til «Vis flere beskeder» i Overblik; ingen database, så klientkomponenten kan importere den. */

/** Antal opslag, ét tryk på «Vis flere beskeder» henter. */
export const FEED_STEP = 5;

/** Højst så mange opslag pr. kald (bruges når allerede viste opslag hentes igen efter en revalidering). */
export const MAX_FEED_LIMIT = 100;

/** Bevarer første forekomst af hvert id og springer id'er i `seen` over (listen kan forskyde sig, hvis der er kommet nye opslag imellem). */
export function uniqueById<T extends { id: number }>(items: readonly T[], seen: Iterable<number> = []): T[] {
  const ids = new Set(seen);
  const out: T[] = [];
  for (const item of items) {
    if (ids.has(item.id)) continue;
    ids.add(item.id);
    out.push(item);
  }
  return out;
}

/** Deler intervallet [start, end) op i [offset, limit]-bidder på højst `size`. */
export function offsetChunks(start: number, end: number, size: number = MAX_FEED_LIMIT): [number, number][] {
  const out: [number, number][] = [];
  for (let o = start; o < end; o += size) out.push([o, Math.min(size, end - o)]);
  return out;
}
