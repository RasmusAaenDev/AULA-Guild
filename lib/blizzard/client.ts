import { nameToSlug } from '@/lib/slug';
import { BlizzardError, type ArmoryCharacter, type BlizzardClient, type RecentAchievement, type RosterMember, type SimProfile } from './types';

const API = 'https://eu.api.blizzard.com';
const TOKEN_URL = 'https://oauth.battle.net/token';
const NAMESPACE = 'profile-forever-eu';
const LOCALE = 'en_GB';
// Intet Blizzard-kald må hænge for evigt (en formular ville så vise «henter …» uden slut).
const REQUEST_TIMEOUT_MS = 15_000;

type RawCharacter = {
  id: number;
  name: string;
  surname?: unknown;
  character_class?: { name: string };
  guild?: { id: number; name: string };
  level?: unknown;
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

// Heltal 1..100, ellers null.
function cleanLevel(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 100 ? v : null;
}

// Defensiv parsing af /achievements: recent_events først, ellers achievements med completed_timestamp (nyest først). Maks 10.
function parseRecentAchievements(raw: unknown): RecentAchievement[] {
  if (!raw || typeof raw !== 'object') return [];
  const r = raw as { recent_events?: unknown; achievements?: unknown };
  const valid = (id: unknown, name: unknown, ts: unknown): RecentAchievement | null =>
    typeof id === 'number' && Number.isInteger(id) && typeof name === 'string' && name.trim() !== '' && typeof ts === 'number' && Number.isFinite(ts) && ts > 0
      ? { id, name: name.trim(), completedAt: new Date(ts) }
      : null;
  const out: RecentAchievement[] = [];
  const collect = (list: unknown, pick: (x: Record<string, unknown>) => RecentAchievement | null) => {
    if (!Array.isArray(list)) return;
    for (const x of list as unknown[]) {
      if (!x || typeof x !== 'object') continue;
      const a = pick(x as Record<string, unknown>);
      if (a && !out.some((o) => o.id === a.id)) out.push(a);
    }
  };
  collect(r.recent_events, (x) => {
    const a = x.achievement as { id?: unknown; name?: unknown } | null | undefined;
    return a && typeof a === 'object' ? valid(a.id, a.name, x.timestamp) : null;
  });
  if (out.length === 0) {
    collect(r.achievements, (x) => {
      const a = x.achievement as { name?: unknown } | null | undefined;
      return valid(x.id, a && typeof a === 'object' ? a.name : undefined, x.completed_timestamp);
    });
  }
  return out.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime()).slice(0, 10);
}

const MAX_TALENT_ID = 99_999_999;
const MAX_ITEM_ID = 9_999_999;
const MAX_TALENT_RANK = 10;
const MAX_EQUIPPED = 40;
const MAX_TALENTS = 200;

const nonEmpty = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const posInt = (v: unknown, max: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= max ? v : null);

// Defensiv parsing af /equipment: ugyldige elementer ignoreres, højst ét item pr. plads.
function parseEquipment(raw: unknown): { slot: string; id: number }[] {
  const list = raw && typeof raw === 'object' ? (raw as { equipped_items?: unknown }).equipped_items : undefined;
  if (!Array.isArray(list)) return [];
  const out: { slot: string; id: number }[] = [];
  for (const x of list.slice(0, MAX_EQUIPPED * 2) as unknown[]) {
    if (!x || typeof x !== 'object') continue;
    const e = x as { item?: { id?: unknown } | null; slot?: { type?: unknown } | null };
    const id = posInt(e.item && typeof e.item === 'object' ? e.item.id : undefined, MAX_ITEM_ID);
    const slot = nonEmpty(e.slot && typeof e.slot === 'object' ? e.slot.type : undefined);
    if (id === null || slot === null || out.some((o) => o.slot === slot)) continue;
    out.push({ slot, id });
    if (out.length >= MAX_EQUIPPED) break;
  }
  return out;
}

// Defensiv parsing af /specializations: talenter fra den aktive gruppe (alle træer), unikke id'er, rang 1..10.
function parseTalents(raw: unknown): { id: number; rank: number }[] {
  const groups = raw && typeof raw === 'object' ? (raw as { specialization_groups?: unknown }).specialization_groups : undefined;
  if (!Array.isArray(groups)) return [];
  const active = (groups as unknown[]).find((g) => g && typeof g === 'object' && (g as { is_active?: unknown }).is_active === true) as { specializations?: unknown } | undefined;
  if (!active || !Array.isArray(active.specializations)) return [];
  const out: { id: number; rank: number }[] = [];
  for (const tree of active.specializations as unknown[]) {
    const talents = tree && typeof tree === 'object' ? (tree as { talents?: unknown }).talents : undefined;
    if (!Array.isArray(talents)) continue;
    for (const t of talents as unknown[]) {
      if (!t || typeof t !== 'object') continue;
      const x = t as { talent?: { id?: unknown } | null; talent_rank?: unknown };
      const id = posInt(x.talent && typeof x.talent === 'object' ? x.talent.id : undefined, MAX_TALENT_ID);
      const rank = posInt(x.talent_rank, MAX_TALENT_RANK);
      if (id === null || rank === null || out.some((o) => o.id === id)) continue;
      out.push({ id, rank });
      if (out.length >= MAX_TALENTS) return out;
    }
  }
  return out;
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
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
        res = await doFetch(url, { headers: { Authorization: `Bearer ${bearer}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
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
        level: cleanLevel(raw.level),
        itemLevel: raw.equipped_item_level ?? raw.average_item_level ?? null,
        guildId: raw.guild?.id ?? null,
        guildName: raw.guild?.name ?? null,
        lastLogin: raw.last_login_timestamp ? new Date(raw.last_login_timestamp) : null,
      };
    },

    async getSimProfile(slug: string): Promise<SimProfile> {
      const base = `/profile/wow/character/${encodeURIComponent(slug)}`;
      // Udstyr og talenter: 404 betyder «ingen data» (tom liste), øvrige fejl går videre.
      const optional = (path: string) =>
        get<unknown>(path).catch((e: unknown) => {
          if (e instanceof BlizzardError && e.kind === 'not_found') return null;
          throw e;
        });
      const [raw, equipment, specs] = await Promise.all([get<unknown>(base), optional(`${base}/equipment`), optional(`${base}/specializations`)]);
      const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
      const name = nonEmpty(c?.name);
      const className = nonEmpty((c?.character_class as { name?: unknown } | undefined)?.name);
      const race = nonEmpty((c?.race as { name?: unknown } | undefined)?.name);
      const level = cleanLevel(c?.level);
      if (!c || !name || !className || !race || level === null) throw new BlizzardError('unavailable', 'Karakter-svar mangler name/klasse/race/level');
      const ft = (c.faction as { type?: unknown } | undefined)?.type;
      return {
        name, className, race, level,
        faction: ft === 'ALLIANCE' ? 'alliance' : ft === 'HORDE' ? 'horde' : null,
        equipment: parseEquipment(equipment),
        talents: parseTalents(specs),
      };
    },

    async getRecentAchievements(slug: string): Promise<RecentAchievement[]> {
      try {
        return parseRecentAchievements(await get<unknown>(`/profile/wow/character/${encodeURIComponent(slug)}/achievements`));
      } catch (e) {
        if (e instanceof BlizzardError && e.kind === 'not_found') return [];
        throw e;
      }
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
