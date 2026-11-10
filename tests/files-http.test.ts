import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  contentDisposition, downloadHeaders, downloadName, handleDownload, handleUpload, uploadErrorMessage, uploadStatus,
} from '@/lib/files-http';
import { deleteFile, getFile, type StorageDeps } from '@/lib/files';
import { files } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { seedUser } from './helpers';

const { db, close } = testDb();
let root: string;
let uploadDir: string;

beforeEach(async () => {
  await resetDb(db);
  root = await mkdtemp(path.join(os.tmpdir(), 'aula-files-http-'));
  uploadDir = path.join(root, 'uploads');
});
afterEach(() => rm(root, { recursive: true, force: true }));
afterAll(() => close());

const deps = (over: Partial<StorageDeps> = {}): StorageDeps => ({
  db, uploadDir, maxBytes: 10_000, maxTotalBytes: 100_000, ...over,
});

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (size = 200) => {
  const b = new Uint8Array(size);
  b.set(PNG_HEAD);
  return b;
};
const pdf = (size = 200) => {
  const b = new Uint8Array(size);
  b.set(Buffer.from('%PDF-1.7'));
  return b;
};

function formRequest(parts: [string, string | Blob, string?][]): Request {
  const fd = new FormData();
  for (const [k, v, name] of parts) {
    if (typeof v === 'string') fd.append(k, v);
    else fd.append(k, v, name);
  }
  return new Request('http://localhost/api/filer', { method: 'POST', body: fd });
}

async function entries(): Promise<string[]> {
  try {
    return await readdir(uploadDir);
  } catch {
    return [];
  }
}

describe('uploadStatus og uploadErrorMessage', () => {
  it('giver passende statuskoder', () => {
    expect(uploadStatus('unauthorized')).toBe(401);
    expect(uploadStatus('bad_request')).toBe(400);
    expect(uploadStatus('invalid')).toBe(400);
    expect(uploadStatus('too_large')).toBe(413);
    expect(uploadStatus('bad_type')).toBe(422);
    expect(uploadStatus('quota')).toBe(507);
    expect(uploadStatus('io')).toBe(500);
  });

  it('giver danske beskeder med grænsen og sektionens tilladte typer', () => {
    expect(uploadErrorMessage('too_large', { maxBytes: 10 * 1024 * 1024 })).toBe('Filen er for stor. Den må højst fylde 10 MB.');
    expect(uploadErrorMessage('too_large', { maxBytes: 1.5 * 1024 * 1024 })).toContain('1,5 MB');
    expect(uploadErrorMessage('bad_type', { maxBytes: 1, section: 'galleri' })).toContain('kun billeder');
    expect(uploadErrorMessage('bad_type', { maxBytes: 1, section: 'filer' })).toContain('PDF');
    expect(uploadErrorMessage('quota', { maxBytes: 1 })).toContain('plads');
    expect(uploadErrorMessage('io', { maxBytes: 1 })).toBe('Upload mislykkedes. Prøv igen.');
    expect(uploadErrorMessage('unauthorized', { maxBytes: 1 })).toContain('logget ind');
    expect(uploadErrorMessage('invalid', { maxBytes: 1 })).toContain('titel');
  });
});

describe('downloadName og contentDisposition', () => {
  it('sikrer en endelse der passer til typen', () => {
    expect(downloadName('guide.pdf', 'application/pdf')).toBe('guide.pdf');
    expect(downloadName('guide.PDF', 'application/pdf')).toBe('guide.PDF');
    expect(downloadName('ond.html', 'application/pdf')).toBe('ond.html.pdf');
    expect(downloadName('billede.jpeg', 'image/jpeg')).toBe('billede.jpeg');
    expect(downloadName('billede', 'image/jpeg')).toBe('billede.jpg');
  });

  it('kan ikke splitte headeren og koder ikke-ASCII efter RFC 5987', () => {
    const h = contentDisposition('attachment', 'a"b\r\nSet-Cookie: x=1;\u0000.pdf');
    expect(h).not.toMatch(/[\r\n\u0000]/);
    expect(h).toBe(`attachment; filename="a_bSet-Cookie: x=1_.pdf"; filename*=UTF-8''a%22bSet-Cookie%3A%20x%3D1%3B.pdf`);
    expect(contentDisposition('inline', 'Ærø (1).png')).toBe(
      `inline; filename="_r_ (1).png"; filename*=UTF-8''%C3%86r%C3%B8%20%281%29.png`,
    );
    expect(contentDisposition('inline', '‮gnp.exe')).toBe(`inline; filename="gnp.exe"; filename*=UTF-8''gnp.exe`);
    expect(contentDisposition('inline', '')).toBe(`inline; filename="fil"; filename*=UTF-8''fil`);
    // Alle header-værdier skal kunne sættes uden at Headers kaster
    expect(() => new Headers({ 'Content-Disposition': contentDisposition('inline', 'ø\uD800\n😀') })).not.toThrow();
  });

  it('downloadHeaders: billeder inline, PDF som vedhæftning, aldrig ukendt type', () => {
    const img = downloadHeaders({ mime: 'image/png', originalName: 'a.png' }, 123);
    expect(img.get('content-type')).toBe('image/png');
    expect(img.get('content-length')).toBe('123');
    expect(img.get('content-disposition')).toMatch(/^inline; /);
    expect(img.get('x-content-type-options')).toBe('nosniff');
    expect(img.get('cache-control')).toBe('private, max-age=3600');
    expect(img.get('content-security-policy')).toContain('sandbox');
    const doc = downloadHeaders({ mime: 'application/pdf', originalName: 'a.pdf' }, 1);
    expect(doc.get('content-disposition')).toMatch(/^attachment; /);
    const odd = downloadHeaders({ mime: 'text/html', originalName: 'a.html' }, 1);
    expect(odd.get('content-type')).toBe('application/octet-stream');
    expect(odd.get('content-disposition')).toMatch(/^attachment; /);
  });
});

