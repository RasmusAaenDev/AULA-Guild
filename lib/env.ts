import { z } from 'zod';

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

// Tom streng regnes som ikke sat.
const optionalHttpUrl = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().url().refine((u) => /^https?:\/\//i.test(u), 'Kun http/https').optional(),
);

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DISCORD_OFFICER_ROLE_ID: z.string().min(1),
  BLIZZARD_CLIENT_ID: z.string().min(1),
  BLIZZARD_CLIENT_SECRET: z.string().min(1),
  BLIZZARD_GUILD_SLUG: z.string().min(1).default('aula'),
  BLIZZARD_GUILD_ID: z.coerce.number().int().positive().default(304114),
  CRON_SECRET: z.string().min(16),
  SYNC_ENABLED: bool,
  AUTO_MIGRATE: bool,
  // Filer: mappen er serverens egen konfiguration, aldrig brugerinput.
  UPLOAD_DIR: z.string().min(1).default('./data/uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(1024).default(10),
  MAX_TOTAL_MB: z.coerce.number().int().positive().default(2048),
  // Chat (valgfri): kun aktiv hvis BEGGE er sat. Tomme værdier regnes som ikke sat.
  // Valideres bevidst løst her (se lib/chat-config.ts), så en fejl i chat-opsætningen aldrig vælter env().
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_CHAT_CHANNEL_ID: z.string().optional(),
  // Sim (valgfri): adressen på simc-worker, fx http://simc:8080. Ikke sat = Sim-siden er slået fra.
  SIMC_WORKER_URL: optionalHttpUrl,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
