import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_URL, fetchAccountCharacters } from '@/lib/blizzard/account';
import { jsonResponse } from './helpers';

// Form fra spiken (2026-11-12): /profile/user/wow?namespace=profile-forever-eu.
const body = {
  id: 1,
  wow_accounts: [
    {
      id: 11,
      characters: [
        {
          character: { href: 'https://eu.api.blizzard.com/profile/wow/character/magi-far?namespace=profile-forever-eu' },
          name: 'Magi', surname: 'Far', id: 3015008,
          playable_class: { name: 'Mage', id: 8 }, playable_race: { name: 'Gnome', id: 7 },
          faction: { type: 'ALLIANCE', name: 'Alliance' }, level: 20,
        },
        // Mangler efternavn, klasse og level: beholdes med null.
        { character: { href: 'https://eu.api.blizzard.com/profile/wow/character/ezzek?namespace=profile-forever-eu' }, name: 'Ezzek', id: 3015009 },
        // Mangler id eller href: springes over.
        { character: { href: 'https://eu.api.blizzard.com/profile/wow/character/x?namespace=profile-forever-eu' }, name: 'X' },
        { name: 'Y', id: 5 },
        null,
      ],
    },
    { id: 12, characters: [{ character: { href: 'https://eu.api.blizzard.com/profile/wow/character/z%C3%B8e-alt?namespace=profile-forever-eu' }, name: 'Zøe', surname: ' ', id: 77, level: 0 }] },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe('fetchAccountCharacters', () => {
  it('kalder /profile/user/wow med brugerens token og parser karaktererne', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, body));
    const chars = await fetchAccountCharacters('user-token', { fetch: fetchMock as unknown as typeof fetch });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ACCOUNT_URL);
    expect(url).toBe('https://eu.api.blizzard.com/profile/user/wow?namespace=profile-forever-eu&locale=en_GB');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer user-token');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(chars).toEqual([
      { blizzardId: 3015008, name: 'Magi', surname: 'Far', slug: 'magi-far', className: 'Mage', level: 20 },
      { blizzardId: 3015009, name: 'Ezzek', surname: null, slug: 'ezzek', className: null, level: null },
      { blizzardId: 77, name: 'Zøe', surname: null, slug: 'zøe-alt', className: null, level: 0 },
    ]);
  });

  it('giver tom liste og logger ved HTTP-fejl', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chars = await fetchAccountCharacters('t', { fetch: (async () => jsonResponse(503)) as unknown as typeof fetch });
    expect(chars).toEqual([]);
    expect(err).toHaveBeenCalled();
  });

  it('giver tom liste ved netværksfejl/timeout og ved misdannet svar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = (async () => { throw new DOMException('timeout', 'TimeoutError'); }) as unknown as typeof fetch;
    expect(await fetchAccountCharacters('t', { fetch: boom })).toEqual([]);
    const bad = (async () => new Response('ikke json', { status: 200 })) as unknown as typeof fetch;
    expect(await fetchAccountCharacters('t', { fetch: bad })).toEqual([]);
    const odd = (async () => jsonResponse(200, { wow_accounts: 'nej' })) as unknown as typeof fetch;
    expect(await fetchAccountCharacters('t', { fetch: odd })).toEqual([]);
  });

  it('kalder ikke Blizzard uden token', async () => {
    const fetchMock = vi.fn();
    expect(await fetchAccountCharacters('', { fetch: fetchMock as unknown as typeof fetch })).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
