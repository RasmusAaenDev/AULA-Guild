import type { Access } from '@/lib/access';
import { displayName } from '@/lib/users';

/** Battle.net-profilen: userinfo giver `battletag`, ID-tokenet `battle_tag`; `sub` er det numeriske Battle.net-id. */
export type BattleNetProfile = { sub?: unknown; battletag?: unknown; battle_tag?: unknown };

export type SignInToken = {
  userId?: number;
  battlenetId?: string;
  isGuildMember?: boolean;
  isOfficer?: boolean;
  /** Tidspunkt (ms) for seneste afledning af adgang fra databasen. */
  checkedAt?: number;
  [key: string]: unknown;
};

export type AuthDeps = {
  upsertUser(u: { battlenetId: string; battletag: string }): Promise<number>;
  /** Henter og knytter brugerens karakterer fra Battle.net-kontoen. Access token bruges kun her og gemmes aldrig. */
  syncAccountCharacters(input: { userId: number; accessToken: string }): Promise<void>;
  deriveAccess(userId: number): Promise<Access>;
  now?: () => number;
};

/** Adgang genberegnes fra databasen højst så ofte. */
export const REVALIDATE_MS = 10 * 60 * 1000;

function profileId(p: BattleNetProfile): string {
  const sub = typeof p.sub === 'number' ? String(p.sub) : p.sub;
  if (typeof sub !== 'string' || !/^\d{1,20}$/.test(sub)) throw new Error('Battle.net-profilen mangler et gyldigt id');
  return sub;
}

function profileTag(p: BattleNetProfile): string {
  const tag = typeof p.battletag === 'string' ? p.battletag : typeof p.battle_tag === 'string' ? p.battle_tag : '';
  return tag.trim();
}

/** Login: opret/opdatér brugeren, synkronisér karakterer (fejl stopper ikke login) og læg afledt adgang i tokenet. */
export async function applySignIn(
  deps: AuthDeps,
  token: SignInToken,
  input: { accessToken: string; profile: BattleNetProfile },
): Promise<SignInToken> {
  const battlenetId = profileId(input.profile);
  const battletag = profileTag(input.profile);
  const userId = await deps.upsertUser({ battlenetId, battletag });
  try {
    await deps.syncAccountCharacters({ userId, accessToken: input.accessToken });
  } catch (err) {
    console.error('Synkronisering af Battle.net-karakterer ved login fejlede', err);
  }
  const access = await deps.deriveAccess(userId);
  const now = (deps.now ?? Date.now)();
  return {
    ...token,
    name: displayName(battletag),
    userId,
    battlenetId,
    isGuildMember: access.isGuildMember,
    isOfficer: access.isOfficer,
    checkedAt: now,
  };
}

/**
 * Eksisterende session: genberegn adgang fra databasen højst hvert 10. minut; fejl beholder den eksisterende adgang.
 * Tokens uden Battle.net-id (fx fra Discord-tiden) afvises med null, så brugeren logges ud.
 */
export async function revalidateToken(
  deps: Pick<AuthDeps, 'deriveAccess' | 'now'>,
  token: SignInToken,
): Promise<SignInToken | null> {
  if (typeof token.battlenetId !== 'string' || typeof token.userId !== 'number' || token.userId <= 0) return null;
  const now = (deps.now ?? Date.now)();
  if (typeof token.checkedAt === 'number' && now - token.checkedAt < REVALIDATE_MS) return token;
  try {
    const access = await deps.deriveAccess(token.userId);
    return { ...token, isGuildMember: access.isGuildMember, isOfficer: access.isOfficer, checkedAt: now };
  } catch (err) {
    console.error('Genberegning af adgang fejlede; beholder den eksisterende', err);
    return token;
  }
}
