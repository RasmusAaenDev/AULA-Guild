import path from 'node:path';
import { createBlizzardClient } from '@/lib/blizzard/client';
import type { BlizzardClient } from '@/lib/blizzard/types';
import type { CharactersDeps } from '@/lib/characters';
import { getDb } from '@/lib/db';
import { fetchAccess } from '@/lib/discord-access';
import { env } from '@/lib/env';
import type { StorageDeps } from '@/lib/files';
import { runJobs, type JobsResult } from '@/lib/jobs';
import { generateSeriesEvents } from '@/lib/series';
import { syncRoster, type SyncResult } from '@/lib/sync';
import { upsertUser } from '@/lib/users';

const g = globalThis as unknown as { __aulaBlizzard?: BlizzardClient };

export function getBlizzard(): BlizzardClient {
  g.__aulaBlizzard ??= createBlizzardClient({
    clientId: env().BLIZZARD_CLIENT_ID,
    clientSecret: env().BLIZZARD_CLIENT_SECRET,
  });
  return g.__aulaBlizzard;
}

export function charactersDeps(): CharactersDeps {
  return { db: getDb(), blizzard: getBlizzard(), guildId: env().BLIZZARD_GUILD_ID, guildSlug: env().BLIZZARD_GUILD_SLUG };
}

export function runSync(): Promise<SyncResult> {
  return syncRoster({ db: getDb(), blizzard: getBlizzard(), guildSlug: env().BLIZZARD_GUILD_SLUG });
}

export function runScheduledJobs(): Promise<JobsResult> {
  return runJobs({ sync: runSync, generate: () => generateSeriesEvents(getDb()) });
}

export function authDeps() {
  return {
    fetchAccess: (accessToken: string) =>
      fetchAccess({ accessToken, guildId: env().DISCORD_GUILD_ID, officerRoleId: env().DISCORD_OFFICER_ROLE_ID }),
    upsertUser: (u: { discordId: string; name: string; avatar: string | null }) => upsertUser(getDb(), u),
  };
}

export function filesDeps(): StorageDeps {
  const e = env();
  return {
    db: getDb(),
    uploadDir: path.resolve(e.UPLOAD_DIR),
    maxBytes: e.MAX_UPLOAD_MB * 1024 * 1024,
    maxTotalBytes: e.MAX_TOTAL_MB * 1024 * 1024,
  };
}
