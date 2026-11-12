import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  allowedInSection, cleanupStaleUploads, deleteFile, detectType, getFile, listFiles, sanitizeFileName, setFilePinned, storeUpload,
  type StorageDeps,
} from '@/lib/files';
import { files } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { seedUser } from './helpers';

const { db, close } = testDb();
let root: string;
let uploadDir: string;

beforeEach(async () => {
  await resetDb(db);
  root = await mkdtemp(path.join(os.tmpdir(), 'aula-files-'));
  uploadDir = path.join(root, 'uploads');
});
afterEach(() => rm(root, { recursive: true, force: true }));
afterAll(() => close());

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...Buffer.from(p, 'latin1')] : p)));
const pad = (head: Uint8Array, total = 64) => {
  const out = new Uint8Array(Math.max(total, head.length));
  out.set(head);
  return out;
};

const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0]);
const WEBP = bytes('RIFF', [0x24, 0, 0, 0], 'WEBP');
const GIF87 = bytes('GIF87a');
const GIF89 = bytes('GIF89a');
const PDF = bytes('%PDF-1.7\n');

function streamOf(data: Uint8Array, chunk = 7): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (i >= data.length) return c.close();
      c.enqueue(data.slice(i, i + chunk));
      i += chunk;
    },
  });
}

/** Strøm der aldrig slutter af sig selv: tester at grænsen håndhæves under læsning. */
function endless(head: Uint8Array): { stream: ReadableStream<Uint8Array>; cancelled: () => boolean; sent: () => number } {
  let sentBytes = 0;
  let wasCancelled = false;
  let first = true;
  const stream = new ReadableStream<Uint8Array>({
    pull(c) {
      const chunk = first ? pad(head, 1024) : new Uint8Array(1024);
      first = false;
      sentBytes += chunk.length;
      c.enqueue(chunk);
    },
    cancel() {
      wasCancelled = true;
    },
  });
  return { stream, cancelled: () => wasCancelled, sent: () => sentBytes };
}

const deps = (over: Partial<StorageDeps> = {}): StorageDeps => ({
  db, uploadDir, maxBytes: 10_000, maxTotalBytes: 100_000, ...over,
});

async function upload(
  userId: number,
  data: Uint8Array,
  over: { section?: 'filer' | 'galleri'; title?: string; originalName?: string; declaredLength?: number | null } = {},
  d = deps(),
) {
  return storeUpload(d, {
    userId,
    section: over.section ?? 'filer',
    title: over.title ?? 'Titel',
    originalName: over.originalName ?? 'billede.png',
    stream: streamOf(data),
    declaredLength: over.declaredLength === undefined ? data.length : over.declaredLength,
  });
}

async function dirEntries(): Promise<string[]> {
  try {
    return await readdir(uploadDir);
  } catch {
    return [];
  }
}

