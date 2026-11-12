import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { fullName } from '@/lib/names';
import { characters, comments, postBookmarks, postReads, posts, users } from '@/lib/db/schema';

export type PostTab = 'alle' | 'ulaeste' | 'vigtige' | 'egne' | 'gemte';
export type PostActor = { userId: number; isOfficer: boolean };
export type PostListItem = {
  id: number;
  title: string;
  excerpt: string;
  /** Null for opslag uden ejer (fra før Battle.net-login); så er authorName det gemte navn. */
  authorId: number | null;
  authorName: string;
  /** Navnet på forfatterens aktive karakter, ellers null. */
  authorCharacter: string | null;
  /** Fuldt navn (fornavn + efternavn) på forfatterens aktive karakter, ellers null. */
  authorCharacterFullName: string | null;
  createdAt: Date;
  pinned: boolean;
  commentCount: number;
  unread: boolean;
  bookmarked: boolean;
};
export type CommentItem = {
  id: number;
  authorId: number | null;
  authorName: string;
  /** Fuldt navn på forfatterens aktive karakter, ellers null. */
  authorCharacterFullName: string | null;
  body: string;
  createdAt: Date;
};
export type PostDetail = {
  id: number;
  title: string;
  body: string;
  authorId: number | null;
  authorName: string;
  /** Fuldt navn på forfatterens aktive karakter, ellers null. */
  authorCharacterFullName: string | null;
  createdAt: Date;
  pinned: boolean;
  comments: CommentItem[];
  unread: boolean;
  bookmarked: boolean;
};

/** Uddraget hentes med ét tegn mere end vist, så UI kan se, om teksten blev afkortet (se `excerptText`). */
const EXCERPT_LENGTH = 200;
/** Opslag pr. side i Overblik (`?side=N`). */
export const POSTS_PAGE_SIZE = 20;
const DEFAULT_PAGE_SIZE = POSTS_PAGE_SIZE;

const validId = (id: number) => Number.isInteger(id) && id > 0 && id <= 2147483647;

function lengthOk(s: string, max: number): boolean {
  if (s.includes('\u0000')) return false; // Postgres afviser NUL i text (22021)
  const n = [...s].length; // Unicode-tegn, ikke UTF-16-enheder
  return n >= 1 && n <= max;
}

export async function createPost(
  db: Db,
  userId: number,
  input: { title: string; body: string },
): Promise<{ ok: true; postId: number } | { ok: false; reason: 'invalid' }> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!lengthOk(title, 120) || !lengthOk(body, 5000)) return { ok: false, reason: 'invalid' };
  const postId = await db.transaction(async (tx) => {
    const [p] = await tx.insert(posts).values({ authorId: userId, title, body }).returning({ id: posts.id });
    await tx.insert(postReads).values({ userId, postId: p.id }).onConflictDoNothing();
    return p.id;
  });
  return { ok: true, postId };
}

export async function addComment(
  db: Db,
  userId: number,
  postId: number,
  body: string,
): Promise<{ ok: true; commentId: number } | { ok: false; reason: 'invalid' | 'not_found' }> {
  const text = body.trim();
  if (!lengthOk(text, 2000)) return { ok: false, reason: 'invalid' };
  if (!validId(postId)) return { ok: false, reason: 'not_found' };
  // Tjek og insert i ét udsagn, så et samtidigt slettet opslag ikke giver FK-fejl eller kommentar på slettet opslag.
  const rows = await db.execute<{ id: number }>(sql`
    insert into comments (post_id, author_id, body)
    select p.id, ${userId}, ${text} from posts p where p.id = ${postId} and p.deleted_at is null
    returning id`);
  const row = rows[0];
  if (!row) return { ok: false, reason: 'not_found' };
  return { ok: true, commentId: row.id };
}

export async function deletePost(
  db: Db,
  actor: PostActor,
  postId: number,
): Promise<{ ok: true } | { ok: false; reason: 'forbidden' | 'not_found' }> {
  if (!validId(postId)) return { ok: false, reason: 'not_found' };
  const [p] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)));
  if (!p) return { ok: false, reason: 'not_found' };
  if (!actor.isOfficer && p.authorId !== actor.userId) return { ok: false, reason: 'forbidden' };
  await db
    .update(posts)
    .set({ deletedAt: new Date() })
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)));
  return { ok: true };
}

