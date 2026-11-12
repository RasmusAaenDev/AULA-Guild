import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { handleFeedRequest, parseFeedRequest } from '@/lib/post-feed';
import { FEED_STEP, MAX_FEED_LIMIT, offsetChunks, uniqueById } from '@/lib/post-feed-ui';
import { listPosts, listPostsSlice } from '@/lib/posts';
import { postBookmarks, postReads, posts } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const T0 = new Date('2026-11-10T12:00:00Z');

/** n opslag; nr. 1 er ældst, nr. n nyest. Returnerer id'erne nyeste først (feedets rækkefølge). */
async function seedPosts(authorId: number, n: number, extra: Partial<typeof posts.$inferInsert> = {}) {
  const rows = await db
    .insert(posts)
    .values(Array.from({ length: n }, (_, i) => ({ authorId, title: `Opslag ${i + 1}`, body: 'x', createdAt: new Date(T0.getTime() + i * 60_000), ...extra })))
    .returning({ id: posts.id });
  return rows.map((r) => r.id).reverse();
}
const idsOf = (r: Awaited<ReturnType<typeof handleFeedRequest>>) => (r.ok ? r.items.map((p) => p.id) : null);

describe('uniqueById', () => {
  it('bevarer første forekomst og rækkefølgen', () => {
    expect(uniqueById([{ id: 3 }, { id: 1 }, { id: 3 }, { id: 2 }, { id: 1 }]).map((x) => x.id)).toEqual([3, 1, 2]);
  });
  it("springer allerede viste id'er over", () => {
    expect(uniqueById([{ id: 5 }, { id: 4 }, { id: 3 }], [5, 9]).map((x) => x.id)).toEqual([4, 3]);
  });
  it('tom liste giver tom liste', () => {
    expect(uniqueById([], [1])).toEqual([]);
  });
});

describe('offsetChunks', () => {
  it('deler et interval i bidder af højst størrelsen', () => {
    expect(offsetChunks(20, 35)).toEqual([[20, 15]]);
    expect(offsetChunks(20, 20 + MAX_FEED_LIMIT + 3)).toEqual([[20, MAX_FEED_LIMIT], [20 + MAX_FEED_LIMIT, 3]]);
    expect(offsetChunks(0, 7, 3)).toEqual([[0, 3], [3, 3], [6, 1]]);
    expect(offsetChunks(5, 5)).toEqual([]);
  });
});

describe('parseFeedRequest', () => {
  it('godtager de fem ægte faner, offset fra 0 og limit 1–100', () => {
    for (const tab of ['alle', 'ulaeste', 'vigtige', 'egne', 'gemte']) {
      expect(parseFeedRequest(tab, 20, FEED_STEP)).toEqual({ tab, offset: 20, limit: FEED_STEP });
    }
    expect(parseFeedRequest('alle', 0, 1)).toEqual({ tab: 'alle', offset: 0, limit: 1 });
    expect(parseFeedRequest('alle', 3, MAX_FEED_LIMIT)).toEqual({ tab: 'alle', offset: 3, limit: MAX_FEED_LIMIT });
  });
  it('afviser satire, ukendte faner og ikke-strenge', () => {
    for (const tab of ['satire', 'Alle', '', 'x', undefined, null, 1, ['alle']]) expect(parseFeedRequest(tab, 20, 5)).toBeNull();
  });
  it('afviser ugyldige offsets og limits', () => {
    const bad: [unknown, unknown][] = [
      [-1, 5], [2.5, 5], [Number.NaN, 5], [Infinity, 5], ['20', 5], [null, 5], [20_000_001, 5],
      [20, 0], [20, -5], [20, 1.5], [20, MAX_FEED_LIMIT + 1], [20, '5'], [20, undefined],
    ];
    for (const [offset, limit] of bad) expect(parseFeedRequest('alle', offset, limit)).toBeNull();
  });
});

