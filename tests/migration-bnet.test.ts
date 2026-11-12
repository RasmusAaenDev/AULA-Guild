import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';

// Migrationen til Battle.net-login skal virke på en database med data fra Discord-tiden:
// brugere slettes, opslag/kommentarer/chatbeskeder/filer bevares med forfatternavnet som tekst.
const LAST_DISCORD_MIGRATION = 12;

const baseUrl = process.env.TEST_DATABASE_URL!;
const dbName = `aula_migtest_${process.pid}`;
const url = (() => {
  const u = new URL(baseUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
})();

let admin: ReturnType<typeof postgres>;
let conn: { db: Db; close: () => Promise<void> };
let sql: ReturnType<typeof postgres>;
let oldFolder: string;

function copyMigrationsUpTo(idx: number): string {
  const src = path.join(process.cwd(), 'drizzle');
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'aula-mig-'));
  fs.mkdirSync(path.join(dst, 'meta'));
  const journal = JSON.parse(fs.readFileSync(path.join(src, 'meta/_journal.json'), 'utf8'));
  journal.entries = journal.entries.filter((e: { idx: number }) => e.idx <= idx);
  fs.writeFileSync(path.join(dst, 'meta/_journal.json'), JSON.stringify(journal));
  for (const e of journal.entries as { tag: string }[]) fs.copyFileSync(path.join(src, `${e.tag}.sql`), path.join(dst, `${e.tag}.sql`));
  return dst;
}

beforeAll(async () => {
  admin = postgres(baseUrl, { max: 1 });
  await admin.unsafe(`drop database if exists ${dbName}`);
  await admin.unsafe(`create database ${dbName}`);
  conn = createDb(url);
  sql = postgres(url, { max: 1 });
  oldFolder = copyMigrationsUpTo(LAST_DISCORD_MIGRATION);
  await runMigrations(conn.db, oldFolder);

  // Data som i Discord-tiden.
  const [u] = await sql`insert into users (discord_id, name, avatar) values ('d1', 'Rasmus', 'x') returning id`;
  const [c] = await sql`
    insert into characters (blizzard_id, slug, name, surname, class_name, role, user_id)
    values (1, 'magi-far', 'Magi', 'Far', 'Mage', 'dps', ${u.id}) returning id`;
  await sql`update users set active_character_id = ${c.id} where id = ${u.id}`;
  const [u2] = await sql`insert into users (discord_id, name) values ('d2', 'Uden Karakter') returning id`;
  const [p] = await sql`insert into posts (author_id, title, body) values (${u.id}, 'Titel', 'Tekst') returning id`;
  await sql`insert into comments (post_id, author_id, body) values (${p.id}, ${u2.id}, 'Svar')`;
  await sql`insert into post_reads (user_id, post_id) values (${u.id}, ${p.id})`;
  await sql`insert into post_bookmarks (user_id, post_id) values (${u.id}, ${p.id})`;
  const [s] = await sql`
    insert into event_series (type, title, weekday, start_time, duration_minutes, created_by)
    values ('raid', 'Raid', 3, '20:00', 120, ${u.id}) returning id`;
  const [e] = await sql`
    insert into events (type, title, starts_at, series_id, created_by)
    values ('raid', 'Raid', now(), ${s.id}, ${u.id}) returning id`;
  await sql`insert into rsvps (event_id, user_id, character_id, status) values (${e.id}, ${u.id}, ${c.id}, 'deltager')`;
  await sql`
    insert into files (section, title, original_name, mime, size_bytes, storage_key, uploaded_by)
    values ('galleri', 'Billede', 'a.png', 'image/png', 10, 'k1', ${u.id})`;
  const [ch] = await sql`insert into chat_channels (name, created_by) values ('snak', ${u.id}) returning id`;
  await sql`insert into chat_messages (channel_id, user_id, character_id, author_name, content) values (${ch.id}, ${u.id}, ${c.id}, 'Magi Far', 'Hej')`;
  await sql`insert into sim_jobs (user_id, input, status) values (${u.id}, 'x', 'done')`;

  await runMigrations(conn.db);
}, 60_000);

afterAll(async () => {
  await sql?.end();
  await conn?.close();
  await admin?.unsafe(`drop database if exists ${dbName}`);
  await admin?.end();
  if (oldFolder) fs.rmSync(oldFolder, { recursive: true, force: true });
}, 30_000);

describe('migration til Battle.net-login', () => {
  it('sletter alle brugere og brugerafhængige rækker', async () => {
    expect(await sql`select * from users`).toHaveLength(0);
    expect(await sql`select * from rsvps`).toHaveLength(0);
    expect(await sql`select * from post_reads`).toHaveLength(0);
    expect(await sql`select * from post_bookmarks`).toHaveLength(0);
    expect(await sql`select * from sim_jobs`).toHaveLength(0);
  });

  it('bevarer karakterer men fjerner ejeren', async () => {
    const rows = await sql`select user_id, verified_at from characters`;
    expect(rows).toEqual([{ user_id: null, verified_at: null }]);
  });

  it('bevarer opslag og kommentarer med forfatternavnet som tekst', async () => {
    const [p] = await sql`select author_id, author_name from posts`;
    expect(p).toEqual({ author_id: null, author_name: 'Magi Far' });
    const [c] = await sql`select author_id, author_name from comments`;
    expect(c).toEqual({ author_id: null, author_name: 'Uden Karakter' });
  });

  it('bevarer chatbeskeder, kanaler, filer, events og serier uden ejer', async () => {
    expect(await sql`select user_id, author_name from chat_messages`).toEqual([{ user_id: null, author_name: 'Magi Far' }]);
    expect(await sql`select created_by from chat_channels`).toEqual([{ created_by: null }]);
    expect(await sql`select uploaded_by, uploader_name from files`).toEqual([{ uploaded_by: null, uploader_name: 'Magi Far' }]);
    expect(await sql`select created_by from events`).toEqual([{ created_by: null }]);
    expect(await sql`select created_by from event_series`).toEqual([{ created_by: null }]);
  });

  it('har de nye brugerkolonner og ikke de gamle', async () => {
    const cols = await sql`select column_name from information_schema.columns where table_name = 'users' order by column_name`;
    expect(cols.map((r) => r.column_name)).toEqual(['active_character_id', 'battlenet_id', 'battletag', 'id', 'name']);
    await sql`insert into users (battlenet_id, battletag, name) values ('1', 'A#1', 'A')`;
    await expect(sql`insert into users (battlenet_id, battletag, name) values ('1', 'B#2', 'B')`).rejects.toThrow();
  });
});
