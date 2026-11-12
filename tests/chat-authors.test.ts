import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { ChatMessage } from '@/lib/chat';
import { resolveAuthors } from '@/lib/chat-authors';
import { buildContent } from '@/lib/chat-send';
import { characters, users } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

function msg(over: Partial<ChatMessage> = {}): ChatMessage {
  return { id: '1', author: 'Discordnavn', authorId: null, content: 'hej', mentions: [], timestamp: '2026-11-10T10:00:00.000Z', bot: false, ...over };
}

async function seedChar(userId: number | null, blizzardId: number, name: string, surname: string | null, active = false) {
  const slug = `${name}-${surname ?? ''}`.toLowerCase();
  const [c] = await db.insert(characters).values({ blizzardId, slug, name, surname, className: 'Mage', role: 'dps', userId }).returning();
  if (active && userId) await db.update(users).set({ activeCharacterId: c.id }).where(eq(users.id, userId));
  return c;
}

describe('resolveAuthors', () => {
  it('Discord-forfattere vises med Discord-navnet som tekst (ingen kobling til brugere)', async () => {
    const u = await seedUser(db, '111');
    await seedChar(u, 1, 'Ragnar', 'Stormskjold', true);
    const out = await resolveAuthors(db, [msg({ authorId: '111' }), msg({ id: '2', authorId: '999' }), msg({ id: '3', authorId: null })]);
    for (const r of out) {
      expect(r.author).toBe('Discordnavn');
      expect(r.characterSlug).toBeNull();
      expect(r.armoryUrl).toBeNull();
    }
  });
  it('[Aula]-præfikset parses og fjernes, og karakteren findes case-insensitivt', async () => {
    await seedChar(null, 1, 'Ragnar', 'Stormskjold');
    const content = buildContent('ragnar STORMSKJOLD', 'hej *alle* @her').ok ? (buildContent('ragnar STORMSKJOLD', 'hej *alle* @her') as { text: string }).text : '';
    const [r] = await resolveAuthors(db, [msg({ author: 'AulaBot', bot: true, content })]);
    expect(r.author).toBe('Ragnar Stormskjold');
    expect(r.characterSlug).toBe('ragnar-stormskjold');
    expect(r.content.startsWith('**')).toBe(false);
    expect(r.content).toContain('hej');
  });
  it('[Aula]-navn der ikke findes vises uden link, escapede tegn tåles', async () => {
    const built = buildContent('Mi_ra [x]', 'tekst');
    if (!built.ok) throw new Error('bygning fejlede');
    const [r] = await resolveAuthors(db, [msg({ bot: true, content: built.text })]);
    expect(r.author).toBe('Mi_ra [x]');
    expect(r.characterSlug).toBeNull();
    expect(r.content).toBe('tekst');
  });
  it('præfiks fra ikke-bot og andre bots\' beskeder er uændrede', async () => {
    const content = '**[Aula] Ragnar Stormskjold:** hej';
    const out = await resolveAuthors(db, [msg({ bot: false, content }), msg({ id: '2', bot: true, content: 'status ok' })]);
    expect(out[0].author).toBe('Discordnavn');
    expect(out[0].content).toBe(content);
    expect(out[1].content).toBe('status ok');
  });
  it('omtaler bevares som Discord-navne', async () => {
    const [r] = await resolveAuthors(db, [msg({
      content: 'hej @Anna og @Ukendt',
      mentions: [{ id: '111', name: 'Anna' }, { id: '222', name: 'Ukendt' }],
    })]);
    expect(r.content).toBe('hej @Anna og @Ukendt');
  });
  it('ingen opslag uden [Aula]-beskeder, og kun kendte felter sendes til klienten', async () => {
    const u = await seedUser(db, '111');
    await seedChar(u, 1, 'Ragnar', 'Stormskjold', true);
    const queries: string[] = [];
    const spy = new Proxy(db, {
      get(t, k, rcv) {
        if (k === 'select') return (...a: unknown[]) => { queries.push('select'); return (t.select as (...x: unknown[]) => unknown)(...a); };
        return Reflect.get(t, k, rcv);
      },
    });
    const many = Array.from({ length: 30 }, (_, i) => msg({ id: String(i + 1), authorId: '111', mentions: [{ id: '111', name: 'A' }] }));
    const out = await resolveAuthors(spy, many);
    expect(queries).toHaveLength(0);
    expect(Object.keys(out[0]).sort()).toEqual(['armoryUrl', 'author', 'bot', 'characterSlug', 'content', 'id', 'timestamp']);
    expect(JSON.stringify(out)).not.toContain('111');
  });
});
