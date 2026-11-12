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

/** En sti på siden selv (til redirectTo); alt der kunne pege ud af siden (`//host`, `/\host`, protokoller, styretegn) er ugyldigt. */
export function parseLocalPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 200) return null;
  if (!/^\/(?![/\\])[\x21-\x7e]*$/.test(value)) return null;
  return value;
}
