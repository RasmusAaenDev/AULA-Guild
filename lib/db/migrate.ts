import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { Db } from './index';

export async function runMigrations(db: Db, folder = path.join(process.cwd(), 'drizzle')): Promise<void> {
  await migrate(db, { migrationsFolder: folder });
}