export async function deleteComment(
  db: Db,
  actor: PostActor,
  commentId: number,
): Promise<{ ok: true } | { ok: false; reason: 'forbidden' | 'not_found' }> {
  if (!validId(commentId)) return { ok: false, reason: 'not_found' };
  const [c] = await db
    .select({ authorId: comments.authorId })
    .from(comments)
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));
  if (!c) return { ok: false, reason: 'not_found' };
  if (!actor.isOfficer && c.authorId !== actor.userId) return { ok: false, reason: 'forbidden' };
  await db
    .update(comments)
    .set({ deletedAt: new Date() })
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));
  return { ok: true };
}

export async function setPinned(
  db: Db,
  actor: PostActor,
  postId: number,
  pinned: boolean,
): Promise<{ ok: true } | { ok: false; reason: 'forbidden' | 'not_found' }> {
  if (!validId(postId)) return { ok: false, reason: 'not_found' };
  const [p] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)));
  if (!p) return { ok: false, reason: 'not_found' };
  if (!actor.isOfficer) return { ok: false, reason: 'forbidden' };
  await db
    .update(posts)
    .set({ pinned, pinnedAt: pinned ? new Date() : null })
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt), eq(posts.pinned, !pinned)));
  return { ok: true };
}

export async function markPostRead(db: Db, userId: number, postId: number): Promise<void> {
  if (!validId(postId)) return;
  // Insert via select: ingen række for slettede/ukendte opslag, og ingen FK-fejl ved samtidig sletning.
  await db.execute(sql`
    insert into post_reads (user_id, post_id)
    select ${userId}, p.id from posts p where p.id = ${postId} and p.deleted_at is null
    on conflict do nothing`);
}

/** Slår brugerens bogmærke på et (ikke-slettet) opslag til eller fra. Et allerede slettet opslag kan ikke gemmes. */
export async function toggleBookmark(
  db: Db,
  userId: number,
  postId: number,
): Promise<{ ok: true; bookmarked: boolean } | { ok: false; reason: 'not_found' }> {
  if (!validId(postId)) return { ok: false, reason: 'not_found' };
  return db.transaction(async (tx) => {
    // Lås opslagsrækken, så et samtidigt sletningsforsøg og et samtidigt dobbeltklik ikke kan slå fejl.
    const [p] = await tx
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
      .for('share');
    if (!p) return { ok: false as const, reason: 'not_found' as const };
    const removed = await tx
      .delete(postBookmarks)
      .where(and(eq(postBookmarks.userId, userId), eq(postBookmarks.postId, postId)))
      .returning({ postId: postBookmarks.postId });
    if (removed.length > 0) return { ok: true as const, bookmarked: false };
    await tx.insert(postBookmarks).values({ userId, postId }).onConflictDoNothing();
    return { ok: true as const, bookmarked: true };
  });
}

const bookmarkedSql = (userId: number) =>
  sql<boolean>`exists (select 1 from ${postBookmarks} where ${postBookmarks.postId} = ${posts.id} and ${postBookmarks.userId} = ${userId})`;

const unreadSql = (userId: number) =>
  sql<boolean>`not exists (select 1 from ${postReads} where ${postReads.postId} = ${posts.id} and ${postReads.userId} = ${userId})`;

