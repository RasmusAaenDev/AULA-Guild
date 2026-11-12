'use server';

import type { ReactNode } from 'react';
import { PostCard } from '@/components/PostCard';
import { getDb } from '@/lib/db';
import { handleFeedRequest } from '@/lib/post-feed';
import { requireMember } from '@/lib/session';

export type FeedSliceResult =
  | { ok: false }
  | { ok: true; posts: { id: number; node: ReactNode }[]; hasMore: boolean; nextOffset: number };

/**
 * Henter `limit` opslag efter de første `offset` i fanens liste og returnerer de renderede kort (samme `PostCard`
 * som siden). Kun ægte opslag; satire, chat og galleri flettes kun ind på side 1. Ikke-medlemmer sendes videre af
 * `requireMember` og får ingen data.
 */
export async function loadPostsAction(tab: string, offset: number, limit: number): Promise<FeedSliceResult> {
  const member = await requireMember();
  const result = await handleFeedRequest(getDb(), member.userId, tab, offset, limit);
  if (!result.ok) return { ok: false };
  const now = new Date();
  return {
    ok: true,
    hasMore: result.hasMore,
    nextOffset: result.nextOffset,
    posts: result.items.map((p) => ({
      id: p.id,
      node: <PostCard post={p} now={now} canDelete={member.isOfficer || p.authorId === member.userId} />,
    })),
  };
}
