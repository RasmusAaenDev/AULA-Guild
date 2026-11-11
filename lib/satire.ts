import data from '@/lib/satire-posts.json';
import type { OverviewTab } from '@/lib/posts-ui';
import { addDaysToDate, copenhagenToUtc } from '@/lib/time';

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

/** Antal opslag i den aktive pulje. Puljen glider ét opslag frem pr. dag, så alle opslag roterer ind og ud i en evig løkke. */
export const SATIRE_VISIBLE = 20;

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

export type DatedSatire = SatirePost & { at: Date };

const SLOT_MIN = 5;
const FIRST_MINUTE = 7 * 60 + 30;
const LAST_MINUTE = 21 * 60 + 30;

/** Deterministisk klokkeslæt (dansk tid, «HH:MM», 07:30–21:30 i 5-minutters trin) ud fra opslagets id. */
function clockFor(id: string): string {
  const slots = (LAST_MINUTE - FIRST_MINUTE) / SLOT_MIN + 1;
  const minutes = FIRST_MINUTE + (hashSeed(id) % slots) * SLOT_MIN;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * Dagens aktive pulje med tidspunkt: opslag k (0..size-1) er fra danske kalenderdag `dateKey − (size−1−k)`, altså ét pr. dag og det seneste
 * fra i dag. Klokkeslættet afhænger kun af id'et. Et tidspunkt i dag efter `now` flyttes til nu − 5 min (afrundet til hele minutter, men
 * ikke før dagens begyndelse), så intet opslag ligger i fremtiden. Rækkefølgen er puljens (ældste først).
 */
export function datedSatire(dateKey: string, now: Date): DatedSatire[] {
  const pool = activeSatire(dateKey);
  const nowMinute = Math.floor(now.getTime() / 60_000) * 60_000;
  return pool.map((post, k) => {
    const day = addDaysToDate(dateKey, -(pool.length - 1 - k));
    const r = copenhagenToUtc(day, clockFor(post.id));
    let at = r.ok ? r.utc : new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), 12));
    if (at.getTime() > now.getTime()) {
      const start = copenhagenToUtc(day, '00:00');
      const floor = start.ok ? start.utc.getTime() : at.getTime();
      at = new Date(Math.min(at.getTime(), Math.max(floor, nowMinute - 5 * 60_000)));
    }
    return { ...post, at };
  });
}

/** Nyeste først. */
export function newestFirst<T extends { at: Date }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.at.getTime() - a.at.getTime());
}

export type SatireMode = 'none' | 'timeline' | 'all';

/** Hvilke faner viser satire: kun ALLE (som del af tidslinjen) og SATIRE (alle); aldrig når det er slået fra. */
export function satireMode(tab: OverviewTab, enabled: boolean): SatireMode {
  if (!enabled) return 'none';
  if (tab === 'alle') return 'timeline';
  if (tab === 'satire') return 'all';
  return 'none';
}

/** Er satire slået fra, falder `?fane=satire` tilbage til ALLE. */
export function effectiveTab(tab: OverviewTab, enabled: boolean): OverviewTab {
  return tab === 'satire' && !enabled ? 'alle' : tab;
}
