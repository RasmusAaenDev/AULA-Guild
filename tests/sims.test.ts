import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createSendLimiter } from '@/lib/chat-send';
import { simJobs, users } from '@/lib/db/schema';
import { processQueue, SIM_ITERATIONS, UNREACHABLE } from '@/lib/sim-runner';
import {
  MAX_ACTIVE_PER_USER, MAX_QUEUED_GLOBAL, claimNextSim, createSimLimiter, deleteMySim, deleteOldSims, enqueueSim, failSim,
  finishSim, listMySims, parseSimResult, resetStaleRunning,
} from '@/lib/sims';
import { simDpsLabel, simStatusLabel } from '@/lib/sims-ui';
import { resetDb, testDb } from './db';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const PROFILE = 'hunter="Fallochli"\nlevel=11\nrace=dwarf';
let seq = 0;
async function mkUser() {
  seq++;
  const [u] = await db.insert(users).values({ battletag: 'X#1', battlenetId: `s${seq}`, name: `S${seq}` }).returning();
  return u;
}
const free = () => createSendLimiter({ max: 1000, windowMs: 1, minGapMs: 0 });
const deps = (userId: number, limiter = free()) => ({ userId, limiter, now: Date.now() });
async function enqueue(userId: number, input = PROFILE) {
  const r = await enqueueSim(db, deps(userId), input);
  if (!r.ok) throw new Error(r.error);
  return r.id;
}
const workerResult = (over: Record<string, unknown> = {}) => ({
  simc: '1000-01',
  player: { name: 'Fallochli', className: 'hunter', spec: 'unknown', level: 11, race: 'dwarf' },
  iterations: 5000,
  dps: { mean: 1234.56, stdDev: 80, meanStdDev: 11.6 },
  scaleFactors: null,
  elapsedMs: 900,
  secret: 'skal-ikke-med',
  ...over,
});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const status = async (id: number) => (await db.select().from(simJobs).where(eq(simJobs.id, id)))[0];

describe('enqueueSim', () => {
  it('validerer før noget lægges i kø og gemmer det rensede input', async () => {
    const u = await mkUser();
    const bad = await enqueueSim(db, deps(u.id), 'input=/etc/passwd');
    expect(bad).toMatchObject({ ok: false, reason: 'invalid' });
    expect(await db.select().from(simJobs)).toHaveLength(0);
    const id = await enqueue(u.id, `# kommentar\n${PROFILE}\n`);
    expect((await status(id)).input).toBe(PROFILE);
    expect((await status(id)).status).toBe('queued');
  });
  it('højst 2 samtidige pr. bruger, også med parallelle kald', async () => {
    const u = await mkUser();
    const rs = await Promise.all([1, 2, 3, 4].map(() => enqueueSim(db, deps(u.id), PROFILE)));
    expect(rs.filter((r) => r.ok)).toHaveLength(MAX_ACTIVE_PER_USER);
    expect(rs.find((r) => !r.ok)).toMatchObject({ reason: 'limit' });
    // en anden bruger er upåvirket, og en færdig sim frigiver en plads
    await enqueue((await mkUser()).id);
    const job = (await claimNextSim(db))!;
    await finishSim(db, job.id, workerResult());
    await enqueue(u.id);
  });
  it('højst 10 pr. time via limiteren, og afviste forsøg tæller ikke', async () => {
    const u = await mkUser();
    const limiter = createSimLimiter();
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) {
      const r = await enqueueSim(db, { userId: u.id, limiter, now }, PROFILE);
      expect(r.ok, String(i)).toBe(true);
      await db.update(simJobs).set({ status: 'done' }).where(eq(simJobs.userId, u.id));
    }
    expect(await enqueueSim(db, { userId: u.id, limiter, now: now + 1000 }, PROFILE)).toMatchObject({ ok: false, reason: 'rate_limited' });
    expect(await enqueueSim(db, { userId: u.id, limiter, now: now + 3_600_001 }, PROFILE)).toMatchObject({ ok: true });
  });
  it('højst 20 køede globalt', async () => {
    for (let i = 0; i < MAX_QUEUED_GLOBAL / 2; i++) {
      const u = await mkUser();
      await enqueue(u.id);
      await enqueue(u.id);
    }
    const extra = await mkUser();
    expect(await enqueueSim(db, deps(extra.id), PROFILE)).toMatchObject({ ok: false, reason: 'queue_full' });
  });
});

