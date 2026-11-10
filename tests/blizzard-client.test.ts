import { describe, expect, it } from 'vitest';
import { createBlizzardClient } from '@/lib/blizzard/client';
import { BlizzardError } from '@/lib/blizzard/types';
import { jsonResponse } from './helpers';

const tokenBody = { access_token: 'tok-1', expires_in: 86399 };

const rawCharacter = {
  id: 1001,
  name: 'Magi Far',
  character_class: { name: 'Mage' },
  active_spec: { name: 'Frost' },
  guild: { id: 304114, name: 'AULA' },
  equipped_item_level: 8,
  average_item_level: 9,
  last_login_timestamp: 1789000000000,
};

const rawRoster = {
  members: [
    { character: { id: 1001, name: 'Magi Far', key: { href: 'https://eu.api.blizzard.com/profile/wow/character/magi-far?namespace=profile-forever-eu' } }, rank: 3 },
    { character: { id: 1002, name: 'Ezzek', key: { href: 'https://eu.api.blizzard.com/profile/wow/character/ezzek-svumpukkel?namespace=profile-forever-eu' } }, rank: 0 },
    { character: { id: 1003, name: 'Uden Href' }, rank: 5 },
  ],
};

type Call = { url: string; init?: RequestInit };

function setup(handler: (url: string, n: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    return handler(u, calls.length);
  }) as typeof fetch;
  let clock = 0;
  const client = createBlizzardClient({ clientId: 'id', clientSecret: 'secret', fetch: fetcher, now: () => clock });
  return { client, calls, advance: (ms: number) => (clock += ms) };
}

const isToken = (u: string) => u.startsWith('https://oauth.battle.net/token');

describe('blizzard-klient', () => {
  it('henter token med Basic auth og slår karakter op i forever-namespace uden realm', async () => {
    const { client, calls } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, rawCharacter)));
    const c = await client.getCharacter('magi-far');
    expect(c).toEqual({
      blizzardId: 1001, slug: 'magi-far', name: 'Magi Far', className: 'Mage', spec: 'Frost',
      itemLevel: 8, guildId: 304114, guildName: 'AULA', lastLogin: new Date(1789000000000),
    });
    expect(calls[0].init?.headers).toMatchObject({ Authorization: 'Basic ' + Buffer.from('id:secret').toString('base64') });
    expect(calls[0].init?.body).toBe('grant_type=client_credentials');
    expect(calls[1].url).toBe('https://eu.api.blizzard.com/profile/wow/character/magi-far?namespace=profile-forever-eu&locale=en_GB');
    expect(calls[1].init?.headers).toMatchObject({ Authorization: 'Bearer tok-1' });
  });

  it('klarer karakter uden guild, spec og item level', async () => {
    const { client } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, { id: 5, name: 'Nul', character_class: { name: 'Priest' } })));
    expect(await client.getCharacter('nul')).toMatchObject({ spec: null, itemLevel: null, guildId: null, guildName: null, lastLogin: null });
  });

  it('genbruger token mellem kald og henter nyt, når det er udløbet', async () => {
    const { client, calls, advance } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, rawCharacter)));
    await client.getCharacter('a');
    await client.getCharacter('b');
    expect(calls.filter((c) => isToken(c.url))).toHaveLength(1);
    advance(86_400_000);
    await client.getCharacter('c');
    expect(calls.filter((c) => isToken(c.url))).toHaveLength(2);
  });

  it('henter nyt token og prøver én gang igen ved 401', async () => {
    let apiCalls = 0;
    const { client, calls } = setup((u) => {
      if (isToken(u)) return jsonResponse(200, tokenBody);
      return ++apiCalls === 1 ? jsonResponse(401) : jsonResponse(200, rawCharacter);
    });
    await client.getCharacter('magi-far');
    expect(calls.filter((c) => isToken(c.url))).toHaveLength(2);
  });

  it.each([
    [404, 'not_found'],
    [429, 'rate_limited'],
    [500, 'unavailable'],
    [503, 'unavailable'],
  ])('oversætter HTTP %i til %s', async (status, kind) => {
    const { client } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(status)));
    await expect(client.getCharacter('x')).rejects.toMatchObject({ name: 'BlizzardError', kind });
  });

  it('oversætter netværksfejl til unavailable', async () => {
    const { client } = setup((u) => {
      if (isToken(u)) return jsonResponse(200, tokenBody);
      throw new TypeError('fetch failed');
    });
    await expect(client.getCharacter('x')).rejects.toBeInstanceOf(BlizzardError);
    await expect(client.getCharacter('x')).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('oversætter fejl ved tokenhentning til unavailable', async () => {
    const { client } = setup(() => jsonResponse(500));
    await expect(client.getCharacter('x')).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('henter roster og tager slug fra href, ellers fra navnet', async () => {
    const { client, calls } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, rawRoster)));
    const roster = await client.getGuildRoster('aula');
    expect(calls[1].url).toBe('https://eu.api.blizzard.com/data/wow/guild/aula/roster?namespace=profile-forever-eu&locale=en_GB');
    expect(roster).toEqual([
      { blizzardId: 1001, slug: 'magi-far', name: 'Magi Far', rank: 3 },
      { blizzardId: 1002, slug: 'ezzek-svumpukkel', name: 'Ezzek', rank: 0 },
      { blizzardId: 1003, slug: 'uden-href', name: 'Uden Href', rank: 5 },
    ]);
  });

  describe('misdannede svar', () => {
    const text = (body: string) => new Response(body, { status: 200 });
    it('token-svar der ikke er JSON giver unavailable', async () => {
      const { client } = setup(() => text('<html>'));
      await expect(client.getCharacter('x')).rejects.toMatchObject({ name: 'BlizzardError', kind: 'unavailable' });
    });
    it('token-svar uden access_token/expires_in giver unavailable', async () => {
      const { client } = setup(() => jsonResponse(200, {}));
      await expect(client.getCharacter('x')).rejects.toMatchObject({ name: 'BlizzardError', kind: 'unavailable' });
    });
    it('karakter-svar der ikke er JSON giver unavailable', async () => {
      const { client } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : text('nope')));
      await expect(client.getCharacter('x')).rejects.toMatchObject({ name: 'BlizzardError', kind: 'unavailable' });
    });
    it('karakter-svar uden id/name giver unavailable', async () => {
      const { client } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, {})));
      await expect(client.getCharacter('x')).rejects.toMatchObject({ name: 'BlizzardError', kind: 'unavailable' });
    });
    it('roster-svar uden members giver unavailable', async () => {
      const { client } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, {})));
      await expect(client.getGuildRoster('aula')).rejects.toMatchObject({ name: 'BlizzardError', kind: 'unavailable' });
    });
    it('roster-medlem uden character giver unavailable', async () => {
      const { client } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, { members: [{ rank: 1 }] })));
      await expect(client.getGuildRoster('aula')).rejects.toMatchObject({ name: 'BlizzardError', kind: 'unavailable' });
    });
    it('roster-medlem med ikke-numerisk rank giver unavailable', async () => {
      const { client } = setup((u) =>
        isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, { members: [{ character: { id: 1, name: 'A' }, rank: 'x' }] }),
      );
      await expect(client.getGuildRoster('aula')).rejects.toMatchObject({ name: 'BlizzardError', kind: 'unavailable' });
    });
  });
});
