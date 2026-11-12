import type { Db } from '@/lib/db';
import { listPostsSlice } from '@/lib/posts';
import type { PostListItem, PostTab } from '@/lib/posts';
import { MAX_FEED_LIMIT } from '@/lib/post-feed-ui';

/** Faner der kan vise flere opslag. Satire har ingen paginering og er bevidst ikke med. */
const PAGED_TABS: readonly PostTab[] = ['alle', 'ulaeste', 'vigtige', 'egne', 'gemte'];

/** Samme loft som `?side=` (1.000.000 sider à 20). */
const MAX_OFFSET = 20_000_000;

export type FeedRequest = { tab: PostTab; offset: number; limit: number };

/**
 * Validerer en anmodning om `limit` opslag efter de første `offset` i fanens liste. Ukendt fane, satire,
 * ikke-heltal, negativt offset eller limit uden for 1–100 giver null.
 */
export function parseFeedRequest(tab: unknown, offset: unknown, limit: unknown): FeedRequest | null {
  if (typeof tab !== 'string' || !(PAGED_TABS as readonly string[]).includes(tab)) return null;
  if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) return null;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_FEED_LIMIT) return null;
  return { tab: tab as PostTab, offset, limit };
}

export type FeedResult =
  | { ok: false }
  | { ok: true; items: PostListItem[]; hasMore: boolean; nextOffset: number };

/** Kernen i «Vis flere beskeder»: validér input, hent udsnittet. Kalderen har allerede tjekket medlemskab. */
export async function handleFeedRequest(db: Db, userId: number, tab: unknown, offset: unknown, limit: unknown): Promise<FeedResult> {
  const req = parseFeedRequest(tab, offset, limit);
  if (!req) return { ok: false };
  const { items, hasMore } = await listPostsSlice(db, userId, req.tab, req.offset, req.limit);
  return { ok: true, items, hasMore, nextOffset: req.offset + items.length };
}
