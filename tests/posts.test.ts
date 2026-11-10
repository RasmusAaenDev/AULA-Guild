import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  addComment, countUnread, createPost, deleteComment, deletePost, getPost, listPosts, markPostRead, setPinned,
} from '@/lib/posts';
import { comments, postReads, posts } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const T0 = new Date('2026-11-10T12:00:00Z');
const min = (m: number) => new Date(T0.getTime() + m * 60_000);

async function seedPost(authorId: number, title: string, createdAt = T0, extra: Partial<typeof posts.$inferInsert> = {}) {
  const [p] = await db.insert(posts).values({ authorId, title, body: `Tekst ${title}`, createdAt, ...extra }).returning({ id: posts.id });
  return p.id;
}
async function seedComment(postId: number, authorId: number, createdAt = T0, extra: Partial<typeof comments.$inferInsert> = {}) {
  const [c] = await db.insert(comments).values({ postId, authorId, body: 'k', createdAt, ...extra }).returning({ id: comments.id });
  return c.id;
}
const reads = (postId: number) => db.select().from(postReads).where(eq(postReads.postId, postId));

describe('createPost', () => {
  it('opretter opslag og forfatterens læsemarkering', async () => {
    const u = await seedUser(db);
    const r = await createPost(db, u, { title: '  Hej  ', body: ' Tekst ' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [p] = await db.select().from(posts).where(eq(posts.id, r.postId));
    expect(p).toMatchObject({ title: 'Hej', body: 'Tekst', pinned: false, pinnedAt: null, deletedAt: null, authorId: u });
    expect((await reads(r.postId)).map((x) => x.userId)).toEqual([u]);
    expect(await countUnread(db, u)).toBe(0);
  });

  it('validerer grænserne præcist', async () => {
    const u = await seedUser(db);
    let created = 0;
    const ok = async (title: string, body: string) => {
      const r = await createPost(db, u, { title, body });
      if (r.ok) created += 1;
      return r.ok;
    };
    expect(await ok('', 'x')).toBe(false);
    expect(await ok('   ', 'x')).toBe(false);
    expect(await ok('t', '')).toBe(false);
    expect(await ok('t', '  \n ')).toBe(false);
    expect(await ok('a'.repeat(120), 'x')).toBe(true);
    expect(await ok('a'.repeat(121), 'x')).toBe(false);
    expect(await ok(' ' + 'a'.repeat(120) + ' ', 'x')).toBe(true);
    expect(await ok('t', 'b'.repeat(5000))).toBe(true);
    expect(await ok('t', 'b'.repeat(5001))).toBe(false);
    const r = await createPost(db, u, { title: '', body: 'x' });
    expect(r).toEqual({ ok: false, reason: 'invalid' });
    expect(await db.select().from(posts)).toHaveLength(created);
  });

  it('afviser NUL-tegn uden at kaste', async () => {
    const u = await seedUser(db);
    expect(await createPost(db, u, { title: 'a\u0000b', body: 'x' })).toEqual({ ok: false, reason: 'invalid' });
    expect(await createPost(db, u, { title: 't', body: 'x\u0000' })).toEqual({ ok: false, reason: 'invalid' });
    expect(await db.select().from(posts)).toHaveLength(0);
  });

  it('tæller unicode-tegn, ikke UTF-16-enheder', async () => {
    const u = await seedUser(db);
    const e = '\u{1F600}';
    expect((await createPost(db, u, { title: e.repeat(120), body: e.repeat(5000) })).ok).toBe(true);
    expect((await createPost(db, u, { title: e.repeat(121), body: 'x' })).ok).toBe(false);
    expect((await createPost(db, u, { title: 't', body: e.repeat(5001) })).ok).toBe(false);
    const p = await seedPost(u, 'P');
    expect((await addComment(db, u, p, e.repeat(2000))).ok).toBe(true);
    expect(await addComment(db, u, p, e.repeat(2001))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('opslag er ikke ulæst for forfatteren lige efter oprettelse', async () => {
    const u = await seedUser(db);
    await createPost(db, u, { title: 't', body: 'x' });
    expect((await listPosts(db, u, 'ulaeste', 1)).items).toEqual([]);
  });
});

describe('addComment', () => {
  it('tilføjer kommentar og validerer grænser', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const p = await seedPost(a, 'P');
    const r = await addComment(db, b, p, '  Hej  ');
    expect(r.ok).toBe(true);
    const [c] = await db.select().from(comments);
    expect(c).toMatchObject({ postId: p, authorId: b, body: 'Hej' });
    expect(await addComment(db, b, p, '   ')).toEqual({ ok: false, reason: 'invalid' });
    expect((await addComment(db, b, p, 'k'.repeat(2000))).ok).toBe(true);
    expect(await addComment(db, b, p, 'k'.repeat(2001))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('afviser NUL-tegn', async () => {
    const a = await seedUser(db);
    const p = await seedPost(a, 'P');
    expect(await addComment(db, a, p, 'a\u0000b')).toEqual({ ok: false, reason: 'invalid' });
    expect(await db.select().from(comments)).toHaveLength(0);
  });

  it('afviser slettet og ukendt opslag', async () => {
    const a = await seedUser(db);
    const p = await seedPost(a, 'P', T0, { deletedAt: T0 });
    expect(await addComment(db, a, p, 'x')).toEqual({ ok: false, reason: 'not_found' });
    expect(await addComment(db, a, 9999, 'x')).toEqual({ ok: false, reason: 'not_found' });
    expect(await db.select().from(comments)).toHaveLength(0);
  });
});

describe('sletning', () => {
  it('forfatter, officer og fremmed på opslag', async () => {
    const a = await seedUser(db, 'a');
    const x = await seedUser(db, 'x');
    const p1 = await seedPost(a, 'P1');
    const p2 = await seedPost(a, 'P2');
    expect(await deletePost(db, { userId: x, isOfficer: false }, p1)).toEqual({ ok: false, reason: 'forbidden' });
    expect(await deletePost(db, { userId: a, isOfficer: false }, p1)).toEqual({ ok: true });
    expect(await deletePost(db, { userId: x, isOfficer: true }, p2)).toEqual({ ok: true });
    expect(await deletePost(db, { userId: a, isOfficer: false }, p1)).toEqual({ ok: false, reason: 'not_found' });
    expect(await deletePost(db, { userId: a, isOfficer: true }, 9999)).toEqual({ ok: false, reason: 'not_found' });
    const rows = await db.select().from(posts);
    expect(rows.every((r) => r.deletedAt !== null)).toBe(true);
  });

  it('forfatter, officer og fremmed på kommentarer', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const x = await seedUser(db, 'x');
    const p = await seedPost(a, 'P');
    const c1 = await seedComment(p, b);
    const c2 = await seedComment(p, b);
    expect(await deleteComment(db, { userId: x, isOfficer: false }, c1)).toEqual({ ok: false, reason: 'forbidden' });
    expect(await deleteComment(db, { userId: a, isOfficer: false }, c1)).toEqual({ ok: false, reason: 'forbidden' });
    expect(await deleteComment(db, { userId: b, isOfficer: false }, c1)).toEqual({ ok: true });
    expect(await deleteComment(db, { userId: x, isOfficer: true }, c2)).toEqual({ ok: true });
    expect(await deleteComment(db, { userId: b, isOfficer: false }, c1)).toEqual({ ok: false, reason: 'not_found' });
    expect(await deleteComment(db, { userId: b, isOfficer: true }, 9999)).toEqual({ ok: false, reason: 'not_found' });
    expect((await getPost(db, a, p))!.comments).toEqual([]);
  });
});

describe('setPinned', () => {
  it('kun officerer fastgør og frigør, og pinned_at sættes', async () => {
    const a = await seedUser(db, 'a');
    const p = await seedPost(a, 'P');
    expect(await setPinned(db, { userId: a, isOfficer: false }, p, true)).toEqual({ ok: false, reason: 'forbidden' });
    expect(await setPinned(db, { userId: a, isOfficer: true }, p, true)).toEqual({ ok: true });
    let [row] = await db.select().from(posts).where(eq(posts.id, p));
    expect(row.pinned).toBe(true);
    expect(row.pinnedAt).toBeInstanceOf(Date);
    expect(await setPinned(db, { userId: a, isOfficer: true }, p, false)).toEqual({ ok: true });
    [row] = await db.select().from(posts).where(eq(posts.id, p));
    expect(row.pinned).toBe(false);
    expect(row.pinnedAt).toBeNull();
    expect(await setPinned(db, { userId: a, isOfficer: true }, 9999, true)).toEqual({ ok: false, reason: 'not_found' });
    await db.update(posts).set({ deletedAt: T0 }).where(eq(posts.id, p));
    expect(await setPinned(db, { userId: a, isOfficer: true }, p, true)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('er en no-op når tilstanden allerede er den ønskede', async () => {
    const a = await seedUser(db, 'a');
    const off = { userId: a, isOfficer: true };
    const p = await seedPost(a, 'P');
    expect(await setPinned(db, off, p, false)).toEqual({ ok: true });
    await setPinned(db, off, p, true);
    const [first] = await db.select().from(posts).where(eq(posts.id, p));
    await new Promise((r) => setTimeout(r, 20));
    expect(await setPinned(db, off, p, true)).toEqual({ ok: true });
    const [second] = await db.select().from(posts).where(eq(posts.id, p));
    expect(second.pinnedAt).toEqual(first.pinnedAt);
  });
});

describe('listPosts', () => {
  it('sorterer fastgjorte først (nyeste pinned_at), derefter nyeste', async () => {
    const a = await seedUser(db);
    const old = await seedPost(a, 'gammel', min(0));
    const mid = await seedPost(a, 'midt', min(10));
    const nw = await seedPost(a, 'ny', min(20));
    const pinA = await seedPost(a, 'pinA', min(1), { pinned: true, pinnedAt: min(30) });
    const pinB = await seedPost(a, 'pinB', min(2), { pinned: true, pinnedAt: min(40) });
    const r = await listPosts(db, a, 'alle', 1);
    expect(r.items.map((i) => i.id)).toEqual([pinB, pinA, nw, mid, old]);
    expect(r.items[0].pinned).toBe(true);
    expect(r.hasMore).toBe(false);
  });

  it('felter: forfatter, uddrag, antal kommentarer (uden slettede), ulæst', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const p = await seedPost(a, 'P', T0, { body: 'x'.repeat(500) });
    await seedComment(p, b);
    await seedComment(p, b);
    await seedComment(p, b, T0, { deletedAt: T0 });
    const q = await seedPost(a, 'Q');
    const r = await listPosts(db, b, 'alle', 1);
    const item = r.items.find((i) => i.id === p)!;
    expect(item).toMatchObject({ title: 'P', authorName: 'Bruger a', commentCount: 2, unread: true, pinned: false });
    expect(item.excerpt.length).toBeLessThanOrEqual(200);
    expect(item.createdAt).toEqual(T0);
    expect(r.items.find((i) => i.id === q)!.commentCount).toBe(0);
  });

  it('faner: ulæste og vigtige', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const p1 = await seedPost(a, 'P1', min(0));
    const p2 = await seedPost(a, 'P2', min(1), { pinned: true, pinnedAt: min(5) });
    const p3 = await seedPost(a, 'P3', min(2));
    await seedPost(a, 'slettet', min(3), { deletedAt: T0 });
    await markPostRead(db, b, p1);
    expect((await listPosts(db, b, 'ulaeste', 1)).items.map((i) => i.id)).toEqual([p2, p3]);
    expect((await listPosts(db, b, 'vigtige', 1)).items.map((i) => i.id)).toEqual([p2]);
    expect((await listPosts(db, b, 'alle', 1)).items.find((i) => i.id === p1)!.unread).toBe(false);
    expect((await listPosts(db, b, 'alle', 1)).items).toHaveLength(3);
    // slettet fastgjort vises ikke
    await db.update(posts).set({ deletedAt: T0 }).where(eq(posts.id, p2));
    expect((await listPosts(db, b, 'vigtige', 1)).items).toEqual([]);
  });

  it('uddrag: whitespace samles, og der skæres på tegngrænsen', async () => {
    const a = await seedUser(db);
    const p1 = await seedPost(a, 'A', min(0), { body: '  Linje1\n\n  Linje2\t\tslut  ' });
    const p2 = await seedPost(a, 'B', min(1), { body: 'x'.repeat(199) + '\u{1F600}\u{1F600}' });
    const r = await listPosts(db, a, 'alle', 1);
    expect(r.items.find((i) => i.id === p1)!.excerpt).toBe('Linje1 Linje2 slut');
    const ex = r.items.find((i) => i.id === p2)!.excerpt;
    expect(ex).toBe('x'.repeat(199) + '\u{1F600}');
    expect([...ex]).toHaveLength(200);
  });

  it('ugyldig page og pageSize giver standardværdier i stedet for fejl', async () => {
    const a = await seedUser(db);
    for (let i = 0; i < 3; i++) await seedPost(a, `P${i}`, min(i));
    for (const page of [NaN, Infinity, -3, 0, 1.5]) {
      expect((await listPosts(db, a, 'alle', page)).items).toHaveLength(3);
    }
    for (const size of [NaN, Infinity, -1, 0]) {
      expect((await listPosts(db, a, 'alle', 1, size)).items).toHaveLength(3);
    }
    expect((await listPosts(db, a, 'alle', 1, 1e9)).items).toHaveLength(3);
    expect((await listPosts(db, a, 'alle', 1, 2.7)).items).toHaveLength(2);
  });

  it('ulæste-fanen med sideinddeling', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) ids.push(await seedPost(a, `P${i}`, min(i)));
    const exp = [...ids].reverse();
    const r1 = await listPosts(db, b, 'ulaeste', 1, 2);
    const r2 = await listPosts(db, b, 'ulaeste', 2, 2);
    const r3 = await listPosts(db, b, 'ulaeste', 3, 2);
    expect(r1.items.map((i) => i.id)).toEqual(exp.slice(0, 2));
    expect(r2.items.map((i) => i.id)).toEqual(exp.slice(2, 4));
    expect(r3.items.map((i) => i.id)).toEqual(exp.slice(4));
    expect([r1.hasMore, r2.hasMore, r3.hasMore]).toEqual([true, true, false]);
  });

  it('sideinddeling med pageSize 2 og stabil rækkefølge ved ens tidspunkt', async () => {
    const a = await seedUser(db);
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) ids.push(await seedPost(a, `P${i}`, T0));
    const expected = [...ids].reverse();
    const p1 = await listPosts(db, a, 'alle', 1, 2);
    const p2 = await listPosts(db, a, 'alle', 2, 2);
    const p3 = await listPosts(db, a, 'alle', 3, 2);
    expect(p1.items.map((i) => i.id)).toEqual(expected.slice(0, 2));
    expect(p1.hasMore).toBe(true);
    expect(p2.items.map((i) => i.id)).toEqual(expected.slice(2, 4));
    expect(p2.hasMore).toBe(true);
    expect(p3.items.map((i) => i.id)).toEqual(expected.slice(4));
    expect(p3.hasMore).toBe(false);
    expect((await listPosts(db, a, 'alle', 4, 2)).items).toEqual([]);
  });
});

describe('markPostRead og countUnread', () => {
  it('er idempotent og tæller ikke slettede', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const p1 = await seedPost(a, 'P1');
    const p2 = await seedPost(a, 'P2');
    await seedPost(a, 'slettet', T0, { deletedAt: T0 });
    expect(await countUnread(db, b)).toBe(2);
    expect(await countUnread(db, a)).toBe(2);
    await markPostRead(db, b, p1);
    await markPostRead(db, b, p1);
    expect(await reads(p1)).toHaveLength(1);
    expect(await countUnread(db, b)).toBe(1);
    expect((await listPosts(db, b, 'ulaeste', 1)).items).toHaveLength(1);
    await db.update(posts).set({ deletedAt: T0 }).where(eq(posts.id, p2));
    expect(await countUnread(db, b)).toBe(0);
  });

  it('opretter ingen række for slettede eller ukendte opslag', async () => {
    const a = await seedUser(db);
    const p = await seedPost(a, 'P', T0, { deletedAt: T0 });
    await expect(markPostRead(db, a, p)).resolves.toBeUndefined();
    await expect(markPostRead(db, a, 9999)).resolves.toBeUndefined();
    expect(await db.select().from(postReads)).toHaveLength(0);
  });
});

describe('getPost', () => {
  it('returnerer opslag med kommentarer i stigende tid uden slettede', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const p = await seedPost(a, 'P');
    const c2 = await seedComment(p, b, min(2));
    const c1 = await seedComment(p, a, min(1));
    await seedComment(p, b, min(3), { deletedAt: T0 });
    const d = (await getPost(db, b, p))!;
    expect(d).toMatchObject({ id: p, title: 'P', body: 'Tekst P', authorId: a, authorName: 'Bruger a', pinned: false, unread: true });
    expect(d.comments.map((c) => c.id)).toEqual([c1, c2]);
    expect(d.comments[0]).toMatchObject({ authorId: a, authorName: 'Bruger a', body: 'k' });
    await markPostRead(db, b, p);
    expect((await getPost(db, b, p))!.unread).toBe(false);
    expect((await getPost(db, a, p))!.unread).toBe(true);
  });

  it('markPostRead for ukendt id er en no-op', async () => {
    const a = await seedUser(db);
    await markPostRead(db, a, 424242);
    expect(await db.select().from(postReads)).toHaveLength(0);
    expect(await getPost(db, a, 424242)).toBeNull();
  });

  it('giver null for slettet og ukendt', async () => {
    const a = await seedUser(db);
    const p = await seedPost(a, 'P', T0, { deletedAt: T0 });
    expect(await getPost(db, a, p)).toBeNull();
    expect(await getPost(db, a, 9999)).toBeNull();
  });
});
