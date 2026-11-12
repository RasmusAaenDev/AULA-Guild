import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { characters, chatChannels, chatMessages, users } from '@/lib/db/schema';
import { createSendLimiter } from '@/lib/chat-send';
import { chatResponse } from '@/lib/chat-http';
import {
  MAX_ACTIVE_CHANNELS, createChannel, createChannelLimiter, createMessageLimiter, deleteChannel, deleteMessage,
  getChannel, listChannels, listMessages, parseId, postMessage, validateChannelName,
} from '@/lib/site-chat';
import { resetDb, testDb } from './db';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

let seq = 0;
async function mkUser(opts: { character?: boolean; name?: string; surname?: string | null } = {}) {
  seq++;
  const [u] = await db.insert(users).values({ battletag: 'X#1', battlenetId: `d${seq}`, name: `U${seq}` }).returning();
  if (opts.character !== false) {
    const [c] = await db.insert(characters).values({
      blizzardId: 5000 + seq, slug: `magi-far${seq}`, name: opts.name ?? 'Magi', surname: opts.surname === undefined ? 'Far' : opts.surname,
      className: 'Mage', role: 'dps', userId: u.id,
    }).returning();
    await db.update(users).set({ activeCharacterId: c.id }).where(eq(users.id, u.id));
    return { ...u, characterId: c.id };
  }
  return { ...u, characterId: null as number | null };
}
const act = (u: { id: number }, isOfficer = false) => ({ userId: u.id, isOfficer });
const free = () => ({ limiter: createSendLimiter({ max: 1000, windowMs: 1, minGapMs: 0 }), now: Date.now() });
const deps = (userId: number) => ({ userId, ...free() });
async function mkChannel(userId: number, name: string) {
  const r = await createChannel(db, deps(userId), name);
  if (!r.ok) throw new Error(r.error);
  return r.channel;
}

describe('navn', () => {
  it('trimmer og klapper mellemrum sammen', () => {
    expect(validateChannelName('  Raid   Snak ')).toEqual({ ok: true, name: 'Raid Snak' });
    expect(validateChannelName('Gæster_øl-å 2')).toEqual({ ok: true, name: 'Gæster_øl-å 2' });
  });
  it('afviser for kort, for langt og ulovlige tegn', () => {
    for (const bad of ['a', '  b ', 'x'.repeat(31), 'hej!', 'a<b>', '#raid', 'tab\u0000x', 42, null, undefined, '😀😀']) {
      expect(validateChannelName(bad).ok, String(bad)).toBe(false);
    }
    expect(validateChannelName('x'.repeat(30)).ok).toBe(true);
    expect(validateChannelName('xy').ok).toBe(true);
  });
  it('er entydigt uanset store/små bogstaver, også æøå', async () => {
    const u = await mkUser();
    await mkChannel(u.id, 'Ærø Snak');
    const r = await createChannel(db, deps(u.id), 'ærø  snak');
    expect(r).toMatchObject({ ok: false, reason: 'duplicate' });
    expect((await listChannels(db)).length).toBe(1);
  });
  it('parallel oprettelse giver præcis én kanal og en pæn fejl til den anden', async () => {
    const u = await mkUser();
    const rs = await Promise.all(['Raid', 'RAID', 'raid', 'Raid'].map((n) => createChannel(db, deps(u.id), n)));
    expect(rs.filter((r) => r.ok).length).toBe(1);
    expect(rs.filter((r) => !r.ok).every((r) => !r.ok && r.reason === 'duplicate')).toBe(true);
  });
  it('navnet kan genbruges efter sletning', async () => {
    const u = await mkUser();
    const c = await mkChannel(u.id, 'Raid');
    expect((await deleteChannel(db, act(u), c.id)).ok).toBe(true);
    expect((await createChannel(db, deps(u.id), 'raid')).ok).toBe(true);
  });
});

