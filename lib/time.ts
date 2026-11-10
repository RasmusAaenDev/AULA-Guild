const ZONE = 'Europe/Copenhagen';

export type LocalToUtc = { ok: true; utc: Date } | { ok: false; reason: 'invalid' | 'nonexistent' };

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function partsOf(d: Date): { date: string; time: string } {
  const p: Record<string, string> = {};
  for (const part of formatter.formatToParts(d)) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Ugedag for en kalenderdato: 0 = mandag … 6 = søndag. */
function weekdayOfDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = søndag
  return (js + 6) % 7;
}

function parseDate(date: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return [y, mo, d];
}

/**
 * Omregner dansk dato og klokkeslæt til UTC. Prøver de mulige UTC-forskydninger
 * (vintertid +60, sommertid +120 min) og verificerer ved at formatere tilbage.
 * Ingen match = tiden springes over (nonexistent); flere match = tiden forekommer
 * to gange, og den første (tidligste UTC) vælges.
 */
export function copenhagenToUtc(date: string, time: string): LocalToUtc {
  const dp = parseDate(date);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dp || !tm) return { ok: false, reason: 'invalid' };
  const [h, min] = [Number(tm[1]), Number(tm[2])];
  if (h > 23 || min > 59) return { ok: false, reason: 'invalid' };
  const localMs = Date.UTC(dp[0], dp[1] - 1, dp[2], h, min);
  const candidates = [120, 60]
    .map((offset) => new Date(localMs - offset * 60_000))
    .filter((c) => {
      const p = partsOf(c);
      return p.date === date && p.time === time;
    });
  if (candidates.length === 0) return { ok: false, reason: 'nonexistent' };
  return { ok: true, utc: candidates[0] };
}

export function utcToCopenhagen(d: Date): { date: string; time: string; weekday: number } {
  const p = partsOf(d);
  return { ...p, weekday: weekdayOfDate(p.date) };
}

export function addDaysToDate(date: string, days: number): string {
  const dp = parseDate(date);
  if (!dp) throw new Error(`Ugyldig dato: ${date}`);
  return new Date(Date.UTC(dp[0], dp[1] - 1, dp[2] + days)).toISOString().slice(0, 10);
}

export function todayInCopenhagen(now: Date): string {
  return partsOf(now).date;
}
