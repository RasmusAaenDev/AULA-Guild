// Visning af (og skrivning i) serverens offentlige Discord-tekstkanaler. Al netværk går gennem den injicerede `fetch`, og tokenet
// forlader aldrig modulet: resultater og fejl er kun data og faste koder, aldrig svar- eller fejltekst.

/** Intern besked: authorId og mentions bruges kun på serveren (resolveAuthors) og sendes aldrig til klienten. */
export type ChatMention = { id: string; name: string };
export type ChatMessage = {
  id: string;
  author: string;
  authorId: string | null;
  content: string;
  mentions: ChatMention[];
  timestamp: string;
  bot: boolean;
};
export type ChatError = 'no_access' | 'not_found' | 'unavailable';
export type ChatChannel = { id: string; name: string; canWrite: boolean };
export type ChannelsResult = { channels: ChatChannel[]; error?: 'unavailable' };
export type ChatResult = { messages: ChatMessage[]; stale: boolean; error?: ChatError; hint?: 'no_content_intent' };
export type SendError = 'no_access' | 'rate_limited' | 'unavailable' | 'invalid' | 'not_found' | 'read_only';
export type SendResult = { ok: true } | { ok: false; error: SendError };
export type ChatClient = {
  listChannels(): Promise<ChannelsResult>;
  getMessages(channelId: string): Promise<ChatResult>;
  sendMessage(channelId: string, content: string): Promise<SendResult>;
};

const MAX_STALE_MS = 10 * 60_000;
const LIST_TTL_MS = 5 * 60_000;
const LIST_MAX_STALE_MS = 30 * 60_000;
const LIST_RETRY_MS = 5000;
const READ_ONLY_MS = 60 * 60_000;
const MAX_CHANNEL_STATES = 50;
const WOW_LINKED_CODE = 20062;
const ID_RE = /^\d{1,20}$/;
const ADMINISTRATOR = 8n;
const VIEW_CHANNEL = 1024n;
const SEND_MESSAGES = 2048n;
const READ_HISTORY = 65536n;
const ALL = (1n << 64n) - 1n;
const DEFAULT_RETRY_S = 5;
const MAX_RETRY_S = 10 * 60;
const DISCORD_EPOCH = 1420070400000n;

type Raw = Record<string, unknown>;
type Parsed = { messages: ChatMessage[]; hint?: 'no_content_intent' };

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function userName(u: unknown): string {
  if (!isObj(u)) return '';
  return str(u.global_name).trim() || str(u.username).trim();
}

function renderContent(content: string, mentions: unknown): { text: string; found: ChatMention[] } {
  const names = new Map<string, string>();
  if (Array.isArray(mentions)) {
    for (const m of mentions) {
      if (isObj(m) && typeof m.id === 'string') {
        const n = userName(m);
        if (n) names.set(m.id, n);
      }
    }
  }
  const found = new Map<string, ChatMention>();
  const text = content
    .replace(/<@!?(\d+)>/g, (_, id: string) => {
      const name = names.get(id);
      if (name && ID_RE.test(id)) found.set(id, { id, name });
      return `@${name ?? 'bruger'}`;
    })
    .replace(/<@&\d+>/g, '«@rolle»')
    .replace(/<#\d+>/g, '«#kanal»')
    .replace(/<a?:(\w+):\d+>/g, ':$1:');
  return { text, found: [...found.values()] };
}

function embedText(embeds: unknown): string {
  if (!Array.isArray(embeds)) return '';
  const first = embeds.find((e) => isObj(e) && (str(e.title).trim() || str(e.description).trim()));
  if (!isObj(first)) return '';
  return [str(first.title).trim(), str(first.description).trim()].filter(Boolean).join('\n');
}

function isoTime(m: Raw, id: string): string {
  const t = typeof m.timestamp === 'string' ? Date.parse(m.timestamp) : NaN;
  if (!Number.isNaN(t)) return new Date(t).toISOString();
  return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH)).toISOString();
}

