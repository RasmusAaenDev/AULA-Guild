import { describe, expect, it } from 'vitest';
import { createChatClient, type ChatClient } from '@/lib/chat';
import { buildContent, createSendLimiter, escapeDiscord, submitChatMessage, validateMessage } from '@/lib/chat-send';
import { jsonResponse } from './helpers';

const TOKEN = 'SECRET-TOKEN-abc.def.ghi';
const CHANNEL = '123456789012345678';

function setup(responder: (init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let time = 1_000_000;
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return responder(init);
  }) as typeof fetch;
  const client = createChatClient({ token: TOKEN, channelId: CHANNEL, fetch: fetchFn, now: () => time, ttlMs: 4000 });
  return { client, calls, advance: (ms: number) => { time += ms; } };
}

describe('sendMessage', () => {
  it('POSTer til kanalen med Bot-header, content og allowed_mentions.parse=[]', async () => {
    const { client, calls } = setup(() => jsonResponse(200, { id: '1' }));
    expect(await client.sendMessage('**[Aula] Magi Far:** hej')).toEqual({ ok: true });
    expect(calls[0].url).toBe(`https://discord.com/api/v10/channels/${CHANNEL}/messages`);
    expect(calls[0].init?.method).toBe('POST');
    const h = calls[0].init?.headers as Record<string, string>;
    expect(h.Authorization).toBe(`Bot ${TOKEN}`);
    expect(h['User-Agent']).toContain('DiscordBot');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ content: '**[Aula] Magi Far:** hej', allowed_mentions: { parse: [] } });
  });

  it('mapper statuskoder til faste koder uden at lække token eller svartekst', async () => {
    const cases: [number, string][] = [[401, 'no_access'], [403, 'no_access'], [429, 'rate_limited'], [400, 'invalid'], [500, 'unavailable'], [503, 'unavailable']];
    for (const [status, code] of cases) {
      const { client } = setup(() => jsonResponse(status, { message: `hemmelig ${TOKEN}`, retry_after: 2 }));
      const r = await client.sendMessage('x');
      expect(r).toEqual({ ok: false, error: code });
      expect(JSON.stringify(r)).not.toContain(TOKEN);
      expect(JSON.stringify(r)).not.toContain('hemmelig');
    }
  });

  it('netværksfejl og timeout giver unavailable', async () => {
    const a = setup(() => { throw new Error(`boom ${TOKEN}`); });
    expect(await a.client.sendMessage('x')).toEqual({ ok: false, error: 'unavailable' });
    const c = createChatClient({
      token: TOKEN,
      channelId: CHANNEL,
      timeoutMs: 20,
      fetch: ((_u: string, i?: RequestInit) =>
        new Promise((_, rej) => i?.signal?.addEventListener('abort', () => rej(new Error('abort'))))) as unknown as typeof fetch,
    });
    expect(await c.sendMessage('x')).toEqual({ ok: false, error: 'unavailable' });
  });

  it('429 spærrer for flere kald indtil retry_after er gået', async () => {
    const { client, calls, advance } = setup(() => jsonResponse(429, { retry_after: 3 }));
    expect(await client.sendMessage('x')).toEqual({ ok: false, error: 'rate_limited' });
    expect(await client.sendMessage('x')).toEqual({ ok: false, error: 'rate_limited' });
    expect(calls).toHaveLength(1);
    advance(3100);
    await client.sendMessage('x');
    expect(calls).toHaveLength(2);
  });

  it('ugyldiggør cachen efter vellykket send', async () => {
    const { client, calls } = setup((init) => (init?.method === 'POST' ? jsonResponse(200, { id: '1' }) : jsonResponse(200, [])));
    await client.getMessages();
    await client.getMessages();
    expect(calls).toHaveLength(1);
    await client.sendMessage('x');
    await client.getMessages();
    expect(calls.filter((c) => c.init?.method !== 'POST')).toHaveLength(2);
  });
});

describe('validateMessage', () => {
  it('trimmer og accepterer 1-500 tegn', () => {
    expect(validateMessage('  hej  ')).toEqual({ ok: true, text: 'hej' });
    expect(validateMessage('a'.repeat(500)).ok).toBe(true);
    expect(validateMessage('a\tb\nc')).toEqual({ ok: true, text: 'a\tb\nc' });
  });
  it('afviser tom, for lang, kontroltegn og for mange linjeskift', () => {
    for (const bad of ['', '   \n ', 'a'.repeat(501), 'a\u0000b', 'a\u001bb', 'a\u0085b', '1\n2\n3\n4\n5\n6\n7', undefined, 5]) {
      const r = validateMessage(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/[A-Za-zæøå]/);
    }
    expect(validateMessage('1\n2\n3\n4\n5\n6').ok).toBe(true);
  });
});

