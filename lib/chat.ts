// Læs-kun-visning af en Discord-kanal. Al netværk går gennem den injicerede `fetch`, og tokenet
// forlader aldrig modulet: resultater og fejl er kun data og faste koder, aldrig svar- eller fejltekst.

export type ChatMessage = { id: string; author: string; content: string; timestamp: string; bot: boolean };
export type ChatError = 'no_access' | 'not_found' | 'unavailable';
export type ChatResult = { messages: ChatMessage[]; stale: boolean; error?: ChatError; hint?: 'no_content_intent' };
export type ChatClient = { getMessages(): Promise<ChatResult> };

const MAX_STALE_MS = 10 * 60_000;
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

function renderContent(content: string, mentions: unknown): string {
  const names = new Map<string, string>();
  if (Array.isArray(mentions)) {
    for (const m of mentions) {
      if (isObj(m) && typeof m.id === 'string') {
        const n = userName(m);
        if (n) names.set(m.id, n);
      }
    }
  }
  return content
    .replace(/<@!?(\d+)>/g, (_, id: string) => `@${names.get(id) ?? 'bruger'}`)
    .replace(/<@&\d+>/g, '«@rolle»')
    .replace(/<#\d+>/g, '«#kanal»')
    .replace(/<a?:(\w+):\d+>/g, ':$1:');
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
    let content = renderContent(raw, m.mentions);
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
        content,
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

export function createChatClient(opts: {
  token: string;
  channelId: string;
  fetch?: typeof fetch;
  now?: () => number;
  ttlMs?: number;
  timeoutMs?: number;
}): ChatClient {
  const doFetch = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlMs ?? 4000;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const url = `https://discord.com/api/v10/channels/${encodeURIComponent(opts.channelId)}/messages?limit=50`;

  let good: { at: number; parsed: Parsed } | null = null;
  let last: { at: number; result: ChatResult } | null = null;
  let blockedUntil = 0;
  let inflight: Promise<ChatResult> | null = null;

  function fresh(parsed: Parsed): ChatResult {
    return { messages: parsed.messages, stale: false, ...(parsed.hint ? { hint: parsed.hint } : {}) };
  }

  /** Midlertidig fejl: seneste gode svar som forældet, hvis det ikke er for gammelt. */
  function degraded(t: number): ChatResult {
    if (good && t - good.at <= MAX_STALE_MS) return { ...fresh(good.parsed), stale: true };
    return { messages: [], stale: false, error: 'unavailable' };
  }

  async function refresh(): Promise<ChatResult> {
    const t = now();
    let result: ChatResult;
    try {
      const res = await doFetch(url, {
        headers: { Authorization: `Bot ${opts.token}`, 'User-Agent': 'DiscordBot (https://aula.aaensoftware.com, 1.0)' },
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
        return degraded(t);
      } else if (!res.ok) {
        await discard(res);
        result = degraded(t);
      } else {
        const parsed = parse(await res.json().catch(() => null));
        if (!parsed) {
          result = degraded(t);
        } else {
          good = { at: t, parsed };
          result = fresh(parsed);
        }
      }
    } catch {
      result = degraded(t);
    }
    last = { at: t, result };
    return result;
  }

  return {
    getMessages(): Promise<ChatResult> {
      const t = now();
      if (last && t - last.at >= 0 && t - last.at < ttl) return Promise.resolve(last.result);
      if (t < blockedUntil) return Promise.resolve(degraded(t));
      inflight ??= refresh().finally(() => {
        inflight = null;
      });
      return inflight;
    },
  };
}