/** Returnerer null ved enhver afvigelse fra den forventede form. */
function parse(body: unknown): Parsed | null {
  if (!Array.isArray(body)) return null;
  const rows: { id: bigint; msg: ChatMessage; empty: boolean }[] = [];
  for (const m of body) {
    if (!isObj(m) || typeof m.id !== 'string' || !/^\d{1,20}$/.test(m.id)) return null;
    const raw = str(m.content);
    const hasEmbeds = Array.isArray(m.embeds) && m.embeds.length > 0;
    const hasFiles = Array.isArray(m.attachments) && m.attachments.length > 0;
    const rendered = renderContent(raw, m.mentions);
    let content = rendered.text;
    if (!content.trim()) {
      content = embedText(m.embeds) || (hasFiles ? '[vedhæftet fil]' : '');
    } else if (hasFiles) {
      content += '\n[vedhæftet fil]';
    }
    const author = isObj(m.author) ? m.author : {};
    rows.push({
      id: BigInt(m.id),
      empty: !raw.trim() && !hasEmbeds && !hasFiles,
      msg: {
        id: m.id,
        author: userName(author) || 'Ukendt',
        authorId: typeof author.id === 'string' && ID_RE.test(author.id) ? author.id : null,
        content,
        mentions: rendered.found,
        timestamp: isoTime(m, m.id),
        bot: author.bot === true || (m.webhook_id !== undefined && m.webhook_id !== null),
      },
    });
  }
  rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const parsed: Parsed = { messages: rows.map((r) => r.msg) };
  if (rows.length > 0 && rows.every((r) => r.empty)) parsed.hint = 'no_content_intent';
  return parsed;
}

async function discard(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // ligegyldigt: kroppen skal bare ikke blive hængende
  }
}

function retrySeconds(res: Response, body: unknown): number {
  let s = isObj(body) && typeof body.retry_after === 'number' ? body.retry_after : NaN;
  if (!(s >= 0)) s = Number(res.headers.get('retry-after') ?? NaN);
  if (!(s >= 0)) s = DEFAULT_RETRY_S;
  return Math.min(Math.max(s, 1), MAX_RETRY_S);
}

type RawChannel = { id: string; name: string; type: number; position: number; nsfw: boolean; parentId: string | null; overwrites: Overwrite[] };
type Overwrite = { id: string; type: number; allow: bigint; deny: bigint };
type ListBase = { id: string; name: string; position: number; type: number; botWrite: boolean; category: string | null };

function big(v: unknown): bigint {
  if (typeof v === 'string' && /^\d{1,20}$/.test(v)) return BigInt(v);
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) return BigInt(v);
  return 0n;
}

function parseChannel(c: unknown): RawChannel | null {
  if (!isObj(c) || typeof c.id !== 'string' || !ID_RE.test(c.id) || typeof c.type !== 'number') return null;
  const overwrites: Overwrite[] = [];
  if (Array.isArray(c.permission_overwrites)) {
    for (const o of c.permission_overwrites) {
      if (isObj(o) && typeof o.id === 'string') {
        overwrites.push({ id: o.id, type: Number(o.type), allow: big(o.allow), deny: big(o.deny) });
      }
    }
  }
  return {
    id: c.id,
    name: str(c.name).trim() || 'kanal',
    type: c.type,
    position: typeof c.position === 'number' ? c.position : 0,
    nsfw: c.nsfw === true,
    parentId: typeof c.parent_id === 'string' ? c.parent_id : null,
    overwrites,
  };
}

