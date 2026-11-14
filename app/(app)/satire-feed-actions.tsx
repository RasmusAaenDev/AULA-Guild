'use server';

import { randomBytes } from 'node:crypto';
import type { ReactNode } from 'react';
import { SatireCard } from '@/components/SatireCard';
import { SATIRE_RANDOM_COUNT, randomSatire, satirePosts } from '@/lib/satire';
import { requireUser } from '@/lib/session';
import { todayInCopenhagen } from '@/lib/time';

export type RandomSatireResult =
  | { ok: false }
  | { ok: true; posts: { id: string; node: ReactNode }[]; remaining: number };

/**
 * Trækker SATIRE_RANDOM_COUNT nye tilfældige satire-opslag (med kommentarer), uden dem klienten allerede har vist (`shownIds`), og
 * returnerer de renderede kort (samme `SatireCard` som siden). `remaining` er antallet af opslag, der endnu ikke er vist, så knappen kan
 * forsvinde, når hele samlingen er set. Ikke-medlemmer sendes videre af `requireUser` og får ingen data.
 */
export async function loadRandomSatireAction(shownIds: string[]): Promise<RandomSatireResult> {
  await requireUser();
  if (!Array.isArray(shownIds) || shownIds.length > satirePosts.length || shownIds.some((id) => typeof id !== 'string' || id.length > 20)) {
    return { ok: false };
  }
  const now = new Date();
  const posts = randomSatire(randomBytes(4).toString('hex'), todayInCopenhagen(now), now, SATIRE_RANDOM_COUNT, shownIds);
  const seen = new Set([...shownIds, ...posts.map((p) => p.id)]);
  return {
    ok: true,
    posts: posts.map((p) => ({ id: p.id, node: <SatireCard post={p} now={now} /> })),
    remaining: satirePosts.filter((p) => !seen.has(p.id)).length,
  };
}
