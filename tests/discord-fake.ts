// Falsk Discord-server til chat-testene: svarer på guild-, rolle-, kanal- og medlems-kald;
// beskedkald (/channels/<id>/messages) sendes videre til testens egen responder.
import { jsonResponse } from './helpers';

export const GUILD = '900000000000000001';
export const BOT = '900000000000000002';
export const CHANNEL = '123456789012345678';
export const VIEW = 1024;
export const SEND = 2048;
export const HISTORY = 65536;
export const ADMIN = 8;

export type FakeChannel = {
  id: string;
  name?: string;
  type?: number;
  position?: number;
  permission_overwrites?: { id: string; type: number; allow: string; deny: string }[];
};
export type Fixture = {
  channels: FakeChannel[];
  roles: { id: string; permissions: string }[];
  botRoles: string[];
  /** Overstyr svar pr. sti (fx for at simulere fejl); returner undefined for standardsvaret. */
  override?: (path: string) => Response | undefined;
};

export function fixture(over: Partial<Fixture> = {}): Fixture {
  return {
    channels: [{ id: CHANNEL, name: 'general', type: 0, position: 0 }],
    roles: [{ id: GUILD, permissions: String(VIEW | HISTORY | SEND) }],
    botRoles: [],
    ...over,
  };
}

export const MESSAGES_RE = /\/channels\/[^/]+\/messages/;

/** Pakker en fetch ind, så alt andet end beskedkald besvares af `fx`. */
export function withGuild(inner: (url: string, init?: RequestInit) => Response | Promise<Response>, fx: () => Fixture, log?: string[]) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const path = u.replace('https://discord.com/api/v10', '');
    if (MESSAGES_RE.test(path)) return inner(u, init);
    log?.push(path);
    const f = fx();
    const o = f.override?.(path);
    if (o) return o;
    if (path === `/channels/${CHANNEL}`) return jsonResponse(200, { id: CHANNEL, guild_id: GUILD });
    if (path === '/users/@me') return jsonResponse(200, { id: BOT });
    if (path === `/guilds/${GUILD}/roles`) return jsonResponse(200, f.roles);
    if (path === `/guilds/${GUILD}/channels`) return jsonResponse(200, f.channels);
    if (path === `/guilds/${GUILD}/members/${BOT}`) return jsonResponse(200, { roles: f.botRoles });
    return jsonResponse(404, {});
  }) as typeof fetch;
}