export async function listPosts(
  db: Db,
  userId: number,
  tab: PostTab,
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<{ items: PostListItem[]; hasMore: boolean }> {
  const size = Number.isFinite(pageSize) && pageSize >= 1 ? Math.min(100, Math.floor(pageSize)) : DEFAULT_PAGE_SIZE;
  const pageNo = Number.isFinite(page) ? Math.min(1_000_000, Math.max(1, Math.floor(page))) : 1;
  return listPostsSlice(db, userId, tab, (pageNo - 1) * size, size);
}

/**
 * Samme liste og rækkefølge som `listPosts`, men fra et vilkårligt offset: `size` opslag efter de første `offset`.
 * Bruges af «Vis flere beskeder», der henter få ad gangen. Kalderen validerer; værdierne afkortes for en sikkerheds skyld.
 */
export async function listPostsSlice(
  db: Db,
  userId: number,
  tab: PostTab,
  offsetIn: number,
  sizeIn: number,
): Promise<{ items: PostListItem[]; hasMore: boolean }> {
  const size = Number.isFinite(sizeIn) && sizeIn >= 1 ? Math.min(100, Math.floor(sizeIn)) : DEFAULT_PAGE_SIZE;
  const offset = Number.isFinite(offsetIn) && offsetIn >= 0 ? Math.min(100_000_000, Math.floor(offsetIn)) : 0;
  const where = and(
    isNull(posts.deletedAt),
    tab === 'vigtige' ? eq(posts.pinned, true) : undefined,
    tab === 'ulaeste' ? unreadSql(userId) : undefined,
    tab === 'egne' ? eq(posts.authorId, userId) : undefined,
    tab === 'gemte' ? bookmarkedSql(userId) : undefined,
  );
  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      excerpt: sql<string>`left(regexp_replace(btrim(${posts.body}), '\\s+', ' ', 'g'), ${EXCERPT_LENGTH + 1})`,
      authorId: posts.authorId,
      authorName: postAuthorName(),
      authorCharacter: characters.name,
      authorCharacterSurname: characters.surname,
      authorCharacterSlug: characters.slug,
      createdAt: posts.createdAt,
      pinned: posts.pinned,
      commentCount: sql<number>`(select count(*)::int from ${comments} where ${comments.postId} = ${posts.id} and ${comments.deletedAt} is null)`,
      unread: unreadSql(userId),
      bookmarked: bookmarkedSql(userId),
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .leftJoin(characters, activeCharacterOf())
    .where(where)
    .orderBy(
      desc(posts.pinned),
      sql`${posts.pinnedAt} desc nulls last`,
      desc(posts.createdAt),
      desc(posts.id),
    )
    .limit(size + 1)
    .offset(offset);
  const items = rows.slice(0, size).map(({ authorCharacterSurname, authorCharacterSlug, ...r }) => ({
    ...r,
    authorCharacterFullName:
      r.authorCharacter === null || authorCharacterSlug === null
        ? null
        : fullName({ name: r.authorCharacter, surname: authorCharacterSurname, slug: authorCharacterSlug }),
  }));
  return { items, hasMore: rows.length > size };
}

/** Brugerens navn, eller det gemte forfatternavn for opslag uden ejer. */
function postAuthorName() {
  return sql<string>`coalesce(${users.name}, ${posts.authorName}, 'Ukendt')`;
}

/** Join-betingelse: forfatterens aktive karakter, og kun hvis den tilhører forfatteren. */
function activeCharacterOf() {
  return and(eq(characters.id, users.activeCharacterId), eq(characters.userId, users.id));
}

function activeFullName(name: string | null, surname: string | null, slug: string | null): string | null {
  return name === null || slug === null ? null : fullName({ name, surname, slug });
}

export async function getPost(db: Db, userId: number, postId: number): Promise<PostDetail | null> {
  if (!validId(postId)) return null;
  const [p] = await db
    .select({
      id: posts.id,
      title: posts.title,
      body: posts.body,
      authorId: posts.authorId,
      authorName: postAuthorName(),
      characterName: characters.name,
      characterSurname: characters.surname,
      characterSlug: characters.slug,
      createdAt: posts.createdAt,
      pinned: posts.pinned,
      unread: unreadSql(userId),
      bookmarked: bookmarkedSql(userId),
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .leftJoin(characters, activeCharacterOf())
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)));
  if (!p) return null;
  const cs = await db
    .select({
      id: comments.id,
      authorId: comments.authorId,
      authorName: sql<string>`coalesce(${users.name}, ${comments.authorName}, 'Ukendt')`,
      characterName: characters.name,
      characterSurname: characters.surname,
      characterSlug: characters.slug,
      body: comments.body,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .leftJoin(characters, activeCharacterOf())
    .where(and(eq(comments.postId, postId), isNull(comments.deletedAt)))
    .orderBy(asc(comments.createdAt), asc(comments.id));
  const { characterName, characterSurname, characterSlug, ...post } = p;
  return {
    ...post,
    authorCharacterFullName: activeFullName(characterName, characterSurname, characterSlug),
    comments: cs.map(({ characterName: n, characterSurname: s, characterSlug: g, ...c }) => ({
      ...c,
      authorCharacterFullName: activeFullName(n, s, g),
    })),
  };
}

export async function countUnread(db: Db, userId: number): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(posts)
    .where(and(isNull(posts.deletedAt), unreadSql(userId)));
  return r.n;
}