describe('handleUpload', () => {
  it('gemmer en fil fra multipart og svarer 201 { ok, id }', async () => {
    const u = await seedUser(db);
    const res = await handleUpload(deps(), u, formRequest([
      ['section', 'galleri'], ['title', 'Boss kill'], ['file', new Blob([png(300)], { type: 'image/svg+xml' }), '../x.png'],
    ]));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ ok: true, id: expect.any(Number) });
    const [row] = await db.select().from(files).where(eq(files.id, body.id));
    // Klientens MIME (image/svg+xml) ignoreres; typen kommer fra indholdet.
    expect(row).toMatchObject({ section: 'galleri', title: 'Boss kill', originalName: 'x.png', mime: 'image/png', sizeBytes: 300 });
    expect(await entries()).toEqual([row.storageKey]);
  });

  it('afviser når filen kommer før felterne', async () => {
    const u = await seedUser(db);
    const res = await handleUpload(deps(), u, formRequest([
      ['file', new Blob([png()]), 'x.png'], ['section', 'filer'], ['title', 't'],
    ]));
    expect(res.status).toBe(400);
    expect((await res.json()).ok).toBe(false);
    expect(await entries()).toEqual([]);
  });

  it('afviser manglende fil, ukendt sektion og ikke-multipart', async () => {
    const u = await seedUser(db);
    expect((await handleUpload(deps(), u, formRequest([['section', 'filer'], ['title', 't']]))).status).toBe(400);
    expect((await handleUpload(deps(), u, formRequest([
      ['section', 'privat'], ['title', 't'], ['file', new Blob([png()]), 'x.png'],
    ]))).status).toBe(400);
    const json = new Request('http://localhost/api/filer', {
      method: 'POST', body: '{}', headers: { 'content-type': 'application/json' },
    });
    const res = await handleUpload(deps(), u, json);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Forespørgslen kunne ikke læses. Prøv igen fra formularen.' });
    const noBoundary = new Request('http://localhost/api/filer', {
      method: 'POST', body: 'x', headers: { 'content-type': 'multipart/form-data; foo=bar' },
    });
    expect((await handleUpload(deps(), u, noBoundary)).status).toBe(400);
    expect(await db.select().from(files)).toHaveLength(0);
  });

  it('afviser forkert type med sektionens besked (422)', async () => {
    const u = await seedUser(db);
    const res = await handleUpload(deps(), u, formRequest([
      ['section', 'galleri'], ['title', 't'], ['file', new Blob([pdf()], { type: 'image/png' }), 'x.png'],
    ]));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain('kun billeder');
    expect(await entries()).toEqual([]);
  });

  it('afviser for stor Content-Length straks med 413', async () => {
    const u = await seedUser(db);
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        pulled += 1;
        c.enqueue(new Uint8Array(1024));
      },
    });
    const req = new Request('http://localhost/api/filer', {
      method: 'POST', body, duplex: 'half',
      headers: { 'content-type': 'multipart/form-data; boundary=xyz', 'content-length': String(10_000 + 64 * 1024 + 1) },
    } as RequestInit);
    const res = await handleUpload(deps(), u, req);
    expect(res.status).toBe(413);
    expect((await res.json()).error).toContain('for stor');
    expect(pulled).toBeLessThanOrEqual(2);
    expect(await entries()).toEqual([]);
  });

  it('håndhæver grænsen under streaming uden Content-Length og rydder op', async () => {
    const u = await seedUser(db);
    const enc = new TextEncoder();
    const preamble = enc.encode(
      '--b0undary\r\nContent-Disposition: form-data; name="section"\r\n\r\nfiler\r\n' +
      '--b0undary\r\nContent-Disposition: form-data; name="title"\r\n\r\nstor\r\n' +
      '--b0undary\r\nContent-Disposition: form-data; name="file"; filename="stor.png"\r\nContent-Type: image/png\r\n\r\n',
    );
    let sent = 0;
    let first = true;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (first) {
          first = false;
          c.enqueue(preamble);
          c.enqueue(png(1024));
          return;
        }
        if (sent > 50_000_000) return c.close(); // sikkerhedsnet: testen må ikke hænge
        sent += 4096;
        c.enqueue(new Uint8Array(4096));
      },
    });
    const req = new Request('http://localhost/api/filer', {
      method: 'POST', body, duplex: 'half', headers: { 'content-type': 'multipart/form-data; boundary=b0undary' },
    } as RequestInit);
    const res = await handleUpload(deps(), u, req);
    expect(res.status).toBe(413);
    expect(sent).toBeLessThan(200_000);
    expect(await entries()).toEqual([]);
    expect(await db.select().from(files)).toHaveLength(0);
  });

  it('en afbrudt upload (forbindelsen dør midt i filen) hænger ikke og efterlader intet', async () => {
    const u = await seedUser(db);
    const enc = new TextEncoder();
    const preamble = enc.encode(
      '--b0undary\r\nContent-Disposition: form-data; name="section"\r\n\r\nfiler\r\n' +
      '--b0undary\r\nContent-Disposition: form-data; name="title"\r\n\r\nafbrudt\r\n' +
      '--b0undary\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\n\r\n',
    );
    for (const ending of ['error', 'close'] as const) {
      let step = 0;
      const body = new ReadableStream<Uint8Array>({
        pull(c) {
          step += 1;
          if (step === 1) return c.enqueue(preamble);
          if (step === 2) return c.enqueue(png(3000));
          if (ending === 'error') c.error(new Error('forbindelsen røg'));
          else c.close();
        },
      });
      const req = new Request('http://localhost/api/filer', {
        method: 'POST', body, duplex: 'half', headers: { 'content-type': 'multipart/form-data; boundary=b0undary' },
      } as RequestInit);
      const res = await handleUpload(deps(), u, req);
      expect(res.status, ending).toBeGreaterThanOrEqual(400);
      expect((await res.json()).ok).toBe(false);
      expect(await entries()).toEqual([]);
    }
    expect(await db.select().from(files)).toHaveLength(0);
  });

  it('svarer 507 når kvoten er brugt', async () => {
    const u = await seedUser(db);
    const d = deps({ maxTotalBytes: 500 });
    const ok = await handleUpload(d, u, formRequest([['section', 'filer'], ['title', 'a'], ['file', new Blob([png(400)]), 'a.png']]));
    expect(ok.status).toBe(201);
    const full = await handleUpload(d, u, formRequest([['section', 'filer'], ['title', 'b'], ['file', new Blob([png(200)]), 'b.png']]));
    expect(full.status).toBe(507);
    expect(await entries()).toHaveLength(1);
  });
});

