import type { Access } from '@/lib/discord-access';

export type DiscordProfile = { id: string; username: string; global_name?: string | null; avatar?: string | null };
export type SignInToken = { userId?: number; isMember?: boolean; isOfficer?: boolean; [key: string]: unknown };

type Deps = {
  fetchAccess(accessToken: string): Promise<Access>;
  upsertUser(u: { battlenetId: string; battletag: string }): Promise<number>;
};

export async function applySignIn(
  deps: Deps,
  token: SignInToken,
  input: { accessToken: string; profile: DiscordProfile },
): Promise<SignInToken> {
  const access = await deps.fetchAccess(input.accessToken);
  if (!access.isMember) return { ...token, isMember: false, isOfficer: false };
  const { profile } = input;
  // Midlertidigt (indtil Battle.net-login): Discord-id'et gemmes i battlenet_id-kolonnen.
  const userId = await deps.upsertUser({ battlenetId: profile.id, battletag: profile.global_name || profile.username });
  return { ...token, userId, discordId: profile.id, isMember: true, isOfficer: access.isOfficer };
}
