import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { users } from '@/lib/db/schema';
import { displayName, upsertUser } from '@/lib/users';
import { resetDb, testDb } from './db';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

describe('upsertUser', () => {
  it('opretter en bruger ved nyt battlenetId med battletag og visningsnavn', async () => {
    const id = await upsertUser(db, { battlenetId: '123', battletag: 'Magi#1234' });
    const [row] = await db.select().from(users).where(eq(users.id, id));
    expect(row).toMatchObject({ battlenetId: '123', battletag: 'Magi#1234', name: 'Magi' });
  });

  it('opdaterer battletag ved samme id og returnerer samme id', async () => {
    const id1 = await upsertUser(db, { battlenetId: '123', battletag: 'Gammel#1' });
    const id2 = await upsertUser(db, { battlenetId: '123', battletag: 'Ny#2' });
    expect(id2).toBe(id1);
    const rows = await db.select().from(users).where(eq(users.battlenetId, '123'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ battletag: 'Ny#2', name: 'Ny' });
  });

  it('holder forskellige Battle.net-konti adskilt', async () => {
    const a = await upsertUser(db, { battlenetId: '1', battletag: 'A#1' });
    const b = await upsertUser(db, { battlenetId: '2', battletag: 'A#1' });
    expect(a).not.toBe(b);
  });
});

describe('displayName', () => {
  it('fjerner #nummer fra battletag', () => {
    expect(displayName('Magi#1234')).toBe('Magi');
  });
  it('bevarer et battletag uden nummer og falder tilbage ved tomt navn', () => {
    expect(displayName('Magi')).toBe('Magi');
    expect(displayName('#1234')).toBe('#1234');
    expect(displayName('  ')).toBe('Ukendt');
  });
});