describe('autorisation og resultat', () => {
  it('brugere ser og sletter kun egne', async () => {
    const a = await mkUser();
    const b = await mkUser();
    const ida = await enqueue(a.id);
    expect(await listMySims(db, b.id)).toEqual([]);
    expect((await listMySims(db, a.id)).map((s) => s.id)).toEqual([ida]);
    expect(await deleteMySim(db, b.id, ida)).toMatchObject({ ok: false, reason: 'not_found' });
    expect(await deleteMySim(db, a.id, 'abc')).toMatchObject({ ok: false });
    expect(await deleteMySim(db, a.id, String(ida))).toEqual({ ok: true });
    expect(await listMySims(db, a.id)).toEqual([]);
  });
  it('listen er nyeste først, højst limit, og afslører ikke input', async () => {
    const u = await mkUser();
    const ids: number[] = [];
    for (let i = 0; i < 3; i++) {
      ids.push(await enqueue(u.id));
      await db.update(simJobs).set({ status: 'done' }).where(eq(simJobs.userId, u.id));
    }
    const list = await listMySims(db, u.id, 2);
    expect(list.map((s) => s.id)).toEqual([ids[2], ids[1]]);
    expect(JSON.stringify(list)).not.toContain('Fallochli');
  });
  it('filtrerer resultatet til kendte felter', () => {
    const r = parseSimResult(workerResult({ warnings: ['a', 5, '', 'b'] }))!;
    expect(r).toEqual({
      styles: [{ fightStyle: 'Patchwerk', dps: { mean: 1234.56, stdDev: 80, meanStdDev: 11.6 }, items: [] }],
      player: { name: 'Fallochli', className: 'hunter', spec: 'unknown', level: 11, race: 'dwarf' },
      iterations: 5000,
      dps: { mean: 1234.56, stdDev: 80, meanStdDev: 11.6 },
      elapsedMs: 900,
      warnings: ['a', 'b'],
    });
    expect(JSON.stringify(r)).not.toContain('skal-ikke-med');
    expect(parseSimResult({ dps: { mean: 'x' } })).toBeNull();
    expect(parseSimResult({ dps: { mean: Infinity } })).toBeNull();
    expect(parseSimResult(null)).toBeNull();
    expect(parseSimResult('x')).toBeNull();
    expect(parseSimResult({ dps: { mean: 5 }, player: { name: 'x'.repeat(500), level: '9' } })!.player).toMatchObject({ name: 'x'.repeat(40), level: null });
  });
  it('gemmer kun det filtrerede resultat; ubrugeligt svar fejler jobbet', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    const job = (await claimNextSim(db))!;
    await finishSim(db, job.id, workerResult());
    expect(JSON.stringify((await status(id)).result)).not.toContain('skal-ikke-med');
    const id2 = await enqueue(u.id);
    const job2 = (await claimNextSim(db))!;
    await finishSim(db, job2.id, { dps: 'nej' });
    expect(await status(id2)).toMatchObject({ status: 'failed', error: 'Simulatoren gav et uventet svar.' });
  });
  it('formaterer status og DPS på dansk', () => {
    expect(simStatusLabel('queued')).toBe('Venter i kø');
    expect(simStatusLabel('running')).toBe('Kører');
    expect(simStatusLabel('done')).toBe('Færdig');
    expect(simStatusLabel('failed')).toBe('Fejlede');
    expect(simDpsLabel({ dps: { mean: 1234.4, stdDev: null, meanStdDev: 11.6 } })).toBe('DPS ≈ 1.234 ± 12');
    expect(simDpsLabel({ dps: { mean: 99.5, stdDev: null, meanStdDev: null } })).toBe('DPS ≈ 100');
  });
});

