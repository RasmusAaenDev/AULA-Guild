import { eq, isNotNull } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { characters } from '@/lib/db/schema';
import { BlizzardError, type ArmoryCharacter, type BlizzardClient } from '@/lib/blizzard/types';

export type SyncDeps = {
  db: Db;
  blizzard: BlizzardClient;
  guildSlug: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  concurrency?: number;
};

export type SyncResult = { skipped: boolean; updated: number; failed: number };

const RATE_LIMIT_WAIT_MS = 2000;

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function fetchProfile(
  blizzard: BlizzardClient,
  slug: string,
  sleep: (ms: number) => Promise<void>,
): Promise<ArmoryCharacter> {
  try {
    return await blizzard.getCharacter(slug);
  } catch (e) {
    if (e instanceof BlizzardError && e.kind === 'rate_limited') {
      await sleep(RATE_LIMIT_WAIT_MS);
      return blizzard.getCharacter(slug);
    }
    throw e;
  }
}

export async function syncRoster(deps: SyncDeps): Promise<SyncResult> {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let roster;
  try {
    roster = await deps.blizzard.getGuildRoster(deps.guildSlug);
  } catch {
    return { skipped: true, updated: 0, failed: 0 };
  }
  // Et vellykket men tomt svar behandles som et udfald, så ingen fejlagtigt markeres som forladt.
  if (roster.length === 0) return { skipped: true, updated: 0, failed: 0 };
  const byId = new Map(roster.map((m) => [m.blizzardId, m]));

  const registered = await deps.db
    .select({ id: characters.id, blizzardId: characters.blizzardId })
    .from(characters)
    .where(isNotNull(characters.userId));

  const present: { id: number; blizzardId: number; slug: string; surname: string | null }[] = [];
  for (const c of registered) {
    const m = byId.get(c.blizzardId);
    if (!m) {
      await deps.db.update(characters).set({ inGuild: false }).where(eq(characters.id, c.id));
    } else {
      await deps.db.update(characters).set({ inGuild: true, guildRank: m.rank }).where(eq(characters.id, c.id));
      present.push({ id: c.id, blizzardId: c.blizzardId, slug: m.slug, surname: m.surname });
    }
  }

  let updated = 0;
  let failed = 0;
  await mapLimit(present, deps.concurrency ?? 3, async (c) => {
    try {
      const p = await fetchProfile(deps.blizzard, c.slug, sleep);
      if (p.blizzardId !== c.blizzardId) {
        failed++;
        return;
      }
      await deps.db
        .update(characters)
        .set({
          slug: c.slug,
          name: p.name,
          // Profil først, rosteren som fallback; aldrig overskriv et kendt efternavn med null.
          ...((p.surname ?? c.surname) !== null ? { surname: p.surname ?? c.surname } : {}),
          className: p.className,
          ...(p.spec !== undefined ? { spec: p.spec } : {}),
          ...(p.level !== null ? { level: p.level } : {}),
          itemLevel: p.itemLevel,
          lastLogin: p.lastLogin,
          lastSynced: now(),
        })
        .where(eq(characters.id, c.id));
      updated++;
    } catch {
      failed++;
    }
  });

  return { skipped: false, updated, failed };
}
