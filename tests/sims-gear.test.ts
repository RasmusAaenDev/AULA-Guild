import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createSendLimiter } from '@/lib/chat-send';
import { simJobs, users } from '@/lib/db/schema';
import { processQueue } from '@/lib/sim-runner';
import { cleanLabel, parseBagItems, sanitizeBagItems } from '@/lib/simc-bags';
import { claimNextSim, enqueueSim, listMySims, parseSimOptions, parseSimResult, type SimItemResult } from '@/lib/sims';
import { fightStyleLabel, itemVerdict, percentText, rankItems, slotLabel } from '@/lib/sims-ui';
import { resetDb, testDb } from './db';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const fx = (n: string) => readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
const BASE = 'hunter="Fallochli"\nlevel=11\nrace=dwarf';

describe('parseBagItems', () => {
  it('læser warlock-fixturen (navn + slot/id) og udelader udstyrede', () => {
    const r = parseBagItems(fx('bags-warlock-10.simc'));
    expect(r.items).toEqual([
      { slot: 'hands', id: 3308, label: 'Barbaric Cloth Gloves' },
      { slot: 'feet', id: 3307, label: 'Barbaric Cloth Boots' },
    ]);
    expect(r.ignored).toBe(0);
  });
  it('læser warrior-fixturen: våben, off_hand og flere i samme slot', () => {
    const r = parseBagItems(fx('bags-warrior-11.simc'));
    expect(r.items).toHaveLength(9);
    expect(r.items[0]).toEqual({ slot: 'back', id: 14088, label: 'Beaded Cloak' });
    expect(r.items.at(-1)).toEqual({ slot: 'off_hand', id: 286740, label: "Proud Brave's Guard" });
    expect(r.items.filter((i) => i.slot === 'main_hand')).toHaveLength(3);
  });
  it('shaman-fixturen kan parses uden fejl, og sektionen slutter ved næste ###', () => {
    const r = parseBagItems(fx('bags-shaman-20.simc'));
    expect(r.items.every((i) => i.id > 0)).toBe(true);
    const t = '### Gear from Bags\n# A (1)\n# head=,id=1\n### Andet\n# B (1)\n# neck=,id=2\n';
    expect(parseBagItems(t).items).toEqual([{ slot: 'head', id: 1, label: 'A' }]);
  });
  it('tåler CRLF, tomme linjer, manglende navn og ekstra felter efter id', () => {
    const t = `${BASE}\r\n\r\n### Gear from Bags\r\n#\r\n\r\n# hands=,id=10,bonus_id=1,enchant_id=2\r\n#\r\n# Rød Ring æøå (12)\r\n\r\n# finger1=,id=11\r\n`;
    expect(parseBagItems(t).items).toEqual([
      { slot: 'hands', id: 10, label: 'Genstand 10' },
      { slot: 'finger1', id: 11, label: 'Rød Ring æøå' },
    ]);
  });
  it('ignorerer ukendte slots, shirt/tabard/relic, ugyldige id og tæller dem', () => {
    const t = '### Gear from Bags\n# x=,id=5\n# shirt=,id=6\n# tabard=,id=7\n# relic=,id=8\n# head=,id=0\n# head=,id=10000000\n# neck=,id=abc\n# neck=,id=9999999\n';
    const r = parseBagItems(t);
    expect(r.items).toEqual([{ slot: 'neck', id: 9999999, label: 'Genstand 9999999' }]);
    expect(r.ignored).toBe(7);
  });
  it('udelader dubletter og genstande der allerede er udstyret (samme slot+id)', () => {
    const t = `${BASE}\nhead=,id=100\n\n### Gear from Bags\n# A (1)\n# head=,id=100\n# B (1)\n# head=,id=101\n# B2 (1)\n# head=,id=101\n# C (1)\n# neck=,id=100\n`;
    const r = parseBagItems(t);
    expect(r.items.map((i) => `${i.slot}:${i.id}`)).toEqual(['head:101', 'neck:100']);
    expect(r.ignored).toBe(2);
  });
  it('højst 40; resten tælles som ignoreret og afkortet', () => {
    const t = '### Gear from Bags\n' + Array.from({ length: 45 }, (_, i) => `# Item ${i} (1)\n# head=,id=${i + 1}\n`).join('');
    const r = parseBagItems(t);
    expect(r.items).toHaveLength(40);
    expect(r.ignored).toBe(5);
    expect(r.truncated).toBe(5);
  });
  it('uden sektion, eller ikke-streng, er resultatet tomt', () => {
    expect(parseBagItems(BASE)).toEqual({ items: [], ignored: 0, truncated: 0 });
    expect(parseBagItems(null).items).toEqual([]);
  });
  it('renser labels og afkorter til 60 tegn', () => {
    expect(cleanLabel('A<b>"x";  y')).toBe('Abx y');
    expect(cleanLabel('x'.repeat(100))).toHaveLength(60);
    expect(cleanLabel("Ål's (Sword)-1.2,3")).toBe("Ål's (Sword)-1.2,3");
    expect(parseBagItems(`### Gear from Bags\n# ${'y'.repeat(80)} (5)\n# head=,id=1\n`).items[0].label).toHaveLength(60);
    expect(parseBagItems('### Gear from Bags\n# <<>> (5)\n# head=,id=1\n').items[0].label).toBe('Genstand 1');
  });
  it('sanitizeBagItems dropper ugyldige poster', () => {
    expect(sanitizeBagItems([{ slot: 'head', id: 1, label: 'A' }, { slot: 'shirt', id: 1, label: 'x' }, { slot: 'head', id: 1.5, label: 'x' }, null, 'x'])).toEqual([{ slot: 'head', id: 1, label: 'A' }]);
    expect(sanitizeBagItems('x')).toEqual([]);
  });
});

