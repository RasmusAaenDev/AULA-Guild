import { createDb } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL mangler. Start dev-databasen: docker compose -f docker-compose.dev.yml up -d');
  const { db, close } = createDb(url);
  try {
    await runMigrations(db);
  } finally {
    await close();
  }
}
