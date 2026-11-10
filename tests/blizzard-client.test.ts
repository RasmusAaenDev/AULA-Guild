import { describe, expect, it } from 'vitest';
import { createBlizzardClient } from '@/lib/blizzard/client';
import { BlizzardError } from '@/lib/blizzard/types';
import { jsonResponse } from './helpers';

const isToken = (u: string) => u.startsWith('https://oauth.battle.net/token');

const tokenBody = { access_token: 'tok-1', expires_in: 86399 };

const rawCharacter = {
  id: 1001,
  name: 'Magi',
  surname: 'Far',
  name_search: 'Magi Far',
  character_class: { name: 'Mage' },
  guild: { id: 304114, name: 'AULA' },
  level: 32,
  equipped_item_level: 8,
  average_item_level: 9,
  last_login_timestamp: 1789000000000,
};

// Rigtig form fra /profile/wow/character/{slug}/specializations (Forever, 2026-11-10): ingen active_spec i profilen;
// aktiv gruppe har is_active, og specialiseringerne er talent-træer med spent_points.
const rawSpecs = {
  specialization_groups: [
    {
      is_active: true,
      specializations: [
        { specialization: { name: 'Arcane', id: 237 }, spent_points: 2 },
        { specialization: { name: 'Frost', id: 6 }, spent_points: 21 },
      ],
    },
  ],
};

// Rigtig form fra /data/wow/guild/{slug}/roster: character.slug findes, og href bærer samme slug (procent-kodet).
const rawRoster = {
  members: [
    { character: { id: 1001, name: 'Magi', surname: 'Far', slug: 'magi-far', key: { href: 'https://eu.api.blizzard.com/profile/wow/character/magi-far?namespace=profile-forever-eu' } }, rank: 3 },
    { character: { id: 1002, name: 'Ezzek', surname: 'Svumpukkel', key: { href: 'https://eu.api.blizzard.com/profile/wow/character/ezzek-svumpukkel?namespace=profile-forever-eu' } }, rank: 0 },
    { character: { id: 1003, name: 'Uden', surname: 'Href' }, rank: 5 },
    { character: { id: 1004, name: 'Testørn', surname: 'Klunkekløe', slug: 'testørn-klunkekløe', key: { href: 'https://eu.api.blizzard.com/profile/wow/character/test%C3%B8rn-klunkekl%C3%B8e?namespace=profile-forever-eu' } }, rank: 1 },
  ],
};

const byPath = (spec: Response | (() => Response)) => (u: string) =>
  isToken(u) ? jsonResponse(200, tokenBody) : u.includes('/specializations') ? (typeof spec === 'function' ? spec() : spec) : jsonResponse(200, rawCharacter);

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

