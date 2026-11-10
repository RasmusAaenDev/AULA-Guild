import { z } from 'zod';

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

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
  DISCORD_BOT_TOKEN: z.string().trim().optional().transform((v) => v || undefined),
  DISCORD_CHAT_CHANNEL_ID: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.string().regex(/^\d{5,25}$/, 'DISCORD_CHAT_CHANNEL_ID skal være et tal').optional()),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
