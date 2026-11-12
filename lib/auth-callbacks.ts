import type { Access } from '@/lib/discord-access';

export type DiscordProfile = { id: string; username: string; global_name?: string | null; avatar?: string | null };
export type SignInToken = { userId?: number; isMember?: boolean; isOfficer?: boolean; [key: string]: unknown };

type Deps = {
  fetchAccess(accessToken: string): Promise<Access>;
  upsertUser(u: { discordId: string; name: string; avatar: string | null }): Promise<number>;
};

export async function applySignIn(
  deps: Deps,
  token: SignInToken,
  input: { accessToken: string; profile: DiscordProfile },
): Promise<SignInToken> {
  const access = await deps.fetchAccess(input.accessToken);
  if (!access.isMember) return { ...token, isMember: false, isOfficer: false };
  const { profile } = input;
  const userId = await deps.upsertUser({
    discordId: profile.id,
    name: profile.global_name || profile.username,
    avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null,
  });
  return { ...token, userId, discordId: profile.id, isMember: true, isOfficer: access.isOfficer };
}
