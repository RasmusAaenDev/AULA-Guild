import type { PostTab } from '@/lib/posts';
import { todayInCopenhagen, utcToCopenhagen } from '@/lib/time';

/** Faner i Overblik: de fem ægte (`PostTab`) plus «satire», som kun findes i UI-laget (ingen database). */
export type OverviewTab = PostTab | 'satire';

const TABS: readonly OverviewTab[] = ['alle', 'ulaeste', 'vigtige', 'egne', 'gemte', 'satire'];

export const tabLabels: Record<OverviewTab, string> = {
  alle: 'Alle', ulaeste: 'Ulæste', vigtige: 'Vigtige', egne: 'Egne opslag', gemte: 'Gemte', satire: 'Satire',
};

/** Ukendt eller manglende fane giver «alle». */
export function parseTab(value: string | string[] | undefined): OverviewTab {
  return typeof value === 'string' && (TABS as readonly string[]).includes(value) ? (value as OverviewTab) : 'alle';
}

/** Sidetal fra `?side=`; ugyldigt giver 1, og værdien afkortes til samme loft som modulet. */
export function parsePage(value: string | string[] | undefined): number {
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value)) return 1;
  const n = Number(value);
  return n >= 1 ? Math.min(n, 1_000_000) : 1;
}

export type PostFailure = 'invalid' | 'forbidden' | 'not_found';

const messages: Record<PostFailure, string> = {
  invalid: 'Tjek felterne. Titel 1–120 tegn og tekst 1–5000 tegn.',
  forbidden: 'Du har ikke lov til det.',
  not_found: 'Opslaget findes ikke længere.',
};

export function postMessage(reason: PostFailure, kind: 'post' | 'comment' = 'post'): string {
  if (reason === 'invalid' && kind === 'comment') return 'Kommentaren skal være 1–2000 tegn.';
  return messages[reason];
}

export const commentNotFound = 'Kommentaren findes ikke længere.';

const absolute = new Intl.DateTimeFormat('da-DK', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Copenhagen',
});

/** «01.07.2026 12.30» i dansk tid. */
/** «Brugernavn (Karakter Fuldnavn)», eller bare brugernavnet uden aktiv karakter. */
export function authorLabel(authorName: string, characterFullName: string | null): string {
  return characterFullName ? `${authorName} (${characterFullName})` : authorName;
}

export function formatAbsolute(d: Date): string {
  return absolute.format(d).replace(',', '');
}

const weekdayShort = ['Man.', 'Tir.', 'Ons.', 'Tor.', 'Fre.', 'Lør.', 'Søn.'] as const;

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/**
 * AULA-lignende relativ tid efter danske kalenderdage: «I dag 09:05», «I går 16:45», ugedagsforkortelse og
 * klokkeslæt («Fre. 13:50») for 2–6 dage siden, ellers dato og tid. Fremtidige tidspunkter vises som dato og tid.
 */
export function formatRelativeDay(d: Date, now: Date): string {
  const local = utcToCopenhagen(d);
  const diff = dayNumber(todayInCopenhagen(now)) - dayNumber(local.date);
  if (diff === 0 && d.getTime() <= now.getTime()) return `I dag ${local.time}`;
  if (diff === 1) return `I går ${local.time}`;
  if (diff >= 2 && diff <= 6) return `${weekdayShort[local.weekday]} ${local.time}`;
  return formatAbsolute(d);
}

/** Tekst til tælleren: skjult ved 0, «99+» over 99. */
export function unreadLabel(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 99 ? '99+' : String(n);
}

/** Antal tegn, et uddrag viser. `listPosts` henter ét tegn mere, så afkortning kan opdages. */
export const EXCERPT_LIMIT = 200;

/** Skærer uddraget til `limit` tegn og tilføjer «…» kun hvis der var mere tekst. */
export function excerptText(excerpt: string, limit: number = EXCERPT_LIMIT): string {
  const chars = Array.from(excerpt);
  return chars.length > limit ? `${chars.slice(0, limit).join('').trimEnd()}…` : excerpt;
}
