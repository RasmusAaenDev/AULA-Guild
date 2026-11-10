/** Delt id-parser for sider og server actions: positive heltal inden for Postgres int4. */
export function parseId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= 2147483647 ? n : null;
}

/** Ugedag 0 (mandag) – 6 (søndag); tom eller manglende værdi er ugyldig (ikke 0). */
export function parseWeekday(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[0-6]$/.test(value)) return null;
  return Number(value);
}
