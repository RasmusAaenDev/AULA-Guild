export type Access = { isMember: boolean; isOfficer: boolean };

export class DiscordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscordError';
  }
}

export async function fetchAccess(opts: {
  accessToken: string;
  guildId: string;
  officerRoleId: string;
  fetch?: typeof fetch;
}): Promise<Access> {
  const doFetch = opts.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`https://discord.com/api/v10/users/@me/guilds/${opts.guildId}/member`, {
      headers: { Authorization: `Bearer ${opts.accessToken}` },
    });
  } catch {
    throw new DiscordError('Discord kunne ikke nås');
  }
  if (res.status === 404) return { isMember: false, isOfficer: false };
  if (!res.ok) throw new DiscordError(`Discord svarede HTTP ${res.status}`);
  const member = (await res.json()) as { roles?: string[] };
  return { isMember: true, isOfficer: member.roles?.includes(opts.officerRoleId) ?? false };
}
