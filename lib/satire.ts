import data from '@/lib/satire-posts.json';
import type { OverviewTab } from '@/lib/posts-ui';

/** Fiktive opslag (statisk indhold, ingen database). Alle personer er opdigtede. */
export type SatireComment = { author: string; body: string };
export type SatirePost = {
  id: string;
  title: string;
  body: string;
  author: string;
  important: boolean;
  tags: string[];
  comments: SatireComment[];
};

export const satirePosts: SatirePost[] = (data as Array<SatirePost & { inspiration?: string; sources?: string[] }>).map(
  ({ id, title, body, author, important, tags, comments }) => ({ id, title, body, author, important, tags, comments }),
);

export const SATIRE_COOKIE = 'aula_satire';
export const SATIRE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Cookie-værdi til om satire vises. Til som standard; kun «off» slår det fra. */
export function parseSatirePreference(value: string | undefined): boolean {
  return value !== 'off';
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Antal opslag i den aktive pulje. Puljen glider ét opslag frem pr. dag, så alle opslag roterer ind og ud i en evig løkke. */
export const SATIRE_VISIBLE = 40;

/** Dagnummer (UTC-midnat) for en `YYYY-MM-DD`-nøgle i dansk tid; ugyldig nøgle giver 0. */
export function dayNumber(dateKey: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : 0;
}

/** Dagens aktive pulje: SATIRE_VISIBLE opslag i rækkefølge fra position (dagnummer mod antal), med wrap-around. */
export function activeSatire(dateKey: string): SatirePost[] {
  const n = satirePosts.length;
  const size = Math.min(SATIRE_VISIBLE, n);
  const start = ((dayNumber(dateKey) % n) + n) % n;
  return Array.from({ length: size }, (_, k) => satirePosts[(start + k) % n]);
}

/** Deterministisk udvalg pr. dag (`YYYY-MM-DD`, dansk tid) og side; ingen dubletter; `count` afkortes til 0..puljens størrelse; vælger kun blandt dagens aktive pulje. */
export function pickSatire(dateKey: string, pageNumber: number, count: number): SatirePost[] {
  const pool = activeSatire(dateKey);
  const n = Math.max(0, Math.min(Math.floor(count) || 0, pool.length));
  const rand = mulberry32(hashSeed(`${dateKey}#${pageNumber}`));
  const idx = pool.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).map((i) => pool[i]);
}

export type FeedItem<T, S> = { kind: 'real'; item: T } | { kind: 'satire'; item: S };

/** Ét satire-element efter hvert `every`. ægte element; stopper når satire løber tør. */
export function interleave<T, S>(real: readonly T[], satire: readonly S[], every = 3): Array<FeedItem<T, S>> {
  const out: Array<FeedItem<T, S>> = [];
  let s = 0;
  real.forEach((item, i) => {
    out.push({ kind: 'real', item });
    if (every >= 1 && (i + 1) % every === 0 && s < satire.length) out.push({ kind: 'satire', item: satire[s++] });
  });
  return out;
}

/** Antal satire-kort en side med `realCount` ægte opslag har brug for (mindst ét på side 1). */
export function satireNeeded(realCount: number, page: number, every = 3): number {
  const n = Math.floor(realCount / every);
  return n > 0 ? n : realCount > 0 || page === 1 ? 1 : 0;
}

/**
 * Feedet i ALLE: satire flettes ind efter hvert 3. ægte opslag. Har siden færre end 3 ægte opslag, vises ét satire-opslag
 * til sidst, men kun på side 1 eller når siden har ægte opslag (en tom side 2 er «ikke flere opslag»).
 */
export function composeAlleFeed<T>(real: readonly T[], satire: readonly SatirePost[], page: number, every = 3): Array<FeedItem<T, SatirePost>> {
  const out = interleave(real, satire, every);
  if (satire.length > 0 && !out.some((x) => x.kind === 'satire') && (real.length > 0 || page === 1)) {
    out.push({ kind: 'satire', item: satire[0] });
  }
  return out;
}

export type SatireMode = 'none' | 'interleaved' | 'all';

/** Hvilke faner viser satire: kun ALLE (indflettet) og SATIRE (alle); aldrig når det er slået fra. */
export function satireMode(tab: OverviewTab, enabled: boolean): SatireMode {
  if (!enabled) return 'none';
  if (tab === 'alle') return 'interleaved';
  if (tab === 'satire') return 'all';
  return 'none';
}

/** Er satire slået fra, falder `?fane=satire` tilbage til ALLE. */
export function effectiveTab(tab: OverviewTab, enabled: boolean): OverviewTab {
  return tab === 'satire' && !enabled ? 'alle' : tab;
}
