import { describe, expect, it } from 'vitest';
import { createChatClient } from '@/lib/chat';
import { pickChannel } from '@/lib/chat-ui';
import { jsonResponse } from './helpers';
import { ADMIN, BOT, CHANNEL, GUILD, HISTORY, SEND, VIEW, fixture, withGuild, type FakeChannel, type Fixture } from './discord-fake';

const TOKEN = 'SECRET-TOKEN-abc.def.ghi';
const ALLOW_ALL = String(VIEW | HISTORY | SEND);
const ow = (id: string, type: number, allow = 0, deny = 0) => ({ id, type, allow: String(allow), deny: String(deny) });
const ch = (id: string, over: Partial<FakeChannel> = {}): FakeChannel => ({ id, name: `k${id}`, type: 0, position: 0, ...over });

function setup(fx: Fixture, messages?: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const msgCalls: { url: string; init?: RequestInit }[] = [];
  const other: string[] = [];
  let time = 1_000_000;
  let cur = fx;
  const fetchFn = withGuild((url, init) => {
    msgCalls.push({ url, init });
    return messages ? messages(url, init) : jsonResponse(200, init?.method === 'POST' ? { id: '1' } : []);
  }, () => cur, other);
  const client = createChatClient({ token: TOKEN, channelId: CHANNEL, fetch: fetchFn, now: () => time });
  return { client, msgCalls, other, advance: (ms: number) => { time += ms; }, set: (f: Fixture) => { cur = f; } };
}
const ids = async (c: ReturnType<typeof setup>) => (await c.client.listChannels()).channels.map((x) => x.id);