const free = () => createSendLimiter({ max: 1000, windowMs: 1, minGapMs: 0 });
let seq = 0;
async function mkUser() {
  seq++;
  const [u] = await db.insert(users).values({ battletag: 'X#1', battlenetId: `g${seq}`, name: `G${seq}` }).returning();
  return u;
}
const withBags = `${BASE}\nhead=,id=100\n\n### Gear from Bags\n#\n# Hjelm (5)\n# head=,id=101\n#\n# Ring (6)\n# finger1=,id=102\n`;
const enq = (userId: number, input: string, o?: Record<string, unknown>) => enqueueSim(db, { userId, limiter: free(), now: Date.now() }, input, o);
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('enqueueSim med valg', () => {
  it('gemmer kampstile og taskegenstande i options', async () => {
    const u = await mkUser();
    const r = await enq(u.id, withBags, { fightStyles: ['DungeonSlice', 'Patchwerk'], optimizeBags: true });
    expect(r.ok).toBe(true);
    const [row] = await db.select().from(simJobs);
    expect(row.options).toMatchObject({
      fightStyles: ['Patchwerk', 'DungeonSlice'], optimizeBags: true, bagFound: 2,
      bagItems: [{ slot: 'head', id: 101, label: 'Hjelm' }, { slot: 'finger1', id: 102, label: 'Ring' }],
    });
  });
  it('uden valg: gammel adfærd (kun Patchwerk, ingen optimering)', async () => {
    const u = await mkUser();
    await enq(u.id, withBags);
    expect(parseSimOptions((await db.select().from(simJobs))[0].options)).toMatchObject({ fightStyles: ['Patchwerk'], optimizeBags: false, bagItems: [] });
  });
  it('afviser ugyldig kampstil, ingen valgt, dubletter og ugyldigt optimeringsvalg', async () => {
    const u = await mkUser();
    expect(await enq(u.id, BASE, { fightStyles: ['Raid'] })).toMatchObject({ ok: false, reason: 'invalid' });
    expect(await enq(u.id, BASE, { fightStyles: [] })).toMatchObject({ ok: false, error: 'Vælg mindst én kampstil.' });
    expect(await enq(u.id, BASE, { fightStyles: 'Patchwerk' })).toMatchObject({ ok: false });
    expect(await enq(u.id, BASE, { fightStyles: ['Patchwerk', 'Patchwerk'] })).toMatchObject({ ok: false });
    expect(await enq(u.id, BASE, { fightStyles: ['Patchwerk'], optimizeBags: 'ja' })).toMatchObject({ ok: false });
    expect(await db.select().from(simJobs)).toHaveLength(0);
  });
  it('optimering uden tasker er ikke en fejl, men gemmer ingen bagItems', async () => {
    const u = await mkUser();
    const r = await enq(u.id, BASE, { fightStyles: ['Patchwerk'], optimizeBags: true });
    expect(r).toMatchObject({ ok: true, bags: { requested: true, found: 0 } });
    const [row] = await db.select().from(simJobs);
    expect(row.options).not.toHaveProperty('bagItems');
    expect(parseSimOptions(row.options).optimizeBags).toBe(true);
  });
  it('en stor optimering tæller som ét job i grænserne', async () => {
    const u = await mkUser();
    const big = `${BASE}\n### Gear from Bags\n` + Array.from({ length: 40 }, (_, i) => `# I${i} (1)\n# head=,id=${i + 1}\n`).join('');
    expect(await enq(u.id, big, { optimizeBags: true })).toMatchObject({ ok: true });
    expect(await enq(u.id, big, { optimizeBags: true })).toMatchObject({ ok: true });
    expect(await enq(u.id, big, { optimizeBags: true })).toMatchObject({ ok: false, reason: 'limit' });
  });
});

