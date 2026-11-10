import { nameToSlug } from '@/lib/slug';
import { BlizzardError, type ArmoryCharacter, type BlizzardClient, type RosterMember } from './types';

const API = 'https://eu.api.blizzard.com';
const TOKEN_URL = 'https://oauth.battle.net/token';
const NAMESPACE = 'profile-forever-eu';
const LOCALE = 'en_GB';

type RawCharacter = {
  id: number;
  name: string;
  character_class?: { name: string };
  active_spec?: { name: string };
  guild?: { id: number; name: string };
  equipped_item_level?: number;
  average_item_level?: number;
  last_login_timestamp?: number;
};

type RawRoster = {
  members: { character: { id: number; name: string; key?: { href: string } }; rank: number }[];
};

function slugFromHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const last = new URL(href).pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
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
    const json = (await res.json()) as { access_token: string; expires_in: number };
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
      return (await res.json()) as T;
    }
    throw new BlizzardError('unavailable', 'Afvist trods nyt token');
  }

  return {
    async getCharacter(slug: string): Promise<ArmoryCharacter> {
      const raw = await get<RawCharacter>(`/profile/wow/character/${encodeURIComponent(slug)}`);
      return {
        blizzardId: raw.id,
        slug,
        name: raw.name,
        className: raw.character_class?.name ?? 'Ukendt',
        spec: raw.active_spec?.name ?? null,
        itemLevel: raw.equipped_item_level ?? raw.average_item_level ?? null,
        guildId: raw.guild?.id ?? null,
        guildName: raw.guild?.name ?? null,
        lastLogin: raw.last_login_timestamp ? new Date(raw.last_login_timestamp) : null,
      };
    },

    async getGuildRoster(guildSlug: string): Promise<RosterMember[]> {
      const raw = await get<RawRoster>(`/data/wow/guild/${encodeURIComponent(guildSlug)}/roster`);
      return raw.members.map((m) => ({
        blizzardId: m.character.id,
        slug: slugFromHref(m.character.key?.href) ?? nameToSlug(m.character.name) ?? String(m.character.id),
        name: m.character.name,
        rank: m.rank,
      }));
    },
  };
}