describe('detectType', () => {
  it('genkender PNG, JPEG, WebP, GIF og PDF på indholdet', () => {
    expect(detectType(pad(PNG))).toEqual({ mime: 'image/png' });
    expect(detectType(pad(JPEG))).toEqual({ mime: 'image/jpeg' });
    expect(detectType(pad(WEBP))).toEqual({ mime: 'image/webp' });
    expect(detectType(pad(GIF87))).toEqual({ mime: 'image/gif' });
    expect(detectType(pad(GIF89))).toEqual({ mime: 'image/gif' });
    expect(detectType(pad(PDF))).toEqual({ mime: 'application/pdf' });
  });

  it('afviser SVG, HTML, EXE, ZIP, tom og for korte data', () => {
    expect(detectType(bytes('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectType(bytes('<svg onload="alert(1)"></svg>'))).toBeNull();
    expect(detectType(bytes('<!DOCTYPE html><html></html>'))).toBeNull();
    expect(detectType(pad(bytes('MZ', [0x90, 0])))).toBeNull();
    expect(detectType(pad(bytes('PK', [3, 4])))).toBeNull();
    expect(detectType(new Uint8Array())).toBeNull();
    expect(detectType(PNG.slice(0, 7))).toBeNull();
    expect(detectType(WEBP.slice(0, 11))).toBeNull();
    // RIFF uden WEBP (fx WAV/AVI) er ikke et billede
    expect(detectType(pad(bytes('RIFF', [0x24, 0, 0, 0], 'WAVE')))).toBeNull();
    expect(detectType(pad(bytes('GIF88a')))).toBeNull();
    expect(detectType(pad(bytes(' %PDF-')))).toBeNull();
  });
});

describe('allowedInSection', () => {
  it('galleri tager kun billeder, filer tager billeder og PDF', () => {
    for (const m of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      expect(allowedInSection('galleri', m)).toBe(true);
      expect(allowedInSection('filer', m)).toBe(true);
    }
    expect(allowedInSection('galleri', 'application/pdf')).toBe(false);
    expect(allowedInSection('filer', 'application/pdf')).toBe(true);
    expect(allowedInSection('filer', 'image/svg+xml')).toBe(false);
    expect(allowedInSection('filer', 'text/html')).toBe(false);
    expect(allowedInSection('ukendt' as 'filer', 'image/png')).toBe(false);
  });
});

describe('sanitizeFileName', () => {
  it('fjerner stier og ..', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('C:\\Users\\x\\guide.pdf')).toBe('guide.pdf');
    expect(sanitizeFileName('a/b/../c.png')).toBe('c.png');
    expect(sanitizeFileName('..')).toBe('fil');
    expect(sanitizeFileName('../')).toBe('fil');
  });

  it('fjerner kontroltegn, retningstegn og indledende punktummer', () => {
    expect(sanitizeFileName('a\u0000b\r\nc.png')).toBe('abc.png');
    expect(sanitizeFileName('\u0007bell.png')).toBe('bell.png');
    expect(sanitizeFileName('kat\u202Egnp.exe')).toBe('katgnp.exe');
    expect(sanitizeFileName('x\u2066y\u2069\u200F.pdf')).toBe('xy.pdf');
    expect(sanitizeFileName('.htaccess')).toBe('htaccess');
    expect(sanitizeFileName('...skjult.png')).toBe('skjult.png');
    expect(sanitizeFileName('  rum .png  ')).toBe('rum .png');
  });

  it('bevarer danske tegn og begrænser længden til 120 tegn med endelsen', () => {
    expect(sanitizeFileName('Ærø åbent.pdf')).toBe('Ærø åbent.pdf');
    const long = sanitizeFileName('a'.repeat(300) + '.png');
    expect([...long].length).toBe(120);
    expect(long.endsWith('.png')).toBe(true);
    const emoji = sanitizeFileName('😀'.repeat(200));
    expect([...emoji].length).toBe(120);
    expect(emoji).toBe('😀'.repeat(120));
    expect(sanitizeFileName('\uD800x.png')).toBe('x.png'); // ensom surrogat
  });

  it('tomt navn bliver "fil"', () => {
    expect(sanitizeFileName('')).toBe('fil');
    expect(sanitizeFileName('   ')).toBe('fil');
    expect(sanitizeFileName('\u0000\u0001')).toBe('fil');
    expect(sanitizeFileName('/')).toBe('fil');
  });
});

describe('storeUpload', () => {
  it('gemmer et gyldigt billede med tilfældig nøgle, rettigheder 0600 i en 0700-mappe', async () => {
    const u = await seedUser(db);
    const data = pad(PNG, 500);
    const r = await upload(u, data, { title: '  Raid-screenshot  ', originalName: '../hemmelig/skærm.png' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [row] = await db.select().from(files).where(eq(files.id, r.id));
    expect(row).toMatchObject({
      section: 'filer', title: 'Raid-screenshot', originalName: 'skærm.png', mime: 'image/png', sizeBytes: 500,
      uploadedBy: u, pinned: false, deletedAt: null,
    });
    expect(row.storageKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await dirEntries()).toEqual([row.storageKey]);
    const p = path.join(uploadDir, row.storageKey);
    expect(new Uint8Array(await readFile(p))).toEqual(data);
    expect((await stat(p)).mode & 0o777).toBe(0o600);
    expect((await stat(uploadDir)).mode & 0o777).toBe(0o700);
  });

  it('typen afgøres af indholdet, ikke af filnavnet', async () => {
    const u = await seedUser(db);
    const r = await upload(u, pad(JPEG, 100), { originalName: 'dokument.pdf' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await getFile(db, r.id))?.mime).toBe('image/jpeg');
  });

  it('PDF er tilladt i filer', async () => {
    const u = await seedUser(db);
    const r = await upload(u, pad(PDF, 300), { originalName: 'guide.pdf', section: 'filer' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await getFile(db, r.id))?.mime).toBe('application/pdf');
  });

  it('PDF afvises i galleri, og intet efterlades', async () => {
    const u = await seedUser(db);
    expect(await upload(u, pad(PDF, 300), { originalName: 'guide.pdf', section: 'galleri' })).toEqual({ ok: false, reason: 'bad_type' });
    expect(await db.select().from(files)).toHaveLength(0);
    expect(await dirEntries()).toEqual([]);
  });

  it('falsk filendelse med forkert indhold afvises (SVG/HTML kaldt .png)', async () => {
    const u = await seedUser(db);
    const svg = bytes('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
    expect(await upload(u, svg, { originalName: 'kat.png', section: 'galleri' })).toEqual({ ok: false, reason: 'bad_type' });
    expect(await upload(u, bytes('<html><script>x</script></html>'), { originalName: 'a.jpg' })).toEqual({ ok: false, reason: 'bad_type' });
    expect(await upload(u, new Uint8Array(), { originalName: 'tom.png' })).toEqual({ ok: false, reason: 'bad_type' });
    expect(await db.select().from(files)).toHaveLength(0);
    expect(await dirEntries()).toEqual([]);
  });

  it('afviser straks en for stor deklareret længde uden at læse streamen', async () => {
    const u = await seedUser(db);
    const e = endless(PNG);
    const r = await storeUpload(deps(), {
      userId: u, section: 'filer', title: 'x', originalName: 'x.png', stream: e.stream, declaredLength: 10_001,
    });
    expect(r).toEqual({ ok: false, reason: 'too_large' });
    expect(e.sent()).toBeLessThanOrEqual(1024 * 2);
    expect(e.cancelled()).toBe(true);
    expect(await dirEntries()).toEqual([]);
  });

  it('håndhæver grænsen under streaming uden længde og fjerner den midlertidige fil', async () => {
    const u = await seedUser(db);
    const e = endless(PNG);
    const r = await storeUpload(deps(), {
      userId: u, section: 'filer', title: 'x', originalName: 'x.png', stream: e.stream, declaredLength: null,
    });
    expect(r).toEqual({ ok: false, reason: 'too_large' });
    expect(e.cancelled()).toBe(true);
    expect(e.sent()).toBeLessThan(10_000 + 4 * 1024);
    expect(await dirEntries()).toEqual([]);
    expect(await db.select().from(files)).toHaveLength(0);
  });

  it('en løgnagtig lille deklareret længde redder ikke en for stor strøm', async () => {
    const u = await seedUser(db);
    const r = await upload(u, pad(PNG, 10_001), { declaredLength: 10 });
    expect(r).toEqual({ ok: false, reason: 'too_large' });
    expect(await dirEntries()).toEqual([]);
  });

  it('præcis maxBytes er tilladt, én byte mere er ikke', async () => {
    const u = await seedUser(db);
    expect((await upload(u, pad(PNG, 10_000), { declaredLength: null })).ok).toBe(true);
    expect(await upload(u, pad(PNG, 10_001), { declaredLength: null })).toEqual({ ok: false, reason: 'too_large' });
    expect(await dirEntries()).toHaveLength(1);
  });

  it('kvote: samlet størrelse af ikke-slettede filer + den nye må ikke overstige grænsen', async () => {
    const u = await seedUser(db);
    const d = deps({ maxTotalBytes: 1000 });
    const a = await upload(u, pad(PNG, 600), {}, d);
    expect(a.ok).toBe(true);
    expect(await upload(u, pad(PNG, 401), {}, d)).toEqual({ ok: false, reason: 'quota' });
    expect(await dirEntries()).toHaveLength(1);
    expect((await upload(u, pad(PNG, 400), {}, d)).ok).toBe(true);
    // Slettede filer tæller ikke med
    if (!a.ok) return;
    expect(await deleteFile(d, { userId: u, isOfficer: false }, a.id)).toEqual({ ok: true });
    expect((await upload(u, pad(PNG, 600), {}, d)).ok).toBe(true);
  });

  it('samtidige uploads kan ikke tilsammen sprænge kvoten', async () => {
    const u = await seedUser(db);
    const d = deps({ maxTotalBytes: 1000 });
    const results = await Promise.all(Array.from({ length: 5 }, () => upload(u, pad(PNG, 400), {}, d)));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(results.filter((r) => !r.ok && r.reason === 'quota')).toHaveLength(3);
    expect(await dirEntries()).toHaveLength(2);
  });

  it('titel: trimmes, 1–120 tegn, tom bliver originalnavnet uden endelse', async () => {
    const u = await seedUser(db);
    const ok = await upload(u, pad(PNG), { title: '   ', originalName: 'Raid aften.png' });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const [row] = await db.select().from(files).where(eq(files.id, ok.id));
    expect(row.title).toBe('Raid aften');
    const noExt = await upload(u, pad(PNG), { title: '', originalName: '' });
    if (!noExt.ok) throw new Error('forventede ok');
    expect((await db.select().from(files).where(eq(files.id, noExt.id)))[0].title).toBe('fil');
    expect((await upload(u, pad(PNG), { title: 'æ'.repeat(120) })).ok).toBe(true);
    expect(await upload(u, pad(PNG), { title: 'a'.repeat(121) })).toEqual({ ok: false, reason: 'invalid' });
    expect(await upload(u, pad(PNG), { title: 'a\u0000b' })).toEqual({ ok: false, reason: 'invalid' });
    expect(await upload(u, pad(PNG), { section: 'andet' as 'filer' })).toEqual({ ok: false, reason: 'invalid' });
    expect(await db.select().from(files)).toHaveLength(3);
    expect(await dirEntries()).toHaveLength(3);
  });

  it('ugyldigt input annullerer streamen uden at skrive til disk', async () => {
    const u = await seedUser(db);
    const e = endless(PNG);
    const r = await storeUpload(deps(), {
      userId: u, section: 'filer', title: 'x'.repeat(200), originalName: 'x.png', stream: e.stream, declaredLength: null,
    });
    expect(r).toEqual({ ok: false, reason: 'invalid' });
    expect(e.cancelled()).toBe(true);
    expect(await dirEntries()).toEqual([]);
  });

  it('en strøm der fejler midt i giver io og rydder op', async () => {
    const u = await seedUser(db);
    let n = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        n += 1;
        if (n === 1) c.enqueue(pad(PNG, 100));
        else c.error(new Error('forbindelsen røg'));
      },
    });
    const r = await storeUpload(deps(), { userId: u, section: 'filer', title: 'x', originalName: 'x.png', stream, declaredLength: null });
    expect(r).toEqual({ ok: false, reason: 'io' });
    expect(await dirEntries()).toEqual([]);
    expect(await db.select().from(files)).toHaveLength(0);
  });

  it('opretter ikke filer uden for upload-mappen, uanset navn', async () => {
    const u = await seedUser(db);
    const r = await upload(u, pad(PNG), { originalName: '../../../../tmp/ond.png' });
    expect(r.ok).toBe(true);
    expect((await readdir(root)).sort()).toEqual(['uploads']);
  });
});

describe('deleteFile', () => {
  async function seeded() {
    const owner = await seedUser(db, 'ejer');
    const other = await seedUser(db, 'anden');
    const officer = await seedUser(db, 'officer');
    const r = await upload(owner, pad(PNG, 200));
    if (!r.ok) throw new Error('upload fejlede');
    const row = await getFile(db, r.id);
    if (!row) throw new Error('mangler');
    return { owner, other, officer, id: r.id, filePath: path.join(uploadDir, row.storageKey) };
  }

  it('ejeren kan slette; rækken markeres og filen fjernes fra disken', async () => {
    const s = await seeded();
    expect(await deleteFile(deps(), { userId: s.owner, isOfficer: false }, s.id)).toEqual({ ok: true });
    const [row] = await db.select().from(files).where(eq(files.id, s.id));
    expect(row.deletedAt).toBeInstanceOf(Date);
    await expect(stat(s.filePath)).rejects.toThrow();
    expect(await getFile(db, s.id)).toBeNull();
    expect(await deleteFile(deps(), { userId: s.owner, isOfficer: false }, s.id)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('officer kan slette andres filer', async () => {
    const s = await seeded();
    expect(await deleteFile(deps(), { userId: s.officer, isOfficer: true }, s.id)).toEqual({ ok: true });
    await expect(stat(s.filePath)).rejects.toThrow();
  });

  it('fremmed medlem må ikke, og filen bliver liggende', async () => {
    const s = await seeded();
    expect(await deleteFile(deps(), { userId: s.other, isOfficer: false }, s.id)).toEqual({ ok: false, reason: 'forbidden' });
    expect((await stat(s.filePath)).isFile()).toBe(true);
    expect(await getFile(db, s.id)).not.toBeNull();
  });

  it('manglende fil på disken er ikke en fejl; ukendte id giver not_found', async () => {
    const s = await seeded();
    await rm(s.filePath);
    expect(await deleteFile(deps(), { userId: s.owner, isOfficer: false }, s.id)).toEqual({ ok: true });
    expect(await deleteFile(deps(), { userId: s.owner, isOfficer: true }, 999_999)).toEqual({ ok: false, reason: 'not_found' });
    expect(await deleteFile(deps(), { userId: s.owner, isOfficer: true }, -1)).toEqual({ ok: false, reason: 'not_found' });
    expect(await deleteFile(deps(), { userId: s.owner, isOfficer: true }, 1.5)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('en manipuleret storage_key kan ikke slette filer uden for mappen', async () => {
    const s = await seeded();
    const outside = path.join(root, 'udenfor.txt');
    await writeFile(outside, 'x');
    await db.update(files).set({ storageKey: '../udenfor.txt' }).where(eq(files.id, s.id));
    expect(await deleteFile(deps(), { userId: s.owner, isOfficer: false }, s.id)).toEqual({ ok: true });
    expect((await stat(outside)).isFile()).toBe(true);
  });
});

describe('setFilePinned', () => {
  it('kun officer kan fastgøre og frigøre', async () => {
    const u = await seedUser(db);
    const r = await upload(u, pad(PDF));
    if (!r.ok) throw new Error('upload fejlede');
    expect(await setFilePinned(db, { userId: u, isOfficer: false }, r.id, true)).toEqual({ ok: false, reason: 'forbidden' });
    expect(await setFilePinned(db, { userId: u, isOfficer: true }, r.id, true)).toEqual({ ok: true });
    expect((await db.select().from(files).where(eq(files.id, r.id)))[0].pinned).toBe(true);
    expect(await setFilePinned(db, { userId: u, isOfficer: true }, r.id, true)).toEqual({ ok: true });
    expect(await setFilePinned(db, { userId: u, isOfficer: true }, r.id, false)).toEqual({ ok: true });
    expect((await db.select().from(files).where(eq(files.id, r.id)))[0].pinned).toBe(false);
    expect(await setFilePinned(db, { userId: u, isOfficer: true }, 424242, true)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('slettede filer kan ikke fastgøres', async () => {
    const u = await seedUser(db);
    const r = await upload(u, pad(PDF));
    if (!r.ok) throw new Error('upload fejlede');
    await deleteFile(deps(), { userId: u, isOfficer: true }, r.id);
    expect(await setFilePinned(db, { userId: u, isOfficer: true }, r.id, true)).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('listFiles og getFile', () => {
  it('fastgjorte først, derefter nyeste; slettede og andre sektioner skjules', async () => {
    const u = await seedUser(db);
    const ids: number[] = [];
    for (const t of ['A', 'B', 'C', 'D']) {
      const r = await upload(u, pad(PNG), { title: t });
      if (!r.ok) throw new Error('upload fejlede');
      ids.push(r.id);
    }
    const base = new Date('2026-11-10T12:00:00Z').getTime();
    for (const [i, id] of ids.entries()) {
      await db.update(files).set({ createdAt: new Date(base + i * 60_000) }).where(eq(files.id, id));
    }
    const g = await upload(u, pad(PNG), { title: 'G', section: 'galleri' });
    expect(g.ok).toBe(true);
    await setFilePinned(db, { userId: u, isOfficer: true }, ids[0], true);
    await deleteFile(deps(), { userId: u, isOfficer: true }, ids[2]);
    const list = await listFiles(db, 'filer');
    expect(list.map((f) => f.title)).toEqual(['A', 'D', 'B']);
    expect(list[0]).toMatchObject({
      id: ids[0], section: 'filer', originalName: 'billede.png', mime: 'image/png', sizeBytes: 64, uploadedBy: u,
      uploaderName: 'Bruger d1', pinned: true,
    });
    expect(list[0].createdAt).toBeInstanceOf(Date);
    expect((await listFiles(db, 'galleri')).map((f) => f.title)).toEqual(['G']);
  });

  it('getFile returnerer metadata for levering og null for ukendt/slettet/ugyldigt id', async () => {
    const u = await seedUser(db);
    const r = await upload(u, pad(PNG, 80), { originalName: 'x.png' });
    if (!r.ok) throw new Error('upload fejlede');
    const f = await getFile(db, r.id);
    expect(f).toMatchObject({ id: r.id, mime: 'image/png', originalName: 'x.png', sizeBytes: 80 });
    expect(f?.storageKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(await getFile(db, 0)).toBeNull();
    expect(await getFile(db, Number.NaN)).toBeNull();
    expect(await getFile(db, 2 ** 31)).toBeNull();
  });
});

describe('cleanupStaleUploads', () => {
  const HOUR = 60 * 60 * 1000;
  const now = new Date('2026-11-10T12:00:00Z');
  const touch = async (name: string, ageMs: number) => {
    const p = path.join(uploadDir, name);
    await writeFile(p, 'x');
    const t = new Date(now.getTime() - ageMs);
    await utimes(p, t, t);
  };

  it('sletter kun gamle .upload-filer og rører intet andet', async () => {
    await mkdir(uploadDir, { recursive: true });
    await touch('.upload-gammel', 2 * HOUR);
    await touch('.upload-ny', 10 * 60 * 1000);
    await touch('0b0f4b3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b', 5 * 24 * HOUR);
    await touch('anden.txt', 5 * 24 * HOUR);
    await touch('x.upload-fejl', 5 * 24 * HOUR);
    await mkdir(path.join(uploadDir, '.upload-mappe'));
    const old = new Date(now.getTime() - 3 * HOUR);
    await utimes(path.join(uploadDir, '.upload-mappe'), old, old);
    await symlink(path.join(uploadDir, 'anden.txt'), path.join(uploadDir, '.upload-link'));

    expect(await cleanupStaleUploads(uploadDir, now, HOUR)).toBe(1);
    expect((await readdir(uploadDir)).sort()).toEqual(
      ['.upload-link', '.upload-mappe', '.upload-ny', '0b0f4b3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b', 'anden.txt', 'x.upload-fejl'].sort(),
    );
  });

  it('en manglende mappe er ikke en fejl', async () => {
    expect(await cleanupStaleUploads(path.join(root, 'findes-ikke'), now, HOUR)).toBe(0);
  });
});

describe('filer uden ejer (fra før Battle.net-login)', () => {
  it('vises med det gemte uploadernavn', async () => {
    await db.insert(files).values({
      section: 'filer', title: 'Gammel', originalName: 'a.png', mime: 'image/png', sizeBytes: 1, storageKey: 'k-old',
      uploadedBy: null, uploaderName: 'Magi Far',
    });
    const [f] = await listFiles(db, 'filer');
    expect(f).toMatchObject({ title: 'Gammel', uploadedBy: null, uploaderName: 'Magi Far' });
  });
});