describe('offentlig/privat', () => {
  it('udleder serveren fra standardkanalen og viser offentlige tekst- og announcement-kanaler', async () => {
    const s = setup(fixture({ channels: [ch('11'), ch('12', { type: 5 }), ch('13', { type: 2 }), ch('14', { type: 4 }), ch('15', { type: 15 }), ch('16', { type: 11 })] }));
    const r = await s.client.listChannels();
    expect(r.channels.map((c) => [c.id, c.canWrite])).toEqual([['11', true], ['12', false]]);
    expect(s.other[0]).toBe(`/channels/${CHANNEL}`);
  });
  it('skjuler aldersbegrænsede (nsfw) kanaler', async () => {
    const s = setup(fixture({ channels: [ch('11'), ch('12', { nsfw: true })] }));
    expect(await ids(s)).toEqual(['11']);
  });
  it('@everyone uden View eller Read History skjuler kanalen', async () => {
    const s = setup(fixture({ roles: [{ id: GUILD, permissions: String(SEND) }], channels: [ch('11')] }));
    expect(await ids(s)).toEqual([]);
    const t = setup(fixture({ roles: [{ id: GUILD, permissions: String(VIEW | SEND) }], channels: [ch('11')] }));
    expect(await ids(t)).toEqual([]);
  });
  it('overwrite: deny View på @everyone skjuler; deny først, så allow', async () => {
    const hidden = setup(fixture({ channels: [ch('11', { permission_overwrites: [ow(GUILD, 0, 0, VIEW)] }), ch('12', { permission_overwrites: [ow(GUILD, 0, VIEW, VIEW)] })] }));
    expect(await ids(hidden)).toEqual(['12']);
    const shown = setup(fixture({ roles: [{ id: GUILD, permissions: '0' }], channels: [ch('11', { permission_overwrites: [ow(GUILD, 0, VIEW | HISTORY, 0)] })] }));
    expect(await ids(shown)).toEqual(['11']);
  });
  it('overwrites for andre roller eller medlemmer gør ikke kanalen offentlig', async () => {
    const s = setup(fixture({
      roles: [{ id: GUILD, permissions: '0' }, { id: '77', permissions: '0' }],
      channels: [ch('11', { permission_overwrites: [ow('77', 0, VIEW | HISTORY), ow(BOT, 1, VIEW | HISTORY)] })],
      botRoles: ['77'],
    }));
    expect(await ids(s)).toEqual([]);
  });
  it('kategori-synkede overwrites (kopieret ind på kanalen) virker som kanalens egne', async () => {
    const synced = [ow(GUILD, 0, 0, VIEW), ow('77', 0, VIEW | HISTORY)];
    const s = setup(fixture({ roles: [{ id: GUILD, permissions: ALLOW_ALL }, { id: '77', permissions: '0' }], channels: [ch('11', { permission_overwrites: synced }), ch('12')] }));
    expect(await ids(s)).toEqual(['12']);
  });
  it('botten skal selv kunne se kanalen: rolle-deny og medlems-overwrite', async () => {
    const roles = [{ id: GUILD, permissions: ALLOW_ALL }, { id: '77', permissions: '0' }];
    const denied = setup(fixture({ roles, botRoles: ['77'], channels: [ch('11', { permission_overwrites: [ow('77', 0, 0, VIEW)] })] }));
    expect(await ids(denied)).toEqual([]);
    const memberDeny = setup(fixture({ roles, channels: [ch('11', { permission_overwrites: [ow(BOT, 1, 0, HISTORY)] })] }));
    expect(await ids(memberDeny)).toEqual([]);
    const memberRestore = setup(fixture({ roles, botRoles: ['77'], channels: [ch('11', { permission_overwrites: [ow('77', 0, 0, SEND), ow(BOT, 1, SEND, 0)] })] }));
    expect((await memberRestore.client.listChannels()).channels[0].canWrite).toBe(true);
  });
  it('botrollers rettigheder tæller med; en rolles allow vinder over en andens deny', async () => {
    const s = setup(fixture({
      roles: [{ id: GUILD, permissions: String(VIEW | HISTORY) }, { id: '77', permissions: String(SEND) }, { id: '78', permissions: '0' }],
      botRoles: ['77', '78'],
      channels: [ch('11'), ch('12', { permission_overwrites: [ow('77', 0, 0, SEND), ow('78', 0, SEND, 0)] })],
    }));
    expect((await s.client.listChannels()).channels.map((c) => c.canWrite)).toEqual([true, true]);
  });
  it('administrator på botten giver alle rettigheder, men skjuler ikke privat for @everyone', async () => {
    const s = setup(fixture({
      roles: [{ id: GUILD, permissions: String(VIEW | HISTORY) }, { id: '77', permissions: String(ADMIN) }],
      botRoles: ['77'],
      channels: [ch('11', { permission_overwrites: [ow(GUILD, 0, 0, SEND), ow('77', 0, 0, SEND)] }), ch('12', { permission_overwrites: [ow(GUILD, 0, 0, VIEW)] })],
    }));
    const r = await s.client.listChannels();
    expect(r.channels.map((c) => [c.id, c.canWrite])).toEqual([['11', true]]);
  });
  it('administrator på @everyone gør alt offentligt', async () => {
    const s = setup(fixture({ roles: [{ id: GUILD, permissions: String(ADMIN) }], channels: [ch('11', { permission_overwrites: [ow(GUILD, 0, 0, VIEW)] })] }));
    expect(await ids(s)).toEqual(['11']);
  });
});

describe('canWrite', () => {
  it('kræver kanaltype 0 og Send Messages for botten', async () => {
    const s = setup(fixture({
      channels: [ch('11'), ch('12', { permission_overwrites: [ow(GUILD, 0, 0, SEND)] }), ch('13', { type: 5 })],
    }));
    expect((await s.client.listChannels()).channels.map((c) => [c.id, c.canWrite])).toEqual([['11', true], ['12', false], ['13', false]]);
  });
  it('sender ikke til en kanal uden Send Messages (ingen POST)', async () => {
    const s = setup(fixture({ channels: [ch('12', { permission_overwrites: [ow(GUILD, 0, 0, SEND)] })] }));
    expect(await s.client.sendMessage('12', 'x')).toEqual({ ok: false, error: 'no_access' });
    expect(s.msgCalls).toHaveLength(0);
  });
  it('20062 giver read_only, huskes i 1 time og ryddes derefter', async () => {
    const s = setup(fixture({ channels: [ch('11'), ch('12')] }), () => jsonResponse(403, { code: 20062, message: `x ${TOKEN}` }));
    const r = await s.client.sendMessage('11', 'hej');
    expect(r).toEqual({ ok: false, error: 'read_only' });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    expect((await s.client.listChannels()).channels.map((c) => [c.id, c.canWrite])).toEqual([['11', false], ['12', true]]);
    expect(await s.client.sendMessage('11', 'igen')).toEqual({ ok: false, error: 'read_only' });
    expect(s.msgCalls).toHaveLength(1);
    s.advance(59 * 60_000);
    expect((await s.client.listChannels()).channels[0].canWrite).toBe(false);
    s.advance(2 * 60_000);
    expect((await s.client.listChannels()).channels[0].canWrite).toBe(true);
  });
  it('andre 403/404 forbliver no_access og huskes ikke som skrivebeskyttet', async () => {
    for (const [status, body] of [[403, { code: 50013 }], [403, {}], [404, {}]] as const) {
      const s = setup(fixture(), () => jsonResponse(status, body));
      expect(await s.client.sendMessage(CHANNEL, 'x')).toEqual({ ok: false, error: 'no_access' });
      expect((await s.client.listChannels()).channels[0].canWrite).toBe(true);
    }
  });
});

