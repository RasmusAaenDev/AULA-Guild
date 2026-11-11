import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { ChatClient, ChatMessage } from '@/lib/chat';
import { characters, chatChannels, chatMessages, users } from '@/lib/db/schema';
import { clipChatText, recentChatItems, chatItemHref } from '@/lib/overview-chat';
import { resetDb, testDb } from './db';
import { seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const now = new Date('2026-11-10T12:00:00Z');
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const msg = (id: string, h: number, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id, author: 'Discordnavn', authorId: null, content: `besked ${id}`, mentions: [], timestamp: ago(h), bot: false, ...over,
});
function fakeChat(channels: Record<string, ChatMessage[]>, names: Record<string, string> = {}): ChatClient {
  return {
    listChannels: async () => ({ channels: Object.keys(channels).map((id) => ({ id, name: names[id] ?? `kanal${id}`, canWrite: true })) }),
    getMessages: async (id) => ({ messages: channels[id] ?? [], stale: false }),
    sendMessage: async () => ({ ok: true }),
  };
}
async function siteChannel(name: string, msgs: Array<{ h: number; content: string; author?: string }>) {
  const [c] = await db.insert(chatChannels).values({ name }).returning();
  for (const m of msgs) {
    await db.insert(chatMessages).values({ channelId: c.id, authorName: m.author ?? 'Egen Forfatter', content: m.content, createdAt: new Date(ago(m.h)) });
  }
  return c;
}

describe('recentChatItems', () => {
  it('giver tom liste uden chat og uden egne kanaler', async () => {
    expect(await recentChatItems({ chat: null, db }, now)).toEqual([]);
  });
  it('tager kun beskeder fra de seneste 7 dage, springer tomme over og sorterer nyeste først', async () => {
    const chat = fakeChat({ '1': [msg('a', 24 * 8), msg('b', 24 * 6), msg('c', 3, { content: '   \n ' }), msg('d', 2)] });
    const out = await recentChatItems({ chat, db }, now);
    expect(out.map((i) => i.content)).toEqual(['besked d', 'besked b']);
    expect(out[0]).toMatchObject({ source: 'discord', channelId: '1', channelName: 'kanal1', author: 'Discordnavn', armoryUrl: null, at: new Date(ago(2)) });
    expect(chatItemHref(out[0])).toBe('/chat?kanal=1');
  });
  it('tager højst 2 pr. kanal (de nyeste) og 6 i alt', async () => {
    const chat = fakeChat({
      '1': [msg('a1', 1), msg('a2', 2), msg('a3', 3)],
      '2': [msg('b1', 4), msg('b2', 5), msg('b3', 6)],
      '3': [msg('c1', 7), msg('c2', 8), msg('c3', 9)],
      '4': [msg('d1', 10), msg('d2', 11)],
    });
    const out = await recentChatItems({ chat, db }, now);
    expect(out.map((i) => i.content.replace('besked ', ''))).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']);
  });
  it('tager også egne kanaler med, med link og beskedens forfatternavn', async () => {
    const c = await siteChannel('Raid', [{ h: 1, content: 'Hej fra siden', author: 'Ægte Navn' }, { h: 30, content: 'ældre' }, { h: 50, content: 'tredje' }, { h: 24 * 9, content: 'for gammel' }]);
    const out = await recentChatItems({ chat: fakeChat({ '1': [msg('a', 0.5)] }), db }, now);
    expect(out.map((i) => i.source)).toEqual(['discord', 'site', 'site']);
    expect(out[1]).toMatchObject({ channelId: `egen-${c.id}`, channelName: 'Raid', author: 'Ægte Navn', armoryUrl: null, content: 'Hej fra siden' });
    expect(chatItemHref(out[1])).toBe(`/chat?kanal=egen-${c.id}`);
    expect(out).toHaveLength(3);
  });
  it('viser karakternavn og armory-link for kendte Discord-forfattere', async () => {
    const u = await seedUser(db, '111');
    const [ch] = await db.insert(characters).values({ blizzardId: 1, slug: 'ragnar-storm', name: 'Ragnar', surname: 'Storm', className: 'Mage', role: 'dps', userId: u }).returning();
    await db.update(users).set({ activeCharacterId: ch.id }).where(eq(users.id, u));
    const [item] = await recentChatItems({ chat: fakeChat({ '1': [msg('a', 1, { authorId: '111' })] }), db }, now);
    expect(item.author).toBe('Ragnar Storm');
    expect(item.armoryUrl).toContain('ragnar-storm');
  });
  it('afkorter til 280 tegn med «…» og klapper mellemrum sammen', async () => {
    const long = 'x'.repeat(300);
    const [item] = await recentChatItems({ chat: fakeChat({ '1': [msg('a', 1, { content: long })] }), db }, now);
    expect(Array.from(item.content)).toHaveLength(281);
    expect(item.content.endsWith('…')).toBe(true);
    expect(clipChatText('a  b\n\nc')).toBe('a b c');
    expect(clipChatText('x'.repeat(280))).toBe('x'.repeat(280));
  });
  it('giver tom liste ved fejl og ved tidsoverskridelse, og blokerer ikke', async () => {
    const failing: ChatClient = { ...fakeChat({}), listChannels: async () => { throw new Error('nede'); } };
    expect(await recentChatItems({ chat: failing, db }, now)).toEqual([]);
    const hanging: ChatClient = { ...fakeChat({}), listChannels: () => new Promise(() => {}) };
    const t0 = Date.now();
    expect(await recentChatItems({ chat: hanging, db, timeoutMs: 50 }, now)).toEqual([]);
    expect(Date.now() - t0).toBeLessThan(1000);
  });
  it('lader en Discord-fejl uden om egne kanaler og springer kanaler med fejlsvar over', async () => {
    await siteChannel('Egen', [{ h: 1, content: 'stadig her' }]);
    const failing: ChatClient = { ...fakeChat({}), listChannels: async () => { throw new Error('nede'); } };
    expect((await recentChatItems({ chat: failing, db }, now)).map((i) => i.content)).toEqual(['stadig her']);
    const noAccess: ChatClient = { ...fakeChat({ '1': [msg('a', 1)] }), getMessages: async () => ({ messages: [], stale: false, error: 'no_access' }) };
    expect(await recentChatItems({ chat: noAccess, db }, now)).toHaveLength(1);
  });
  it('indeholder kun de ejede felter, ingen Discord-bruger-id eller mentions', async () => {
    const [item] = await recentChatItems({ chat: fakeChat({ '1': [msg('a', 1, { authorId: '424242', mentions: [{ id: '777', name: 'x' }] })] }), db }, now);
    expect(Object.keys(item).sort()).toEqual(['armoryUrl', 'at', 'author', 'channelId', 'channelName', 'content', 'id', 'source']);
    expect(JSON.stringify(item)).not.toMatch(/424242|777/);
  });
});
