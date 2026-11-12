import { describe, expect, it } from 'vitest';
import { createAccessRevalidator } from '@/lib/access-revalidate';
import { fetchMemberAccessByBot } from '@/lib/discord-access';

const resp = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });

describe('fetchMemberAccessByBot', () => {
  const base = { botToken: 'BOT-TOKEN-xyz', guildId: '555', officerRoleId: '777', discordId: '123' };
  it('medlem med officer-rolle, og bot-token kun i headeren', async () => {
    let seen: { url: string; auth: string } | null = null;
    const fetchFn = (async (url: string, init?: RequestInit) => {
      seen = { url: String(url), auth: (init?.headers as Record<string, string>).Authorization };
      return resp(200, { roles: ['1', '777'] });
    }) as typeof fetch;
    expect(await fetchMemberAccessByBot({ ...base, fetch: fetchFn })).toEqual({ isMember: true, isOfficer: true });
    expect(seen!.url).toBe('https://discord.com/api/v10/guilds/555/members/123');
    expect(seen!.auth).toBe('Bot BOT-TOKEN-xyz');
  });
  it('medlem uden officer-rolle; 404 = ikke medlem; andre fejl kaster uden at lække tokenet', async () => {
    expect(await fetchMemberAccessByBot({ ...base, fetch: (async () => resp(200, { roles: ['1'] })) as typeof fetch })).toEqual({ isMember: true, isOfficer: false });
    expect(await fetchMemberAccessByBot({ ...base, fetch: (async () => resp(404)) as typeof fetch })).toEqual({ isMember: false, isOfficer: false });
    for (const f of [async () => resp(500), async () => resp(429), async () => { throw new Error('BOT-TOKEN-xyz netværk'); }]) {
      const err = await fetchMemberAccessByBot({ ...base, fetch: f as unknown as typeof fetch }).catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect(String(err.message)).not.toContain('BOT-TOKEN');
    }
  });
  it('afviser ugyldigt Discord-id uden at kalde Discord', async () => {
    let called = false;
    const fetchFn = (async () => { called = true; return resp(200, {}); }) as typeof fetch;
    await expect(fetchMemberAccessByBot({ ...base, discordId: '../x', fetch: fetchFn })).rejects.toThrow();
    expect(called).toBe(false);
  });
});

describe('createAccessRevalidator', () => {
  it('cacher i 10 minutter og slår derefter op igen; afvisning (ikke medlem) slår igennem', async () => {
    let t = 0; let calls = 0; let member = true;
    const r = createAccessRevalidator({ lookup: async () => { calls++; return { isMember: member, isOfficer: false }; }, now: () => t });
    expect((await r.check('1'))?.isMember).toBe(true);
    t += 5 * 60_000; await r.check('1');
    expect(calls).toBe(1);
    member = false; t += 6 * 60_000;
    expect((await r.check('1'))?.isMember).toBe(false);
    expect(calls).toBe(2);
  });
  it('fejl giver null (behold eksisterende adgang) og prøver igen først efter pausen', async () => {
    let t = 0; let calls = 0;
    const r = createAccessRevalidator({ lookup: async () => { calls++; throw new Error('nede'); }, now: () => t });
    expect(await r.check('1')).toBeNull();
    t += 10_000; expect(await r.check('1')).toBeNull();
    expect(calls).toBe(1);
    t += 25_000; await r.check('1');
    expect(calls).toBe(2);
  });
  it('samtidige opslag for samme bruger deles', async () => {
    let calls = 0;
    const r = createAccessRevalidator({ lookup: async () => { calls++; await new Promise((x) => setTimeout(x, 10)); return { isMember: true, isOfficer: true }; } });
    await Promise.all([r.check('9'), r.check('9'), r.check('9')]);
    expect(calls).toBe(1);
  });
});
