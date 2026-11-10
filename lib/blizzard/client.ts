import { nameToSlug } from '@/lib/slug';
import { BlizzardError, type ArmoryCharacter, type BlizzardClient, type RosterMember } from './types';

const API = 'https://eu.api.blizzard.com';
const TOKEN_URL = 'https://oauth.battle.net/token';
const NAMESPACE = 'profile-forever-eu';
const LOCALE = 'en_GB';

type RawCharacter = {
  id: number;
  name: string;
  surname?: unknown;
  character_class?: { name: string };
  guild?: { id: number; name: string };
  equipped_item_level?: number;
  average_item_level?: number;
  last_login_timestamp?: number;
};

type RawRoster = {
  members: { character: { id: number; name: string; surname?: unknown; slug?: string; key?: { href: string } }; rank: number }[];
};

// Forever (classic-talenter): profilen har ingen active_spec. Aktiv spec = talent-træet med flest point i den aktive gruppe.
// string = udledt spec, null = opslaget lykkedes men ingen enkelt spec, undefined = misdannet/ukendt svar.
function activeSpec(raw: unknown): string | null | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const groups = (raw as { specialization_groups?: unknown }).specialization_groups;
  if (groups === undefined) return null;
  if (!Array.isArray(groups)) return undefined;
  let active: { specializations?: unknown } | null = null;
  for (const g of groups as unknown[]) {
    if (!g || typeof g !== 'object') return undefined;
    if (!active && (g as { is_active?: unknown }).is_active === true) active = g as { specializations?: unknown };
  }
  if (!active || active.specializations === undefined) return null;
  if (!Array.isArray(active.specializations)) return undefined;
  const trees: { name: string; points: number }[] = [];
  for (const t of active.specializations as unknown[]) {
    if (!t || typeof t !== 'object') return undefined;
    const pts = (t as { spent_points?: unknown }).spent_points;
    const spec = (t as { specialization?: unknown }).specialization;
    const name = spec && typeof spec === 'object' ? (spec as { name?: unknown }).name : undefined;
    if (typeof pts !== 'number' || !Number.isFinite(pts) || typeof name !== 'string') return undefined;
    trees.push({ name, points: pts });
  }
  if (trees.length === 0) return null;
  const max = Math.max(...trees.map((t) => t.points));
  const top = trees.filter((t) => t.points === max);
  return top.length === 1 && max > 0 ? top[0].name : null;
}

// Trimmet streng, ellers null (tom, manglende eller forkert type).
function cleanSurname(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function slugFromHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const last = new URL(href).pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}

async function readJson(res: Response, what: string): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new BlizzardError('unavailable', `Ugyldigt JSON-svar: ${what}`);
  }
}

export function createBlizzardClient(opts: {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  now?: () => number;
}): BlizzardClient {
  const doFetch = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now;
  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<string> {
    if (token && token.expiresAt > now()) return token.value;
    let res: Response;
    try {
      res = await doFetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
    } catch {
      throw new BlizzardError('unavailable', 'Token-kald fejlede');
    }
    if (!res.ok) throw new BlizzardError(res.status === 429 ? 'rate_limited' : 'unavailable', `Token HTTP ${res.status}`);
    const json = (await readJson(res, 'Token')) as { access_token?: unknown; expires_in?: unknown } | null;
    if (!json || typeof json.access_token !== 'string' || typeof json.expires_in !== 'number') {
      throw new BlizzardError('unavailable', 'Token-svar mangler access_token/expires_in');
    }
    token = { value: json.access_token, expiresAt: now() + (json.expires_in - 60) * 1000 };
    return token.value;
  }

  async function get<T>(path: string): Promise<T> {
    const url = `${API}${path}?namespace=${NAMESPACE}&locale=${LOCALE}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const bearer = await getToken();
      let res: Response;
      try {
        res = await doFetch(url, { headers: { Authorization: `Bearer ${bearer}` } });
      } catch {
        throw new BlizzardError('unavailable', 'Netværksfejl');
      }
      if (res.status === 401 && attempt === 0) {
        token = null;
        continue;
      }
      if (res.status === 404) throw new BlizzardError('not_found', path);
      if (res.status === 429) throw new BlizzardError('rate_limited', path);
      if (!res.ok) throw new BlizzardError('unavailable', `HTTP ${res.status} ${path}`);
      return (await readJson(res, path)) as T;
    }
    throw new BlizzardError('unavailable', 'Afvist trods nyt token');
  }

  return {
    async getCharacter(slug: string): Promise<ArmoryCharacter> {
      const raw = await get<RawCharacter>(`/profile/wow/character/${encodeURIComponent(slug)}`);
      if (!raw || typeof raw !== 'object' || typeof raw.id !== 'number' || typeof raw.name !== 'string') {
        throw new BlizzardError('unavailable', 'Karakter-svar mangler id/name');
      }
      // Sekundære data: enhver fejl her giver spec undefined (ukendt), aldrig en fejlet profil.
      let spec: string | null | undefined;
      try {
        spec = activeSpec(await get<unknown>(`/profile/wow/character/${encodeURIComponent(slug)}/specializations`));
      } catch {
        spec = undefined;
      }
      return {
        blizzardId: raw.id,
        slug,
        name: raw.name,
        surname: cleanSurname(raw.surname),
        className: raw.character_class?.name ?? 'Ukendt',
        spec,
        itemLevel: raw.equipped_item_level ?? raw.average_item_level ?? null,
        guildId: raw.guild?.id ?? null,
        guildName: raw.guild?.name ?? null,
        lastLogin: raw.last_login_timestamp ? new Date(raw.last_login_timestamp) : null,
      };
    },

    async getGuildRoster(guildSlug: string): Promise<RosterMember[]> {
      const raw = await get<RawRoster>(`/data/wow/guild/${encodeURIComponent(guildSlug)}/roster`);
      if (!raw || !Array.isArray(raw.members)) throw new BlizzardError('unavailable', 'Roster-svar mangler members');
      for (const m of raw.members as unknown[]) {
        const mm = m as { character?: { id?: unknown; name?: unknown }; rank?: unknown } | null;
        const ch = mm?.character;
        if (!mm || !ch || typeof ch !== 'object' || typeof ch.id !== 'number' || typeof ch.name !== 'string' || typeof mm.rank !== 'number') {
          throw new BlizzardError('unavailable', 'Roster-medlem mangler character.id/name eller rank');
        }
      }
      return raw.members.map((m) => {
        const surname = cleanSurname(m.character.surname);
        return {
          blizzardId: m.character.id,
          slug:
            (typeof m.character.slug === 'string' && m.character.slug !== '' ? m.character.slug : null) ??
            slugFromHref(m.character.key?.href) ??
            nameToSlug(surname ? `${m.character.name} ${surname}` : m.character.name) ??
            String(m.character.id),
          name: m.character.name,
          surname,
          rank: m.rank,
        };
      });
    },
  };
}
