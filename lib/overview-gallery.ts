// Nye billeder fra Galleri som kort i Overblik. Må aldrig vælte siden: enhver fejl giver tom liste.

import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { characters, files, users } from '@/lib/db/schema';
import { fullName } from '@/lib/names';

export type GalleryThumb = { id: number; name: string; alt: string | null };
export type GalleryItem = {
  /** Stabil nøgle: uploader + nyeste billedes id. */
  id: string;
  uploaderId: number;
  uploader: string;
  at: Date;
  count: number;
  thumbs: GalleryThumb[];
  href: '/galleri';
};

export const GALLERY_MAX_ITEMS = 3;
export const GALLERY_MAX_THUMBS = 4;
export const GALLERY_WINDOW_DAYS = 7;
export const GALLERY_GROUP_GAP_MS = 60 * 60_000;
export const GALLERY_FETCH_LIMIT = 60;
/** Samme billedtyper som Galleri accepterer (se allowedInSection i lib/files.ts). */
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Den autentificerede rute, Galleri selv bruger til både miniature og original. */
export function galleryImageUrl(id: number): string {
  return `/api/filer/${id}`;
}

export function galleryHeading(uploader: string, count: number): string {
  return `${uploader} tilføjede ${count} ${count === 1 ? 'billede' : 'billeder'}`;
}

/** Højst 3 kort fra de seneste 7 dage: samme uploaders billeder med højst 60 min mellem hinanden. Fejl giver tom liste. */
export async function recentGalleryItems(deps: { db: Db }, now: Date): Promise<GalleryItem[]> {
  try {
    const since = new Date(now.getTime() - GALLERY_WINDOW_DAYS * 86_400_000);
    const rows = await deps.db
      .select({
        id: files.id,
        title: files.title,
        uploadedBy: files.uploadedBy,
        createdAt: files.createdAt,
        userName: users.name,
        charName: characters.name,
        charSurname: characters.surname,
        charSlug: characters.slug,
      })
      .from(files)
      .innerJoin(users, eq(users.id, files.uploadedBy))
      .leftJoin(characters, and(eq(characters.id, users.activeCharacterId), eq(characters.userId, users.id)))
      .where(and(eq(files.section, 'galleri'), isNull(files.deletedAt), inArray(files.mime, IMAGE_MIMES), gt(files.createdAt, since)))
      .orderBy(desc(files.createdAt), desc(files.id))
      .limit(GALLERY_FETCH_LIMIT);

    const byUser = new Map<number, typeof rows>();
    for (const r of rows) {
      if (r.createdAt.getTime() > now.getTime() + 60_000) continue;
      const list = byUser.get(r.uploadedBy) ?? [];
      list.push(r);
      byUser.set(r.uploadedBy, list);
    }
    const items: GalleryItem[] = [];
    for (const list of byUser.values()) {
      let group: typeof rows = [];
      const flush = () => {
        if (group.length === 0) return;
        const first = group[0];
        const uploader =
          first.charName !== null && first.charSlug !== null
            ? fullName({ name: first.charName, surname: first.charSurname, slug: first.charSlug })
            : first.userName;
        items.push({
          id: `${first.uploadedBy}-${first.id}`,
          uploaderId: first.uploadedBy,
          uploader,
          at: first.createdAt,
          count: group.length,
          thumbs: group.slice(0, GALLERY_MAX_THUMBS).map((g) => ({ id: g.id, name: g.title, alt: null })),
          href: '/galleri',
        });
        group = [];
      };
      for (const r of list) {
        if (group.length > 0 && group[group.length - 1].createdAt.getTime() - r.createdAt.getTime() > GALLERY_GROUP_GAP_MS) flush();
        group.push(r);
      }
      flush();
    }
    items.sort((a, b) => b.at.getTime() - a.at.getTime() || b.id.localeCompare(a.id));
    return items.slice(0, GALLERY_MAX_ITEMS);
  } catch {
    return [];
  }
}