describe('grænser', () => {
  it('højst 30 aktive kanaler i alt; sletning frigør plads', async () => {
    const u = await mkUser();
    const first = await mkChannel(u.id, 'Kanal 0');
    for (let i = 1; i < MAX_ACTIVE_CHANNELS; i++) await mkChannel(u.id, `Kanal ${i}`);
    expect(await createChannel(db, deps(u.id), 'En for meget')).toMatchObject({ ok: false, reason: 'limit' });
    await deleteChannel(db, act(u), first.id);
    expect((await createChannel(db, deps(u.id), 'En for meget')).ok).toBe(true);
  });
  it('højst 3 nye kanaler pr. bruger pr. time', async () => {
    const a = await mkUser();
    const b = await mkUser();
    const limiter = createChannelLimiter();
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect((await createChannel(db, { userId: a.id, limiter, now: t + i }, `Kanal ${i}`)).ok).toBe(true);
    expect(await createChannel(db, { userId: a.id, limiter, now: t + 10 }, 'Fjerde')).toMatchObject({ ok: false, reason: 'rate_limited' });
    expect((await createChannel(db, { userId: b.id, limiter, now: t + 10 }, 'Andens')).ok).toBe(true);
    expect((await createChannel(db, { userId: a.id, limiter, now: t + 3_600_001 }, 'Efter en time')).ok).toBe(true);
  });
  it('ugyldigt navn bruger ikke rate-limit', async () => {
    const a = await mkUser();
    const limiter = createChannelLimiter();
    for (let i = 0; i < 5; i++) await createChannel(db, { userId: a.id, limiter, now: 1 }, '!');
    expect((await createChannel(db, { userId: a.id, limiter, now: 1 }, 'Gyldig')).ok).toBe(true);
  });
});

describe('sletning og autorisation', () => {
  it('opretter og officer må slette kanal, andre ikke', async () => {
    const owner = await mkUser();
    const other = await mkUser();
    const c1 = await mkChannel(owner.id, 'Ejer');
    const c2 = await mkChannel(owner.id, 'Officer');
    expect(await deleteChannel(db, { userId: other.id, isOfficer: false }, c1.id)).toMatchObject({ ok: false, reason: 'forbidden' });
    expect(await getChannel(db, c1.id)).not.toBeNull();
    expect((await deleteChannel(db, { userId: owner.id, isOfficer: false }, c1.id)).ok).toBe(true);
    expect((await deleteChannel(db, { userId: other.id, isOfficer: true }, c2.id)).ok).toBe(true);
    expect(await deleteChannel(db, act(owner), c2.id)).toMatchObject({ ok: false, reason: 'not_found' });
  });
  it('kanal uden opretter (bruger slettet) kan kun slettes af officer', async () => {
    const owner = await mkUser();
    const other = await mkUser();
    const c = await mkChannel(owner.id, 'Forladt');
    await db.delete(users).where(eq(users.id, owner.id));
    expect((await getChannel(db, c.id))?.createdBy).toBeNull();
    expect((await deleteChannel(db, { userId: other.id, isOfficer: false }, c.id)).ok).toBe(false);
    expect((await deleteChannel(db, { userId: other.id, isOfficer: true }, c.id)).ok).toBe(true);
  });
  it('forfatter og officer må slette besked, andre ikke', async () => {
    const a = await mkUser();
    const b = await mkUser();
    const c = await mkChannel(a.id, 'Snak');
    const m1 = await postMessage(db, deps(a.id), c.id, 'en');
    const m2 = await postMessage(db, deps(a.id), c.id, 'to');
    if (!m1.ok || !m2.ok) throw new Error('post');
    expect(await deleteMessage(db, { userId: b.id, isOfficer: false }, m1.message.id)).toMatchObject({ ok: false, reason: 'forbidden' });
    expect((await deleteMessage(db, { userId: a.id, isOfficer: false }, m1.message.id)).ok).toBe(true);
    expect((await deleteMessage(db, { userId: b.id, isOfficer: true }, m2.message.id)).ok).toBe(true);
    expect(await listMessages(db, c.id)).toEqual([]);
    expect(await deleteMessage(db, act(a), m1.message.id)).toMatchObject({ ok: false, reason: 'not_found' });
  });
  it('slettet kanal skjules, kan hverken læses eller skrives til; beskeder slettes ikke fysisk', async () => {
    const a = await mkUser();
    const c = await mkChannel(a.id, 'Væk');
    const m = await postMessage(db, deps(a.id), c.id, 'hej');
    if (!m.ok) throw new Error('post');
    await deleteChannel(db, act(a), c.id);
    expect(await listChannels(db)).toEqual([]);
    expect(await getChannel(db, c.id)).toBeNull();
    expect(await listMessages(db, c.id)).toBeNull();
    expect(await postMessage(db, deps(a.id), c.id, 'igen')).toMatchObject({ ok: false, reason: 'not_found' });
    expect(await deleteMessage(db, act(a), m.message.id)).toMatchObject({ ok: false, reason: 'not_found' });
    expect((await db.select().from(chatChannels).where(eq(chatChannels.id, c.id)))[0].deletedAt).not.toBeNull();
    expect((await db.select().from(chatMessages)).length).toBe(1);
  });
});