describe('handleDownload', () => {
  async function uploaded(section: 'filer' | 'galleri', data: Uint8Array<ArrayBuffer>, name: string) {
    const u = await seedUser(db, `u${Math.random()}`);
    const res = await handleUpload(deps(), u, formRequest([['section', section], ['title', 't'], ['file', new Blob([data]), name]]));
    const { id } = await res.json();
    return { u, id: id as number };
  }

  it('streamer et billede inline med sikre headere', async () => {
    const data = png(5000);
    const { id } = await uploaded('galleri', data, 'skærm.png');
    const res = await handleDownload({ db, uploadDir }, String(id));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('content-length')).toBe('5000');
    expect(res.headers.get('content-disposition')).toBe(`inline; filename="sk_rm.png"; filename*=UTF-8''sk%C3%A6rm.png`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('cache-control')).toBe('private, max-age=3600');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(data);
  });

  it('leverer PDF som vedhæftning', async () => {
    const { id } = await uploaded('filer', pdf(400), 'regler');
    const res = await handleDownload({ db, uploadDir }, String(id));
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toBe(`attachment; filename="regler.pdf"; filename*=UTF-8''regler.pdf`);
    await res.arrayBuffer();
  });

  it('404 for ugyldigt, ukendt, slettet id og manglende fil på disken', async () => {
    const { u, id } = await uploaded('filer', pdf(), 'a.pdf');
    for (const raw of ['abc', '1abc', '../1', '01', '0', '-1', '99999999999', '424242']) {
      const res = await handleDownload({ db, uploadDir }, raw);
      expect(res.status, raw).toBe(404);
      expect(await res.json()).toEqual({ error: 'Filen findes ikke.' });
    }
    const f = await getFile(db, id);
    if (!f) throw new Error('mangler');
    await rm(path.join(uploadDir, f.storageKey));
    expect((await handleDownload({ db, uploadDir }, String(id))).status).toBe(404);
    await deleteFile({ db, uploadDir }, { userId: u, isOfficer: false }, id);
    expect((await handleDownload({ db, uploadDir }, String(id))).status).toBe(404);
  });
});