/** Rettighederne for en rolleliste (med @everyone som basis) i en kanal. Rækkefølge som Discord: @everyone, roller, medlem. */
export function channelPermissions(opts: {
  guildId: string;
  everyone: bigint;
  roleIds: string[];
  rolePerms: Map<string, bigint>;
  memberId?: string;
  overwrites: Overwrite[];
}): bigint {
  let perms = opts.everyone;
  for (const r of opts.roleIds) perms |= opts.rolePerms.get(r) ?? 0n;
  if ((perms & ADMINISTRATOR) !== 0n) return ALL;
  const ev = opts.overwrites.find((o) => o.type === 0 && o.id === opts.guildId);
  if (ev) perms = (perms & ~ev.deny) | ev.allow;
  let deny = 0n;
  let allow = 0n;
  for (const o of opts.overwrites) {
    if (o.type === 0 && opts.roleIds.includes(o.id) && o.id !== opts.guildId) {
      deny |= o.deny;
      allow |= o.allow;
    }
  }
  perms = (perms & ~deny) | allow;
  if (opts.memberId) {
    const m = opts.overwrites.find((o) => o.type === 1 && o.id === opts.memberId);
    if (m) perms = (perms & ~m.deny) | m.allow;
  }
  return perms;
}

export function createChatClient(opts: {
  token: string;
  channelId: string;
  fetch?: typeof fetch;
  now?: () => number;
  ttlMs?: number;
  timeoutMs?: number;
  /** Kun kanaler med disse navne (små bogstaver) vises, i den rækkefølge; udeladt = alle offentlige. */
  visibleChannels?: string[];
  /** Kanal-id'er der altid er skrivebeskyttede (fx den WoW-linkede kanal). */
  readOnlyChannelIds?: string[];
  /** Kanal-id'er der aldrig vises (fx en ekstra kanal med samme navn). */
  hiddenChannelIds?: string[];
}): ChatClient {
  const doFetch = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlMs ?? 4000;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const visible = opts.visibleChannels?.map((n) => n.toLowerCase());
  const forcedReadOnly = new Set(opts.readOnlyChannelIds ?? []);
  const hidden = new Set(opts.hiddenChannelIds ?? []);
  const api = 'https://discord.com/api/v10';
  const userAgent = 'DiscordBot (https://aula.aaensoftware.com, 1.0)';
  const authHeaders = { Authorization: `Bot ${opts.token}`, 'User-Agent': userAgent };

  let blockedUntil = 0;

  // ---- kanalliste ----
  let guildId: string | null = null;
  let botId: string | null = null;
  let listGood: { at: number; bases: ListBase[] } | null = null;
  let listRetryAt = 0;
  let listInflight: Promise<ListBase[] | null> | null = null;
  const readOnly = new Map<string, number>(); // kanal-id -> udløb

  async function getJson(path: string): Promise<unknown> {
    const res = await doFetch(`${api}${path}`, {
      headers: authHeaders,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      await discard(res);
      throw new Error('discord');
    }
    return res.json();
  }

  async function buildList(): Promise<ListBase[]> {
    if (!guildId) {
      const ch = await getJson(`/channels/${encodeURIComponent(opts.channelId)}`);
      const g = isObj(ch) ? ch.guild_id : undefined;
      if (typeof g !== 'string' || !ID_RE.test(g)) throw new Error('guild');
      guildId = g;
    }
    if (!botId) {
      const me = await getJson('/users/@me');
      const id = isObj(me) ? me.id : undefined;
      if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error('bot');
      botId = id;
    }
    const gid = guildId;
    const bid = botId;
    const [rolesRaw, channelsRaw, memberRaw] = await Promise.all([
      getJson(`/guilds/${gid}/roles`),
      getJson(`/guilds/${gid}/channels`),
      getJson(`/guilds/${gid}/members/${bid}`),
    ]);
    if (!Array.isArray(rolesRaw) || !Array.isArray(channelsRaw) || !isObj(memberRaw)) throw new Error('shape');
    const rolePerms = new Map<string, bigint>();
    for (const r of rolesRaw) if (isObj(r) && typeof r.id === 'string') rolePerms.set(r.id, big(r.permissions));
    const everyone = rolePerms.get(gid);
    if (everyone === undefined) throw new Error('roles');
    const botRoles = Array.isArray(memberRaw.roles) ? memberRaw.roles.filter((x): x is string => typeof x === 'string') : [];
    const seeAndRead = VIEW_CHANNEL | READ_HISTORY;
    const out: ListBase[] = [];
    const categories = new Map<string, string>();
    for (const raw of channelsRaw) {
      if (isObj(raw) && raw.type === 4 && typeof raw.id === 'string') categories.set(raw.id, str(raw.name).trim());
    }
    for (const raw of channelsRaw) {
      const c = parseChannel(raw);
      if (!c || (c.type !== 0 && c.type !== 5) || c.nsfw) continue; // aldersbegrænsede kanaler vises ikke
      if (hidden.has(c.id) || (visible && !visible.includes(c.name.toLowerCase()))) continue;
      const pub = channelPermissions({ guildId: gid, everyone, roleIds: [], rolePerms, overwrites: c.overwrites });
      if ((pub & seeAndRead) !== seeAndRead) continue;
      const bot = channelPermissions({ guildId: gid, everyone, roleIds: botRoles, rolePerms, memberId: bid, overwrites: c.overwrites });
      if ((bot & seeAndRead) !== seeAndRead) continue;
      out.push({ id: c.id, name: c.name, position: c.position, type: c.type, botWrite: c.type === 0 && !forcedReadOnly.has(c.id) && (bot & SEND_MESSAGES) !== 0n, category: (c.parentId && categories.get(c.parentId)) || null });
    }
    return out;
  }

  /** Den aktuelle offentlige liste (cachet), eller null når den hverken kan hentes eller er gammel nok til at bruge. */
  async function currentBases(): Promise<ListBase[] | null> {
    const t = now();
    if (listGood && t - listGood.at >= 0 && t - listGood.at < LIST_TTL_MS) return listGood.bases;
    const stale = () => (listGood && t - listGood.at <= LIST_MAX_STALE_MS ? listGood.bases : null);
    if (t < listRetryAt) return stale();
    listInflight ??= buildList()
      .then((bases) => {
        listGood = { at: t, bases };
        return bases;
      })
      .catch(() => {
        listRetryAt = t + LIST_RETRY_MS;
        return stale();
      })
      .finally(() => {
        listInflight = null;
      });
    return listInflight;
  }

  function toChannels(bases: ListBase[]): ChatChannel[] {
    const t = now();
    for (const [id, until] of readOnly) if (until <= t) readOnly.delete(id);
    const order = (b: ListBase) => (visible ? visible.indexOf(b.name.toLowerCase()) : 0);
    const dup = (b: ListBase) => bases.filter((x) => x.name.toLowerCase() === b.name.toLowerCase()).length > 1;
    return [...bases]
      .sort((a, b) => order(a) - order(b) || a.position - b.position || a.name.localeCompare(b.name, 'da'))
      .map((b) => ({ id: b.id, name: dup(b) && b.category ? `${b.name} (${b.category})` : b.name, canWrite: b.botWrite && !readOnly.has(b.id) }));
  }

  async function lookup(channelId: unknown): Promise<{ ok: true; channel: ChatChannel } | { ok: false; error: 'not_found' | 'unavailable' }> {
    if (typeof channelId !== 'string' || !ID_RE.test(channelId)) return { ok: false, error: 'not_found' };
    const bases = await currentBases();
    if (!bases) return { ok: false, error: 'unavailable' };
    const channel = toChannels(bases).find((c) => c.id === channelId);
    return channel ? { ok: true, channel } : { ok: false, error: 'not_found' };
  }

  // ---- beskeder pr. kanal ----
  type State = {
    good: { at: number; parsed: Parsed } | null;
    last: { at: number; result: ChatResult } | null;
    inflight: Promise<ChatResult> | null;
    generation: number;
  };
  const states = new Map<string, State>();

  function stateFor(id: string): State {
    let s = states.get(id);
    if (s) {
      states.delete(id); // flyt bagest (LRU)
    } else {
      s = { good: null, last: null, inflight: null, generation: 0 };
      while (states.size >= MAX_CHANNEL_STATES) {
        const oldest = states.keys().next().value;
        if (oldest === undefined) break;
        states.delete(oldest);
      }
    }
    states.set(id, s);
    return s;
  }

  function fresh(parsed: Parsed): ChatResult {
    return { messages: parsed.messages, stale: false, ...(parsed.hint ? { hint: parsed.hint } : {}) };
  }

  function degraded(s: State, t: number): ChatResult {
    if (s.good && t - s.good.at <= MAX_STALE_MS) return { ...fresh(s.good.parsed), stale: true };
    return { messages: [], stale: false, error: 'unavailable' };
  }

  async function refresh(id: string, s: State): Promise<ChatResult> {
    const t = now();
    const gen = s.generation;
    let result: ChatResult;
    try {
      const res = await doFetch(`${api}/channels/${encodeURIComponent(id)}/messages?limit=50`, {
        headers: authHeaders,
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 401 || res.status === 403) {
        await discard(res);
        result = { messages: [], stale: false, error: 'no_access' };
      } else if (res.status === 404) {
        await discard(res);
        result = { messages: [], stale: false, error: 'not_found' };
      } else if (res.status === 429) {
        const body: unknown = await res.json().catch(() => null);
        blockedUntil = t + retrySeconds(res, body) * 1000;
        return degraded(s, t);
      } else if (!res.ok) {
        await discard(res);
        result = degraded(s, t);
      } else {
        const parsed = parse(await res.json().catch(() => null));
        if (!parsed) {
          result = degraded(s, t);
        } else {
          s.good = { at: t, parsed };
          result = fresh(parsed);
        }
      }
    } catch {
      result = degraded(s, t);
    }
    if (gen === s.generation) s.last = { at: t, result };
    return result;
  }

  async function getMessages(channelId: string): Promise<ChatResult> {
    const found = await lookup(channelId);
    if (!found.ok) return { messages: [], stale: false, error: found.error };
    const s = stateFor(channelId);
    const t = now();
    if (s.last && t - s.last.at >= 0 && t - s.last.at < ttl) return s.last.result;
    if (t < blockedUntil) return degraded(s, t);
    s.inflight ??= refresh(channelId, s).finally(() => {
      s.inflight = null;
    });
    return s.inflight;
  }

  async function send(channelId: string, content: string): Promise<SendResult> {
    const found = await lookup(channelId);
    if (!found.ok) return { ok: false, error: found.error };
    if (readOnly.has(channelId)) return { ok: false, error: 'read_only' };
    if (!found.channel.canWrite) return { ok: false, error: 'no_access' };
    const t = now();
    if (t < blockedUntil) return { ok: false, error: 'rate_limited' };
    try {
      const res = await doFetch(`${api}/channels/${encodeURIComponent(channelId)}/messages`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) {
        await discard(res);
        const s = stateFor(channelId);
        s.generation++;
        s.last = null; // næste læsning henter listen igen, så den nye besked ses
        return { ok: true };
      }
      if (res.status === 429) {
        const body: unknown = await res.json().catch(() => null);
        blockedUntil = t + retrySeconds(res, body) * 1000;
        return { ok: false, error: 'rate_limited' };
      }
      if (res.status === 403) {
        const body: unknown = await res.json().catch(() => null);
        if (isObj(body) && body.code === WOW_LINKED_CODE) {
          readOnly.set(channelId, now() + READ_ONLY_MS);
          return { ok: false, error: 'read_only' };
        }
        return { ok: false, error: 'no_access' };
      }
      await discard(res);
      if (res.status === 401 || res.status === 404) return { ok: false, error: 'no_access' };
      if (res.status === 400) return { ok: false, error: 'invalid' };
      return { ok: false, error: 'unavailable' };
    } catch {
      return { ok: false, error: 'unavailable' };
    }
  }

  return {
    async listChannels(): Promise<ChannelsResult> {
      const bases = await currentBases();
      return bases ? { channels: toChannels(bases) } : { channels: [], error: 'unavailable' };
    },
    getMessages,
    sendMessage: send,
  };
}