describe('listPostsSlice', () => {
  it('har samme rækkefølge som listPosts, også med fastgjorte opslag først', async () => {
    const u = await seedUser(db);
    await seedPosts(u, 30);
    await seedPosts(u, 2, { pinned: true, pinnedAt: T0 });
    const page2 = (await listPosts(db, u, 'alle', 2)).items.map((p) => p.id);
    const sliced = (await listPostsSlice(db, u, 'alle', 20, 12)).items.map((p) => p.id);
    expect(sliced).toEqual(page2);
    const first = (await listPosts(db, u, 'alle', 1)).items.map((p) => p.id);
    expect((await listPostsSlice(db, u, 'alle', 0, 20)).items.map((p) => p.id)).toEqual(first);
  });
});

describe('handleFeedRequest', () => {
  it('henter 5 ad gangen efter de viste, med nextOffset og hasMore', async () => {
    const u = await seedUser(db);
    const ids = await seedPosts(u, 32);
    const a = await handleFeedRequest(db, u, 'alle', 20, FEED_STEP);
    expect(a).toMatchObject({ ok: true, hasMore: true, nextOffset: 25 });
    expect(idsOf(a)).toEqual(ids.slice(20, 25));
    const b = await handleFeedRequest(db, u, 'alle', 25, FEED_STEP);
    expect(b).toMatchObject({ ok: true, hasMore: true, nextOffset: 30 });
    expect(idsOf(b)).toEqual(ids.slice(25, 30));
    const c = await handleFeedRequest(db, u, 'alle', 30, FEED_STEP);
    expect(c).toMatchObject({ ok: true, hasMore: false, nextOffset: 32 });
    expect(idsOf(c)).toEqual(ids.slice(30));
  });

  it('præcis ved slutningen: hasMore false; ud over slutningen: tom liste', async () => {
    const u = await seedUser(db);
    await seedPosts(u, 25);
    expect(await handleFeedRequest(db, u, 'alle', 20, FEED_STEP)).toMatchObject({ ok: true, hasMore: false, nextOffset: 25 });
    expect(await handleFeedRequest(db, u, 'alle', 40, FEED_STEP)).toEqual({ ok: true, items: [], hasMore: false, nextOffset: 40 });
  });

  it('afviser ugyldigt input', async () => {
    const u = await seedUser(db);
    await seedPosts(u, 30);
    expect(await handleFeedRequest(db, u, 'satire', 20, 5)).toEqual({ ok: false });
    expect(await handleFeedRequest(db, u, 'alle', -1, 5)).toEqual({ ok: false });
    expect(await handleFeedRequest(db, u, 'alle', '20', 5)).toEqual({ ok: false });
    expect(await handleFeedRequest(db, u, 'alle', 20, 101)).toEqual({ ok: false });
  });

  it('følger fanen pr. bruger, og hentning markerer intet som læst', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const ids = await seedPosts(a, 25);
    await db.insert(postBookmarks).values(ids.slice(0, 22).map((postId) => ({ postId, userId: b })));
    const saved = await handleFeedRequest(db, b, 'gemte', 20, FEED_STEP);
    expect(idsOf(saved)).toEqual(ids.slice(20, 22));
    expect(saved.ok && saved.items.every((p) => p.bookmarked && p.unread)).toBe(true);
    expect(idsOf(await handleFeedRequest(db, b, 'ulaeste', 20, FEED_STEP))).toEqual(ids.slice(20, 25));
    expect(await db.select().from(postReads)).toEqual([]);
    expect(await handleFeedRequest(db, a, 'gemte', 0, FEED_STEP)).toEqual({ ok: true, items: [], hasMore: false, nextOffset: 0 });
  });

  it('dedup: et nyt opslag forskyder listen, og klienten sorterer dubletten fra', async () => {
    const u = await seedUser(db);
    const ids = await seedPosts(u, 30);
    const shown = ids.slice(0, 20);
    await db.insert(posts).values({ authorId: u, title: 'Nyt', body: 'x', createdAt: new Date(T0.getTime() + 999 * 60_000) });
    const r = await handleFeedRequest(db, u, 'alle', 20, FEED_STEP);
    if (!r.ok) throw new Error('forventede ok');
    expect(r.items[0].id).toBe(ids[19]);
    expect(uniqueById(r.items, shown).map((p) => p.id)).toEqual(ids.slice(20, 24));
    expect(r.nextOffset).toBe(25);
  });
});
