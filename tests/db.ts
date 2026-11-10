import { sql } from 'drizzle-orm';
import { createDb, type Db } from '@/lib/db';

export function testDb(): { db: Db; close: () => Promise<void> } {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL mangler');
  return createDb(url);
}

export async function resetDb(db: Db): Promise<void> {
  await db.execute(sql`truncate table files, post_bookmarks, post_reads, comments, posts, rsvps, events, event_series, characters, users restart identity cascade`);
}