describe('beskeder', () => {
  it('validerer: tom, NUL, kontroltegn, længde, linjeskift', async () => {
    const a = await mkUser();
    const c = await mkChannel(a.id, 'Snak');
    for (const bad of ['', '   ', 'a\u0000b', 'a\u0007b', 'a‮b'.replace('‮', ' '), 'x'.repeat(501), 'a\n\n\n\n\n\nb', 7, null]) {
      expect(await postMessage(db, deps(a.id), c.id, bad), String(bad)).toMatchObject({ ok: false, reason: 'invalid' });
    }
    expect((await postMessage(db, deps(a.id), c.id, 'x'.repeat(500))).ok).toBe(true);
    expect((await postMessage(db, deps(a.id), c.id, 'a\n\n\n\n\nb')).ok).toBe(true);
    expect((await db.select().from(chatMessages)).length).toBe(2);
  });
  it('gemmer teksten uændret (ingen HTML-omskrivning)', async () => {
    const a = await mkUser();
    const c = await mkChannel(a.id, 'Snak');
    await postMessage(db, deps(a.id), c.id, '<b>hej</b> & https://example.com');
    expect((await listMessages(db, c.id))?.[0].content).toBe('<b>hej</b> & https://example.com');
  });
  it('gemmer author_name og character_id som snapshot', async () => {
    const a = await mkUser({ name: 'Magi', surname: 'Far' });
    const c = await mkChannel(a.id, 'Snak');
    await postMessage(db, deps(a.id), c.id, 'før');
    await db.update(characters).set({ name: 'Nyt', surname: 'Navn' }).where(eq(characters.id, a.characterId!));
    const msgs = (await listMessages(db, c.id))!;
    expect(msgs[0]).toMatchObject({ authorName: 'Magi Far', userId: a.id, characterId: a.characterId });
    expect(msgs[0].characterSlug).toMatch(/^magi-far\d+$/);
    await postMessage(db, deps(a.id), c.id, 'efter');
    expect((await listMessages(db, c.id))!.map((m) => m.authorName)).toEqual(['Magi Far', 'Nyt Navn']);
    await db.delete(characters).where(eq(characters.id, a.characterId!));
    const after = (await listMessages(db, c.id))!;
    expect(after[0].characterId).toBeNull();
    expect(after[0].characterSlug).toBeNull();
    expect(after[0].authorName).toBe('Magi Far');
  });
  it('kræver aktiv karakter', async () => {
    const a = await mkUser({ character: false });
    const c = await mkChannel(a.id, 'Snak');
    expect(await postMessage(db, deps(a.id), c.id, 'hej')).toMatchObject({ ok: false, reason: 'no_character', error: 'Vælg en karakter først.' });
    // en andens karakter som aktiv tæller ikke
    const b = await mkUser();
    await db.update(users).set({ activeCharacterId: b.characterId }).where(eq(users.id, a.id));
    expect((await postMessage(db, deps(a.id), c.id, 'hej')).ok).toBe(false);
  });
  it('rate-limit: 5 pr. minut og mindst 2 sek imellem, pr. bruger', async () => {
    const a = await mkUser();
    const b = await mkUser();
    const c = await mkChannel(a.id, 'Snak');
    const limiter = createMessageLimiter();
    const send = (u: number, now: number) => postMessage(db, { userId: u, limiter, now }, c.id, 'hej');
    expect((await send(a.id, 0)).ok).toBe(true);
    expect(await send(a.id, 1000)).toMatchObject({ ok: false, reason: 'rate_limited' });
    for (const t of [2000, 4000, 6000, 8000]) expect((await send(a.id, t)).ok).toBe(true);
    expect(await send(a.id, 10_000)).toMatchObject({ ok: false, reason: 'rate_limited' });
    expect((await send(b.id, 10_000)).ok).toBe(true);
    expect((await send(a.id, 61_000)).ok).toBe(true);
    expect((await db.select().from(chatMessages)).length).toBe(7);
  });
  it('listMessages giver de seneste 50, ældste først', async () => {
    const a = await mkUser();
    const c = await mkChannel(a.id, 'Snak');
    const other = await mkChannel(a.id, 'Anden');
    await db.insert(chatMessages).values(Array.from({ length: 60 }, (_, i) => ({ channelId: c.id, userId: a.id, authorName: 'X', content: `m${i}` })));
    await postMessage(db, deps(a.id), other.id, 'andet');
    const msgs = (await listMessages(db, c.id, { limit: 50 }))!;
    expect(msgs.length).toBe(50);
    expect(msgs[0].content).toBe('m10');
    expect(msgs.at(-1)!.content).toBe('m59');
    expect(msgs.map((m) => m.id)).toEqual([...msgs.map((m) => m.id)].sort((x, y) => x - y));
    expect((await listMessages(db, other.id))!.map((m) => m.content)).toEqual(['andet']);
  });
});

