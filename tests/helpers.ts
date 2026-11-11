import type { Db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { BlizzardError, type ArmoryCharacter, type BlizzardClient, type RecentAchievement, type RosterMember, type SimProfile } from '@/lib/blizzard/types';

export function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export function armory(over: Partial<ArmoryCharacter> = {}): ArmoryCharacter {
  return {
    blizzardId: 1001,
    slug: 'magi-far',
    name: 'Magi',
    surname: 'Far',
    className: 'Mage',
    spec: 'Frost',
    level: 32,
    itemLevel: 8,
    guildId: 304114,
    guildName: 'AULA',
    lastLogin: new Date('2026-11-10T18:00:00Z'),
    ...over,
  };
}

export function member(over: Partial<RosterMember> = {}): RosterMember {
  return { blizzardId: 1001, slug: 'magi-far', name: 'Magi', surname: 'Far', rank: 3, ...over };
}

export function fakeBlizzard(opts: {
  characters?: Record<string, ArmoryCharacter | BlizzardError | (ArmoryCharacter | BlizzardError)[]>;
  roster?: RosterMember[] | BlizzardError;
  achievements?: Record<string, RecentAchievement[] | BlizzardError | Error>;
  simProfiles?: Record<string, SimProfile | BlizzardError | Error>;
}): BlizzardClient & { calls: string[] } {
  const calls: string[] = [];
  const counters = new Map<string, number>();
  return {
    calls,
    async getCharacter(slug) {
      calls.push(`character:${slug}`);
      let v = opts.characters?.[slug];
      if (Array.isArray(v)) {
        const n = counters.get(slug) ?? 0;
        counters.set(slug, n + 1);
        v = v[Math.min(n, v.length - 1)];
      }
      if (v === undefined) throw new BlizzardError('not_found', slug);
      if (v instanceof BlizzardError) throw v;
      return v;
    },
    async getRecentAchievements(slug) {
      calls.push(`achievements:${slug}`);
      const v = opts.achievements?.[slug];
      if (v instanceof Error) throw v;
      return v ?? [];
    },
    async getSimProfile(slug) {
      calls.push(`simprofile:${slug}`);
      const v = opts.simProfiles?.[slug];
      if (v === undefined) throw new BlizzardError('not_found', slug);
      if (v instanceof Error) throw v;
      return v;
    },
    async getGuildRoster() {
      calls.push('roster');
      if (opts.roster instanceof BlizzardError) throw opts.roster;
      return opts.roster ?? [];
    },
  };
}

export async function seedUser(db: Db, discordId = 'd1'): Promise<number> {
  const [u] = await db.insert(users).values({ discordId, name: `Bruger ${discordId}` }).returning({ id: users.id });
  return u.id;
}
