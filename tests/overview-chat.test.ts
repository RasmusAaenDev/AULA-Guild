import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { characters, chatChannels, chatMessages } from '@/lib/db/schema';
import type { Db } from '@/lib/db';
import { clipChatText, recentChatItems, chatItemHref } from '@/lib/overview-chat';
import { resetDb, testDb } from './db';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const now = new Date('2026-11-10T12:00:00Z');
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000);

async function siteChannel(name: string, msgs: Array<{ h: number; content: string; author?: string; characterId?: number; deleted?: boolean }>) {
  const [c] = await db.insert(chatChannels).values({ name }).returning();
  for (const m of msgs) {
    await db.insert(chatMessages).values({
      channelId: c.id, authorName: m.author ?? 'Egen Forfatter', characterId: m.characterId ?? null, content: m.content,
      createdAt: ago(m.h), deletedAt: m.deleted ? ago(0) : null,
    });
  }
  return c;
}

describe('recentChatItems', () => {
  it('giver tom liste uden egne kanaler', async () => {
    expect(await recentChatItems({ db }, now)).toEqual([]);
  });
  it('tager kun beskeder fra de seneste 7 dage, springer tomme over og sorterer nyeste først', async () => {
    const c = await siteChannel('Raid', [{ h: 24 * 8, content: 'for gammel' }, { h: 24 * 6, content: 'b' }, { h: 3, content: '   \n ' }, { h: 2, content: 'd', author: 'Ægte Navn' }]);
    const out = await recentChatItems({ db }, now);
    expect(out.map((i) => i.content)).toEqual(['d', 'b']);
    expect(out[0]).toMatchObject({ channelId: `egen-${c.id}`, channelName: 'Raid', author: 'Ægte Navn', armoryUrl: null, at: ago(2) });
    expect(chatItemHref(out[0])).toBe(`/chat?kanal=egen-${c.id}`);
  });
  it('tager højst 2 pr. kanal (de nyeste) og 6 i alt', async () => {
    for (const [name, base] of [['a', 1], ['b', 4], ['c', 7], ['d', 10]] as const) {
      await siteChannel(name, [{ h: base, content: `${name}1` }, { h: base + 1, content: `${name}2` }, { h: base + 2, content: `${name}3` }]);
    }
    const out = await recentChatItems({ db }, now);
    expect(out.map((i) => i.content)).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']);
  });
  it('udelader slettede beskeder og beskeder i slettede kanaler', async () => {
    await siteChannel('Aktiv', [{ h: 1, content: 'synlig' }, { h: 2, content: 'væk', deleted: true }]);
    const gone = await siteChannel('Gammel', [{ h: 1, content: 'i slettet kanal' }]);
    await db.update(chatChannels).set({ deletedAt: ago(0) }).where(eq(chatChannels.id, gone.id));
    expect((await recentChatItems({ db }, now)).map((i) => i.content)).toEqual(['synlig']);
  });
  it('linker forfatteren til armory, når beskeden har en karakter', async () => {
    const [ch] = await db.insert(characters).values({ blizzardId: 1, slug: 'ragnar-storm', name: 'Ragnar', surname: 'Storm', className: 'Mage', role: 'dps' }).returning();
    await siteChannel('Raid', [{ h: 1, content: 'med karakter', author: 'Ragnar Storm', characterId: ch.id }, { h: 2, content: 'uden' }]);
    const [withChar, without] = await recentChatItems({ db }, now);
    expect(withChar).toMatchObject({ author: 'Ragnar Storm', armoryUrl: expect.stringContaining('ragnar-storm') });
    expect(without.armoryUrl).toBeNull();
  });
  it('afkorter til 280 tegn med «…» og klapper mellemrum sammen', async () => {
    await siteChannel('Raid', [{ h: 1, content: 'x'.repeat(300) }]);
    const [item] = await recentChatItems({ db }, now);
    expect(Array.from(item.content)).toHaveLength(281);
    expect(item.content.endsWith('…')).toBe(true);
    expect(clipChatText('a  b\n\nc')).toBe('a b c');
    expect(clipChatText('x'.repeat(280))).toBe('x'.repeat(280));
  });
  it('giver tom liste ved fejl og ved tidsoverskridelse, og blokerer ikke', async () => {
    const failing = { select: () => { throw new Error('nede'); } } as unknown as Db;
    expect(await recentChatItems({ db: failing }, now)).toEqual([]);
    const hanging = { select: () => hangingQuery } as unknown as Db;
    const t0 = Date.now();
    expect(await recentChatItems({ db: hanging, timeoutMs: 50 }, now)).toEqual([]);
    expect(Date.now() - t0).toBeLessThan(1000);
  });
  it('indeholder kun de ejede felter', async () => {
    await siteChannel('Raid', [{ h: 1, content: 'hej' }]);
    const [item] = await recentChatItems({ db }, now);
    expect(Object.keys(item).sort()).toEqual(['armoryUrl', 'at', 'author', 'channelId', 'channelName', 'content', 'id']);
  });
});

// En forespørgsel, der aldrig bliver færdig, uanset hvor mange led der kædes på.
const hangingQuery: unknown = new Proxy(() => {}, {
  get: (_t, prop) => (prop === 'then' ? (_res: unknown) => undefined : () => hangingQuery),
});

