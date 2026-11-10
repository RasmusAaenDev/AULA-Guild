import type { PostTab } from '@/lib/posts';

const TABS: readonly PostTab[] = ['alle', 'ulaeste', 'vigtige', 'egne', 'gemte'];

export const tabLabels: Record<PostTab, string> = {
  alle: 'Alle', ulaeste: 'Ulæste', vigtige: 'Vigtige', egne: 'Egne opslag', gemte: 'Gemte',
};

/** Ukendt eller manglende fane giver «alle». */
export function parseTab(value: string | string[] | undefined): PostTab {
  return typeof value === 'string' && (TABS as readonly string[]).includes(value) ? (value as PostTab) : 'alle';
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
export function formatAbsolute(d: Date): string {
  return absolute.format(d).replace(',', '');
}

/** «lige nu», «for 5 min. siden», «for 3 timer siden»; ældre end et døgn giver absolut tid. */
export function formatRelative(d: Date, now: Date): string {
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'lige nu';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `for ${minutes} min. siden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'for 1 time siden' : `for ${hours} timer siden`;
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
