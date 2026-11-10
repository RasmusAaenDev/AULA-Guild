import { open } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import Busboy from '@fastify/busboy';
import type { Db } from '@/lib/db';
import { getFile, storagePath, storeUpload, type FileSection, type StorageDeps, type UploadFailure } from '@/lib/files';

/**
 * HTTP-laget for filer: multipart-parsing (streaming via @fastify/busboy), danske fejlbeskeder og
 * sikre svarheadere. Route-handlerne i app/api/filer klarer kun sessionstjekket og kalder herind.
 */

export type UploadError = UploadFailure | 'unauthorized' | 'bad_request';

/** Plads til multipart-grænser, feltnavne, titel og sektion ud over selve filen. */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

const STATUS: Record<UploadError, number> = {
  unauthorized: 401,
  bad_request: 400,
  invalid: 400,
  too_large: 413,
  bad_type: 422,
  quota: 507,
  io: 500,
};

export function uploadStatus(reason: UploadError): number {
  return STATUS[reason];
}

export function uploadErrorMessage(reason: UploadError, ctx: { maxBytes: number; section?: FileSection }): string {
  switch (reason) {
    case 'unauthorized':
      return 'Du skal være logget ind som medlem.';
    case 'bad_request':
      return 'Forespørgslen kunne ikke læses. Prøv igen fra formularen.';
    case 'invalid':
      return 'Tjek felterne. Vælg en fil og skriv en titel på højst 120 tegn.';
    case 'too_large':
      return `Filen er for stor. Den må højst fylde ${formatMb(ctx.maxBytes)} MB.`;
    case 'bad_type':
      return ctx.section === 'galleri'
        ? 'Filtypen er ikke tilladt. Galleriet tager kun billeder (PNG, JPEG, WebP eller GIF).'
        : 'Filtypen er ikke tilladt. Brug PNG, JPEG, WebP, GIF eller PDF.';
    case 'quota':
      return 'Der er ikke mere plads til filer. Bed en officer om at rydde op.';
    case 'io':
      return 'Upload mislykkedes. Prøv igen.';
  }
}

function formatMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? String(mb) : mb.toFixed(1).replace('.', ',');
}

export function uploadFailureResponse(reason: UploadError, ctx: { maxBytes: number; section?: FileSection }): Response {
  return Response.json(
    { ok: false, error: uploadErrorMessage(reason, ctx) },
    { status: uploadStatus(reason), headers: { 'Cache-Control': 'no-store' } },
  );
}