describe('claimNextSim', () => {
  it('tager ældste først og sætter running + started_at', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    const job = (await claimNextSim(db))!;
    expect(job).toMatchObject({ id, userId: u.id, input: PROFILE });
    const row = await status(id);
    expect(row.status).toBe('running');
    expect(row.startedAt).not.toBeNull();
    expect(await claimNextSim(db)).toBeNull();
  });
  it('to samtidige claims får forskellige jobs', async () => {
    const u1 = await mkUser();
    const u2 = await mkUser();
    await enqueue(u1.id);
    await enqueue(u2.id);
    for (let round = 0; round < 3; round++) {
      await db.update(simJobs).set({ status: 'queued', startedAt: null });
      const [a, b, c] = await Promise.all([claimNextSim(db), claimNextSim(db), claimNextSim(db)]);
      const got = [a, b, c].filter((x) => x !== null).map((x) => x!.id);
      expect(got).toHaveLength(2);
      expect(new Set(got).size).toBe(2);
    }
  });
  it('finish/fail rører kun kørende jobs', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    expect(await failSim(db, id, 'x')).toBe(false); // stadig queued
    expect((await status(id)).status).toBe('queued');
  });
});

describe('resetStaleRunning og deleteOldSims', () => {
  it('lægger kun kørende jobs ældre end 5 minutter tilbage i køen', async () => {
    const u = await mkUser();
    const old = await enqueue(u.id);
    const fresh = await enqueue(u.id);
    const now = new Date('2026-11-10T12:00:00Z');
    await db.update(simJobs).set({ status: 'running', startedAt: new Date(now.getTime() - 6 * 60_000) }).where(eq(simJobs.id, old));
    await db.update(simJobs).set({ status: 'running', startedAt: new Date(now.getTime() - 60_000) }).where(eq(simJobs.id, fresh));
    expect(await resetStaleRunning(db, now)).toBe(1);
    expect(await status(old)).toMatchObject({ status: 'queued', startedAt: null });
    expect((await status(fresh)).status).toBe('running');
  });
  it('sletter færdige og fejlede ældre end 30 dage, men ikke køede/kørende eller nyere', async () => {
    const u = await mkUser();
    const now = new Date('2026-11-10T12:00:00Z');
    const mk = async (st: 'queued' | 'running' | 'done' | 'failed', ageDays: number) => {
      const [r] = await db.insert(simJobs).values({ userId: u.id, input: PROFILE, status: st, createdAt: new Date(now.getTime() - ageDays * 86_400_000) }).returning();
      return r.id;
    };
    const oldDone = await mk('done', 31);
    const oldFailed = await mk('failed', 40);
    const newDone = await mk('done', 29);
    const oldQueued = await mk('queued', 31);
    expect(await deleteOldSims(db, now)).toBe(2);
    const left = (await db.select({ id: simJobs.id }).from(simJobs)).map((r) => r.id).sort();
    expect(left).toEqual([newDone, oldQueued].sort());
    expect(left).not.toContain(oldDone);
    expect(left).not.toContain(oldFailed);
  });
});