describe('afvisning af ukendte kanal-id', () => {
  it('ukendt, privat og ikke-numerisk id giver not_found uden beskedkald', async () => {
    const s = setup(fixture({ channels: [ch('11'), ch('12', { permission_overwrites: [ow(GUILD, 0, 0, VIEW)] })] }));
    for (const bad of ['99', '12', '', 'abc', '11/../x', '11?limit=1', '../users/@me', '1'.repeat(21), ' 11', '11\n']) {
      expect(await s.client.getMessages(bad)).toEqual({ messages: [], stale: false, error: 'not_found' });
      expect(await s.client.sendMessage(bad, 'x')).toEqual({ ok: false, error: 'not_found' });
    }
    expect(await s.client.getMessages(undefined as unknown as string)).toMatchObject({ error: 'not_found' });
    expect(s.msgCalls).toHaveLength(0);
  });
  it('kender id fra listen og bruger den i URL', async () => {
    const s = setup(fixture({ channels: [ch('11')] }));
    await s.client.getMessages('11');
    expect(s.msgCalls[0].url).toBe('https://discord.com/api/v10/channels/11/messages?limit=50');
  });
});

describe('kanallistens cache', () => {
  it('cacher i 5 minutter og sorterer efter position og navn', async () => {
    const s = setup(fixture({ channels: [ch('11', { name: 'b', position: 1 }), ch('12', { name: 'z', position: 0 }), ch('13', { name: 'a', position: 1 })] }));
    expect((await s.client.listChannels()).channels.map((c) => c.name)).toEqual(['z', 'a', 'b']);
    const n = s.other.length;
    s.advance(4 * 60_000);
    await s.client.listChannels();
    await s.client.getMessages('11');
    expect(s.other.length).toBe(n);
    s.advance(61_000);
    await s.client.listChannels();
    expect(s.other.length).toBeGreaterThan(n);
    // server-id og bot-id hentes kun én gang
    expect(s.other.filter((p) => p === `/channels/${CHANNEL}` || p === '/users/@me')).toHaveLength(2);
  });
  it('bruger sidste gode liste ved Discord-fejl i op til 30 minutter, derefter unavailable', async () => {
    const good = fixture({ channels: [ch('11')] });
    const s = setup(good);
    await s.client.listChannels();
    s.set({ ...good, override: () => jsonResponse(500, {}) });
    s.advance(6 * 60_000);
    expect((await s.client.listChannels()).channels.map((c) => c.id)).toEqual(['11']);
    expect((await s.client.getMessages('11')).error).toBeUndefined();
    s.advance(25 * 60_000);
    expect(await s.client.listChannels()).toEqual({ channels: [], error: 'unavailable' });
    expect(await s.client.getMessages('11')).toEqual({ messages: [], stale: false, error: 'unavailable' });
    expect(await s.client.sendMessage('11', 'x')).toEqual({ ok: false, error: 'unavailable' });
  });
  it('unavailable uden nogen god liste, og gen-forsøg lykkes bagefter', async () => {
    const s = setup(fixture({ override: () => jsonResponse(500, {}) }));
    expect(await s.client.listChannels()).toEqual({ channels: [], error: 'unavailable' });
    s.set(fixture());
    s.advance(10_000);
    expect((await s.client.listChannels()).channels).toHaveLength(1);
  });
  it('misdannede svar og netværksfejl giver unavailable uden at lække token', async () => {
    for (const o of [() => jsonResponse(200, { x: 1 }), () => { throw new Error(`boom ${TOKEN}`); }]) {
      const s = setup(fixture({ override: (p) => (p.endsWith('/roles') ? (o() as Response) : undefined) }));
      const r = await s.client.listChannels();
      expect(r.error).toBe('unavailable');
      expect(JSON.stringify(r)).not.toContain(TOKEN);
    }
  });
});

