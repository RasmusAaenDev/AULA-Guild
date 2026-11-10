import type { Counts, EventListItem } from '@/lib/events';
import { utcToCopenhagen } from '@/lib/time';
import type { EventType, RsvpStatus } from '@/lib/db/schema';

const ZONE = 'Europe/Copenhagen';

const dayFormatter = new Intl.DateTimeFormat('da-DK', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: ZONE,
});
const timeFormatter = new Intl.DateTimeFormat('da-DK', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: ZONE,
});

/** «mandag 16. november» (dansk tid). */
export function formatDayHeading(d: Date): string {
  return dayFormatter.format(d);
}

const dayNumberFormatter = new Intl.DateTimeFormat('da-DK', { day: 'numeric', timeZone: ZONE });
const monthShortFormatter = new Intl.DateTimeFormat('da-DK', { month: 'short', timeZone: ZONE });

/** Stor dato og kort måned til datoblokken: `{ day: '12', month: 'nov' }` (dansk tid, uden punktum). */
export function formatDayMonth(d: Date): { day: string; month: string } {
  return { day: dayNumberFormatter.format(d).replace('.', ''), month: monthShortFormatter.format(d).replace('.', '') };
}

/** «20:00» (dansk tid). */
export function formatClock(d: Date): string {
  return timeFormatter.format(d).replace('.', ':');
}

/** «20:00–22:00», eller kun starttid uden varighed. */
export function formatTimeRange(startsAt: Date, durationMinutes: number | null): string {
  if (durationMinutes === null) return formatClock(startsAt);
  return `${formatClock(startsAt)}–${formatClock(new Date(startsAt.getTime() + durationMinutes * 60_000))}`;
}

/** Gruppér pr. dansk kalenderdag; rækkefølgen af input bevares. */
export function groupByDay<T extends { startsAt: Date }>(items: T[]): { date: string; label: string; items: T[] }[] {
  const groups: { date: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const date = utcToCopenhagen(item.startsAt).date;
    let g = groups[groups.length - 1];
    if (!g || g.date !== date) {
      g = { date, label: formatDayHeading(item.startsAt), items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }
  return groups;
}

export function countsLabel(c: Counts): string {
  return `${c.tank} tank · ${c.healer} healer · ${c.dps} dps`;
}

export const weekdayNames = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'] as const;

export function eventTypeLabel(t: EventType): string {
  return t === 'raid' ? 'Raid' : 'Aften';
}

export function rsvpLabel(s: RsvpStatus): string {
  return s === 'deltager' ? 'Deltager' : s === 'maaske' ? 'Måske' : 'Afbud';
}

export type TimeFailure = 'invalid' | 'nonexistent' | 'in_past';
export type CalendarFailure =
  | TimeFailure
  | 'forbidden'
  | 'not_found'
  | 'cancelled'
  | 'closed'
  | 'no_character';

const messages: Record<CalendarFailure, string> = {
  invalid: 'Tjek felterne. Titel 1–100 tegn, beskrivelse højst 2000 tegn og varighed 15–720 minutter.',
  nonexistent: 'Tidspunktet findes ikke (sommertidsskifte)',
  in_past: 'Tidspunktet ligger i fortiden',
  forbidden: 'Du har ikke lov til det.',
  not_found: 'Eventet findes ikke længere.',
  cancelled: 'Eventet er aflyst og kan ikke ændres.',
  closed: 'Tilmeldingen er lukket.',
  no_character: 'Tilføj en karakter først.',
};

export function calendarMessage(reason: CalendarFailure): string {
  return messages[reason];
}

/** Besked for fejl fra `copenhagenToUtc`; `invalid` giver den korte datobesked. */
export function timeMessage(reason: 'invalid' | 'nonexistent'): string {
  return reason === 'invalid' ? 'Ugyldig dato eller tid' : messages.nonexistent;
}

export function seriesKeptMessage(n: number): string | null {
  if (!Number.isInteger(n) || n <= 0) return null;
  return n === 1 ? '1 event har tilmeldinger og blev ikke ændret' : `${n} events har tilmeldinger og blev ikke ændret`;
}

/**
 * Udvalget til «Næste begivenheder»: de første `max` kommende, ikke-aflyste events, plus næste raid og næste aften,
 * også hvis de ligger senere (så de altid kan få hurtig tilmelding). Højst `max` + 2 events, sorteret efter start og id.
 */
export function selectNextEvents(
  events: EventListItem[],
  now: Date,
  max = 5,
): { shown: EventListItem[]; rsvpIds: Set<number> } {
  const future = events
    .filter((e) => !e.cancelled && e.startsAt.getTime() > now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id - b.id);
  const nextRaid = future.find((e) => e.type === 'raid');
  const nextAften = future.find((e) => e.type === 'aften');
  const picked = new Map<number, EventListItem>();
  for (const e of [...future.slice(0, Math.max(0, max)), nextRaid, nextAften]) if (e) picked.set(e.id, e);
  const shown = [...picked.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id - b.id);
  const rsvpIds = new Set<number>([nextRaid, nextAften].flatMap((e) => (e ? [e.id] : [])));
  return { shown, rsvpIds };
}
