const TZ = 'Europe/Copenhagen';
const parts = new Intl.DateTimeFormat('da-DK', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function dk(date: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of parts.formatToParts(date)) out[p.type] = p.value;
  return out;
}

/** `HH.mm` i dansk tid; med dato (`dd.MM`, plus år hvis det ikke er i år) når dagen ikke er i dag. */
export function formatMessageTime(iso: string, now: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const m = dk(d);
  const n = dk(now);
  const time = `${m.hour}.${m.minute}`;
  if (m.year === n.year && m.month === n.month && m.day === n.day) return time;
  return m.year === n.year ? `${m.day}.${m.month} ${time}` : `${m.day}.${m.month}.${m.year} ${time}`;
}

/** Skal visningen følge med nye beskeder? Sandt når brugeren er (næsten) i bunden. */
export function isNearBottom(el: { scrollTop: number; clientHeight: number; scrollHeight: number }, threshold = 80): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

/** Ventetid til næste hentning: 5 s, fordoblet for hver fejl i træk, højst 60 s. */
export function nextPollDelay(failures: number): number {
  return Math.min(5000 * 2 ** Math.max(0, failures), 60000);
}

/** Kun `HH.mm` i dansk tid (dagen står i dagsskillelinjen); tom tekst for ugyldigt tidspunkt. */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const m = dk(d);
  return `${m.hour}.${m.minute}`;
}

/** Den danske kalenderdag som `ÅÅÅÅ-MM-DD`; null for ugyldigt tidspunkt. */
export function dayKey(iso: string | Date): string | null {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;
  const m = dk(d);
  return `${m.year}-${m.month}-${m.day}`;
}

const longDay = new Intl.DateTimeFormat('da-DK', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const longDayYear = new Intl.DateTimeFormat('da-DK', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** «I dag», «I går» eller fx «Mandag den 9. november» (med år, hvis det ikke er i år). */
export function dayLabel(key: string, now: Date): string {
  const today = dayKey(now)!;
  if (key === today) return 'I dag';
  const [y, mo, d] = key.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const yesterday = new Date(Date.UTC(ty, tm - 1, td - 1)).toISOString().slice(0, 10);
  if (key === yesterday) return 'I går';
  const date = new Date(Date.UTC(y, mo - 1, d, 12));
  const s = (y === ty ? longDay : longDayYear).format(date);
  return s.charAt(0).toLocaleUpperCase('da-DK') + s.slice(1);
}

/** Beskeder fra samme afsender inden for så mange minutter vises som én gruppe (avatar og navn kun på den første). */
export const GROUP_GAP_MS = 5 * 60_000;

export type ThreadItem<T> =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; msg: T; first: boolean };

/**
 * Lægger dagsskillelinjer ind før hver ny dansk kalenderdag og markerer, hvilke beskeder der starter en ny gruppe.
 * En gruppe brydes af en anden afsender, en anden bot-status, en ny dag, mere end GROUP_GAP_MS mellem beskederne
 * (eller et ugyldigt/baglæns tidspunkt). Beskederne forventes ældste først.
 */
export function buildThread<T extends { author: string; timestamp: string; bot?: boolean }>(messages: T[], now: Date): ThreadItem<T>[] {
  const out: ThreadItem<T>[] = [];
  let lastDay: string | null = null;
  let prev: T | null = null;
  for (const m of messages) {
    const day = dayKey(m.timestamp);
    if (day !== null && day !== lastDay) {
      out.push({ kind: 'day', key: day, label: dayLabel(day, now) });
      lastDay = day;
      prev = null;
    }
    const gap = prev ? new Date(m.timestamp).getTime() - new Date(prev.timestamp).getTime() : NaN;
    const grouped = prev !== null && day !== null && prev.author === m.author && Boolean(prev.bot) === Boolean(m.bot)
      && gap >= 0 && gap <= GROUP_GAP_MS;
    out.push({ kind: 'msg', msg: m, first: !grouped });
    prev = m;
  }
  return out;
}