export function unauthorizedResponse(): Response {
  return Response.json(
    { ok: false, error: uploadErrorMessage('unauthorized', { maxBytes: 0 }) },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

const isSection = (s: string | undefined): s is FileSection => s === 'filer' || s === 'galleri';

type ParseResult = { ok: true; id: number } | { ok: false; reason: UploadError; section?: FileSection };

/**
 * Parser multipart som en strøm og sender filfeltet direkte videre til `storeUpload`, så filen aldrig
 * ligger helt i hukommelsen. Felterne `section` og `title` skal komme FØR `file` (browserens FormData
 * sender felterne i den rækkefølge, de er tilføjet/står i formularen).
 */
function parseAndStore(deps: StorageDeps, userId: number, contentType: string, body: ReadableStream<Uint8Array>): Promise<ParseResult> {
  return new Promise<ParseResult>((resolve) => {
    let settled = false;
    let fileSeen = false;
    const fields: { section?: string; title?: string; truncated?: boolean } = {};
    let input: Readable | undefined;
    let bb: ReturnType<typeof Busboy> | undefined;
    // Filstrømmen, mens storeUpload læser den. Fejl i parser/forespørgsel videresendes hertil, så
    // storeUpload altid slutter (og rydder sin midlertidige fil op) i stedet for at vente for evigt.
    let storing: Readable | undefined;
    let limitHit = false;

    const stopInput = () => {
      if (input && bb) input.unpipe(bb);
      input?.destroy();
    };

    const failParse = (reason: UploadError, err?: unknown) => {
      if (storing) storing.destroy(err instanceof Error ? err : new Error(String(reason)));
      else done({ ok: false, reason });
    };

    const done = (r: ParseResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
      // Resten af forespørgslen er uinteressant: stop parsingen og annullér request-strømmen.
      stopInput();
      bb?.destroy();
    };

    try {
      bb = Busboy({
        headers: { 'content-type': contentType },
        limits: {
          fieldNameSize: 32,
          fieldSize: 4096,
          fields: 2,
          files: 1,
          parts: 3,
          headerPairs: 20,
          // Én byte over grænsen, så storeUpload selv opdager overskridelsen og svarer too_large.
          fileSize: deps.maxBytes + 1,
        },
      });
    } catch {
      resolve({ ok: false, reason: 'bad_request' });
      return;
    }

    bb.on('field', (name, value, _nameTruncated, valueTruncated) => {
      if (name !== 'section' && name !== 'title') return;
      if (valueTruncated) fields.truncated = true;
      fields[name] = value;
    });

    bb.on('file', (name, file, filename) => {
      if (settled || fileSeen || name !== 'file') {
        file.resume();
        return;
      }
      fileSeen = true;
      const section = fields.section;
      if (!isSection(section) || fields.title === undefined || fields.truncated) {
        file.resume();
        done({ ok: false, reason: 'invalid' });
        return;
      }
      storing = file;
      // Busboy afkorter filen ved maxBytes + 1 bytes. Derefter læses der ikke mere fra forespørgslen:
      // de bufrede bytes er nok til, at storeUpload selv afgør too_large og rydder op.
      file.on('limit', () => {
        limitHit = true;
        stopInput();
      });
      const stream = Readable.toWeb(file) as unknown as ReadableStream<Uint8Array>;
      storeUpload(deps, { userId, section, title: fields.title, originalName: filename ?? '', stream, declaredLength: null })
        .then((r) => {
          if (r.ok) return done(r);
          done({ ok: false, reason: limitHit && r.reason === 'io' ? 'too_large' : r.reason, section });
        })
        .catch((err) => {
          console.error('Upload: uventet fejl', err);
          done({ ok: false, reason: 'io', section });
        });
    });

    bb.on('finish', () => {
      if (!fileSeen) done({ ok: false, reason: 'invalid' });
    });
    bb.on('error', (err) => failParse('bad_request', err));

    input = Readable.fromWeb(body as unknown as NodeWebReadableStream<Uint8Array>);
    input.on('error', (err) => failParse('io', err));
    input.pipe(bb);
  });
}

export async function handleUpload(deps: StorageDeps, userId: number, request: Request): Promise<Response> {
  const ctx = { maxBytes: deps.maxBytes };
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !request.body) return uploadFailureResponse('bad_request', ctx);

  // Første værn: en ærlig Content-Length over grænsen afvises uden at læse noget. Selve grænsen
  // håndhæves under streaming (Content-Length kan mangle eller lyve).
  const declared = request.headers.get('content-length');
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > deps.maxBytes + MULTIPART_OVERHEAD_BYTES) {
    await request.body.cancel().catch(() => {});
    return uploadFailureResponse('too_large', ctx);
  }

  const result = await parseAndStore(deps, userId, contentType, request.body);
  if (!result.ok) return uploadFailureResponse(result.reason, { ...ctx, section: result.section });
  return Response.json({ ok: true, id: result.id }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const EXTENSIONS: Record<string, string[]> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'application/pdf': ['.pdf'],
};

/** Visningsnavnet får altid en endelse, der passer til den faktiske type (aldrig "x.html" som PDF). */
export function downloadName(originalName: string, mime: string): string {
  const exts = EXTENSIONS[mime];
  if (!exts) return originalName;
  const lower = originalName.toLowerCase();
  return exts.some((e) => lower.endsWith(e)) ? originalName : originalName + exts[0];
}

/**
 * Content-Disposition med et ASCII-sikkert `filename` og et RFC 5987-kodet `filename*`.
 * Kontroltegn (inkl. CR/LF) fjernes, så headeren ikke kan splittes.
 */
export function contentDisposition(kind: 'inline' | 'attachment', name: string): string {
  const clean = name.replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, '');
  const fallback = clean.replace(/[^\x20-\x7e]/g, '_').replace(/["\\%;]/g, '_').trim() || 'fil';
  const encoded = encodeURIComponent(clean || 'fil').replace(
    /['()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function downloadHeaders(file: { mime: string; originalName: string }, size: number): Headers {
  const inline = INLINE_TYPES.has(file.mime);
  const known = inline || file.mime === 'application/pdf';
  return new Headers({
    'Content-Type': known ? file.mime : 'application/octet-stream',
    'Content-Length': String(size),
    'Content-Disposition': contentDisposition(inline ? 'inline' : 'attachment', downloadName(file.originalName, file.mime)),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=3600',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
}

function notFound(): Response {
  return Response.json({ error: 'Filen findes ikke.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

/** Leverer en fil som strøm fra disken. `rawId` er det rå segment fra URL'en. */
export async function handleDownload(deps: { db: Db; uploadDir: string }, rawId: string): Promise<Response> {
  if (!/^[1-9]\d{0,9}$/.test(rawId)) return notFound();
  const file = await getFile(deps.db, Number(rawId));
  if (!file) return notFound();
  const p = storagePath(deps.uploadDir, file.storageKey);
  if (!p) return notFound();

  let fh;
  try {
    fh = await open(p, 'r');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return notFound();
    console.error('Download: kan ikke åbne filen', err);
    return Response.json({ error: 'Filen kunne ikke hentes.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const st = await fh.stat();
    if (!st.isFile()) {
      await fh.close();
      return notFound();
    }
    const stream = fh.createReadStream(); // autoClose lukker filhåndtaget ved slut eller fejl
    const body = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
    return new Response(body, { status: 200, headers: downloadHeaders(file, st.size) });
  } catch (err) {
    await fh.close().catch(() => {});
    console.error('Download: fejl ved læsning', err);
    return Response.json({ error: 'Filen kunne ikke hentes.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
