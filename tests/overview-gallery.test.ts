import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { eq } from 'drizzle-orm';
import { characters, files, users } from '@/lib/db/schema';
import { galleryHeading, galleryImageUrl, recentGalleryItems } from '@/lib/overview-gallery';
import { GalleryItemCard } from '@/components/GalleryItemCard';
import { resetDb, testDb } from './db';
import { seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const now = new Date('2026-11-10T12:00:00Z');
const minAgo = (m: number) => new Date(now.getTime() - m * 60_000);
let n = 0;
async function img(userId: number, m: number, over: Partial<typeof files.$inferInsert> = {}) {
  n++;
  const [f] = await db
    .insert(files)
    .values({ section: 'galleri', title: `Billede ${n}`, originalName: `b${n}.png`, mime: 'image/png', sizeBytes: 10, storageKey: `k-${n}-${Math.random()}`, uploadedBy: userId, createdAt: minAgo(m), ...over })
    .returning();
  return f;
}

describe('recentGalleryItems', () => {
  it('giver tom liste uden billeder', async () => {
    expect(await recentGalleryItems({ db }, now)).toEqual([]);
  });
  it('samler samme brugers billeder inden for 60 min i ét kort, og deler ved længere pause', async () => {
    const u = await seedUser(db);
    await img(u, 10);
    await img(u, 40);
    await img(u, 90); // 50 min efter forrige: samme gruppe
    await img(u, 200); // 110 min pause: nyt kort
    const out = await recentGalleryItems({ db }, now);
    expect(out.map((i) => i.count)).toEqual([3, 1]);
    expect(out[0]).toMatchObject({ uploader: 'Bruger d1', at: minAgo(10), href: '/galleri' });
  });
  it('to brugere giver to kort', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    await img(a, 5);
    await img(b, 6);
    const out = await recentGalleryItems({ db }, now);
    expect(out.map((i) => i.uploader)).toEqual(['Bruger a', 'Bruger b']);
  });
  it('bruger aktiv karakters fulde navn', async () => {
    const u = await seedUser(db);
    const [ch] = await db.insert(characters).values({ blizzardId: 1, slug: 'ragnar-storm', name: 'Ragnar', surname: 'Storm', className: 'Mage', role: 'dps', userId: u }).returning();
    await db.update(users).set({ activeCharacterId: ch.id }).where(eq(users.id, u));
    await img(u, 5);
    expect((await recentGalleryItems({ db }, now))[0].uploader).toBe('Ragnar Storm');
  });
  it('holder 7-dages grænsen', async () => {
    const u = await seedUser(db);
    await img(u, 7 * 24 * 60 + 1);
    expect(await recentGalleryItems({ db }, now)).toEqual([]);
    await img(u, 7 * 24 * 60 - 1);
    expect((await recentGalleryItems({ db }, now))[0].count).toBe(1);
  });
  it('tager kun billeder i galleriet: ikke PDF, ikke Filer-sektionen, ikke slettede', async () => {
    const u = await seedUser(db);
    await img(u, 5, { mime: 'application/pdf' });
    await img(u, 6, { section: 'filer' });
    await img(u, 7, { deletedAt: minAgo(1) });
    await img(u, 8, { mime: 'image/svg+xml' });
    expect(await recentGalleryItems({ db }, now)).toEqual([]);
    const ok = await img(u, 9);
    const out = await recentGalleryItems({ db }, now);
    expect(out).toHaveLength(1);
    expect(out[0].thumbs[0].id).toBe(ok.id);
  });
  it('giver højst 3 kort og højst 4 miniaturer, men korrekt antal', async () => {
    const u = await seedUser(db);
    for (let i = 0; i < 6; i++) await img(u, 5 + i);
    for (const name of ['a', 'b', 'c']) await img(await seedUser(db, name), 30);
    const out = await recentGalleryItems({ db }, now);
    expect(out).toHaveLength(3);
    expect(out[0].count).toBe(6);
    expect(out[0].thumbs).toHaveLength(4);
    expect(out[0].thumbs[0].name).toBe(`Billede ${n - 3 - 5}`);
  });
  it('giver tom liste ved fejl', async () => {
    const broken = { select: () => { throw new Error('db nede'); } } as unknown as typeof db;
    expect(await recentGalleryItems({ db: broken }, now)).toEqual([]);
  });
});

describe('GalleryItemCard', () => {
  const base = { id: '1-5', uploaderId: 1, at: minAgo(5), href: '/galleri' as const };
  it('ental og flertal i overskriften', () => {
    expect(galleryHeading('Ragnar', 1)).toBe('Ragnar tilføjede 1 billede');
    expect(galleryHeading('Ragnar', 5)).toBe('Ragnar tilføjede 5 billeder');
  });
  it('bruger Galleris egen billed-rute, lazy img og link til /galleri', () => {
    const html = renderToStaticMarkup(createElement(GalleryItemCard, { item: { ...base, uploader: 'Ragnar', count: 2, thumbs: [{ id: 7, name: 'Fest', alt: null }, { id: 8, name: '', alt: null }] }, now }));
    expect(galleryImageUrl(7)).toBe('/api/filer/7');
    expect(html).toContain('src="/api/filer/7"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('alt="Fest"');
    expect(html).toContain('alt="Billede"');
    expect(html).toContain('href="/galleri"');
    expect(html).toContain('Se i Galleri');
    expect(html).toContain('Ragnar tilføjede 2 billeder');
  });
  it('escaper HTML i navne og filnavne', () => {
    const evil = '<script>alert(1)</script>"><img src=x onerror=y>';
    const html = renderToStaticMarkup(createElement(GalleryItemCard, { item: { ...base, uploader: evil, count: 1, thumbs: [{ id: 1, name: evil, alt: evil }] }, now }));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });
});