describe('processQueue', () => {
  const url = 'http://simc:8080';
  it('gemmer resultatet og sender renset input, iterationer og timeout-signal', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    const calls: { url: string; init?: RequestInit }[] = [];
    await processQueue({ db, workerUrl: url + '/', fetch: async (x, init) => { calls.push({ url: x, init }); return json(200, { ok: true, result: workerResult() }); } });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://simc:8080/run');
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ input: PROFILE, iterations: SIM_ITERATIONS, fightStyles: ['Patchwerk'] });
    expect(calls[0].init!.signal).toBeInstanceOf(AbortSignal);
    const row = await status(id);
    expect(row.status).toBe('done');
    expect(row.finishedAt).not.toBeNull();
    expect((await listMySims(db, u.id))[0].result?.dps.mean).toBeCloseTo(1234.56);
  });
  it('tager advarsler med fra øverste niveau i svaret', async () => {
    const u = await mkUser();
    await enqueue(u.id);
    await processQueue({ db, workerUrl: url, fetch: async () => json(200, { ok: true, result: workerResult(), warnings: ['Pas på'] }) });
    expect((await listMySims(db, u.id))[0].result?.warnings).toEqual(['Pas på']);
  });
  it('viser workerens danske fejl ved 422 og 400', async () => {
    const u = await mkUser();
    const a = await enqueue(u.id);
    const b = await enqueue(u.id);
    const replies = [json(422, { ok: false, error: 'Simulatoren kunne ikke køre profilen.' }), json(400, { ok: false, error: 'Linje 2: dårligt.' })];
    await processQueue({ db, workerUrl: url, fetch: async () => replies.shift()! });
    expect(await status(a)).toMatchObject({ status: 'failed', error: 'Simulatoren kunne ikke køre profilen.' });
    expect(await status(b)).toMatchObject({ status: 'failed', error: 'Linje 2: dårligt.' });
  });
  it('netværksfejl, timeout, 5xx og ikke-JSON giver «svarer ikke» og ingen genforsøg', async () => {
    const u = await mkUser();
    const ids = [await enqueue(u.id), await enqueue(u.id)];
    let n = 0;
    await processQueue({ db, workerUrl: url, fetch: async () => { n++; throw new TypeError('fetch failed'); } });
    expect(n).toBe(2);
    for (const id of ids) expect(await status(id)).toMatchObject({ status: 'failed', error: UNREACHABLE });
    const timeoutId = await enqueue(u.id);
    await processQueue({ db, workerUrl: url, fetch: async () => { throw new DOMException('timeout', 'TimeoutError'); } });
    expect((await status(timeoutId)).error).toBe(UNREACHABLE);
    const id5 = await enqueue(u.id);
    await processQueue({ db, workerUrl: url, fetch: async () => json(502, { ok: false, error: 'Bad gateway intern' }) });
    expect((await status(id5)).error).toBe(UNREACHABLE);
    const idH = await enqueue(u.id);
    await processQueue({ db, workerUrl: url, fetch: async () => new Response('<html>nope</html>', { status: 200 }) });
    expect((await status(idH)).error).toBe(UNREACHABLE);
  });
  it('løber hele køen igennem, ét job ad gangen i oprettelsesrækkefølge', async () => {
    const ids: number[] = [];
    for (let i = 0; i < 3; i++) ids.push(await enqueue((await mkUser()).id));
    const order: string[] = [];
    await processQueue({ db, workerUrl: url, fetch: async (_u, init) => { order.push(JSON.parse(init!.body as string).input); return json(200, { ok: true, result: workerResult() }); } });
    expect(order).toHaveLength(3);
    for (const id of ids) expect((await status(id)).status).toBe('done');
  });
  it('låsen forhindrer to jobs parallelt og samler samtidige kald', async () => {
    for (let i = 0; i < 3; i++) await enqueue((await mkUser()).id);
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    const f = async () => {
      calls++;
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 30));
      active--;
      return json(200, { ok: true, result: workerResult() });
    };
    await Promise.all([processQueue({ db, workerUrl: url, fetch: f }), processQueue({ db, workerUrl: url, fetch: f }), processQueue({ db, workerUrl: url, fetch: f })]);
    expect(maxActive).toBe(1);
    expect(calls).toBe(3);
    // et job, der kommer til mens køen kører, bliver også taget
    const late = (await mkUser()).id;
    const p = processQueue({ db, workerUrl: url, fetch: f });
    const lateId = await enqueue(late);
    await Promise.all([p, processQueue({ db, workerUrl: url, fetch: f })]);
    expect((await status(lateId)).status).toBe('done');
  });
});