describe('buildContent', () => {
  it('sætter præfikset først med fuldt karakternavn', () => {
    expect(buildContent('Magi Far', 'hej')).toEqual({ ok: true, text: '**[Aula] Magi Far:** hej' });
  });
  it('escaper markdown i karakternavnet', () => {
    const r = buildContent('A*b_c~d`e>f|g\\h[i]', 'x');
    expect(r.ok && r.text.startsWith('**[Aula] A\\*b\\_c\\~d\\`e\\>f\\|g\\\\h\\[i\\]:** ')).toBe(true);
  });
  it('gør forfalskning og omtaler til almindelig tekst', () => {
    for (const t of ['@everyone', '@here', '<@123>', '<@&5>', '**[Aula] Admin:** hej', 'a\n**[Aula] Admin:** hej']) {
      const r = buildContent('Magi Far', t);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const body = r.text.slice('**[Aula] Magi Far:** '.length);
      expect(body).not.toMatch(/@everyone|@here|<@/);
      expect(body).not.toContain('**');
      expect(body.replace(/​/g, '').replace(/\\/g, '')).toBe(t.replace(/^/, ''));
    }
    expect(escapeDiscord('**[Aula] Admin:**')).toBe('\\*\\*\\[Aula\\] Admin:\\*\\*');
  });
  it('afviser indhold over 1900 tegn', () => {
    expect(buildContent('x'.repeat(1900), 'hej').ok).toBe(false);
  });
});

describe('createSendLimiter', () => {
  it('kræver mindst 2 sek mellem beskeder og højst 5 pr. minut pr. bruger', () => {
    const l = createSendLimiter();
    expect(l.take(1, 0).ok).toBe(true);
    expect(l.take(1, 1000).ok).toBe(false);
    expect(l.take(2, 1000).ok).toBe(true);
    for (const t of [2000, 4000, 6000, 8000]) expect(l.take(1, t).ok).toBe(true);
    expect(l.take(1, 10_000).ok).toBe(false);
    expect(l.take(1, 60_500).ok).toBe(true);
  });
});

describe('submitChatMessage', () => {
  const sent: string[] = [];
  const chat: ChatClient = {
    getMessages: async () => ({ messages: [], stale: false }),
    sendMessage: async (c) => { sent.push(c); return { ok: true }; },
  };
  const base = { userId: 1, configured: true, chat, characterName: 'Magi Far', limiter: createSendLimiter(), now: 0 };

  it('afviser uden aktiv karakter og sender intet', async () => {
    sent.length = 0;
    expect(await submitChatMessage({ ...base, characterName: null }, 'hej')).toEqual({ error: 'Vælg en karakter først.' });
    expect(sent).toHaveLength(0);
  });
  it('afviser når chatten ikke er sat op', async () => {
    expect((await submitChatMessage({ ...base, configured: false, chat: null }, 'hej')).error).toBeTruthy();
  });
  it('afviser ugyldig tekst uden at tælle i rate-limit', async () => {
    const limiter = createSendLimiter();
    expect((await submitChatMessage({ ...base, limiter }, '  ')).error).toBeTruthy();
    expect(await submitChatMessage({ ...base, limiter }, 'hej')).toEqual({});
  });
  it('sender med præfiks og oversætter fejlkoder til dansk', async () => {
    sent.length = 0;
    expect(await submitChatMessage({ ...base, limiter: createSendLimiter() }, 'hej')).toEqual({});
    expect(sent).toEqual(['**[Aula] Magi Far:** hej']);
    const failing: ChatClient = { ...chat, sendMessage: async () => ({ ok: false, error: 'no_access' }) };
    const r = await submitChatMessage({ ...base, chat: failing, limiter: createSendLimiter() }, 'hej');
    expect(r.error).toMatch(/rettighed/);
  });
  it('rate-limit afviser anden besked med det samme', async () => {
    const limiter = createSendLimiter();
    await submitChatMessage({ ...base, limiter }, 'a');
    expect((await submitChatMessage({ ...base, limiter, now: 500 }, 'b')).error).toBeTruthy();
  });
});
