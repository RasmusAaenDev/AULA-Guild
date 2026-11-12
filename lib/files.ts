import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readdir, rename, rm, type FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { files, fileSections, users } from '@/lib/db/schema';

export type FileSection = 'filer' | 'galleri';
export type DetectedType = { mime: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'application/pdf' };
export type StorageDeps = { db: Db; uploadDir: string; maxBytes: number; maxTotalBytes: number };
export type FileActor = { userId: number; isOfficer: boolean };
export type FileItem = {
  id: number;
  section: FileSection;
  title: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  /** Null for filer uden ejer (fra før Battle.net-login); så er uploaderName det gemte navn. */
  uploadedBy: number | null;
  uploaderName: string;
  pinned: boolean;
  createdAt: Date;
};
export type UploadFailure = 'invalid' | 'too_large' | 'quota' | 'bad_type' | 'io';

const TITLE_MAX = 120;
const NAME_MAX = 120;
const HEAD_BYTES = 12;
/** Fast nøgle til pg_advisory_xact_lock, så kvotetjek + insert ikke kan overhales af en samtidig upload. */
const QUOTA_LOCK_KEY = 0x41554c46; // "AULF"
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
const STORAGE_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const validId = (id: number) => Number.isInteger(id) && id > 0 && id <= 2147483647;
const isSection = (s: unknown): s is FileSection => (fileSections as readonly unknown[]).includes(s);

