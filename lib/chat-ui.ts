import type { ChatChannel, ChatError, ChatResult } from '@/lib/chat';

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

export function chatErrorMessage(error: ChatError | undefined): string | null {
  switch (error) {
    case 'no_access': return 'Botten har ikke adgang til kanalen.';
    case 'not_found': return 'Kanalen blev ikke fundet. Vælg en anden kanal.';
    case 'unavailable': return 'Discord kan ikke nås lige nu. Prøver igen om lidt.';
    default: return null;
  }
}

export function chatHintMessage(hint: ChatResult['hint']): string | null {
  return hint === 'no_content_intent'
    ? 'Beskederne er tomme. Slå Message Content Intent til for botten i Discords udviklerportal.'
    : null;
}

/** Ventetid til næste hentning: 5 s, fordoblet for hver fejl i træk, højst 60 s. */
export function nextPollDelay(failures: number): number {
  return Math.min(5000 * 2 ** Math.max(0, failures), 60000);
}

/** Vælger kanal ud fra ?kanal=: ukendt/ugyldigt id giver standardkanalen, ellers den første. */
export function pickChannel(channels: ChatChannel[], requested: unknown, defaultId: string): ChatChannel | null {
  const id = typeof requested === 'string' ? requested : Array.isArray(requested) && typeof requested[0] === 'string' ? requested[0] : '';
  return channels.find((c) => c.id === id) ?? channels.find((c) => c.id === defaultId) ?? channels[0] ?? null;
}
