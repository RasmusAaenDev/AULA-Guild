import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createSendLimiter } from '@/lib/chat-send';
import { simJobs, users } from '@/lib/db/schema';
import { LOG_TAIL_CHARS, processQueue, UNREACHABLE } from '@/lib/sim-runner';
import { enqueueSim, listMySims } from '@/lib/sims';
import { resetDb, testDb } from './db';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const PROFILE = 'hunter="Fallochli"\nlevel=11\nrace=dwarf';
const url = 'http://simc:8080';
let seq = 0;
async function mkUser() {
  seq++;
  const [u] = await db.insert(users).values({ discordId: `l${seq}`, name: `L${seq}` }).returning();
  return u;
}
async function enqueue(userId: number) {
  const r = await enqueueSim(db, { userId, limiter: createSendLimiter({ max: 1000, windowMs: 1, minGapMs: 0 }), now: Date.now() }, PROFILE);
  if (!r.ok) throw new Error(r.error);
  return r.id;
}
const row = async (id: number) => (await db.select().from(simJobs).where(eq(simJobs.id, id)))[0];
const result = () => ({
  simc: 'x', player: { name: 'Fallochli', className: 'hunter', spec: 'bm', level: 11, race: 'dwarf' }, iterations: 5000,
  dps: { mean: 1000, stdDev: 5, meanStdDev: 1 }, elapsedMs: 10,
});
const logLine = (text: string) => `${JSON.stringify({ type: 'log', text })}\n`;
const resultLine = (extra: Record<string, unknown> = { ok: true, result: result() }) => `${JSON.stringify({ type: 'result', ...extra })}\n`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Falsk worker: giver brudstykker (strenge/bytes) ud ét ad gangen, med valgfrit ventetrin ({ wait: ms }) imellem. */
type Step = string | Uint8Array | { wait: number } | { error: true };
function ndjsonResponse(steps: Step[], init: ResponseInit = { status: 200, headers: { 'content-type': 'application/x-ndjson' } }) {
  const enc = new TextEncoder();
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(c) {
      // Pull skal ende med enqueue/close/error, ellers kaldes den ikke igen; ventetrin løkkes derfor igennem.
      for (;;) {
        if (i >= steps.length) return c.close();
        const s = steps[i++];
        if (typeof s === 'string') return c.enqueue(enc.encode(s));
        if (s instanceof Uint8Array) return c.enqueue(s);
        if ('wait' in s) { await sleep(s.wait); continue; }
        return c.error(new TypeError('terminated'));
      }
    },
  });
  return new Response(body, init);
}
const run = (steps: Step[], seen?: { headers?: HeadersInit | undefined }) =>
  processQueue({ db, workerUrl: url, fetch: async (_u, init) => { if (seen) seen.headers = init?.headers; return ndjsonResponse(steps); } });

