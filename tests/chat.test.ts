import { describe, expect, it } from 'vitest';
import { createChatClient } from '@/lib/chat';
import { jsonResponse } from './helpers';

const TOKEN = 'SECRET-TOKEN-abc.def.ghi';
const CHANNEL = '123456789012345678';

function msg(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    content: `besked ${id}`,
    timestamp: '2026-11-10T10:00:00.000000+00:00',
    author: { id: '1', username: 'bruger', global_name: 'Visningsnavn' },
    mentions: [],
    embeds: [],
    attachments: [],
    ...over,
  };
}

type Call = { url: string; init?: RequestInit };

function setup(responder: (n: number, init?: RequestInit) => Response | Promise<Response>, ttlMs?: number, timeoutMs?: number) {
  const calls: Call[] = [];
  let time = 1_000_000;
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return responder(calls.length, init);
  }) as typeof fetch;
  const client = createChatClient({ token: TOKEN, channelId: CHANNEL, fetch: fetchFn, now: () => time, ttlMs, timeoutMs });
  return { client, calls, advance: (ms: number) => { time += ms; } };
}

describe('createChatClient', () => {
  it('kalder Discord med korrekt URL og Bot-header', async () => {
    const { client, calls } = setup(() => jsonResponse(200, [msg('2')]));
    await client.getMessages();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://discord.com/api/v10/channels/${CHANNEL}/messages?limit=50`);
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(`Bot ${TOKEN}`);
  });

  it('mapper forfatter, bot-flag og tid', async () => {
    const { client } = setup(() =>
      jsonResponse(200, [
        msg('3', { author: { id: '9', username: 'broen', bot: true } }),
        msg('2', { author: { id: '8', username: 'hook' }, webhook_id: '77' }),
        msg('1'),
      ]),
    );
    const r = await client.getMessages();
    expect(r.stale).toBe(false);
    expect(r.error).toBeUndefined();
    const byId = Object.fromEntries(r.messages.map((m) => [m.id, m]));
    expect(byId['1']).toMatchObject({ author: 'Visningsnavn', bot: false, content: 'besked 1' });
    expect(byId['2']).toMatchObject({ author: 'hook', bot: true });
    expect(byId['3']).toMatchObject({ author: 'broen', bot: true });
    expect(byId['1'].timestamp).toBe('2026-11-10T10:00:00.000Z');
  });

  it('returnerer beskeder i stigende tid', async () => {
    const { client } = setup(() => jsonResponse(200, [msg('30'), msg('20'), msg('10')]));
    const r = await client.getMessages();
    expect(r.messages.map((m) => m.id)).toEqual(['10', '20', '30']);
  });

  it('erstatter omtaler, emoji, rolle- og kanalomtaler', async () => {
    const mentions = [{ id: '5', username: 'kari', global_name: 'Kari K' }, { id: '6', username: 'ole' }];
    const { client } = setup(() =>
      jsonResponse(200, [
        msg('1', {
          content: 'hej <@5> og <@!6> og <@7> <@&99> <#42> <:wow:123> <a:dans:456> @everyone',
          mentions,
        }),
      ]),
    );
    const r = await client.getMessages();
    expect(r.messages[0].content).toBe('hej @Kari K og @ole og @bruger «@rolle» «#kanal» :wow: :dans: @everyone');
  });

  it('bruger embed, ellers vedhæftning, når teksten er tom', async () => {
    const { client } = setup(() =>
      jsonResponse(200, [
        msg('1', { content: '', embeds: [{ title: 'Titel', description: 'Beskrivelse' }] }),
        msg('2', { content: '', attachments: [{ id: 'a' }] }),
        msg('3', { content: '', embeds: [{ description: 'kun beskrivelse' }] }),
      ]),
    );
    const r = await client.getMessages();
    expect(r.messages.map((m) => m.content)).toEqual(['Titel\nBeskrivelse', '[vedhæftet fil]', 'kun beskrivelse']);
    expect(r.hint).toBeUndefined();
  });

  it('tåler manglende valgfrie felter', async () => {
    const { client } = setup(() => jsonResponse(200, [{ id: '1420070400000000000'.slice(0, 18) }]));
    const r = await client.getMessages();
    expect(r.error).toBeUndefined();
    expect(r.messages[0]).toMatchObject({ author: 'Ukendt', content: '', bot: false });
    expect(Number.isNaN(Date.parse(r.messages[0].timestamp))).toBe(false);
  });

  it('giver no_content_intent når alle beskeder er helt tomme', async () => {
    const { client } = setup(() => jsonResponse(200, [msg('1', { content: '' }), msg('2', { content: '' })]));
    const r = await client.getMessages();
    expect(r.hint).toBe('no_content_intent');
    expect(r.messages).toHaveLength(2);
  });

  it('giver intet tip for tom kanal eller når nogen har tekst', async () => {
    expect((await setup(() => jsonResponse(200, [])).client.getMessages()).hint).toBeUndefined();
    const r = await setup(() => jsonResponse(200, [msg('1', { content: '' }), msg('2')])).client.getMessages();
    expect(r.hint).toBeUndefined();
  });

  it('cacher inden for TTL og henter igen efter', async () => {
    const { client, calls, advance } = setup(() => jsonResponse(200, [msg('1')]));
    await client.getMessages();
    advance(3999);
    await client.getMessages();
    expect(calls).toHaveLength(1);
    advance(2);
    await client.getMessages();
    expect(calls).toHaveLength(2);
  });

  it('deler igangværende kald', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const { client, calls } = setup(async () => { await gate; return jsonResponse(200, [msg('1')]); });
    const a = client.getMessages();
    const b = client.getMessages();
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(calls).toHaveLength(1);
    expect(ra).toEqual(rb);
  });

  it.each([[401], [403]])('%i giver no_access uden beskeder', async (status) => {
    const { client } = setup(() => jsonResponse(status, { message: 'x' }));
    expect(await client.getMessages()).toEqual({ messages: [], stale: false, error: 'no_access' });
  });

  it('404 giver not_found', async () => {
    const { client } = setup(() => jsonResponse(404, {}));
    expect(await client.getMessages()).toEqual({ messages: [], stale: false, error: 'not_found' });
  });

  it('cacher også fejl inden for TTL', async () => {
    const { client, calls } = setup(() => jsonResponse(403, {}));
    await client.getMessages();
    await client.getMessages();
    expect(calls).toHaveLength(1);
  });

  it('429 med retry_after i body: stale cache og ingen nyt kald før tiden er gået', async () => {
    const { client, calls, advance } = setup((n) =>
      n === 1 ? jsonResponse(200, [msg('1')]) : n === 2 ? jsonResponse(429, { retry_after: 20.5 }) : jsonResponse(200, [msg('1'), msg('2')]),
    );
    await client.getMessages();
    advance(5000);
    const r = await client.getMessages();
    expect(calls).toHaveLength(2);
    expect(r.stale).toBe(true);
    expect(r.messages.map((m) => m.id)).toEqual(['1']);
    advance(20_000);
    const r2 = await client.getMessages();
    expect(calls).toHaveLength(2);
    expect(r2.stale).toBe(true);
    advance(600);
    const r3 = await client.getMessages();
    expect(calls).toHaveLength(3);
    expect(r3.stale).toBe(false);
    expect(r3.messages).toHaveLength(2);
  });

  it('429 med Retry-After-header virker, og uden cache giver det unavailable', async () => {
    const { client, calls, advance } = setup(() => new Response('{}', { status: 429, headers: { 'retry-after': '10' } }));
    expect(await client.getMessages()).toEqual({ messages: [], stale: false, error: 'unavailable' });
    advance(9000);
    await client.getMessages();
    expect(calls).toHaveLength(1);
    advance(1100);
    await client.getMessages();
    expect(calls).toHaveLength(2);
  });

  it('5xx og netværksfejl giver stale cache, ellers unavailable', async () => {
    for (const bad of [() => jsonResponse(503, {}), () => { throw new TypeError('fetch failed Bot ' + TOKEN); }]) {
      const { client, advance } = setup((n) => (n === 1 ? jsonResponse(200, [msg('1')]) : bad()));
      await client.getMessages();
      advance(5000);
      const r = await client.getMessages();
      expect(r.stale).toBe(true);
      expect(r.error).toBeUndefined();
      expect(r.messages).toHaveLength(1);
      const none = setup(() => bad());
      expect(await none.client.getMessages()).toEqual({ messages: [], stale: false, error: 'unavailable' });
    }
  });

  it('en mislykket opdatering sletter ikke en god cache, og et gen-forsøg kan lykkes', async () => {
    const { client, advance } = setup((n) => (n === 2 ? jsonResponse(500, {}) : jsonResponse(200, [msg('1')])));
    await client.getMessages();
    advance(5000);
    expect((await client.getMessages()).stale).toBe(true);
    advance(5000);
    const r = await client.getMessages();
    expect(r.stale).toBe(false);
    expect(r.messages).toHaveLength(1);
  });

  it('serverer ikke en cache ældre end 10 minutter som stale', async () => {
    const { client, advance } = setup((n) => (n === 1 ? jsonResponse(200, [msg('1')]) : jsonResponse(500, {})));
    await client.getMessages();
    advance(9 * 60_000);
    expect((await client.getMessages()).stale).toBe(true);
    advance(2 * 60_000);
    expect(await client.getMessages()).toEqual({ messages: [], stale: false, error: 'unavailable' });
  });

  it('misdannede svar giver unavailable', async () => {
    const bodies: unknown[] = [{ message: 'nej' }, 'tekst', null, [null], [{ content: 'uden id' }], [{ id: 'abc' }], [msg('1'), 5]];
    for (const body of bodies) {
      const { client } = setup(() => jsonResponse(200, body));
      expect(await client.getMessages()).toEqual({ messages: [], stale: false, error: 'unavailable' });
    }
    const invalidJson = setup(() => new Response('ikke json', { status: 200 }));
    expect((await invalidJson.client.getMessages()).error).toBe('unavailable');
  });

  it('tokenet forekommer aldrig i resultater', async () => {
    const outcomes = [
      () => jsonResponse(200, [msg('1')]),
      () => jsonResponse(401, { message: TOKEN }),
      () => jsonResponse(404, {}),
      () => jsonResponse(500, { message: TOKEN }),
      () => { throw new Error(`boom ${TOKEN}`); },
      () => jsonResponse(200, { token: TOKEN }),
    ];
    for (const o of outcomes) {
      const { client } = setup(o);
      const r = await client.getMessages();
      expect(JSON.stringify(r)).not.toContain(TOKEN);
      expect(JSON.stringify(r)).not.toContain('Bot ');
    }
  });

  it('sender User-Agent', async () => {
    const { client, calls } = setup(() => jsonResponse(200, [msg('1')]));
    await client.getMessages();
    expect((calls[0].init?.headers as Record<string, string>)['User-Agent']).toBe('DiscordBot (https://aula.aaensoftware.com, 1.0)');
  });

  it('tilføjer vedhæftningsmarkør også når der er tekst', async () => {
    const { client } = setup(() => jsonResponse(200, [msg('1', { content: 'se her', attachments: [{ id: 'a' }] })]));
    expect((await client.getMessages()).messages[0].content).toBe('se her\n[vedhæftet fil]');
  });

  it('retry_after 0 blokerer stadig i mindst ét sekund', async () => {
    const { client, calls, advance } = setup(() => jsonResponse(429, { retry_after: 0 }));
    await client.getMessages();
    advance(5000);
    await client.getMessages();
    expect(calls).toHaveLength(2);
    advance(500);
    await client.getMessages();
    expect(calls).toHaveLength(2);
    advance(600);
    await client.getMessages();
    expect(calls).toHaveLength(3);
  });

  it('afbryder en hængende anmodning og kan bruges igen bagefter', async () => {
    const hang = (init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'TimeoutError')));
      });
    const { client, calls, advance } = setup((n, init) => (n === 1 ? hang(init) : jsonResponse(200, [msg('1')])), undefined, 20);
    expect(await client.getMessages()).toEqual({ messages: [], stale: false, error: 'unavailable' });
    advance(5000);
    const r = await client.getMessages();
    expect(calls).toHaveLength(2);
    expect(r.messages).toHaveLength(1);
  });

  it('en hængende anmodning giver stale cache når der er en', async () => {
    const hang = (init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'TimeoutError')));
      });
    const { client, advance } = setup((n, init) => (n === 1 ? jsonResponse(200, [msg('1')]) : hang(init)), undefined, 20);
    await client.getMessages();
    advance(5000);
    const r = await client.getMessages();
    expect(r.stale).toBe(true);
    expect(r.messages).toHaveLength(1);
  });

  it('forbruger svarkroppen ved fejlstatus', async () => {
    let cancelled = 0;
    const mk = (status: number) => {
      const res = new Response('x', { status });
      const orig = res.body!.cancel.bind(res.body);
      res.body!.cancel = (...a: []) => { cancelled++; return orig(...a); };
      return res;
    };
    for (const status of [401, 404, 500]) await setup(() => mk(status)).client.getMessages();
    expect(cancelled).toBe(3);
  });
});