describe('id-validering', () => {
  const bad: unknown[] = ['abc', '', '1.5', 1.5, -1, '-1', 0, '0', NaN, Infinity, 2_147_483_648, '99999999999999999999', 1e21, null, undefined, {}, [], '1e3', ' 7', '0x10'];
  it('parseId accepterer kun positive heltal i integer-området', () => {
    expect(parseId(7)).toBe(7);
    expect(parseId('7')).toBe(7);
    expect(parseId(2_147_483_647)).toBe(2_147_483_647);
    for (const v of bad) expect(parseId(v), String(v)).toBeNull();
  });
  it('alle funktioner afviser ugyldige id\'er uden at ramme databasen med dem', async () => {
    const a = await mkUser();
    await mkChannel(a.id, 'Snak');
    for (const v of bad) {
      expect(await getChannel(db, v)).toBeNull();
      expect(await listMessages(db, v)).toBeNull();
      expect(await deleteChannel(db, { userId: a.id, isOfficer: true }, v)).toMatchObject({ ok: false, reason: 'not_found' });
      expect(await deleteMessage(db, { userId: a.id, isOfficer: true }, v)).toMatchObject({ ok: false, reason: 'not_found' });
      expect(await postMessage(db, deps(a.id), v, 'hej')).toMatchObject({ ok: false, reason: 'not_found' });
    }
    expect((await listChannels(db)).length).toBe(1);
  });
});

describe('GET /api/chat for egne kanaler', () => {
  it('giver canDelete pr. besked, armory-link og 404 for slettet/ugyldig kanal', async () => {
    const a = await mkUser();
    const b = await mkUser();
    const c = await mkChannel(a.id, 'Snak');
    await postMessage(db, deps(a.id), c.id, 'hej');
    await postMessage(db, deps(b.id), c.id, 'dav');
    const get = (user: { isGuildMember: boolean; id: string; isOfficer?: boolean }, k: string) => chatResponse(user, k, db);
    const res = await get({ isGuildMember: true, id: String(a.id) }, `egen-${c.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages.map((m: { content: string; canDelete: boolean }) => [m.content, m.canDelete])).toEqual([['hej', true], ['dav', false]]);
    expect(Object.keys(body.messages[0]).sort()).toEqual(['armoryUrl', 'author', 'canDelete', 'content', 'id', 'mine', 'timestamp']);
    expect(body.messages.map((m: { author: string }) => m.author)).toEqual(['Magi Far', 'Magi Far']);
    expect(body.messages[0].armoryUrl).toMatch(/armory\/character\/magi-far\d+$/);
    const off = await (await get({ isGuildMember: true, id: String(b.id), isOfficer: true }, `egen-${c.id}`)).json();
    expect(off.messages.every((m: { canDelete: boolean }) => m.canDelete)).toBe(true);
    // «mine» følger forfatteren, ikke sletteretten (officeren ejer ikke a's besked).
    expect(body.messages.map((m: { mine: boolean }) => m.mine)).toEqual([true, false]);
    expect(off.messages.map((m: { mine: boolean }) => m.mine)).toEqual([false, true]);
    // Gæster (uden guild-karakter) må læse egne kanaler.
    expect((await get({ isGuildMember: false, id: String(a.id) }, `egen-${c.id}`)).status).toBe(200);
    expect((await get({ isGuildMember: true, id: '1' }, 'egen-abc')).status).toBe(404);
    expect((await get({ isGuildMember: true, id: '1' }, 'egen-99999999999')).status).toBe(404);
    await deleteChannel(db, act(a), c.id);
    expect((await get({ isGuildMember: true, id: String(a.id) }, `egen-${c.id}`)).status).toBe(404);
    expect((await chatResponse(undefined, `egen-${c.id}`, db)).status).toBe(401);
  });
});
