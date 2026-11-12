import { eq, isNotNull, lt } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { characters, highlights } from '@/lib/db/schema';
import { fullName } from '@/lib/names';
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
const ACHIEVEMENT_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const HIGHLIGHT_RETENTION_MS = 30 * 24 * 3600 * 1000;

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

async function recordHighlights(
  deps: SyncDeps,
  c: { id: number; slug: string; surname: string | null },
  p: ArmoryCharacter,
  before: { level: number | null; baseline: Date | null } | undefined,
  at: Date,
  sleep: (ms: number) => Promise<void>,
): Promise<void> {
  const name = fullName({ name: p.name, surname: p.surname ?? c.surname, slug: c.slug });
  if (before?.level != null && p.level !== null && p.level > before.level) {
    await deps.db
      .insert(highlights)
      .values({ characterId: c.id, type: 'level_up', title: `${name} nåede level ${p.level}`, occurredAt: at, dedupeKey: `level:${p.level}` })
      .onConflictDoNothing();
  }
  // Første kørsel: kun markøren sættes, ingen historik backfilles.
  if (!before?.baseline) {
    await deps.db.update(characters).set({ highlightsBaselineAt: at }).where(eq(characters.id, c.id));
    return;
  }
  let list;
  try {
    list = await deps.blizzard.getRecentAchievements(c.slug);
  } catch (e) {
    if (!(e instanceof BlizzardError && e.kind === 'rate_limited')) throw e;
    await sleep(RATE_LIMIT_WAIT_MS);
    list = await deps.blizzard.getRecentAchievements(c.slug);
  }
  const cutoff = Math.max(at.getTime() - ACHIEVEMENT_MAX_AGE_MS, before.baseline.getTime());
  const fresh = list.filter((a) => a.completedAt.getTime() > cutoff);
  if (fresh.length > 0) {
    await deps.db
      .insert(highlights)
      .values(fresh.map((a) => ({ characterId: c.id, type: 'achievement' as const, title: `${name}: ${a.name}`, occurredAt: a.completedAt, dedupeKey: `ach:${a.id}` })))
      .onConflictDoNothing();
  }
  await deps.db.update(characters).set({ highlightsBaselineAt: at }).where(eq(characters.id, c.id));
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
    .select({ id: characters.id, blizzardId: characters.blizzardId, slug: characters.slug, surname: characters.surname })
    .from(characters)
    .where(isNotNull(characters.userId));

  const present: { id: number; blizzardId: number; slug: string; surname: string | null }[] = [];
  const outside: typeof present = [];
  for (const c of registered) {
    const m = byId.get(c.blizzardId);
    if (!m) {
      await deps.db.update(characters).set({ inGuild: false, guildRank: null }).where(eq(characters.id, c.id));
      outside.push({ id: c.id, blizzardId: c.blizzardId, slug: c.slug, surname: c.surname });
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
      const [before] = await deps.db
        .select({ level: characters.level, baseline: characters.highlightsBaselineAt })
        .from(characters)
        .where(eq(characters.id, c.id));
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
      // Highlights er sekundære: en fejl her må aldrig påvirke karakterens synkronisering eller tællingerne.
      try {
        await recordHighlights(deps, c, p, before, now(), sleep);
      } catch {
        // ignoreres bevidst
      }
    } catch {
      failed++;
    }
  });

  // Karakterer uden for guilden: kun profilen opdateres (ingen achievements/highlights).
  await mapLimit(outside, deps.concurrency ?? 3, async (c) => {
    try {
      const p = await fetchProfile(deps.blizzard, c.slug, sleep);
      if (p.blizzardId !== c.blizzardId) {
        failed++;
        return;
      }
      await deps.db
        .update(characters)
        .set({
          name: p.name,
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

  try {
    await deps.db.delete(highlights).where(lt(highlights.occurredAt, new Date(now().getTime() - HIGHLIGHT_RETENTION_MS)));
  } catch {
    // oprydning er best effort
  }

  return { skipped: false, updated, failed };
}
