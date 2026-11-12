import path from 'node:path';
import { chatConfig } from '@/lib/chat-config';
import { createChatClient, type ChatClient } from '@/lib/chat';
import { createBlizzardClient } from '@/lib/blizzard/client';
import type { BlizzardClient } from '@/lib/blizzard/types';
import type { CharactersDeps } from '@/lib/characters';
import { getDb } from '@/lib/db';
import { fetchAccess } from '@/lib/discord-access';
import { env } from '@/lib/env';
import type { StorageDeps } from '@/lib/files';
import { processQueue } from '@/lib/sim-runner';
import { deleteOldSims } from '@/lib/sims';
import { runJobs, type JobsResult } from '@/lib/jobs';
import { generateSeriesEvents } from '@/lib/series';
import { syncRoster, type SyncResult } from '@/lib/sync';
import { upsertUser } from '@/lib/users';

const g = globalThis as unknown as { __aulaBlizzard?: BlizzardClient; __aulaChat?: ChatClient; __aulaSync?: Promise<SyncResult> };

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

/** Kun én synkronisering ad gangen: en anmodning under en igangværende kørsel (planlagt eller manuel) får samme resultat. */
export function runSync(): Promise<SyncResult> {
  g.__aulaSync ??= syncRoster({ db: getDb(), blizzard: getBlizzard(), guildSlug: env().BLIZZARD_GUILD_SLUG }).finally(() => {
    g.__aulaSync = undefined;
  });
  return g.__aulaSync;
}

export function isSimConfigured(): boolean {
  return !!env().SIMC_WORKER_URL;
}

/** Sætter køen i gang uden at vente på den (til actions og planlagte jobs). Intet sker, hvis simulatoren ikke er sat op. */
export function kickSimQueue(): void {
  const workerUrl = env().SIMC_WORKER_URL;
  if (!workerUrl) return;
  processQueue({ db: getDb(), workerUrl }).catch((err) => console.error('Sim-kø fejlede', err));
}

export async function runScheduledJobs(): Promise<JobsResult> {
  const result = await runJobs({ sync: runSync, generate: () => generateSeriesEvents(getDb()) });
  try {
    await deleteOldSims(getDb());
    kickSimQueue();
  } catch (err) {
    console.error('Oprydning af simulationer fejlede', err);
  }
  return result;
}

export function authDeps() {
  return {
    fetchAccess: (accessToken: string) =>
      fetchAccess({ accessToken, guildId: env().DISCORD_GUILD_ID, officerRoleId: env().DISCORD_OFFICER_ROLE_ID }),
    upsertUser: (u: { battlenetId: string; battletag: string }) => upsertUser(getDb(), u),
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

export function isChatConfigured(): boolean {
  return chatConfig() !== null;
}

/** Chat-klienten (delt cache på tværs af anmodninger), eller null hvis chatten ikke er sat op. */
export function getChat(): ChatClient | null {
  const cfg = chatConfig();
  if (!cfg) return null;
  g.__aulaChat ??= createChatClient({
    token: cfg.token,
    channelId: cfg.channelId,
    // Kun disse kanaler vises. Standardkanalen er den WoW-linkede, som Discord ikke lader bots skrive i.
    visibleChannels: ['rio', 'wow-news', 'wow'],
    readOnlyChannelIds: [cfg.channelId],
  });
  return g.__aulaChat;
}
