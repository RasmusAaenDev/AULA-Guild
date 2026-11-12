import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applySignIn } from '@/lib/auth-callbacks';
import { DiscordError } from '@/lib/discord-access';
import { users } from '@/lib/db/schema';
import { upsertUser } from '@/lib/users';
import { resetDb, testDb } from './db';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const profile = { id: '555', username: 'rasmus', global_name: 'Rasmus A', avatar: 'abc123' };

describe('applySignIn', () => {
  it('giver medlem et bruger-id og gemmer brugeren', async () => {
    const deps = {
      fetchAccess: vi.fn(async () => ({ isMember: true, isOfficer: true })),
      upsertUser: (u: Parameters<typeof upsertUser>[1]) => upsertUser(db, u),
    };
    const token = await applySignIn(deps, { sub: 'x' }, { accessToken: 'at', profile });
    expect(deps.fetchAccess).toHaveBeenCalledWith('at');
    expect(token).toMatchObject({ sub: 'x', isMember: true, isOfficer: true });
    expect(typeof token.userId).toBe('number');
    const [row] = await db.select().from(users);
    expect(row).toMatchObject({ battlenetId: '555', name: 'Rasmus A' });
  });

  it('falder tilbage til brugernavn og ingen avatar', async () => {
    const deps = {
      fetchAccess: async () => ({ isMember: true, isOfficer: false }),
      upsertUser: (u: Parameters<typeof upsertUser>[1]) => upsertUser(db, u),
    };
    await applySignIn(deps, {}, { accessToken: 'at', profile: { id: '9', username: 'bare' } });
    const [row] = await db.select().from(users);
    expect(row).toMatchObject({ name: 'bare' });
  });

  it('gemmer ikke ikke-medlemmer og giver dem ikke adgang', async () => {
    const deps = {
      fetchAccess: async () => ({ isMember: false, isOfficer: false }),
      upsertUser: (u: Parameters<typeof upsertUser>[1]) => upsertUser(db, u),
    };
    const token = await applySignIn(deps, {}, { accessToken: 'at', profile });
    expect(token).toMatchObject({ isMember: false, isOfficer: false });
    expect(token.userId).toBeUndefined();
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it('lader DiscordError boble op, så login fejler i stedet for at give adgang', async () => {
    const deps = {
      fetchAccess: async () => {
        throw new DiscordError('429');
      },
      upsertUser: (u: Parameters<typeof upsertUser>[1]) => upsertUser(db, u),
    };
    await expect(applySignIn(deps, {}, { accessToken: 'at', profile })).rejects.toBeInstanceOf(DiscordError);
  });
});