describe('blizzard-klient', () => {
  it('henter token med Basic auth og slår karakter op i forever-namespace uden realm', async () => {
    const { client, calls } = setup(byPath(jsonResponse(200, rawSpecs)));
    const c = await client.getCharacter('magi-far');
    expect(c).toEqual({
      blizzardId: 1001, slug: 'magi-far', name: 'Magi', surname: 'Far', className: 'Mage', spec: 'Frost',
      level: 32, itemLevel: 8, guildId: 304114, guildName: 'AULA', lastLogin: new Date(1789000000000),
    });
    expect(calls[0].init?.headers).toMatchObject({ Authorization: 'Basic ' + Buffer.from('id:secret').toString('base64') });
    expect(calls[0].init?.body).toBe('grant_type=client_credentials');
    expect(calls[1].url).toBe('https://eu.api.blizzard.com/profile/wow/character/magi-far?namespace=profile-forever-eu&locale=en_GB');
    expect(calls[1].init?.headers).toMatchObject({ Authorization: 'Bearer tok-1' });
    expect(calls[2].url).toBe('https://eu.api.blizzard.com/profile/wow/character/magi-far/specializations?namespace=profile-forever-eu&locale=en_GB');
  });

  it('vælger træet med flest point i den aktive gruppe som spec', async () => {
    const specs = {
      specialization_groups: [
        { is_active: false, specializations: [{ specialization: { name: 'Arcane' }, spent_points: 30 }] },
        { is_active: true, specializations: [{ specialization: { name: 'Holy' }, spent_points: 22 }, { specialization: { name: 'Protection' }, spent_points: 5 }] },
      ],
    };
    const { client } = setup(byPath(jsonResponse(200, specs)));
    expect((await client.getCharacter('x')).spec).toBe('Holy');
  });

  it.each([
    ['ingen aktiv gruppe', { specialization_groups: [{ is_active: false, specializations: [{ specialization: { name: 'Frost' }, spent_points: 9 }] }] }],
    ['aktiv gruppe uden specializations', { specialization_groups: [{ is_active: true }] }],
    ['ingen grupper', {}],
    ['uafgjort', { specialization_groups: [{ is_active: true, specializations: [{ specialization: { name: 'A' }, spent_points: 5 }, { specialization: { name: 'B' }, spent_points: 5 }] }] }],
  ])('giver spec null når %s', async (_t, specs) => {
    const { client } = setup(byPath(jsonResponse(200, specs)));
    expect((await client.getCharacter('x')).spec).toBeNull();
  });

  it('afviser ugyldigt level (ikke heltal 1..100) som null', async () => {
    for (const bad of [0, 101, 32.5, '32', null]) {
      const { client } = setup((u) =>
        isToken(u) ? jsonResponse(200, tokenBody) : u.includes('/specializations') ? jsonResponse(404) : jsonResponse(200, { id: 5, name: 'Nul', level: bad, character_class: { name: 'Priest' } }),
      );
      expect((await client.getCharacter('nul')).level).toBeNull();
    }
  });

  it('klarer karakter uden guild, spec og item level', async () => {
    const { client } = setup((u) =>
      isToken(u) ? jsonResponse(200, tokenBody) : u.includes('/specializations') ? jsonResponse(404) : jsonResponse(200, { id: 5, name: 'Nul', character_class: { name: 'Priest' } }),
    );
    const c = await client.getCharacter('nul');
    expect(c.spec).toBeUndefined();
    expect(c).toMatchObject({ level: null, itemLevel: null, guildId: null, guildName: null, lastLogin: null });
  });

  // Bevidst ændret: specializations er sekundære data. Før propagerede 429 herfra; nu giver enhver fejl spec undefined og profilen lykkes.
  it.each([
    ['404', () => jsonResponse(404)],
    ['429', () => jsonResponse(429)],
    ['500', () => jsonResponse(500)],
    ['netværksfejl', () => { throw new TypeError('fetch failed'); }],
    ['ikke-JSON', () => new Response('<html>', { status: 200 })],
  ])('giver spec undefined og lykkes med profilen når specializations giver %s', async (_t, spec) => {
    const { client } = setup(byPath(spec as () => Response));
    const c = await client.getCharacter('x');
    expect(c.spec).toBeUndefined();
    expect(c).toMatchObject({ blizzardId: 1001, itemLevel: 8 });
  });

  it.each([
    ['specialization_groups ikke et array', { specialization_groups: 'x' }],
    ['null gruppe', { specialization_groups: [null] }],
    ['specializations ikke et array', { specialization_groups: [{ is_active: true, specializations: {} }] }],
    ['null træ', { specialization_groups: [{ is_active: true, specializations: [null] }] }],
    ['ikke-numerisk spent_points', { specialization_groups: [{ is_active: true, specializations: [{ specialization: { name: 'A' }, spent_points: 'x' }] }] }],
    ['hele svaret er null', null],
  ])('giver spec undefined uden TypeError ved misdannet svar: %s', async (_t, specs) => {
    const { client } = setup(byPath(jsonResponse(200, specs)));
    expect((await client.getCharacter('x')).spec).toBeUndefined();
  });

  it('roster: tom eller ikke-streng character.slug falder tilbage til href, så navn', async () => {
    const body = { members: [
      { character: { id: 1, name: 'A', slug: '', key: { href: 'https://eu.api.blizzard.com/profile/wow/character/a-href?namespace=x' } }, rank: 1 },
      { character: { id: 2, name: 'B C', slug: 7 }, rank: 1 },
    ] };
    const { client } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, body)));
    expect((await client.getGuildRoster('aula')).map((m) => m.slug)).toEqual(['a-href', 'b-c']);
  });

  it.each([
    ['tom streng', ''],
    ['kun mellemrum', '   '],
    ['manglende', undefined],
    ['ikke en streng', 7],
    ['null', null],
  ])('profil: surname %s giver null', async (_t, surname) => {
    const { client } = setup((u) =>
      isToken(u) ? jsonResponse(200, tokenBody) : u.includes('/specializations') ? jsonResponse(200, rawSpecs) : jsonResponse(200, { ...rawCharacter, surname }),
    );
    expect((await client.getCharacter('x')).surname).toBeNull();
  });

  it('profil: surname trimmes', async () => {
    const { client } = setup((u) =>
      isToken(u) ? jsonResponse(200, tokenBody) : u.includes('/specializations') ? jsonResponse(200, rawSpecs) : jsonResponse(200, { ...rawCharacter, surname: '  Far ' }),
    );
    expect((await client.getCharacter('x')).surname).toBe('Far');
  });

  it('roster: surname trimmes, og tom/manglende/forkert type giver null', async () => {
    const body = { members: [
      { character: { id: 1, name: 'A', surname: ' B ', slug: 'a-b' }, rank: 1 },
      { character: { id: 2, name: 'C', surname: '', slug: 'c' }, rank: 1 },
      { character: { id: 3, name: 'D', slug: 'd' }, rank: 1 },
      { character: { id: 4, name: 'E', surname: 5, slug: 'e' }, rank: 1 },
    ] };
    const { client } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, body)));
    expect((await client.getGuildRoster('aula')).map((m) => m.surname)).toEqual(['B', null, null, null]);
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

  it('henter roster og tager slug fra character.slug, ellers href, ellers navnet', async () => {
    const { client, calls } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, rawRoster)));
    const roster = await client.getGuildRoster('aula');
    expect(calls[1].url).toBe('https://eu.api.blizzard.com/data/wow/guild/aula/roster?namespace=profile-forever-eu&locale=en_GB');
    expect(roster).toEqual([
      { blizzardId: 1001, slug: 'magi-far', name: 'Magi', surname: 'Far', rank: 3 },
      { blizzardId: 1002, slug: 'ezzek-svumpukkel', name: 'Ezzek', surname: 'Svumpukkel', rank: 0 },
      { blizzardId: 1003, slug: 'uden-href', name: 'Uden', surname: 'Href', rank: 5 },
      { blizzardId: 1004, slug: 'testørn-klunkekløe', name: 'Testørn', surname: 'Klunkekløe', rank: 1 },
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
