import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applySignIn, REVALIDATE_MS, revalidateToken, type AuthDeps } from '@/lib/auth-callbacks';
import { users } from '@/lib/db/schema';
import { upsertUser } from '@/lib/users';
import { resetDb, testDb } from './db';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const NOW = 1_800_000_000_000;
const profile = { sub: '424242', battletag: 'Magi#1234' };

function deps(over: Partial<AuthDeps> = {}): AuthDeps & {
  syncAccountCharacters: ReturnType<typeof vi.fn>;
  deriveAccess: ReturnType<typeof vi.fn>;
} {
  return {
    upsertUser: (u: { battlenetId: string; battletag: string }) => upsertUser(db, u),
    syncAccountCharacters: vi.fn(async () => {}),
    deriveAccess: vi.fn(async () => ({ isGuildMember: true, isOfficer: false })),
    now: () => NOW,
    ...over,
  } as never;
}

describe('applySignIn', () => {
  it('opretter brugeren, synkroniserer karakterer med access token og lægger afledt adgang i tokenet', async () => {
    const d = deps({ deriveAccess: vi.fn(async () => ({ isGuildMember: true, isOfficer: true })) });
    const token = await applySignIn(d, { sub: '424242', name: 'Magi#1234' }, { accessToken: 'at', profile });
    const [row] = await db.select().from(users);
    expect(row).toMatchObject({ battlenetId: '424242', battletag: 'Magi#1234', name: 'Magi' });
    expect(d.syncAccountCharacters).toHaveBeenCalledWith({ userId: row.id, accessToken: 'at' });
    expect(d.deriveAccess).toHaveBeenCalledWith(row.id);
    expect(token).toMatchObject({
      sub: '424242', name: 'Magi', userId: row.id, battlenetId: '424242', isGuildMember: true, isOfficer: true, checkedAt: NOW,
    });
  });

  it('synker før adgangen afledes, så nye karakterer tæller med det samme', async () => {
    const order: string[] = [];
    const d = deps({
      syncAccountCharacters: vi.fn(async () => void order.push('sync')),
      deriveAccess: vi.fn(async () => (order.push('access'), { isGuildMember: false, isOfficer: false })),
    });
    await applySignIn(d, {}, { accessToken: 'at', profile });
    expect(order).toEqual(['sync', 'access']);
  });

  it('gemmer aldrig access token i tokenet', async () => {
    const token = await applySignIn(deps(), {}, { accessToken: 'hemmeligt-token', profile });
    expect(JSON.stringify(token)).not.toContain('hemmeligt-token');
  });

  it('logger ind som gæst, når brugeren ingen verificeret guild-karakter har', async () => {
    const d = deps({ deriveAccess: vi.fn(async () => ({ isGuildMember: false, isOfficer: false })) });
    const token = await applySignIn(d, {}, { accessToken: 'at', profile });
    expect(token).toMatchObject({ isGuildMember: false, isOfficer: false });
    expect(typeof token.userId).toBe('number');
  });

  it('fejler ikke login, hvis synkroniseringen fejler', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps({ syncAccountCharacters: vi.fn(async () => { throw new Error('Blizzard nede'); }) });
    const token = await applySignIn(d, {}, { accessToken: 'at', profile });
    expect(token).toMatchObject({ isGuildMember: true, battlenetId: '424242' });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('tåler battle_tag (ID-token-claim) og numerisk sub', async () => {
    await applySignIn(deps(), {}, { accessToken: 'at', profile: { sub: 99 as unknown as string, battle_tag: 'Ragnar#9' } });
    const [row] = await db.select().from(users);
    expect(row).toMatchObject({ battlenetId: '99', battletag: 'Ragnar#9', name: 'Ragnar' });
  });

  it('afviser en profil uden sub', async () => {
    await expect(applySignIn(deps(), {}, { accessToken: 'at', profile: { battletag: 'X#1' } })).rejects.toThrow();
    expect(await db.select().from(users)).toHaveLength(0);
  });
});

describe('revalidateToken', () => {
  const base = { userId: 7, battlenetId: '1', isGuildMember: true, isOfficer: true, checkedAt: NOW };
  const derive = (a = { isGuildMember: false, isOfficer: false }) => vi.fn(async () => a);

  it('afviser tokens uden Battle.net-id (fx sessioner fra før skiftet)', async () => {
    const d = { deriveAccess: derive(), now: () => NOW };
    expect(await revalidateToken(d, { userId: 7, isMember: true })).toBeNull();
    expect(await revalidateToken(d, { battlenetId: '1' })).toBeNull();
  });

  it('genberegner ikke inden for 10 minutter', async () => {
    const d = { deriveAccess: derive(), now: () => NOW + REVALIDATE_MS - 1 };
    expect(await revalidateToken(d, base)).toEqual(base);
    expect(d.deriveAccess).not.toHaveBeenCalled();
  });

  it('genberegner fra databasen efter 10 minutter', async () => {
    const d = { deriveAccess: derive({ isGuildMember: true, isOfficer: false }), now: () => NOW + REVALIDATE_MS };
    expect(await revalidateToken(d, base)).toEqual({ ...base, isOfficer: false, checkedAt: NOW + REVALIDATE_MS });
    expect(d.deriveAccess).toHaveBeenCalledWith(7);
  });

  it('genberegner, når checkedAt mangler', async () => {
    const d = { deriveAccess: derive(), now: () => NOW };
    const { checkedAt: _, ...noCheck } = base;
    expect(await revalidateToken(d, noCheck)).toMatchObject({ isGuildMember: false, isOfficer: false, checkedAt: NOW });
  });

  it('beholder eksisterende adgang ved fejl', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = { deriveAccess: vi.fn(async () => { throw new Error('db nede'); }), now: () => NOW + REVALIDATE_MS };
    expect(await revalidateToken(d, base)).toEqual(base);
    err.mockRestore();
  });
});
