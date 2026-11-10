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
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