describe('runneren og simc-loggen', () => {
  it('beder om ndjson, gemmer loggen og læser resultatet fra slutlinjen', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    const seen: { headers?: HeadersInit } = {};
    await run([logLine('første\n'), logLine('anden\n'), resultLine({ ok: true, result: result(), warnings: ['Pas på'] })], seen);
    expect(seen.headers).toMatchObject({ accept: 'application/x-ndjson' });
    const r = await row(id);
    expect(r.status).toBe('done');
    expect(r.log).toBe('første\nanden\n');
    const v = (await listMySims(db, u.id))[0];
    expect(v.log).toBe('første\nanden\n');
    expect(v.result?.dps.mean).toBe(1000);
    expect(v.result?.warnings).toEqual(['Pas på']);
  });

  it('skriver loggen løbende (flere opdateringer) mens jobbet kører, og endeligt til sidst', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    const p = run([logLine('A\n'), { wait: 1300 }, logLine('B\n'), { wait: 1300 }, logLine('C\n'), resultLine()]);
    await sleep(1000);
    const mid1 = await row(id);
    expect(mid1.status).toBe('running');
    expect(mid1.log).toBe('A\n');
    await sleep(1400);
    const mid2 = await row(id);
    expect(mid2.status).toBe('running');
    expect(mid2.log).toBe('A\nB\n');
    await p;
    expect(await row(id)).toMatchObject({ status: 'done', log: 'A\nB\nC\n' });
  }, 15_000);

  it('begrænser loggen til de seneste 16 KB (halen bevares)', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    const steps: Step[] = [];
    for (let i = 0; i < 40; i++) steps.push(logLine(`${String(i).padStart(3, '0')} ${'x'.repeat(996)}\n`));
    steps.push(logLine('SLUT\n'), resultLine());
    await run(steps);
    const r = await row(id);
    expect(r.log!.length).toBeLessThanOrEqual(LOG_TAIL_CHARS);
    expect(r.log!.endsWith('SLUT\n')).toBe(true);
    expect(r.log).not.toContain('000 xxx');
    expect(r.log).toContain('039 xxx');
  });

  it('klarer linjer delt over chunks (også midt i et UTF-8-tegn) og ignorerer ugyldige linjer', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    const full = new TextEncoder().encode(logLine('Rød grød\n') + 'ikke json\n{"type":"log"}\n{"type":"log","text":5}\n[1]\n\n' + logLine('slut\n') + resultLine());
    const steps: Step[] = [];
    for (let i = 0; i < full.length; i += 7) steps.push(full.slice(i, i + 7)); // 7 bytes ad gangen skærer æ/ø/å over
    await run(steps);
    expect(await row(id)).toMatchObject({ status: 'done', log: 'Rød grød\nslut\n' });
  });

  it('læser en slutlinje uden afsluttende linjeskift', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    await run([logLine('x\n'), resultLine().trimEnd()]);
    expect(await row(id)).toMatchObject({ status: 'done', log: 'x\n' });
  });

  it('fjerner kontroltegn fra loggen før den gemmes', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    await run([logLine('a\u0000b\u001b[31mc\td\n'), resultLine()]);
    expect((await row(id)).log).toBe('ab[31mc\td\n');
  });

  it('fald tilbage til almindeligt JSON-svar fra en ældre worker (ingen log)', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    await processQueue({ db, workerUrl: url, fetch: async () => new Response(JSON.stringify({ ok: true, result: result() }), { status: 200, headers: { 'content-type': 'application/json' } }) });
    expect(await row(id)).toMatchObject({ status: 'done', log: null });
    expect((await listMySims(db, u.id))[0].result?.dps.mean).toBe(1000);
  });

  it('en fejl-slutlinje fejler jobbet med workerens besked og beholder loggen', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    await run([logLine('simc brokkede sig\n'), resultLine({ ok: false, error: 'Simulationen kunne ikke køre. Tjek profilen.' })]);
    expect(await row(id)).toMatchObject({ status: 'failed', error: 'Simulationen kunne ikke køre. Tjek profilen.', log: 'simc brokkede sig\n' });
  });

  it('en afbrudt strøm fejler jobbet («svarer ikke») og gemmer loggen indtil afbrydelsen', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    await run([logLine('halv\n'), { error: true }]);
    expect(await row(id)).toMatchObject({ status: 'failed', error: UNREACHABLE, log: 'halv\n' });
  });

  it('en strøm uden slutlinje fejler jobbet, men gemmer loggen', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    await run([logLine('kun log\n')]);
    expect(await row(id)).toMatchObject({ status: 'failed', error: UNREACHABLE, log: 'kun log\n' });
  });

  it('en timeout/netværksfejl før strømmen starter giver «svarer ikke» uden log', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    await processQueue({ db, workerUrl: url, fetch: async () => { throw new DOMException('timeout', 'TimeoutError'); } });
    expect(await row(id)).toMatchObject({ status: 'failed', error: UNREACHABLE, log: null });
  });

  it('almindelig JSON-fejl (fx 422) uden strøm virker som før', async () => {
    const u = await mkUser();
    const id = await enqueue(u.id);
    await processQueue({ db, workerUrl: url, fetch: async () => new Response(JSON.stringify({ ok: false, error: 'Linje 2: dårligt.' }), { status: 400, headers: { 'content-type': 'application/json' } }) });
    expect(await row(id)).toMatchObject({ status: 'failed', error: 'Linje 2: dårligt.' });
  });

  it('loggen sendes kun til ejeren, og et nyt claim nulstiller en gammel log', async () => {
    const a = await mkUser();
    const b = await mkUser();
    const ida = await enqueue(a.id);
    await run([logLine('hemmelig\n'), resultLine()]);
    expect((await listMySims(db, b.id))).toEqual([]);
    expect((await listMySims(db, a.id))[0].log).toBe('hemmelig\n');
    await db.update(simJobs).set({ status: 'queued', startedAt: null }).where(eq(simJobs.id, ida));
    let during: string | null | undefined;
    await processQueue({ db, workerUrl: url, fetch: async () => { during = (await row(ida)).log; return ndjsonResponse([resultLine()]); } });
    expect(during).toBeNull();
  });
});