function startsWith(head: Uint8Array, sig: readonly number[], offset = 0): boolean {
  if (head.length < offset + sig.length) return false;
  return sig.every((b, i) => head[offset + i] === b);
}
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Typen afgøres udelukkende af de første bytes. Alt andet (SVG, HTML, ZIP, ...) giver null. */
export function detectType(head: Uint8Array): DetectedType | null {
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png' };
  if (startsWith(head, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg' };
  if (startsWith(head, ascii('GIF87a')) || startsWith(head, ascii('GIF89a'))) return { mime: 'image/gif' };
  if (startsWith(head, ascii('RIFF')) && startsWith(head, ascii('WEBP'), 8)) return { mime: 'image/webp' };
  if (startsWith(head, ascii('%PDF-'))) return { mime: 'application/pdf' };
  return null;
}

/** Galleri: kun billeder. Filer: billeder og PDF. */
export function allowedInSection(section: FileSection, mime: string): boolean {
  if (!isSection(section)) return false;
  if ((IMAGE_TYPES as readonly string[]).includes(mime)) return true;
  return section === 'filer' && mime === 'application/pdf';
}

/**
 * Renser klientens filnavn til ren visningsmetadata: kun sidste stiled, ingen kontrol-, format- (bl.a.
 * retningstegn og nulbredde) eller ensomme surrogattegn, ingen Windows-reserverede tegn, ingen indledende
 * punktummer, højst 120 tegn (endelsen bevares). Bruges aldrig til at bygge en sti.
 */
export function sanitizeFileName(name: string): string {
  let s = String(name).replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, '').normalize('NFC');
  s = s.split(/[\\/]/).pop() ?? '';
  s = s.replace(/[<>:"|?*]/g, '_');
  s = s.trim().replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
  const chars = [...s];
  if (chars.length > NAME_MAX) {
    const ext = /\.[^.\s]{1,10}$/.exec(s)?.[0] ?? '';
    s = chars.slice(0, NAME_MAX - ext.length).join('').trimEnd() + ext;
  }
  return s === '' ? 'fil' : s;
}

function resolveTitle(title: string, originalName: string): string | null {
  if (typeof title !== 'string' || title.includes('\u0000')) return null;
  let t = title.replace(/[\p{Cc}‪-‮⁦-⁩]/gu, ' ').trim();
  if (t === '') {
    const dot = originalName.lastIndexOf('.');
    t = (dot > 0 ? originalName.slice(0, dot) : originalName).trim() || 'fil';
  }
  const n = [...t].length;
  return n >= 1 && n <= TITLE_MAX ? t : null;
}

/** Sti til en lagret fil, eller null hvis nøglen ikke har serverens eget format (forsvar i dybden). */
export function storagePath(uploadDir: string, storageKey: string): string | null {
  return STORAGE_KEY_RE.test(storageKey) ? path.join(uploadDir, storageKey) : null;
}

async function writeAll(fh: FileHandle, chunk: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < chunk.byteLength) {
    const { bytesWritten } = await fh.write(chunk, offset, chunk.byteLength - offset);
    offset += bytesWritten;
  }
}

export async function storeUpload(
  deps: StorageDeps,
  input: {
    userId: number;
    section: FileSection;
    title: string;
    originalName: string;
    stream: ReadableStream<Uint8Array>;
    declaredLength: number | null;
  },
): Promise<{ ok: true; id: number } | { ok: false; reason: UploadFailure }> {
  const { stream } = input;
  const reject = async (reason: UploadFailure) => {
    await stream.cancel().catch(() => {});
    return { ok: false as const, reason };
  };

  if (!isSection(input.section) || !validId(input.userId)) return reject('invalid');
  const originalName = sanitizeFileName(input.originalName);
  const title = resolveTitle(input.title, originalName);
  if (title === null) return reject('invalid');
  if (input.declaredLength !== null && input.declaredLength > deps.maxBytes) return reject('too_large');

  try {
    await mkdir(deps.uploadDir, { recursive: true, mode: 0o700 });
  } catch (err) {
    console.error('Upload: kan ikke oprette upload-mappen', err);
    return reject('io');
  }

  // Midlertidig fil i samme mappe, så den endelige omdøbning er atomisk. Navnet er serverens eget.
  const tmp = path.join(deps.uploadDir, `.upload-${randomUUID()}`);
  const reader = stream.getReader();
  const head = new Uint8Array(HEAD_BYTES);
  let headLen = 0;
  let size = 0;
  let failure: UploadFailure | null = null;
  let fh: FileHandle | undefined;
  try {
    fh = await open(tmp, 'wx', 0o600);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > deps.maxBytes) {
        failure = 'too_large';
        break;
      }
      if (headLen < HEAD_BYTES) {
        const take = value.subarray(0, HEAD_BYTES - headLen);
        head.set(take, headLen);
        headLen += take.byteLength;
      }
      await writeAll(fh, value);
    }
  } catch (err) {
    console.error('Upload: fejl under modtagelse', err);
    failure = 'io';
  } finally {
    if (failure) await reader.cancel().catch(() => {});
    reader.releaseLock();
    await fh?.close().catch(() => {});
  }

  const cleanup = () => rm(tmp, { force: true }).catch(() => {});
  if (failure) {
    await cleanup();
    return { ok: false, reason: failure };
  }

  const type = detectType(head.subarray(0, headLen));
  if (!type || !allowedInSection(input.section, type.mime)) {
    await cleanup();
    return { ok: false, reason: 'bad_type' };
  }

  const storageKey = randomUUID();
  const finalPath = path.join(deps.uploadDir, storageKey);
  let moved = false;
  try {
    const id = await deps.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${QUOTA_LOCK_KEY})`);
      const [{ total }] = await tx
        .select({ total: sql<string>`coalesce(sum(${files.sizeBytes}), 0)::bigint` })
        .from(files)
        .where(isNull(files.deletedAt));
      if (Number(total) + size > deps.maxTotalBytes) return null;
      await rename(tmp, finalPath);
      moved = true;
      const [row] = await tx
        .insert(files)
        .values({
          section: input.section,
          title,
          originalName,
          mime: type.mime,
          sizeBytes: size,
          storageKey,
          uploadedBy: input.userId,
        })
        .returning({ id: files.id });
      return row.id;
    });
    if (id === null) {
      await cleanup();
      return { ok: false, reason: 'quota' };
    }
    return { ok: true, id };
  } catch (err) {
    console.error('Upload: kunne ikke gemme filen', err);
    await cleanup();
    if (moved) await rm(finalPath, { force: true }).catch(() => {});
    return { ok: false, reason: 'io' };
  }
}

export async function deleteFile(
  deps: Pick<StorageDeps, 'db' | 'uploadDir'>,
  actor: FileActor,
  fileId: number,
): Promise<{ ok: true } | { ok: false; reason: 'forbidden' | 'not_found' }> {
  if (!validId(fileId)) return { ok: false, reason: 'not_found' };
  const [f] = await deps.db
    .select({ uploadedBy: files.uploadedBy })
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)));
  if (!f) return { ok: false, reason: 'not_found' };
  if (!actor.isOfficer && f.uploadedBy !== actor.userId) return { ok: false, reason: 'forbidden' };
  const [deleted] = await deps.db
    .update(files)
    .set({ deletedAt: new Date() })
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)))
    .returning({ storageKey: files.storageKey });
  if (!deleted) return { ok: false, reason: 'not_found' };
  const p = storagePath(deps.uploadDir, deleted.storageKey);
  if (p) {
    // force: en fil der allerede mangler på disken er ikke en fejl.
    await rm(p, { force: true }).catch((err) => console.error('Sletning: kunne ikke fjerne filen fra disken', err));
  }
  return { ok: true };
}

export async function setFilePinned(
  db: Db,
  actor: FileActor,
  fileId: number,
  pinned: boolean,
): Promise<{ ok: true } | { ok: false; reason: 'forbidden' | 'not_found' }> {
  if (!validId(fileId)) return { ok: false, reason: 'not_found' };
  const [f] = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)));
  if (!f) return { ok: false, reason: 'not_found' };
  if (!actor.isOfficer) return { ok: false, reason: 'forbidden' };
  await db
    .update(files)
    .set({ pinned })
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)));
  return { ok: true };
}

/** Fastgjorte først, derefter nyeste. Slettede filer er skjult. */
export async function listFiles(db: Db, section: FileSection): Promise<FileItem[]> {
  if (!isSection(section)) return [];
  return db
    .select({
      id: files.id,
      section: files.section,
      title: files.title,
      originalName: files.originalName,
      mime: files.mime,
      sizeBytes: files.sizeBytes,
      uploadedBy: files.uploadedBy,
      uploaderName: sql<string>`coalesce(${users.name}, ${files.uploaderName}, 'Ukendt')`,
      pinned: files.pinned,
      createdAt: files.createdAt,
    })
    .from(files)
    .leftJoin(users, eq(users.id, files.uploadedBy))
    .where(and(eq(files.section, section), isNull(files.deletedAt)))
    .orderBy(desc(files.pinned), desc(files.createdAt), desc(files.id));
}

export async function getFile(
  db: Db,
  id: number,
): Promise<{ id: number; mime: string; originalName: string; storageKey: string; sizeBytes: number } | null> {
  if (!validId(id)) return null;
  const [f] = await db
    .select({
      id: files.id,
      mime: files.mime,
      originalName: files.originalName,
      storageKey: files.storageKey,
      sizeBytes: files.sizeBytes,
    })
    .from(files)
    .where(and(eq(files.id, id), isNull(files.deletedAt)));
  return f ?? null;
}

/**
 * Sletter efterladte midlertidige uploadfiler (`.upload-*`, almindelige filer) der er ældre end `maxAgeMs`.
 * Rører aldrig andre filer. En manglende mappe er ikke en fejl. Returnerer antal slettede.
 */
export async function cleanupStaleUploads(uploadDir: string, now: Date, maxAgeMs: number): Promise<number> {
  let entries;
  try {
    entries = await readdir(uploadDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw err;
  }
  let removed = 0;
  for (const e of entries) {
    if (!e.isFile() || !e.name.startsWith('.upload-')) continue;
    const p = path.join(uploadDir, e.name);
    try {
      const st = await lstat(p);
      if (!st.isFile() || now.getTime() - st.mtimeMs <= maxAgeMs) continue;
      await rm(p, { force: true });
      removed++;
    } catch (err) {
      console.error('Oprydning: kunne ikke fjerne', e.name, err);
    }
  }
  return removed;
}
