import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

export function createDb(url: string): { db: Db; close: () => Promise<void> } {
  const client = postgres(url, { max: 5 });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

const g = globalThis as unknown as { __aulaDb?: Db };

export function getDb(): Db {
  g.__aulaDb ??= createDb(env().DATABASE_URL).db;
  return g.__aulaDb;
}