const style = (fightStyle: string, mean: number, items?: unknown[], error?: string) => ({
  fightStyle, dps: error ? { mean: null, stdDev: null, meanStdDev: null } : { mean, stdDev: 10, meanStdDev: 1.5 }, ...(items ? { items } : {}), ...(error ? { error } : {}),
});
const item = (over: Record<string, unknown> = {}) => ({ index: 0, slot: 'head', id: 101, label: 'Hjelm', dpsMean: 1050, dpsStdDev: 9, delta: 50, deltaPercent: 5, ...over });
const v2 = (results: unknown[], extra: Record<string, unknown> = {}) => ({
  apiVersion: 2, simc: 'x', player: { name: 'Fallochli', className: 'hunter', level: 11 }, iterations: 5000, elapsedMs: 5, dps: results[0] ? (results[0] as { dps: unknown }).dps : null, results, secret: 'nej', ...extra,
});

describe('parseSimResult v2', () => {
  it('accepterer results[] med items og filtrerer ukendte felter', () => {
    const r = parseSimResult(v2([style('Patchwerk', 1000, [item(), item({ index: 1, slot: 'finger1', id: 5, label: 'Ring', secret: 1 })]), style('DungeonSlice', 900, [])]))!;
    expect(r.styles.map((s) => s.fightStyle)).toEqual(['Patchwerk', 'DungeonSlice']);
    expect(r.styles[0].items).toHaveLength(2);
    expect(r.dps.mean).toBe(1000);
    expect(JSON.stringify(r)).not.toMatch(/secret|nej|dpsStdDev/);
  });
  it('en kampstil med fejl beholdes med fejltekst; første gode giver top-DPS', () => {
    const r = parseSimResult(v2([style('Patchwerk', 0, undefined, 'Ikke tid'), style('DungeonSlice', 800, [])]))!;
    expect(r.styles[0]).toMatchObject({ fightStyle: 'Patchwerk', dps: null, error: 'Ikke tid' });
    expect(r.dps.mean).toBe(800);
    expect(parseSimResult(v2([style('Patchwerk', 0, undefined, 'x')]))).toBeNull();
  });
  it('items med fejl og ugyldige items', () => {
    const bad = [
      item({ index: 2, dpsMean: null, delta: null, deltaPercent: null, error: 'Kunne ikke indlæses' }),
      item({ slot: 'shirt' }), item({ id: 0 }), item({ index: -1 }), item({ index: 99 }), null, 'x',
      item({ index: 3, label: '<b>Ny</b>' }), item({ index: 4, deltaPercent: 'x' }),
    ];
    const items = parseSimResult(v2([style('Patchwerk', 1000, bad)]))!.styles[0].items;
    expect(items.map((i) => i.index)).toEqual([2, 3, 4]);
    expect(items[0]).toMatchObject({ error: 'Kunne ikke indlæses', deltaPercent: null });
    expect(items[1].label).toBe('bNy/b'.replace('/', ''));
    expect(items[2].error).toBeTruthy();
  });
  it('ukendt kampstil droppes; gammel form giver én Patchwerk-stil', () => {
    expect(parseSimResult(v2([style('Raid', 1000, [])]))).toBeNull();
    const old = parseSimResult({ player: { name: 'A' }, dps: { mean: 500, stdDev: 5, meanStdDev: 1 }, iterations: 100, elapsedMs: 1 })!;
    expect(old.styles).toEqual([{ fightStyle: 'Patchwerk', dps: { mean: 500, stdDev: 5, meanStdDev: 1 }, items: [] }]);
  });
  it('den gemte form kan læses igen (round-trip)', () => {
    const r = parseSimResult(v2([style('Patchwerk', 1000, [item()])]))!;
    expect(parseSimResult(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });
});

describe('runner og gear-optimering', () => {
  it('sender fightStyles og bagItems, og et optimeringsjob kører til ende', async () => {
    const u = await mkUser();
    const r = await enq(u.id, withBags, { fightStyles: ['Patchwerk', 'DungeonSlice'], optimizeBags: true });
    if (!r.ok) throw new Error(r.error);
    let body: Record<string, unknown> = {};
    let timeoutSignal: AbortSignal | undefined;
    const result = v2([
      style('Patchwerk', 1000, [item(), item({ index: 1, slot: 'finger1', id: 102, label: 'Ring', dpsMean: 995, delta: -5, deltaPercent: -0.5 })]),
      style('DungeonSlice', 900, [item({ dpsMean: 910, delta: 10, deltaPercent: 1.1 }), item({ index: 1, slot: 'finger1', id: 102, label: 'Ring', dpsMean: null, delta: null, deltaPercent: null, error: 'fejl' })]),
    ]);
    await processQueue({ db, workerUrl: 'http://w', fetch: async (_u, init) => { body = JSON.parse(init!.body as string); timeoutSignal = init!.signal as AbortSignal; return json({ ok: true, result, warnings: ['obs'] }); } });
    expect(body).toEqual({
      input: BASE + '\nhead=,id=100', iterations: 5000, fightStyles: ['Patchwerk', 'DungeonSlice'],
      bagItems: [{ slot: 'head', id: 101, label: 'Hjelm' }, { slot: 'finger1', id: 102, label: 'Ring' }],
    });
    expect(timeoutSignal).toBeInstanceOf(AbortSignal);
    const sim = (await listMySims(db, u.id))[0];
    expect(sim.status).toBe('done');
    expect(sim.bags).toEqual({ requested: true, found: 2, ignored: 0, truncated: 0 });
    expect(sim.result!.styles).toHaveLength(2);
    expect(sim.result!.styles[1].items[1].error).toBe('fejl');
    expect(sim.result!.warnings).toEqual(['obs']);
    expect(JSON.stringify(sim)).not.toContain('secret');
  });
  it('uden taskegenstande sendes bagItems ikke; uden valg sendes Patchwerk', async () => {
    const u = await mkUser();
    await enq(u.id, BASE, { fightStyles: ['DungeonSlice'], optimizeBags: true });
    await enq(u.id, BASE);
    const bodies: Record<string, unknown>[] = [];
    await processQueue({ db, workerUrl: 'http://w', fetch: async (_u, init) => { bodies.push(JSON.parse(init!.body as string)); return json({ ok: true, result: v2([style('Patchwerk', 1, [])]) }); } });
    expect(bodies.map((b) => b.fightStyles)).toEqual([['DungeonSlice'], ['Patchwerk']]);
    expect(bodies.every((b) => !('bagItems' in b))).toBe(true);
  });
  it('gamle rækker uden options (default {}) og gamle resultater kan stadig køres/vises', async () => {
    const u = await mkUser();
    const [row] = await db.insert(simJobs).values({ userId: u.id, input: BASE, status: 'done', result: { dps: { mean: 700, stdDev: 1, meanStdDev: 2 }, player: { name: 'G' }, iterations: 10 } }).returning();
    const list = await listMySims(db, u.id);
    expect(list[0].result?.styles[0].fightStyle).toBe('Patchwerk');
    expect(list[0].bags.requested).toBe(false);
    await db.update(simJobs).set({ status: 'queued' }).where(eq(simJobs.id, row.id));
    expect((await claimNextSim(db))!.options.fightStyles).toEqual(['Patchwerk']);
  });
});

describe('UI-hjælpere', () => {
  it('oversætter slots og kampstile', () => {
    expect(slotLabel('main_hand')).toBe('våben i hånd');
    expect(slotLabel('off_hand')).toBe('anden hånd');
    expect(slotLabel('finger2')).toBe('ring 2');
    expect(slotLabel('trinket1')).toBe('trinket 1');
    expect(slotLabel('ranged')).toBe('afstand');
    expect(slotLabel('ukendt')).toBe('ukendt');
    expect(fightStyleLabel('DungeonSlice')).toBe('Dungeon Slice (flere mål)');
    expect(fightStyleLabel('Patchwerk')).toBe('Patchwerk (enkelt mål)');
  });
  it('formaterer procent med komma og fortegn', () => {
    expect(percentText(2.8)).toBe('+2,8 %');
    expect(percentText(-1.5)).toBe('-1,5 %');
    expect(percentText(0)).toBe('0,0 %');
    expect(percentText(0.04)).toBe('0,0 %');
    expect(percentText(12)).toBe('+12,0 %');
  });
  it('dømmer opgradering/nedgradering/ingen mærkbar forskel/fejl', () => {
    expect(itemVerdict({ deltaPercent: 2.8 })).toBe('upgrade');
    expect(itemVerdict({ deltaPercent: -2.8 })).toBe('downgrade');
    expect(itemVerdict({ deltaPercent: 0.3 })).toBe('upgrade');
    expect(itemVerdict({ deltaPercent: 0.2 })).toBe('neutral');
    expect(itemVerdict({ deltaPercent: -0.2 })).toBe('neutral');
    expect(itemVerdict({ deltaPercent: null })).toBe('error');
    expect(itemVerdict({ deltaPercent: 5, error: 'x' })).toBe('error');
  });
  it('sorterer efter ændring og sætter fejl for sig', () => {
    const mk = (index: number, delta: number | null): SimItemResult => ({ index, slot: 'head', id: index + 1, label: `i${index}`, dpsMean: 1, delta, deltaPercent: delta, ...(delta === null ? { error: 'x' } : {}) });
    const { ranked, failed } = rankItems([mk(0, 1), mk(1, null), mk(2, 5), mk(3, -2)]);
    expect(ranked.map((i) => i.index)).toEqual([2, 0, 3]);
    expect(failed.map((i) => i.index)).toEqual([1]);
  });
});
