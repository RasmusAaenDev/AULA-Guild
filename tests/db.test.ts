import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { characters, users } from '@/lib/db/schema';
import { resetDb, testDb } from './db';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const base = { slug: 'magi-far', name: 'Magi Far', className: 'Mage', role: 'dps' as const };

describe('skema', () => {
  it('afviser to rækker med samme blizzard_id', async () => {
    await db.insert(characters).values({ ...base, blizzardId: 1 });
    await expect(db.insert(characters).values({ ...base, blizzardId: 1 })).rejects.toThrow();
  });

  it('gemmer en bruger og en karakter knyttet til den', async () => {
    const [u] = await db.insert(users).values({ discordId: 'd1', name: 'Rasmus' }).returning();
    const [c] = await db.insert(characters).values({ ...base, blizzardId: 2, userId: u.id }).returning();
    expect(c.userId).toBe(u.id);
    expect(c.inGuild).toBe(true);
  });
});
