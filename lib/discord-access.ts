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

/**
 * Slår et medlem op med BOT-tokenet (ikke brugerens eget, som udløber): bruges til jævnligt at tjekke, at en lang session
 * (30 dage) stadig tilhører et guild-medlem, og at officer-rollen stadig er der. 404 = ikke længere medlem. Andre fejl kaster
 * DiscordError, så kalderen kan lade den eksisterende adgang stå ved midlertidige fejl.
 */
export async function fetchMemberAccessByBot(opts: {
  botToken: string;
  guildId: string;
  officerRoleId: string;
  discordId: string;
  fetch?: typeof fetch;
}): Promise<Access> {
  if (!/^\d{1,25}$/.test(opts.discordId)) throw new DiscordError('Ugyldigt Discord-id');
  const doFetch = opts.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`https://discord.com/api/v10/guilds/${encodeURIComponent(opts.guildId)}/members/${opts.discordId}`, {
      headers: { Authorization: `Bot ${opts.botToken}`, 'User-Agent': 'DiscordBot (https://aula-forever.dk, 1.0)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new DiscordError('Discord kunne ikke nås');
  }
  if (res.status === 404) {
    await res.body?.cancel().catch(() => undefined);
    return { isMember: false, isOfficer: false };
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new DiscordError(`Discord svarede HTTP ${res.status}`);
  }
  const member = (await res.json().catch(() => null)) as { roles?: unknown } | null;
  const roles = Array.isArray(member?.roles) ? (member!.roles as unknown[]) : [];
  return { isMember: true, isOfficer: roles.includes(opts.officerRoleId) };
}