describe('beskedcache pr. kanal', () => {
  const body = (id: string) => [{ id, content: `i ${id}`, timestamp: '2026-11-10T10:00:00.000000+00:00', author: { id: '1', username: 'u' } }];
  it('holder kanalernes beskeder adskilt og dedupper pr. kanal', async () => {
    const s = setup(fixture({ channels: [ch('11'), ch('12')] }), (url) => jsonResponse(200, body(url.includes('/channels/11/') ? '1100' : '1200')));
    const [a, b, a2] = await Promise.all([s.client.getMessages('11'), s.client.getMessages('12'), s.client.getMessages('11')]);
    expect(a.messages[0].content).toBe('i 1100');
    expect(b.messages[0].content).toBe('i 1200');
    expect(a2).toEqual(a);
    expect(s.msgCalls).toHaveLength(2);
    await s.client.getMessages('11');
    await s.client.getMessages('12');
    expect(s.msgCalls).toHaveLength(2);
  });
  it('en send ugyldiggør kun den kanals cache', async () => {
    const s = setup(fixture({ channels: [ch('11'), ch('12')] }));
    await s.client.getMessages('11');
    await s.client.getMessages('12');
    await s.client.sendMessage('11', 'x');
    await s.client.getMessages('11');
    await s.client.getMessages('12');
    expect(s.msgCalls.filter((c) => c.init?.method !== 'POST')).toHaveLength(3);
  });
  it('stale fra én kanal bruges ikke i en anden', async () => {
    let fail = false;
    const s = setup(fixture({ channels: [ch('11'), ch('12')] }), () => (fail ? jsonResponse(500, {}) : jsonResponse(200, body('5'))));
    await s.client.getMessages('11');
    fail = true;
    s.advance(5000);
    expect((await s.client.getMessages('11')).stale).toBe(true);
    expect(await s.client.getMessages('12')).toEqual({ messages: [], stale: false, error: 'unavailable' });
  });
  it('begrænser antallet af kanaler i cachen uden at gå i stykker', async () => {
    const channels = Array.from({ length: 60 }, (_, i) => ch(String(100 + i)));
    const s = setup(fixture({ channels }));
    for (const c of channels) await s.client.getMessages(c.id);
    expect(s.msgCalls).toHaveLength(60);
    await s.client.getMessages('159');
    expect(s.msgCalls).toHaveLength(60); // nyeste er stadig cachet
    await s.client.getMessages('100');
    expect(s.msgCalls).toHaveLength(61); // ældste blev smidt ud
  });
  it('tokenet optræder ikke i nogen resultater', async () => {
    const s = setup(fixture(), () => jsonResponse(401, { message: TOKEN }));
    const all = [await s.client.listChannels(), await s.client.getMessages(CHANNEL), await s.client.sendMessage(CHANNEL, 'x'), await s.client.getMessages('zzz')];
    expect(JSON.stringify(all)).not.toContain(TOKEN);
    expect(JSON.stringify(all)).not.toContain('Bot ');
  });
});

describe('pickChannel', () => {
  const list = [{ id: '1', name: 'a', canWrite: true }, { id: '2', name: 'b', canWrite: false }];
  it('vælger den ønskede, ellers standard, ellers første', () => {
    expect(pickChannel(list, '2', '1')?.id).toBe('2');
    expect(pickChannel(list, '9', '2')?.id).toBe('2');
    expect(pickChannel(list, undefined, '9')?.id).toBe('1');
    expect(pickChannel(list, ['2', '1'], '1')?.id).toBe('2');
    expect(pickChannel([], '1', '1')).toBeNull();
  });
});
