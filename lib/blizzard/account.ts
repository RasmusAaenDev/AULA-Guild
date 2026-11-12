import { REQUEST_TIMEOUT_MS, slugFromHref } from './client';

/** Kun WoW Forever EU (se spike-noten 2026-11-12). */
export const ACCOUNT_URL = 'https://eu.api.blizzard.com/profile/user/wow?namespace=profile-forever-eu&locale=en_GB';

/** En karakter fra brugerens egen Battle.net-konto. level 0/null = ukendt (fx aldrig spillet). */
export type AccountCharacter = {
  blizzardId: number;
  name: string;
  surname: string | null;
  slug: string;
  className: string | null;
  level: number | null;
};

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

function parse(raw: unknown): AccountCharacter[] {
  const accounts = raw && typeof raw === 'object' ? (raw as { wow_accounts?: unknown }).wow_accounts : undefined;
  if (!Array.isArray(accounts)) throw new Error('Svaret mangler wow_accounts');
  const out: AccountCharacter[] = [];
  for (const acc of accounts as unknown[]) {
    const list = acc && typeof acc === 'object' ? (acc as { characters?: unknown }).characters : undefined;
    if (!Array.isArray(list)) continue;
    for (const x of list as unknown[]) {
      if (!x || typeof x !== 'object') continue;
      const c = x as { id?: unknown; name?: unknown; surname?: unknown; level?: unknown; character?: { href?: unknown } | null; playable_class?: { name?: unknown } | null };
      const id = typeof c.id === 'number' && Number.isInteger(c.id) && c.id > 0 ? c.id : null;
      const name = text(c.name);
      const href = c.character && typeof c.character === 'object' && typeof c.character.href === 'string' ? c.character.href : undefined;
      const slug = slugFromHref(href);
      if (id === null || !name || !slug || out.some((o) => o.blizzardId === id)) continue;
      out.push({
        blizzardId: id,
        name,
        surname: text(c.surname),
        slug,
        className: c.playable_class && typeof c.playable_class === 'object' ? text(c.playable_class.name) : null,
        level: typeof c.level === 'number' && Number.isInteger(c.level) && c.level >= 0 ? c.level : null,
      });
    }
  }
  return out;
}

/**
 * Brugerens egne WoW Forever-karakterer fra Battle.net-kontoen (brugerens OAuth-token, ikke appens). Fejl (HTTP, timeout,
 * misdannet svar) logges og giver en tom liste, så login aldrig vælter på grund af Blizzard. Tokenet gemmes ikke.
 */
export async function fetchAccountCharacters(accessToken: string, opts: { fetch?: typeof fetch } = {}): Promise<AccountCharacter[]> {
  if (!accessToken) return [];
  const doFetch = opts.fetch ?? fetch;
  try {
    const res = await doFetch(ACCOUNT_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parse(await res.json());
  } catch (err) {
    console.error('Hentning af karakterer fra Battle.net-kontoen fejlede', err instanceof Error ? err.message : err);
    return [];
  }
}
