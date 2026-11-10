import { describe, expect, it } from 'vitest';
import { DiscordError, fetchAccess } from '@/lib/discord-access';
import { jsonResponse } from './helpers';

function run(res: Response | Error) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (res instanceof Error) throw res;
    return res;
  }) as typeof fetch;
  const promise = fetchAccess({ accessToken: 'at', guildId: 'G1', officerRoleId: 'R-OFF', fetch: fetcher });
  return { promise, calls };
}

describe('fetchAccess', () => {
  it('slår brugerens egen medlemsrække op i serveren med brugerens token', async () => {
    const { promise, calls } = run(jsonResponse(200, { roles: ['R1'] }));
    await promise;
    expect(calls[0].url).toBe('https://discord.com/api/v10/users/@me/guilds/G1/member');
    expect(calls[0].init?.headers).toMatchObject({ Authorization: 'Bearer at' });
  });

  it('medlem uden officer-rolle', async () => {
    expect(await run(jsonResponse(200, { roles: ['R1'] })).promise).toEqual({ isMember: true, isOfficer: false });
  });

  it('medlem med officer-rolle', async () => {
    expect(await run(jsonResponse(200, { roles: ['R1', 'R-OFF'] })).promise).toEqual({ isMember: true, isOfficer: true });
  });

  it('404 er ikke medlem', async () => {
    expect(await run(jsonResponse(404, { code: 10004 })).promise).toEqual({ isMember: false, isOfficer: false });
  });

  it.each([401, 403, 429, 500])('HTTP %i giver DiscordError, ikke adgang', async (status) => {
    await expect(run(jsonResponse(status)).promise).rejects.toBeInstanceOf(DiscordError);
  });

  it('netværksfejl giver DiscordError', async () => {
    await expect(run(new TypeError('fetch failed')).promise).rejects.toBeInstanceOf(DiscordError);
  });
});
