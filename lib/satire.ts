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

/**
 * Rotation: puljen glider SATIRE_PER_DAY opslag frem pr. dansk kalenderdag. Dag nummer d (dage siden 1970-01-01) får opslagene på
 * positionerne d·5 … d·5+4 (mod antal), så hver dag har præcis fem «nye» opslag, og hele puljen kommer rundt på
 * SATIRE_CYCLE_DAYS = antal / 5 dage (150 opslag = 30 dage). Antallet skal derfor være deleligt med 5 (det tjekker testen).
 * Det synlige vindue er SATIRE_WINDOW_DAYS hele dage (5 dage = 25 opslag): en arbejdsuges opslag, cirka samme mængde som før (20), og
 * 30-dages-cyklussen går op i seks vinduer. Ingen opslag gentages inden for et vindue, og det samme opslag kommer først igen efter 30 dage.
 */
export const SATIRE_PER_DAY = 5;
/** Antal hele dage i den aktive pulje (Satire-fanen). */
export const SATIRE_WINDOW_DAYS = 5;
/** Antal opslag i den aktive pulje: 5 dage × 5 opslag = 25. */
export const SATIRE_VISIBLE = SATIRE_PER_DAY * SATIRE_WINDOW_DAYS;
/** Dage før samme opslag kommer igen: puljens størrelse / 5 (150 opslag = 30 dage). */
export const SATIRE_CYCLE_DAYS = Math.floor(satirePosts.length / SATIRE_PER_DAY);
/**
 * Antal dage, der flettes ind i Alle-fanens tidslinje (2 dage = højst 10 opslag). Hele vinduet på 25 ville drukne de ægte opslag på
 * side 1, når der kun er få af dem; Satire-fanen viser stadig hele vinduet.
 */
export const SATIRE_TIMELINE_DAYS = 2;

/** Dagnummer (UTC-midnat) for en `YYYY-MM-DD`-nøgle i dansk tid; ugyldig nøgle giver 0. */
export function dayNumber(dateKey: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : 0;
}

export type DatedSatire = SatirePost & { at: Date };

const SLOT_MIN = 5;
const FIRST_MINUTE = 7 * 60 + 30;
const LAST_MINUTE = 21 * 60 + 30;
const SLOTS = (LAST_MINUTE - FIRST_MINUTE) / SLOT_MIN + 1;

/** Deterministisk tidsplads (0 = 07:30 … 168 = 21:30 i 5-minutters trin) ud fra opslagets id. */
const slotFor = (id: string) => hashSeed(id) % SLOTS;

function clock(slot: number): string {
  const minutes = FIRST_MINUTE + slot * SLOT_MIN;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Deterministisk klokkeslæt (dansk tid, «HH:MM», 07:30–21:30 i 5-minutters trin) ud fra opslagets id alene. */
export function clockFor(id: string): string {
  return clock(slotFor(id));
}

/**
 * Dagens fem opslag for dag nummer `day`, sorteret efter klokkeslæt (ældste først). Klokkeslættet kommer fra id'et; falder to på samme
 * tidsplads, rykkes det senere 5 minutter frem (og tilbage fra 21:30), så de fem altid har forskellige tider. Da puljen er delelig med 5,
 * er det altid de samme fem opslag, der deler dag, og tiderne er derfor faste pr. opslag.
 */
function dayGroup(day: number): Array<{ post: SatirePost; clock: string }> {
  const n = satirePosts.length;
  const per = Math.min(SATIRE_PER_DAY, n);
  const posts = Array.from({ length: per }, (_, j) => satirePosts[(((day * per + j) % n) + n) % n]);
  const sorted = posts.map((post, j) => ({ post, j, slot: slotFor(post.id) })).sort((a, b) => a.slot - b.slot || a.j - b.j);
  const slots = sorted.map((x) => x.slot);
  for (let i = 1; i < slots.length; i++) slots[i] = Math.max(slots[i], slots[i - 1] + 1);
  for (let i = slots.length - 1; i >= 0; i--) slots[i] = Math.min(slots[i], i === slots.length - 1 ? SLOTS - 1 : slots[i + 1] - 1);
  return sorted.map((x, i) => ({ post: x.post, clock: clock(slots[i]) }));
}

/** Dagens aktive pulje: SATIRE_WINDOW_DAYS dages opslag, fem pr. dag, ældste dag først og inden for dagen efter klokkeslæt. */
export function activeSatire(dateKey: string): SatirePost[] {
  return datedDays(dateKey).flatMap((d) => d.group.map((g) => g.post));
}

function datedDays(dateKey: string) {
  const today = dayNumber(dateKey);
  return Array.from({ length: SATIRE_WINDOW_DAYS }, (_, k) => {
    const back = SATIRE_WINDOW_DAYS - 1 - k;
    return { date: addDaysToDate(dateKey, -back), group: dayGroup(today - back) };
  });
}

/**
 * Dagens aktive pulje med tidspunkt: de fem sidste opslag er fra danske kalenderdag `dateKey`, de fem før fra dagen før osv.
 * Klokkeslættet er fast pr. opslag (se dayGroup). Opslag, hvis tidspunkt ligger efter `now`, flyttes til lige før nu: det sidste til
 * nu − 5 min, det før til nu − 10 min osv. (hele minutter). Er der ikke plads til 5-minutters trin efter dagens begyndelse og efter de
 * opslag, der allerede er passeret, bliver trinnet mindre (ned til samme minut lige efter midnat). Rækkefølgen er puljens (ældste
 * først), og tiderne stiger med den. Intet ligger i fremtiden.
 */
export function datedSatire(dateKey: string, now: Date): DatedSatire[] {
  const nowMinute = Math.floor(now.getTime() / 60_000) * 60_000;
  return datedDays(dateKey).flatMap(({ date, group }) => {
    const times = group.map(({ clock: c }) => {
      const r = copenhagenToUtc(date, c);
      return r.ok ? r.utc.getTime() : Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), 12);
    });
    const future = times.filter((t) => t > now.getTime()).length;
    if (future > 0) {
      const start = copenhagenToUtc(date, '00:00');
      const dayStart = start.ok ? start.utc.getTime() : -Infinity;
      const past = times.length - future;
      const lower = Math.max(dayStart, past > 0 ? times[past - 1] : -Infinity);
      const room = Math.floor((nowMinute - lower) / 60_000);
      const step = Math.max(0, Math.min(SLOT_MIN, Math.floor((room - 1) / future)));
      for (let i = past; i < times.length; i++) {
        times[i] = Math.max(dayStart, nowMinute - (times.length - i) * step * 60_000);
      }
    }
    return group.map(({ post }, i) => ({ ...post, at: new Date(times[i]) }));
  });
}

/** De seneste SATIRE_TIMELINE_DAYS dages opslag (højst 10) til Alle-fanens tidslinje, nyeste først. */
export function timelineSatire(dateKey: string, now: Date): DatedSatire[] {
  return newestFirst(datedSatire(dateKey, now).slice(-SATIRE_TIMELINE_DAYS * SATIRE_PER_DAY));
}

/** Nyeste først. Ved samme tidspunkt kommer det senere element i kilden først (puljen er ældste først). Kilden ændres ikke. */
export function newestFirst<T extends { at: Date }>(items: readonly T[]): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => b.item.at.getTime() - a.item.at.getTime() || b.i - a.i)
    .map((x) => x.item);
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
