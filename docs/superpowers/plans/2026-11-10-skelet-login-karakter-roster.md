# AULA Guild – spec 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bygge AULA-skallen, Discord-login med serveradgang, karakter-tilføjelse mod Blizzard-armory og en Kontakter-side med time-synkroniseret roster, klar til selvhosting.

**Architecture:** Én Next.js-app (app router) med tynde server-komponenter og server actions oven på små, testbare moduler i `lib/`: `blizzard` (kender kun Blizzard), `discord-access` (kender kun Discord), `characters` og `sync` (forretningsregler mod Postgres via Drizzle). Alle moduler får deres afhængigheder (db, Blizzard-klient, fetch) som parametre, så de testes uden netværk. Containeren kører Next.js plus en indbygget time-planlægger; Postgres kører i en søstercontainer.

**Tech Stack:** Next.js (app router, TypeScript), Auth.js v5 (`next-auth@beta`) med Discord, Drizzle ORM + `postgres`, Zod, Vitest, Docker, GitHub Actions → GHCR.

Spec: `docs/superpowers/specs/2026-11-10-skelet-login-karakter-roster-design.md`. Køreplan: `docs/superpowers/roadmap.md`.

## Global Constraints

Gælder implicit for alle tasks (værdier fra specen):

- UI-sprog er dansk. Ingen engelske brugervendte tekster.
- Blizzard: host `https://eu.api.blizzard.com`, token fra `https://oauth.battle.net/token` (client credentials, Basic auth), namespace **`profile-forever-eu`** til profil og guild, `locale=en_GB`. Ingen realm i stien. Guild-slug `aula`, guild-id `304114`.
- Hemmeligheder (Blizzard-secret, Discord-secret, `AUTH_SECRET`, `CRON_SECRET`, database-URL) kun som miljøvariabler/`.env` på serveren. Aldrig i git, image eller klientkode. Den Blizzard-nøgle, der blev delt i chat, må ikke bruges.
- Discord-scopes: `identify` og `guilds.members.read`. Ingen bot.
- Officer = Discord-rolle (`DISCORD_OFFICER_ROLE_ID`). Alle officer-handlinger tjekkes server-side.
- `characters.blizzard_id` er unik i databasen. Én karakter tilhører højst én bruger. Flere karakterer pr. bruger, én aktiv.
- Rolle (`tank`/`healer`/`dps`) vælges af spilleren.
- Tidspunkter gemmes i UTC og vises i `Europe/Copenhagen`.
- Cron-jobbet opretter aldrig karakterer. Kontakter viser kun registrerede (tilknyttede) karakterer.
- Ved Blizzard-fejl i roster-kaldet ændres intet (ingen "forladt guild"-markering).
- Hosting: selvhostet på denne Linux-maskine (adskilt fra Sekvens' servere og deres `server-stacks`/Watchtower), kun prod, port `127.0.0.1:8102` (ledig, verificeret), `aula.aaensoftware.com` via Cloudflare Tunnel. `cloudflared` og Sekvens' opsætning røres ikke. AULA får sin egen Watchtower-instans med scope `aula`, der kun opdaterer app-containeren.
- Kun Overblik og Kontakter er menupunkter. Ingen døde links.

## Kendte usikkerheder (verificeres, ikke gættes)

Plan og tests bygger på disse antagelser, som **Task 14** afprøver mod rigtige API'er. Fixtures i tests er håndskrevet efter kendt Blizzard-format, ikke optaget fra Forever.

1. Forevers profil-svar har `id`, `name`, `character_class.name`, `guild.id`, `guild.name`, `equipped_item_level`, `average_item_level`, `last_login_timestamp`, og spec står i `active_spec.name`. Hvis `active_spec` mangler, skal `getCharacter` også kalde `/specializations` (justeres i Task 14).
2. Rosterens `members[].character.key.href` ender på karakterens slug. Ellers bruges `nameToSlug(name)`.
3. Discord svarer 404 på `GET /users/@me/guilds/{id}/member` for ikke-medlemmer.
4. `next-auth@beta` virker med den Next.js-version, npm vælger. Tjekkes i Task 1.
5. Officer-rolle og medlemskab aflæses ved login og gemmes i en JWT med `maxAge` 12 timer. Ændringer i Discord-roller slår igennem ved næste login (højst 12 timer).

## Filstruktur

```
package.json, tsconfig.json, next.config.ts, vitest.config.ts, drizzle.config.ts
docker-compose.dev.yml, .env.example, .gitignore, Dockerfile, .dockerignore
auth.ts, instrumentation.ts
types/next-auth.d.ts
app/layout.tsx, app/globals.css, app/login/page.tsx, app/ingen-adgang/page.tsx
app/api/auth/[...nextauth]/route.ts, app/api/cron/sync-roster/route.ts
app/(app)/layout.tsx, app/(app)/page.tsx, app/(app)/actions.ts
app/(app)/kontakter/page.tsx, app/(app)/karakter/ny/page.tsx, app/(app)/karakter/ny/AddCharacterForm.tsx
components/Shell.tsx, components/NavLink.tsx, components/ProfileMenu.tsx, components/ThemeToggle.tsx
lib/env.ts, lib/format.ts, lib/messages.ts, lib/slug.ts, lib/services.ts, lib/session.ts
lib/db/schema.ts, lib/db/index.ts, lib/db/migrate.ts
lib/blizzard/types.ts, lib/blizzard/client.ts
lib/discord-access.ts, lib/auth-callbacks.ts, lib/users.ts
lib/characters.ts, lib/sync.ts, lib/scheduler.ts, lib/cron-auth.ts
drizzle/ (genererede migrationer)
scripts/verify-armory.ts
deploy/docker-compose.yml, deploy/.env.example, deploy/backup.sh
.github/workflows/build-and-push.yml
tests/global-setup.ts, tests/db.ts, tests/helpers.ts, tests/*.test.ts
README.md
```

---

### Task 1: Projektskelet, værktøjer og dev-database

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `drizzle.config.ts`, `docker-compose.dev.yml`, `.env.example`, `.gitignore`, `app/layout.tsx`, `app/page.tsx` (midlertidig), `tests/smoke.test.ts`

**Interfaces:**
- Produces: npm-scripts `dev`, `build`, `test`, `typecheck`, `db:generate`; alias `@/` → projektrod; dev-Postgres på `127.0.0.1:55433` med databaserne `aula` og `aula_test`.

- [ ] **Step 1: Opret `.gitignore`**

```
node_modules/
.next/
.env
.env.local
data/
*.log
next-env.d.ts
```

- [ ] **Step 2: Installér afhængigheder**

Run (i `/home/rasmus/development/AULA-Guild`):
```bash
npm init -y
npm install next react react-dom next-auth@beta drizzle-orm postgres zod
npm install -D typescript @types/node @types/react @types/react-dom drizzle-kit vitest tsx
```
Expected: installationen lykkes. Læs `npm ls next next-auth` og tjek, at der ikke står `ERESOLVE` eller `invalid` ved `next-auth`. Opstår der peer-konflikt mellem `next-auth@beta` og `next`, stop og rapportér versionerne i stedet for at bruge `--force`.

- [ ] **Step 3: Skriv `package.json`-scripts**

Åbn `package.json` og sæt `"name": "aula-guild"`, `"private": true`, fjern `main` og `keywords`, og sæt:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "typecheck": "tsc --noEmit",
  "db:generate": "drizzle-kit generate"
}
```

- [ ] **Step 4: Skriv `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Skriv `next.config.ts`**

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
};

export default config;
```

- [ ] **Step 6: Skriv `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

process.env.TEST_DATABASE_URL ??= 'postgres://aula:aula@127.0.0.1:55433/aula_test';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 7: Skriv `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
});
```

- [ ] **Step 8: Skriv `docker-compose.dev.yml`**

```yaml
name: aula-dev

services:
  db:
    image: postgres:16-alpine
    container_name: aula-dev-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: aula
      POSTGRES_USER: aula
      POSTGRES_PASSWORD: aula
    ports:
      - "127.0.0.1:55433:5432"
    volumes:
      - devdata:/var/lib/postgresql/data

volumes:
  devdata:
```

- [ ] **Step 9: Skriv `.env.example`**

```
# Database
DATABASE_URL=postgres://aula:aula@127.0.0.1:55433/aula

# Auth.js (AUTH_URL = den adresse siden nås på)
AUTH_SECRET=
AUTH_URL=http://localhost:3000
AUTH_DISCORD_ID=
AUTH_DISCORD_SECRET=

# Discord-server og officer-rolle
DISCORD_GUILD_ID=
DISCORD_OFFICER_ROLE_ID=

# Blizzard (ny nøgle, aldrig den der blev delt i chat)
BLIZZARD_CLIENT_ID=
BLIZZARD_CLIENT_SECRET=
BLIZZARD_GUILD_SLUG=aula
BLIZZARD_GUILD_ID=304114

# Cron/planlægger
CRON_SECRET=
SYNC_ENABLED=false
AUTO_MIGRATE=false
```

- [ ] **Step 9b: Minimal `app/layout.tsx` og `app/page.tsx`**

`app/layout.tsx`:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
```
`app/page.tsx`:
```tsx
export default function Home() {
  return <main>AULA</main>;
}
```

- [ ] **Step 10: Start dev-database og opret testdatabase**

Run:
```bash
docker compose -f docker-compose.dev.yml up -d
until docker compose -f docker-compose.dev.yml exec -T db pg_isready -U aula; do sleep 1; done
docker compose -f docker-compose.dev.yml exec -T db createdb -U aula aula_test
```
Expected: `accepting connections`, derefter ingen fejl fra `createdb`.

- [ ] **Step 11: Skriv røgtest, der importerer de biblioteker, planen bygger på**

`tests/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { z } from 'zod';

describe('afhængigheder', () => {
  it('kan importeres og bruges', () => {
    expect(typeof postgres).toBe('function');
    expect(typeof drizzle).toBe('function');
    expect(z.string().parse('ok')).toBe('ok');
  });
});
```
`globalSetup` findes endnu ikke, så opret midlertidigt `tests/global-setup.ts`:
```ts
export default function setup() {}
```

- [ ] **Step 12: Kør test og typecheck**

Run: `npm test && npm run typecheck`
Expected: 1 test passerer, typecheck uden fejl. Hvis importen af `postgres` eller `drizzle` fejler (API-ændring i nyere versioner), ret importene her, så de følgende tasks bruger de rigtige, og notér ændringen i commit-beskeden.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: Next.js-skelet, vitest, drizzle og dev-database"
```

---

### Task 2: Miljø, database-skema og migrationer

**Files:**
- Create: `lib/env.ts`, `lib/db/schema.ts`, `lib/db/index.ts`, `lib/db/migrate.ts`, `tests/db.ts`, `tests/db.test.ts`
- Modify: `tests/global-setup.ts`

**Interfaces:**
- Produces:
  - `env(): Env` (Zod-valideret, cachet). `Env` har: `DATABASE_URL`, `DISCORD_GUILD_ID`, `DISCORD_OFFICER_ROLE_ID`, `BLIZZARD_CLIENT_ID`, `BLIZZARD_CLIENT_SECRET`, `BLIZZARD_GUILD_SLUG: string`, `BLIZZARD_GUILD_ID: number`, `CRON_SECRET`, `SYNC_ENABLED: boolean`, `AUTO_MIGRATE: boolean`.
  - `schema.users`, `schema.characters`, `type Role = 'tank'|'healer'|'dps'`, `roles` (tuple).
  - `type Db = PostgresJsDatabase<typeof schema>`, `createDb(url): { db: Db; close(): Promise<void> }`, `getDb(): Db` (singleton).
  - `runMigrations(db: Db, folder?: string): Promise<void>`.
  - Test: `testDb()`, `resetDb(db)`.

- [ ] **Step 1: Skriv `lib/env.ts`**

```ts
import { z } from 'zod';

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DISCORD_OFFICER_ROLE_ID: z.string().min(1),
  BLIZZARD_CLIENT_ID: z.string().min(1),
  BLIZZARD_CLIENT_SECRET: z.string().min(1),
  BLIZZARD_GUILD_SLUG: z.string().min(1).default('aula'),
  BLIZZARD_GUILD_ID: z.coerce.number().int().positive().default(304114),
  CRON_SECRET: z.string().min(16),
  SYNC_ENABLED: bool,
  AUTO_MIGRATE: bool,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
```

- [ ] **Step 2: Skriv `lib/db/schema.ts`**

```ts
import { boolean, integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const roles = ['tank', 'healer', 'dps'] as const;
export type Role = (typeof roles)[number];
export const roleEnum = pgEnum('role', roles);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  discordId: text('discord_id').notNull().unique(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  activeCharacterId: integer('active_character_id'),
});

export const characters = pgTable('characters', {
  id: serial('id').primaryKey(),
  blizzardId: integer('blizzard_id').notNull().unique(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  className: text('class_name').notNull(),
  spec: text('spec'),
  role: roleEnum('role').notNull(),
  itemLevel: integer('item_level'),
  guildRank: integer('guild_rank'),
  inGuild: boolean('in_guild').notNull().default(true),
  lastLogin: timestamp('last_login', { withTimezone: true }),
  lastSynced: timestamp('last_synced', { withTimezone: true }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
});
```
(`users.active_character_id` har bevidst ingen fremmednøgle, for at undgå cyklus. Koden nulstiller feltet ved frakobling.)

- [ ] **Step 3: Skriv `lib/db/index.ts`**

```ts
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
```

- [ ] **Step 4: Skriv `lib/db/migrate.ts`**

```ts
import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { Db } from './index';

export async function runMigrations(db: Db, folder = path.join(process.cwd(), 'drizzle')): Promise<void> {
  await migrate(db, { migrationsFolder: folder });
}
```

- [ ] **Step 5: Generér migration**

Run: `npm run db:generate`
Expected: mappen `drizzle/` indeholder en `0000_*.sql` med `CREATE TYPE "role"`, `CREATE TABLE "users"`, `CREATE TABLE "characters"` og en unik constraint på `blizzard_id`. Læs filen og bekræft det.

- [ ] **Step 6: Skriv `tests/global-setup.ts` (erstat den midlertidige)**

```ts
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
```
(Mangler databasen, fejler hele testkørslen højlydt. Ingen tests springes tavst over.)

- [ ] **Step 7: Skriv `tests/db.ts`**

```ts
import { sql } from 'drizzle-orm';
import { createDb, type Db } from '@/lib/db';

export function testDb(): { db: Db; close: () => Promise<void> } {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL mangler');
  return createDb(url);
}

export async function resetDb(db: Db): Promise<void> {
  await db.execute(sql`truncate table characters, users restart identity cascade`);
}
```

- [ ] **Step 8: Skriv den fejlende test**

`tests/db.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { characters, users } from '@/lib/db/schema';
import { resetDb, testDb } from './db';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const base = { slug: 'magi-far', name: 'Magi Far', className: 'Mage', role: 'dps' as const };

describe('skema', () => {
  it('afviser to rækker med samme blizzard_id', async () => {
    await db.insert(characters).values({ ...base, blizzardId: 1 });
    await expect(db.insert(characters).values({ ...base, blizzardId: 1 })).rejects.toThrow();
  });

  it('gemmer en bruger og en karakter knyttet til den', async () => {
    const [u] = await db.insert(users).values({ discordId: 'd1', name: 'Rasmus' }).returning();
    const [c] = await db.insert(characters).values({ ...base, blizzardId: 2, userId: u.id }).returning();
    expect(c.userId).toBe(u.id);
    expect(c.inGuild).toBe(true);
  });
});
```

- [ ] **Step 9: Kør testen**

Run: `npm test -- tests/db.test.ts`
Expected: PASS (migration er allerede kørt i global-setup, så testen er grøn med det samme; skemaets constraint bekræftes af første test).

- [ ] **Step 10: Typecheck og commit**

Run: `npm run typecheck`
```bash
git add -A
git commit -m "feat: miljø-validering, databaseskema og migrationer"
```

---

### Task 3: Navn → slug og danske beskeder og datoformat

**Files:**
- Create: `lib/slug.ts`, `lib/messages.ts`, `lib/format.ts`, `tests/slug.test.ts`, `tests/format.test.ts`

**Interfaces:**
- Produces:
  - `nameToSlug(input: string): string | null`
  - `normalizeName(input: string): string` (trim, mellemrum samles, små bogstaver; bruges til navnesammenligning)
  - `addCharacterMessage(reason: AddFailure): string` og `type AddFailure = 'invalid_name'|'not_found'|'wrong_guild'|'taken'|'already_yours'|'unavailable'`
  - `roleLabel(role: Role): string`
  - `formatDateTime(date: Date | null): string`

- [ ] **Step 1: Skriv fejlende tests**

`tests/slug.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { nameToSlug, normalizeName } from '@/lib/slug';

describe('nameToSlug', () => {
  it.each([
    ['Magi Far', 'magi-far'],
    ['  Magi   Far ', 'magi-far'],
    ['Ezzek', 'ezzek'],
    ["D'arc", "d'arc"],
  ])('%s → %s', (input, expected) => {
    expect(nameToSlug(input)).toBe(expected);
  });

  it.each(['', '   ', 'a/b', 'Magi_Far', 'x'.repeat(61), 'Magi?Far'])('afviser %j', (input) => {
    expect(nameToSlug(input)).toBeNull();
  });
});

describe('normalizeName', () => {
  it('trimmer, samler mellemrum og sænker', () => {
    expect(normalizeName('  Magi   FAR ')).toBe('magi far');
  });
});
```
`tests/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatDateTime } from '@/lib/format';
import { addCharacterMessage, roleLabel } from '@/lib/messages';

describe('formatDateTime', () => {
  it('viser dansk tid (vintertid, UTC+1)', () => {
    expect(formatDateTime(new Date('2026-11-10T19:00:00Z'))).toMatch(/10\.11\.2026.*20[.:]00/);
  });
  it('viser sommertid (UTC+2)', () => {
    expect(formatDateTime(new Date('2026-07-10T19:00:00Z'))).toMatch(/10\.07\.2026.*21[.:]00/);
  });
  it('viser tekst når der ikke er nogen dato', () => {
    expect(formatDateTime(null)).toBe('Ikke synkroniseret endnu');
  });
});

describe('beskeder', () => {
  it('har en dansk tekst for hver fejl', () => {
    for (const r of ['invalid_name', 'not_found', 'wrong_guild', 'taken', 'already_yours', 'unavailable'] as const) {
      expect(addCharacterMessage(r).length).toBeGreaterThan(10);
    }
    expect(addCharacterMessage('wrong_guild')).toBe('Karakteren er ikke i guilden AULA.');
    expect(roleLabel('dps')).toBe('DPS');
  });
});
```

- [ ] **Step 2: Kør og se dem fejle**

Run: `npm test -- tests/slug.test.ts tests/format.test.ts`
Expected: FAIL (moduler findes ikke).

- [ ] **Step 3: Implementér**

`lib/slug.ts`:
```ts
export function normalizeName(input: string): string {
  return input.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

const VALID = /^[\p{L}'-]+( [\p{L}'-]+)*$/u;

export function nameToSlug(input: string): string | null {
  const name = normalizeName(input);
  if (name.length === 0 || name.length > 60 || !VALID.test(name)) return null;
  return name.replace(/ /g, '-');
}
```
`lib/messages.ts`:
```ts
import type { Role } from '@/lib/db/schema';

export type AddFailure = 'invalid_name' | 'not_found' | 'wrong_guild' | 'taken' | 'already_yours' | 'unavailable';

const messages: Record<AddFailure, string> = {
  invalid_name: 'Skriv karakterens fornavn og efternavn. Kun bogstaver, mellemrum, bindestreg og apostrof.',
  not_found: 'Karakteren findes ikke i armory. Tjek stavningen.',
  wrong_guild: 'Karakteren er ikke i guilden AULA.',
  taken: 'Karakteren er allerede koblet til en anden spiller. Kontakt en officer.',
  already_yours: 'Du har allerede tilføjet den karakter.',
  unavailable: 'Armory svarer ikke lige nu, prøv igen om lidt.',
};

export function addCharacterMessage(reason: AddFailure): string {
  return messages[reason];
}

const roleLabels: Record<Role, string> = { tank: 'Tank', healer: 'Healer', dps: 'DPS' };

export function roleLabel(role: Role): string {
  return roleLabels[role];
}
```
`lib/format.ts`:
```ts
const formatter = new Intl.DateTimeFormat('da-DK', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Copenhagen',
});

export function formatDateTime(date: Date | null): string {
  return date ? formatter.format(date) : 'Ikke synkroniseret endnu';
}
```

- [ ] **Step 4: Kør og se dem bestå**

Run: `npm test -- tests/slug.test.ts tests/format.test.ts`
Expected: PASS. Fejler datoformatet, fordi ICU leverer et andet mønster end `10.11.2026 20.00`, så udskriv resultatet og ret kun regex'en i testen, ikke formatteren.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: navn til slug, danske beskeder og datoformat"
```

---

### Task 4: Blizzard-klient

**Files:**
- Create: `lib/blizzard/types.ts`, `lib/blizzard/client.ts`, `tests/helpers.ts`, `tests/blizzard-client.test.ts`

**Interfaces:**
- Produces (`lib/blizzard/types.ts`):
```ts
export type ArmoryCharacter = {
  blizzardId: number; slug: string; name: string; className: string;
  spec: string | null; itemLevel: number | null;
  guildId: number | null; guildName: string | null; lastLogin: Date | null;
};
export type RosterMember = { blizzardId: number; slug: string; name: string; rank: number };
export type BlizzardErrorKind = 'not_found' | 'rate_limited' | 'unavailable';
export class BlizzardError extends Error { constructor(public kind: BlizzardErrorKind, message: string) }
export type BlizzardClient = {
  getCharacter(slug: string): Promise<ArmoryCharacter>;
  getGuildRoster(guildSlug: string): Promise<RosterMember[]>;
};
```
- Produces (`lib/blizzard/client.ts`): `createBlizzardClient(opts: { clientId: string; clientSecret: string; fetch?: typeof fetch; now?: () => number }): BlizzardClient`
- Produces (`tests/helpers.ts`): `jsonResponse(status, body): Response`, `armory(over?): ArmoryCharacter`, `member(over?): RosterMember`, `fakeBlizzard(opts): BlizzardClient & { calls: string[] }`, `seedUser(db, discordId?): Promise<number>`.

- [ ] **Step 1: Skriv `lib/blizzard/types.ts`**

```ts
export type ArmoryCharacter = {
  blizzardId: number;
  slug: string;
  name: string;
  className: string;
  spec: string | null;
  itemLevel: number | null;
  guildId: number | null;
  guildName: string | null;
  lastLogin: Date | null;
};

export type RosterMember = { blizzardId: number; slug: string; name: string; rank: number };

export type BlizzardErrorKind = 'not_found' | 'rate_limited' | 'unavailable';

export class BlizzardError extends Error {
  constructor(public kind: BlizzardErrorKind, message: string) {
    super(message);
    this.name = 'BlizzardError';
  }
}

export type BlizzardClient = {
  getCharacter(slug: string): Promise<ArmoryCharacter>;
  getGuildRoster(guildSlug: string): Promise<RosterMember[]>;
};
```

- [ ] **Step 2: Skriv `tests/helpers.ts`**

```ts
import type { Db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { BlizzardError, type ArmoryCharacter, type BlizzardClient, type RosterMember } from '@/lib/blizzard/types';

export function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export function armory(over: Partial<ArmoryCharacter> = {}): ArmoryCharacter {
  return {
    blizzardId: 1001,
    slug: 'magi-far',
    name: 'Magi Far',
    className: 'Mage',
    spec: 'Frost',
    itemLevel: 8,
    guildId: 304114,
    guildName: 'AULA',
    lastLogin: new Date('2026-11-10T18:00:00Z'),
    ...over,
  };
}

export function member(over: Partial<RosterMember> = {}): RosterMember {
  return { blizzardId: 1001, slug: 'magi-far', name: 'Magi Far', rank: 3, ...over };
}

export function fakeBlizzard(opts: {
  characters?: Record<string, ArmoryCharacter | BlizzardError | (ArmoryCharacter | BlizzardError)[]>;
  roster?: RosterMember[] | BlizzardError;
}): BlizzardClient & { calls: string[] } {
  const calls: string[] = [];
  const counters = new Map<string, number>();
  return {
    calls,
    async getCharacter(slug) {
      calls.push(`character:${slug}`);
      let v = opts.characters?.[slug];
      if (Array.isArray(v)) {
        const n = counters.get(slug) ?? 0;
        counters.set(slug, n + 1);
        v = v[Math.min(n, v.length - 1)];
      }
      if (v === undefined) throw new BlizzardError('not_found', slug);
      if (v instanceof BlizzardError) throw v;
      return v;
    },
    async getGuildRoster() {
      calls.push('roster');
      if (opts.roster instanceof BlizzardError) throw opts.roster;
      return opts.roster ?? [];
    },
  };
}

export async function seedUser(db: Db, discordId = 'd1'): Promise<number> {
  const [u] = await db.insert(users).values({ discordId, name: `Bruger ${discordId}` }).returning({ id: users.id });
  return u.id;
}
```

- [ ] **Step 3: Skriv de fejlende klient-tests**

`tests/blizzard-client.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createBlizzardClient } from '@/lib/blizzard/client';
import { BlizzardError } from '@/lib/blizzard/types';
import { jsonResponse } from './helpers';

const tokenBody = { access_token: 'tok-1', expires_in: 86399 };

const rawCharacter = {
  id: 1001,
  name: 'Magi Far',
  character_class: { name: 'Mage' },
  active_spec: { name: 'Frost' },
  guild: { id: 304114, name: 'AULA' },
  equipped_item_level: 8,
  average_item_level: 9,
  last_login_timestamp: 1789000000000,
};

const rawRoster = {
  members: [
    { character: { id: 1001, name: 'Magi Far', key: { href: 'https://eu.api.blizzard.com/profile/wow/character/magi-far?namespace=profile-forever-eu' } }, rank: 3 },
    { character: { id: 1002, name: 'Ezzek', key: { href: 'https://eu.api.blizzard.com/profile/wow/character/ezzek-svumpukkel?namespace=profile-forever-eu' } }, rank: 0 },
    { character: { id: 1003, name: 'Uden Href' }, rank: 5 },
  ],
};

type Call = { url: string; init?: RequestInit };

function setup(handler: (url: string, n: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    return handler(u, calls.length);
  }) as typeof fetch;
  let clock = 0;
  const client = createBlizzardClient({ clientId: 'id', clientSecret: 'secret', fetch: fetcher, now: () => clock });
  return { client, calls, advance: (ms: number) => (clock += ms) };
}

const isToken = (u: string) => u.startsWith('https://oauth.battle.net/token');

describe('blizzard-klient', () => {
  it('henter token med Basic auth og slår karakter op i forever-namespace uden realm', async () => {
    const { client, calls } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, rawCharacter)));
    const c = await client.getCharacter('magi-far');
    expect(c).toEqual({
      blizzardId: 1001, slug: 'magi-far', name: 'Magi Far', className: 'Mage', spec: 'Frost',
      itemLevel: 8, guildId: 304114, guildName: 'AULA', lastLogin: new Date(1789000000000),
    });
    expect(calls[0].init?.headers).toMatchObject({ Authorization: 'Basic ' + Buffer.from('id:secret').toString('base64') });
    expect(calls[0].init?.body).toBe('grant_type=client_credentials');
    expect(calls[1].url).toBe('https://eu.api.blizzard.com/profile/wow/character/magi-far?namespace=profile-forever-eu&locale=en_GB');
    expect(calls[1].init?.headers).toMatchObject({ Authorization: 'Bearer tok-1' });
  });

  it('klarer karakter uden guild, spec og item level', async () => {
    const { client } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, { id: 5, name: 'Nul', character_class: { name: 'Priest' } })));
    expect(await client.getCharacter('nul')).toMatchObject({ spec: null, itemLevel: null, guildId: null, guildName: null, lastLogin: null });
  });

  it('genbruger token mellem kald og henter nyt, når det er udløbet', async () => {
    const { client, calls, advance } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, rawCharacter)));
    await client.getCharacter('a');
    await client.getCharacter('b');
    expect(calls.filter((c) => isToken(c.url))).toHaveLength(1);
    advance(86_400_000);
    await client.getCharacter('c');
    expect(calls.filter((c) => isToken(c.url))).toHaveLength(2);
  });

  it('henter nyt token og prøver én gang igen ved 401', async () => {
    let apiCalls = 0;
    const { client, calls } = setup((u) => {
      if (isToken(u)) return jsonResponse(200, tokenBody);
      return ++apiCalls === 1 ? jsonResponse(401) : jsonResponse(200, rawCharacter);
    });
    await client.getCharacter('magi-far');
    expect(calls.filter((c) => isToken(c.url))).toHaveLength(2);
  });

  it.each([
    [404, 'not_found'],
    [429, 'rate_limited'],
    [500, 'unavailable'],
    [503, 'unavailable'],
  ])('oversætter HTTP %i til %s', async (status, kind) => {
    const { client } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(status)));
    await expect(client.getCharacter('x')).rejects.toMatchObject({ name: 'BlizzardError', kind });
  });

  it('oversætter netværksfejl til unavailable', async () => {
    const { client } = setup((u) => {
      if (isToken(u)) return jsonResponse(200, tokenBody);
      throw new TypeError('fetch failed');
    });
    await expect(client.getCharacter('x')).rejects.toBeInstanceOf(BlizzardError);
    await expect(client.getCharacter('x')).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('oversætter fejl ved tokenhentning til unavailable', async () => {
    const { client } = setup(() => jsonResponse(500));
    await expect(client.getCharacter('x')).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('henter roster og tager slug fra href, ellers fra navnet', async () => {
    const { client, calls } = setup((u) => (isToken(u) ? jsonResponse(200, tokenBody) : jsonResponse(200, rawRoster)));
    const roster = await client.getGuildRoster('aula');
    expect(calls[1].url).toBe('https://eu.api.blizzard.com/data/wow/guild/aula/roster?namespace=profile-forever-eu&locale=en_GB');
    expect(roster).toEqual([
      { blizzardId: 1001, slug: 'magi-far', name: 'Magi Far', rank: 3 },
      { blizzardId: 1002, slug: 'ezzek-svumpukkel', name: 'Ezzek', rank: 0 },
      { blizzardId: 1003, slug: 'uden-href', name: 'Uden Href', rank: 5 },
    ]);
  });
});
```

- [ ] **Step 4: Kør og se dem fejle**

Run: `npm test -- tests/blizzard-client.test.ts`
Expected: FAIL (`@/lib/blizzard/client` findes ikke).

- [ ] **Step 5: Implementér `lib/blizzard/client.ts`**

```ts
import { nameToSlug } from '@/lib/slug';
import { BlizzardError, type ArmoryCharacter, type BlizzardClient, type RosterMember } from './types';

const API = 'https://eu.api.blizzard.com';
const TOKEN_URL = 'https://oauth.battle.net/token';
const NAMESPACE = 'profile-forever-eu';
const LOCALE = 'en_GB';

type RawCharacter = {
  id: number;
  name: string;
  character_class?: { name: string };
  active_spec?: { name: string };
  guild?: { id: number; name: string };
  equipped_item_level?: number;
  average_item_level?: number;
  last_login_timestamp?: number;
};

type RawRoster = {
  members: { character: { id: number; name: string; key?: { href: string } }; rank: number }[];
};

function slugFromHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const last = new URL(href).pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}

export function createBlizzardClient(opts: {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  now?: () => number;
}): BlizzardClient {
  const doFetch = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now;
  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<string> {
    if (token && token.expiresAt > now()) return token.value;
    let res: Response;
    try {
      res = await doFetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
    } catch {
      throw new BlizzardError('unavailable', 'Token-kald fejlede');
    }
    if (!res.ok) throw new BlizzardError(res.status === 429 ? 'rate_limited' : 'unavailable', `Token HTTP ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: json.access_token, expiresAt: now() + (json.expires_in - 60) * 1000 };
    return token.value;
  }

  async function get<T>(path: string): Promise<T> {
    const url = `${API}${path}?namespace=${NAMESPACE}&locale=${LOCALE}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const bearer = await getToken();
      let res: Response;
      try {
        res = await doFetch(url, { headers: { Authorization: `Bearer ${bearer}` } });
      } catch {
        throw new BlizzardError('unavailable', 'Netværksfejl');
      }
      if (res.status === 401 && attempt === 0) {
        token = null;
        continue;
      }
      if (res.status === 404) throw new BlizzardError('not_found', path);
      if (res.status === 429) throw new BlizzardError('rate_limited', path);
      if (!res.ok) throw new BlizzardError('unavailable', `HTTP ${res.status} ${path}`);
      return (await res.json()) as T;
    }
    throw new BlizzardError('unavailable', 'Afvist trods nyt token');
  }

  return {
    async getCharacter(slug: string): Promise<ArmoryCharacter> {
      const raw = await get<RawCharacter>(`/profile/wow/character/${encodeURIComponent(slug)}`);
      return {
        blizzardId: raw.id,
        slug,
        name: raw.name,
        className: raw.character_class?.name ?? 'Ukendt',
        spec: raw.active_spec?.name ?? null,
        itemLevel: raw.equipped_item_level ?? raw.average_item_level ?? null,
        guildId: raw.guild?.id ?? null,
        guildName: raw.guild?.name ?? null,
        lastLogin: raw.last_login_timestamp ? new Date(raw.last_login_timestamp) : null,
      };
    },

    async getGuildRoster(guildSlug: string): Promise<RosterMember[]> {
      const raw = await get<RawRoster>(`/data/wow/guild/${encodeURIComponent(guildSlug)}/roster`);
      return raw.members.map((m) => ({
        blizzardId: m.character.id,
        slug: slugFromHref(m.character.key?.href) ?? nameToSlug(m.character.name) ?? String(m.character.id),
        name: m.character.name,
        rank: m.rank,
      }));
    },
  };
}
```

- [ ] **Step 6: Kør og se dem bestå**

Run: `npm test -- tests/blizzard-client.test.ts && npm run typecheck`
Expected: alle tests PASS, typecheck uden fejl.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Blizzard-klient med token-cache, fejloversættelse og roster"
```

---

### Task 5: Discord-adgang og login-logik

**Files:**
- Create: `lib/discord-access.ts`, `lib/users.ts`, `lib/auth-callbacks.ts`, `tests/discord-access.test.ts`, `tests/auth-callbacks.test.ts`

**Interfaces:**
- Consumes: `Db`, `users` (Task 2), `jsonResponse` (Task 4 helpers).
- Produces:
  - `type Access = { isMember: boolean; isOfficer: boolean }`
  - `class DiscordError extends Error`
  - `fetchAccess(opts: { accessToken: string; guildId: string; officerRoleId: string; fetch?: typeof fetch }): Promise<Access>`
  - `upsertUser(db: Db, u: { discordId: string; name: string; avatar: string | null }): Promise<number>`
  - `type DiscordProfile = { id: string; username: string; global_name?: string | null; avatar?: string | null }`
  - `type SignInToken = { userId?: number; isMember?: boolean; isOfficer?: boolean; [key: string]: unknown }`
  - `applySignIn(deps: { fetchAccess(accessToken: string): Promise<Access>; upsertUser(u: { discordId: string; name: string; avatar: string | null }): Promise<number> }, token: SignInToken, input: { accessToken: string; profile: DiscordProfile }): Promise<SignInToken>`

- [ ] **Step 1: Skriv fejlende tests**

`tests/discord-access.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DiscordError, fetchAccess } from '@/lib/discord-access';
import { jsonResponse } from './helpers';

function run(res: Response | Error) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (res instanceof Error) throw res;
    return res;
  }) as typeof fetch;
  const promise = fetchAccess({ accessToken: 'at', guildId: 'G1', officerRoleId: 'R-OFF', fetch: fetcher });
  return { promise, calls };
}

describe('fetchAccess', () => {
  it('slår brugerens egen medlemsrække op i serveren med brugerens token', async () => {
    const { promise, calls } = run(jsonResponse(200, { roles: ['R1'] }));
    await promise;
    expect(calls[0].url).toBe('https://discord.com/api/v10/users/@me/guilds/G1/member');
    expect(calls[0].init?.headers).toMatchObject({ Authorization: 'Bearer at' });
  });

  it('medlem uden officer-rolle', async () => {
    expect(await run(jsonResponse(200, { roles: ['R1'] })).promise).toEqual({ isMember: true, isOfficer: false });
  });

  it('medlem med officer-rolle', async () => {
    expect(await run(jsonResponse(200, { roles: ['R1', 'R-OFF'] })).promise).toEqual({ isMember: true, isOfficer: true });
  });

  it('404 er ikke medlem', async () => {
    expect(await run(jsonResponse(404, { code: 10004 })).promise).toEqual({ isMember: false, isOfficer: false });
  });

  it.each([401, 403, 429, 500])('HTTP %i giver DiscordError, ikke adgang', async (status) => {
    await expect(run(jsonResponse(status)).promise).rejects.toBeInstanceOf(DiscordError);
  });

  it('netværksfejl giver DiscordError', async () => {
    await expect(run(new TypeError('fetch failed')).promise).rejects.toBeInstanceOf(DiscordError);
  });
});
```
`tests/auth-callbacks.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { applySignIn } from '@/lib/auth-callbacks';
import { DiscordError } from '@/lib/discord-access';
import { users } from '@/lib/db/schema';
import { upsertUser } from '@/lib/users';
import { resetDb, testDb } from './db';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const profile = { id: '555', username: 'rasmus', global_name: 'Rasmus A', avatar: 'abc123' };

describe('upsertUser', () => {
  it('opretter og opdaterer samme discord-bruger uden dubletter', async () => {
    const id1 = await upsertUser(db, { discordId: '555', name: 'Gammel', avatar: null });
    const id2 = await upsertUser(db, { discordId: '555', name: 'Ny', avatar: 'x' });
    expect(id2).toBe(id1);
    const rows = await db.select().from(users).where(eq(users.discordId, '555'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Ny', avatar: 'x' });
  });
});

describe('applySignIn', () => {
  it('giver medlem et bruger-id og gemmer brugeren', async () => {
    const deps = {
      fetchAccess: vi.fn(async () => ({ isMember: true, isOfficer: true })),
      upsertUser: (u: Parameters<typeof upsertUser>[1]) => upsertUser(db, u),
    };
    const token = await applySignIn(deps, { sub: 'x' }, { accessToken: 'at', profile });
    expect(deps.fetchAccess).toHaveBeenCalledWith('at');
    expect(token).toMatchObject({ sub: 'x', isMember: true, isOfficer: true });
    expect(typeof token.userId).toBe('number');
    const [row] = await db.select().from(users);
    expect(row).toMatchObject({ discordId: '555', name: 'Rasmus A', avatar: 'https://cdn.discordapp.com/avatars/555/abc123.png' });
  });

  it('falder tilbage til brugernavn og ingen avatar', async () => {
    const deps = {
      fetchAccess: async () => ({ isMember: true, isOfficer: false }),
      upsertUser: (u: Parameters<typeof upsertUser>[1]) => upsertUser(db, u),
    };
    await applySignIn(deps, {}, { accessToken: 'at', profile: { id: '9', username: 'bare' } });
    const [row] = await db.select().from(users);
    expect(row).toMatchObject({ name: 'bare', avatar: null });
  });

  it('gemmer ikke ikke-medlemmer og giver dem ikke adgang', async () => {
    const deps = {
      fetchAccess: async () => ({ isMember: false, isOfficer: false }),
      upsertUser: (u: Parameters<typeof upsertUser>[1]) => upsertUser(db, u),
    };
    const token = await applySignIn(deps, {}, { accessToken: 'at', profile });
    expect(token).toMatchObject({ isMember: false, isOfficer: false });
    expect(token.userId).toBeUndefined();
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it('lader DiscordError boble op, så login fejler i stedet for at give adgang', async () => {
    const deps = {
      fetchAccess: async () => {
        throw new DiscordError('429');
      },
      upsertUser: (u: Parameters<typeof upsertUser>[1]) => upsertUser(db, u),
    };
    await expect(applySignIn(deps, {}, { accessToken: 'at', profile })).rejects.toBeInstanceOf(DiscordError);
  });
});
```

- [ ] **Step 2: Kør og se dem fejle**

Run: `npm test -- tests/discord-access.test.ts tests/auth-callbacks.test.ts`
Expected: FAIL (moduler mangler).

- [ ] **Step 3: Implementér**

`lib/discord-access.ts`:
```ts
export type Access = { isMember: boolean; isOfficer: boolean };

export class DiscordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscordError';
  }
}

export async function fetchAccess(opts: {
  accessToken: string;
  guildId: string;
  officerRoleId: string;
  fetch?: typeof fetch;
}): Promise<Access> {
  const doFetch = opts.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`https://discord.com/api/v10/users/@me/guilds/${opts.guildId}/member`, {
      headers: { Authorization: `Bearer ${opts.accessToken}` },
    });
  } catch {
    throw new DiscordError('Discord kunne ikke nås');
  }
  if (res.status === 404) return { isMember: false, isOfficer: false };
  if (!res.ok) throw new DiscordError(`Discord svarede HTTP ${res.status}`);
  const member = (await res.json()) as { roles?: string[] };
  return { isMember: true, isOfficer: member.roles?.includes(opts.officerRoleId) ?? false };
}
```
`lib/users.ts`:
```ts
import type { Db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export async function upsertUser(
  db: Db,
  u: { discordId: string; name: string; avatar: string | null },
): Promise<number> {
  const [row] = await db
    .insert(users)
    .values(u)
    .onConflictDoUpdate({ target: users.discordId, set: { name: u.name, avatar: u.avatar } })
    .returning({ id: users.id });
  return row.id;
}
```
`lib/auth-callbacks.ts`:
```ts
import type { Access } from '@/lib/discord-access';

export type DiscordProfile = { id: string; username: string; global_name?: string | null; avatar?: string | null };
export type SignInToken = { userId?: number; isMember?: boolean; isOfficer?: boolean; [key: string]: unknown };

type Deps = {
  fetchAccess(accessToken: string): Promise<Access>;
  upsertUser(u: { discordId: string; name: string; avatar: string | null }): Promise<number>;
};

export async function applySignIn(
  deps: Deps,
  token: SignInToken,
  input: { accessToken: string; profile: DiscordProfile },
): Promise<SignInToken> {
  const access = await deps.fetchAccess(input.accessToken);
  if (!access.isMember) return { ...token, isMember: false, isOfficer: false };
  const { profile } = input;
  const userId = await deps.upsertUser({
    discordId: profile.id,
    name: profile.global_name || profile.username,
    avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null,
  });
  return { ...token, userId, isMember: true, isOfficer: access.isOfficer };
}
```

- [ ] **Step 4: Kør og se dem bestå**

Run: `npm test -- tests/discord-access.test.ts tests/auth-callbacks.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Discord-adgang (medlem/officer) og login-logik"
```

---

### Task 6: Karakter-modulet (tilføj, aktiv, rolle, frakobl, lister)

**Files:**
- Create: `lib/characters.ts`, `tests/characters.test.ts`

**Interfaces:**
- Consumes: `Db`, `characters`, `users`, `Role`, `BlizzardClient`, `BlizzardError`, `ArmoryCharacter`, `nameToSlug`, `normalizeName`, `AddFailure`; test-helpers `fakeBlizzard`, `armory`, `member`, `seedUser`.
- Produces:
```ts
export type CharactersDeps = { db: Db; blizzard: BlizzardClient; guildId: number; guildSlug: string };
export type AddResult = { ok: true; characterId: number } | { ok: false; reason: AddFailure };
export function addCharacter(deps: CharactersDeps, input: { userId: number; name: string; role: Role }): Promise<AddResult>;
export function setActiveCharacter(db: Db, userId: number, characterId: number): Promise<boolean>;
export function setRole(db: Db, userId: number, characterId: number, role: Role): Promise<boolean>;
export function unlinkCharacter(db: Db, characterId: number): Promise<void>;
export type MyCharacter = { id: number; name: string; className: string; spec: string | null; role: Role };
export function listMyCharacters(db: Db, userId: number): Promise<MyCharacter[]>;
export type Contact = { id: number; name: string; className: string; spec: string | null; role: Role; itemLevel: number | null; guildRank: number | null; inGuild: boolean; lastSynced: Date | null; ownerName: string; ownerAvatar: string | null };
export function listContacts(db: Db): Promise<Contact[]>;
```

- [ ] **Step 1: Skriv fejlende tests**

`tests/characters.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  addCharacter, listContacts, listMyCharacters, setActiveCharacter, setRole, unlinkCharacter,
  type CharactersDeps,
} from '@/lib/characters';
import { BlizzardError } from '@/lib/blizzard/types';
import { characters, users } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { armory, fakeBlizzard, member, seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const GUILD_ID = 304114;
const deps = (blizzard: CharactersDeps['blizzard']): CharactersDeps => ({ db, blizzard, guildId: GUILD_ID, guildSlug: 'aula' });

async function activeOf(userId: number) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  return u.activeCharacterId;
}

describe('addCharacter', () => {
  it('gemmer karakteren på brugeren og gør den aktiv, når det er den første', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory() } });
    const res = await addCharacter(deps(blizzard), { userId, name: 'Magi Far', role: 'dps' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [row] = await db.select().from(characters);
    expect(row).toMatchObject({ blizzardId: 1001, slug: 'magi-far', name: 'Magi Far', className: 'Mage', spec: 'Frost', role: 'dps', itemLevel: 8, inGuild: true, userId });
    expect(row.lastSynced).toBeInstanceOf(Date);
    expect(await activeOf(userId)).toBe(res.characterId);
  });

  it('ændrer ikke aktiv karakter, når der tilføjes en ekstra', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({
      characters: { 'magi-far': armory(), 'ezzek': armory({ blizzardId: 1002, slug: 'ezzek', name: 'Ezzek' }) },
    });
    const first = await addCharacter(deps(blizzard), { userId, name: 'Magi Far', role: 'dps' });
    await addCharacter(deps(blizzard), { userId, name: 'Ezzek', role: 'tank' });
    if (!first.ok) throw new Error('forventede ok');
    expect(await activeOf(userId)).toBe(first.characterId);
    expect(await listMyCharacters(db, userId)).toHaveLength(2);
  });

  it('afviser ugyldigt navn uden at kalde Blizzard', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({});
    expect(await addCharacter(deps(blizzard), { userId, name: 'a/b', role: 'dps' })).toEqual({ ok: false, reason: 'invalid_name' });
    expect(blizzard.calls).toEqual([]);
  });

  it('giver not_found, når karakteren hverken findes i armory eller roster', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({ roster: [member({ name: 'Andre', slug: 'andre' })] });
    expect(await addCharacter(deps(blizzard), { userId, name: 'Ukendt Navn', role: 'dps' })).toEqual({ ok: false, reason: 'not_found' });
    expect(await db.select().from(characters)).toHaveLength(0);
  });

  it('bruger rosterens slug, når navnet står i rosteren men slug afviger', async () => {
    const userId = await seedUser(db);
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1002, name: 'Ezzek', slug: 'ezzek-svumpukkel' })],
      characters: { 'ezzek-svumpukkel': armory({ blizzardId: 1002, slug: 'ezzek-svumpukkel', name: 'Ezzek' }) },
    });
    const res = await addCharacter(deps(blizzard), { userId, name: 'ezzek', role: 'healer' });
    expect(res.ok).toBe(true);
    const [row] = await db.select().from(characters);
    expect(row.slug).toBe('ezzek-svumpukkel');
    expect(blizzard.calls).toEqual(['character:ezzek', 'roster', 'character:ezzek-svumpukkel']);
  });

  it('afviser karakter i en anden guild eller uden guild', async () => {
    const userId = await seedUser(db);
    const other = fakeBlizzard({ characters: { 'magi-far': armory({ guildId: 999 }) } });
    expect(await addCharacter(deps(other), { userId, name: 'Magi Far', role: 'dps' })).toEqual({ ok: false, reason: 'wrong_guild' });
    const none = fakeBlizzard({ characters: { 'magi-far': armory({ guildId: null, guildName: null }) } });
    expect(await addCharacter(deps(none), { userId, name: 'Magi Far', role: 'dps' })).toEqual({ ok: false, reason: 'wrong_guild' });
    expect(await db.select().from(characters)).toHaveLength(0);
  });

  it('giver unavailable og gemmer intet, når armory er nede eller rate-limiter', async () => {
    const userId = await seedUser(db);
    for (const kind of ['unavailable', 'rate_limited'] as const) {
      const blizzard = fakeBlizzard({ characters: { 'magi-far': new BlizzardError(kind, 'x') } });
      expect(await addCharacter(deps(blizzard), { userId, name: 'Magi Far', role: 'dps' })).toEqual({ ok: false, reason: 'unavailable' });
    }
    expect(await db.select().from(characters)).toHaveLength(0);
  });

  it('afviser karakter, som en anden bruger har', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory() } });
    await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' });
    expect(await addCharacter(deps(blizzard), { userId: b, name: 'Magi Far', role: 'tank' })).toEqual({ ok: false, reason: 'taken' });
    const [row] = await db.select().from(characters);
    expect(row.userId).toBe(a);
    expect(row.role).toBe('dps');
  });

  it('siger already_yours, når brugeren selv har karakteren', async () => {
    const a = await seedUser(db, 'a');
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory() } });
    await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' });
    expect(await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' })).toEqual({ ok: false, reason: 'already_yours' });
  });

  it('lader to samtidige forsøg ende med præcis én ejer', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory() } });
    const results = await Promise.all([
      addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' }),
      addCharacter(deps(blizzard), { userId: b, name: 'Magi Far', role: 'dps' }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === 'taken')).toHaveLength(1);
    expect(await db.select().from(characters)).toHaveLength(1);
  });

  it('lader en anden bruger overtage en frakoblet karakter', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory() } });
    const first = await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' });
    if (!first.ok) throw new Error('forventede ok');
    await unlinkCharacter(db, first.characterId);
    const res = await addCharacter(deps(blizzard), { userId: b, name: 'Magi Far', role: 'healer' });
    expect(res).toEqual({ ok: true, characterId: first.characterId });
    const [row] = await db.select().from(characters);
    expect(row).toMatchObject({ userId: b, role: 'healer' });
    expect(await activeOf(b)).toBe(first.characterId);
  });
});

describe('setActiveCharacter og setRole', () => {
  it('virker kun på egne karakterer', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    const blizzard = fakeBlizzard({
      characters: { 'magi-far': armory(), ezzek: armory({ blizzardId: 1002, slug: 'ezzek', name: 'Ezzek' }) },
    });
    const mine = await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' });
    const theirs = await addCharacter(deps(blizzard), { userId: b, name: 'Ezzek', role: 'dps' });
    if (!mine.ok || !theirs.ok) throw new Error('forventede ok');

    expect(await setActiveCharacter(db, a, theirs.characterId)).toBe(false);
    expect(await activeOf(a)).toBe(mine.characterId);
    expect(await setRole(db, a, theirs.characterId, 'tank')).toBe(false);
    expect(await setRole(db, a, mine.characterId, 'tank')).toBe(true);
    const [row] = await db.select().from(characters).where(eq(characters.id, mine.characterId));
    expect(row.role).toBe('tank');
  });

  it('skifter aktiv karakter til en anden af egne', async () => {
    const a = await seedUser(db, 'a');
    const blizzard = fakeBlizzard({
      characters: { 'magi-far': armory(), ezzek: armory({ blizzardId: 1002, slug: 'ezzek', name: 'Ezzek' }) },
    });
    await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' });
    const second = await addCharacter(deps(blizzard), { userId: a, name: 'Ezzek', role: 'dps' });
    if (!second.ok) throw new Error('forventede ok');
    expect(await setActiveCharacter(db, a, second.characterId)).toBe(true);
    expect(await activeOf(a)).toBe(second.characterId);
  });
});

describe('unlinkCharacter', () => {
  it('fjerner ejer og nulstiller ejerens aktive karakter', async () => {
    const a = await seedUser(db, 'a');
    const blizzard = fakeBlizzard({ characters: { 'magi-far': armory() } });
    const res = await addCharacter(deps(blizzard), { userId: a, name: 'Magi Far', role: 'dps' });
    if (!res.ok) throw new Error('forventede ok');
    await unlinkCharacter(db, res.characterId);
    const [row] = await db.select().from(characters);
    expect(row.userId).toBeNull();
    expect(await activeOf(a)).toBeNull();
    expect(await listMyCharacters(db, a)).toEqual([]);
  });
});

describe('listContacts', () => {
  it('viser kun tilknyttede karakterer, guild-medlemmer først, med ejerens navn', async () => {
    const a = await seedUser(db, 'a');
    const b = await seedUser(db, 'b');
    await db.insert(characters).values([
      { blizzardId: 1, slug: 'zed', name: 'Zed', className: 'Rogue', role: 'dps', userId: a, inGuild: false },
      { blizzardId: 2, slug: 'abe', name: 'Abe', className: 'Mage', role: 'dps', userId: b },
      { blizzardId: 3, slug: 'bob', name: 'Bob', className: 'Priest', role: 'healer', userId: a },
      { blizzardId: 4, slug: 'orphan', name: 'Orphan', className: 'Priest', role: 'healer', userId: null },
    ]);
    const contacts = await listContacts(db);
    expect(contacts.map((c) => c.name)).toEqual(['Abe', 'Bob', 'Zed']);
    expect(contacts[0]).toMatchObject({ ownerName: 'Bruger b', inGuild: true });
    expect(contacts[2].inGuild).toBe(false);
  });
});
```

- [ ] **Step 2: Kør og se dem fejle**

Run: `npm test -- tests/characters.test.ts`
Expected: FAIL (`@/lib/characters` findes ikke).

- [ ] **Step 3: Implementér `lib/characters.ts`**

```ts
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { characters, users, type Role } from '@/lib/db/schema';
import { BlizzardError, type ArmoryCharacter, type BlizzardClient } from '@/lib/blizzard/types';
import type { AddFailure } from '@/lib/messages';
import { nameToSlug, normalizeName } from '@/lib/slug';

export type CharactersDeps = { db: Db; blizzard: BlizzardClient; guildId: number; guildSlug: string };
export type AddResult = { ok: true; characterId: number } | { ok: false; reason: AddFailure };

async function lookup(deps: CharactersDeps, slug: string, typedName: string): Promise<ArmoryCharacter> {
  try {
    return await deps.blizzard.getCharacter(slug);
  } catch (e) {
    if (!(e instanceof BlizzardError) || e.kind !== 'not_found') throw e;
    const roster = await deps.blizzard.getGuildRoster(deps.guildSlug);
    const wanted = normalizeName(typedName);
    const hit = roster.find((m) => normalizeName(m.name) === wanted);
    if (!hit || hit.slug === slug) throw e;
    return deps.blizzard.getCharacter(hit.slug);
  }
}

export async function addCharacter(
  deps: CharactersDeps,
  input: { userId: number; name: string; role: Role },
): Promise<AddResult> {
  const slug = nameToSlug(input.name);
  if (!slug) return { ok: false, reason: 'invalid_name' };

  let found: ArmoryCharacter;
  try {
    found = await lookup(deps, slug, input.name);
  } catch (e) {
    if (e instanceof BlizzardError) return { ok: false, reason: e.kind === 'not_found' ? 'not_found' : 'unavailable' };
    throw e;
  }
  if (found.guildId !== deps.guildId) return { ok: false, reason: 'wrong_guild' };

  const values = {
    blizzardId: found.blizzardId,
    slug: found.slug,
    name: found.name,
    className: found.className,
    spec: found.spec,
    role: input.role,
    itemLevel: found.itemLevel,
    inGuild: true,
    lastLogin: found.lastLogin,
    lastSynced: new Date(),
    userId: input.userId,
  };
  const { blizzardId, ...update } = values;

  const rows = await deps.db
    .insert(characters)
    .values(values)
    .onConflictDoUpdate({ target: characters.blizzardId, set: update, setWhere: isNull(characters.userId) })
    .returning({ id: characters.id });

  if (rows.length === 0) {
    const [existing] = await deps.db
      .select({ userId: characters.userId })
      .from(characters)
      .where(eq(characters.blizzardId, blizzardId));
    return { ok: false, reason: existing?.userId === input.userId ? 'already_yours' : 'taken' };
  }

  await deps.db
    .update(users)
    .set({ activeCharacterId: rows[0].id })
    .where(and(eq(users.id, input.userId), isNull(users.activeCharacterId)));
  return { ok: true, characterId: rows[0].id };
}

export async function setActiveCharacter(db: Db, userId: number, characterId: number): Promise<boolean> {
  const [owned] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
  if (!owned) return false;
  await db.update(users).set({ activeCharacterId: characterId }).where(eq(users.id, userId));
  return true;
}

export async function setRole(db: Db, userId: number, characterId: number, role: Role): Promise<boolean> {
  const rows = await db
    .update(characters)
    .set({ role })
    .where(and(eq(characters.id, characterId), eq(characters.userId, userId)))
    .returning({ id: characters.id });
  return rows.length > 0;
}

export async function unlinkCharacter(db: Db, characterId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(characters).set({ userId: null }).where(eq(characters.id, characterId));
    await tx.update(users).set({ activeCharacterId: null }).where(eq(users.activeCharacterId, characterId));
  });
}

export type MyCharacter = { id: number; name: string; className: string; spec: string | null; role: Role };

export async function listMyCharacters(db: Db, userId: number): Promise<MyCharacter[]> {
  return db
    .select({ id: characters.id, name: characters.name, className: characters.className, spec: characters.spec, role: characters.role })
    .from(characters)
    .where(eq(characters.userId, userId))
    .orderBy(asc(characters.name));
}

export type Contact = {
  id: number;
  name: string;
  className: string;
  spec: string | null;
  role: Role;
  itemLevel: number | null;
  guildRank: number | null;
  inGuild: boolean;
  lastSynced: Date | null;
  ownerName: string;
  ownerAvatar: string | null;
};

export async function listContacts(db: Db): Promise<Contact[]> {
  return db
    .select({
      id: characters.id,
      name: characters.name,
      className: characters.className,
      spec: characters.spec,
      role: characters.role,
      itemLevel: characters.itemLevel,
      guildRank: characters.guildRank,
      inGuild: characters.inGuild,
      lastSynced: characters.lastSynced,
      ownerName: users.name,
      ownerAvatar: users.avatar,
    })
    .from(characters)
    .innerJoin(users, eq(characters.userId, users.id))
    .orderBy(desc(characters.inGuild), asc(characters.name));
}
```

- [ ] **Step 4: Kør og se dem bestå**

Run: `npm test -- tests/characters.test.ts && npm run typecheck`
Expected: alle PASS. Fejler samtidighedstesten med en rå databasefejl (`23505`) i stedet for `taken`, bruger `ON CONFLICT` ikke den unikke indeks som forventet. Læs fejlen, og ret koden, ikke testen.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: karakter-modul med atomisk kobling, slug-fallback og lister"
```

---

### Task 7: Roster-synkronisering

**Files:**
- Create: `lib/sync.ts`, `tests/sync.test.ts`

**Interfaces:**
- Consumes: `Db`, `characters`, `BlizzardClient`, `BlizzardError`; test-helpers.
- Produces:
```ts
export type SyncDeps = { db: Db; blizzard: BlizzardClient; guildSlug: string; now?: () => Date; sleep?: (ms: number) => Promise<void>; concurrency?: number };
export type SyncResult = { skipped: boolean; updated: number; failed: number };
export function syncRoster(deps: SyncDeps): Promise<SyncResult>;
```

- [ ] **Step 1: Skriv fejlende tests**

`tests/sync.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { syncRoster } from '@/lib/sync';
import { BlizzardError } from '@/lib/blizzard/types';
import { characters } from '@/lib/db/schema';
import { resetDb, testDb } from './db';
import { armory, fakeBlizzard, member, seedUser } from './helpers';

const { db, close } = testDb();
beforeEach(() => resetDb(db));
afterAll(() => close());

const NOW = new Date('2026-11-10T12:00:00Z');
const OLD = new Date('2026-11-01T00:00:00Z');
const noSleep = async () => {};

async function seed(blizzardId: number, name: string, userId: number | null, extra: Partial<typeof characters.$inferInsert> = {}) {
  await db.insert(characters).values({
    blizzardId, slug: name.toLowerCase(), name, className: 'Mage', role: 'dps',
    itemLevel: 5, spec: 'Fire', guildRank: 9, inGuild: true, lastSynced: OLD, userId, ...extra,
  });
}
const row = async (blizzardId: number) => (await db.select().from(characters).where(eq(characters.blizzardId, blizzardId)))[0];
const run = (blizzard: ReturnType<typeof fakeBlizzard>, extra = {}) =>
  syncRoster({ db, blizzard, guildSlug: 'aula', now: () => NOW, sleep: noSleep, ...extra });

describe('syncRoster', () => {
  it('opdaterer rang, slug, item level, spec og last_synced for karakterer i rosteren', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha-ny', name: 'Alpha', rank: 2 })],
      characters: { 'alpha-ny': armory({ blizzardId: 1, slug: 'alpha-ny', name: 'Alpha', itemLevel: 42, spec: 'Frost', className: 'Mage' }) },
    });
    expect(await run(blizzard)).toEqual({ skipped: false, updated: 1, failed: 0 });
    expect(await row(1)).toMatchObject({ guildRank: 2, slug: 'alpha-ny', itemLevel: 42, spec: 'Frost', inGuild: true, lastSynced: NOW });
  });

  it('markerer karakterer, der ikke står i rosteren, som forladt og beholder deres data', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    const blizzard = fakeBlizzard({ roster: [] });
    expect(await run(blizzard)).toEqual({ skipped: false, updated: 0, failed: 0 });
    expect(await row(1)).toMatchObject({ inGuild: false, itemLevel: 5, spec: 'Fire', lastSynced: OLD });
    expect(blizzard.calls).toEqual(['roster']);
  });

  it('sætter forladt karakter tilbage i guilden, når den står i rosteren igen', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u, { inGuild: false });
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha', name: 'Alpha' })],
      characters: { alpha: armory({ blizzardId: 1, slug: 'alpha', name: 'Alpha' }) },
    });
    await run(blizzard);
    expect((await row(1)).inGuild).toBe(true);
  });

  it('ændrer intet og springer over, når roster-kaldet fejler', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    const blizzard = fakeBlizzard({ roster: new BlizzardError('unavailable', 'nede') });
    expect(await run(blizzard)).toEqual({ skipped: true, updated: 0, failed: 0 });
    expect(await row(1)).toMatchObject({ inGuild: true, lastSynced: OLD });
  });

  it('beholder gamle data for en karakter, der fejler, og fortsætter med resten', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    await seed(2, 'Beta', u);
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha', name: 'Alpha' }), member({ blizzardId: 2, slug: 'beta', name: 'Beta' })],
      characters: {
        alpha: new BlizzardError('unavailable', 'x'),
        beta: armory({ blizzardId: 2, slug: 'beta', name: 'Beta', itemLevel: 77 }),
      },
    });
    expect(await run(blizzard)).toEqual({ skipped: false, updated: 1, failed: 1 });
    expect(await row(1)).toMatchObject({ itemLevel: 5, lastSynced: OLD });
    expect(await row(2)).toMatchObject({ itemLevel: 77, lastSynced: NOW });
  });

  it('venter og prøver én gang igen ved rate limit', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    const waits: number[] = [];
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha', name: 'Alpha' })],
      characters: { alpha: [new BlizzardError('rate_limited', 'x'), armory({ blizzardId: 1, slug: 'alpha', name: 'Alpha', itemLevel: 50 })] },
    });
    const result = await run(blizzard, { sleep: async (ms: number) => void waits.push(ms) });
    expect(result).toEqual({ skipped: false, updated: 1, failed: 0 });
    expect(waits).toEqual([2000]);
    expect((await row(1)).itemLevel).toBe(50);
  });

  it('giver op efter ét genforsøg ved vedvarende rate limit', async () => {
    const u = await seedUser(db);
    await seed(1, 'Alpha', u);
    const blizzard = fakeBlizzard({
      roster: [member({ blizzardId: 1, slug: 'alpha', name: 'Alpha' })],
      characters: { alpha: new BlizzardError('rate_limited', 'x') },
    });
    expect(await run(blizzard)).toEqual({ skipped: false, updated: 0, failed: 1 });
    expect(blizzard.calls.filter((c) => c === 'character:alpha')).toHaveLength(2);
  });

  it('rører ikke frakoblede karakterer', async () => {
    await seed(1, 'Orphan', null);
    const blizzard = fakeBlizzard({ roster: [] });
    await run(blizzard);
    expect(await row(1)).toMatchObject({ inGuild: true, lastSynced: OLD });
  });
});
```

- [ ] **Step 2: Kør og se dem fejle**

Run: `npm test -- tests/sync.test.ts`
Expected: FAIL (`@/lib/sync` findes ikke).

- [ ] **Step 3: Implementér `lib/sync.ts`**

```ts
import { eq, isNotNull } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { characters } from '@/lib/db/schema';
import { BlizzardError, type ArmoryCharacter, type BlizzardClient } from '@/lib/blizzard/types';

export type SyncDeps = {
  db: Db;
  blizzard: BlizzardClient;
  guildSlug: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  concurrency?: number;
};

export type SyncResult = { skipped: boolean; updated: number; failed: number };

const RATE_LIMIT_WAIT_MS = 2000;

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function fetchProfile(
  blizzard: BlizzardClient,
  slug: string,
  sleep: (ms: number) => Promise<void>,
): Promise<ArmoryCharacter> {
  try {
    return await blizzard.getCharacter(slug);
  } catch (e) {
    if (e instanceof BlizzardError && e.kind === 'rate_limited') {
      await sleep(RATE_LIMIT_WAIT_MS);
      return blizzard.getCharacter(slug);
    }
    throw e;
  }
}

export async function syncRoster(deps: SyncDeps): Promise<SyncResult> {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let roster;
  try {
    roster = await deps.blizzard.getGuildRoster(deps.guildSlug);
  } catch {
    return { skipped: true, updated: 0, failed: 0 };
  }
  const byId = new Map(roster.map((m) => [m.blizzardId, m]));

  const registered = await deps.db
    .select({ id: characters.id, blizzardId: characters.blizzardId })
    .from(characters)
    .where(isNotNull(characters.userId));

  const present: { id: number; slug: string }[] = [];
  for (const c of registered) {
    const m = byId.get(c.blizzardId);
    if (!m) {
      await deps.db.update(characters).set({ inGuild: false }).where(eq(characters.id, c.id));
    } else {
      await deps.db.update(characters).set({ inGuild: true, guildRank: m.rank, slug: m.slug }).where(eq(characters.id, c.id));
      present.push({ id: c.id, slug: m.slug });
    }
  }

  let updated = 0;
  let failed = 0;
  await mapLimit(present, deps.concurrency ?? 3, async (c) => {
    try {
      const p = await fetchProfile(deps.blizzard, c.slug, sleep);
      await deps.db
        .update(characters)
        .set({
          name: p.name,
          className: p.className,
          spec: p.spec,
          itemLevel: p.itemLevel,
          lastLogin: p.lastLogin,
          lastSynced: now(),
        })
        .where(eq(characters.id, c.id));
      updated++;
    } catch {
      failed++;
    }
  });

  return { skipped: false, updated, failed };
}
```

- [ ] **Step 4: Kør og se dem bestå**

Run: `npm test -- tests/sync.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: roster-synkronisering med forladt-guild-markering og genforsøg"
```

---

### Task 8: Services, planlægger, cron-rute og instrumentation

**Files:**
- Create: `lib/services.ts`, `lib/cron-auth.ts`, `lib/scheduler.ts`, `app/api/cron/sync-roster/route.ts`, `instrumentation.ts`, `tests/cron-auth.test.ts`, `tests/scheduler.test.ts`

**Interfaces:**
- Consumes: `env()`, `getDb()`, `createBlizzardClient`, `fetchAccess`, `upsertUser`, `syncRoster`, `runMigrations`.
- Produces:
  - `getBlizzard(): BlizzardClient` (singleton), `charactersDeps(): CharactersDeps`, `runSync(): Promise<SyncResult>`, `authDeps(): { fetchAccess(accessToken: string): Promise<Access>; upsertUser(u): Promise<number> }`.
  - `isAuthorizedCron(header: string | null, secret: string): boolean`
  - `startScheduler(opts: { run: () => Promise<unknown>; intervalMs?: number; initialDelayMs?: number; log?: (msg: string, err?: unknown) => void }): () => void` (returnerer stop-funktion; to kørsler overlapper aldrig).

- [ ] **Step 1: Skriv fejlende tests**

`tests/cron-auth.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isAuthorizedCron } from '@/lib/cron-auth';

const secret = 'x'.repeat(20);

describe('isAuthorizedCron', () => {
  it('accepterer korrekt Bearer-token', () => {
    expect(isAuthorizedCron(`Bearer ${secret}`, secret)).toBe(true);
  });
  it.each([null, '', 'Bearer ', `Bearer ${secret}x`, `Basic ${secret}`, secret, 'Bearer short'])('afviser %j', (h) => {
    expect(isAuthorizedCron(h, secret)).toBe(false);
  });
});
```
`tests/scheduler.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startScheduler } from '@/lib/scheduler';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('startScheduler', () => {
  it('kører efter startforsinkelsen og derefter hvert interval', async () => {
    const run = vi.fn(async () => {});
    const stop = startScheduler({ run, intervalMs: 1000, initialDelayMs: 100, log: () => {} });
    await vi.advanceTimersByTimeAsync(99);
    expect(run).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('starter ikke en ny kørsel, mens den forrige stadig kører', async () => {
    let release!: () => void;
    const run = vi.fn(() => new Promise<void>((r) => (release = r)));
    const stop = startScheduler({ run, intervalMs: 1000, initialDelayMs: 0, log: () => {} });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(3000);
    expect(run).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
  });

  it('logger fejl og fortsætter', async () => {
    const log = vi.fn();
    const run = vi.fn(async () => {
      throw new Error('boom');
    });
    const stop = startScheduler({ run, intervalMs: 1000, initialDelayMs: 0, log });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalled();
    stop();
  });
});
```

- [ ] **Step 2: Kør og se dem fejle**

Run: `npm test -- tests/cron-auth.test.ts tests/scheduler.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementér**

`lib/cron-auth.ts`:
```ts
import { timingSafeEqual } from 'node:crypto';

export function isAuthorizedCron(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? '');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```
`lib/scheduler.ts`:
```ts
type Options = {
  run: () => Promise<unknown>;
  intervalMs?: number;
  initialDelayMs?: number;
  log?: (message: string, err?: unknown) => void;
};

export function startScheduler(opts: Options): () => void {
  const intervalMs = opts.intervalMs ?? 60 * 60 * 1000;
  const log = opts.log ?? ((m, e) => console.error(m, e));
  let running = false;
  let interval: ReturnType<typeof setInterval> | undefined;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await opts.run();
    } catch (err) {
      log('Planlagt synkronisering fejlede', err);
    } finally {
      running = false;
    }
  };

  const first = setTimeout(() => {
    void tick();
    interval = setInterval(() => void tick(), intervalMs);
    interval.unref?.();
  }, opts.initialDelayMs ?? 30_000);
  first.unref?.();

  return () => {
    clearTimeout(first);
    if (interval) clearInterval(interval);
  };
}
```
`lib/services.ts`:
```ts
import { createBlizzardClient } from '@/lib/blizzard/client';
import type { BlizzardClient } from '@/lib/blizzard/types';
import type { CharactersDeps } from '@/lib/characters';
import { getDb } from '@/lib/db';
import { fetchAccess } from '@/lib/discord-access';
import { env } from '@/lib/env';
import { syncRoster, type SyncResult } from '@/lib/sync';
import { upsertUser } from '@/lib/users';

const g = globalThis as unknown as { __aulaBlizzard?: BlizzardClient };

export function getBlizzard(): BlizzardClient {
  g.__aulaBlizzard ??= createBlizzardClient({
    clientId: env().BLIZZARD_CLIENT_ID,
    clientSecret: env().BLIZZARD_CLIENT_SECRET,
  });
  return g.__aulaBlizzard;
}

export function charactersDeps(): CharactersDeps {
  return { db: getDb(), blizzard: getBlizzard(), guildId: env().BLIZZARD_GUILD_ID, guildSlug: env().BLIZZARD_GUILD_SLUG };
}

export function runSync(): Promise<SyncResult> {
  return syncRoster({ db: getDb(), blizzard: getBlizzard(), guildSlug: env().BLIZZARD_GUILD_SLUG });
}

export function authDeps() {
  return {
    fetchAccess: (accessToken: string) =>
      fetchAccess({ accessToken, guildId: env().DISCORD_GUILD_ID, officerRoleId: env().DISCORD_OFFICER_ROLE_ID }),
    upsertUser: (u: { discordId: string; name: string; avatar: string | null }) => upsertUser(getDb(), u),
  };
}
```
`app/api/cron/sync-roster/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { env } from '@/lib/env';
import { runSync } from '@/lib/services';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isAuthorizedCron(request.headers.get('authorization'), env().CRON_SECRET)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(await runSync());
}
```
`instrumentation.ts`:
```ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const g = globalThis as unknown as { __aulaStarted?: boolean };
  if (g.__aulaStarted) return;
  g.__aulaStarted = true;

  const { env } = await import('@/lib/env');
  const config = env();

  if (config.AUTO_MIGRATE) {
    const { getDb } = await import('@/lib/db');
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations(getDb());
    console.log('Migrationer kørt');
  }

  if (config.SYNC_ENABLED) {
    const { startScheduler } = await import('@/lib/scheduler');
    const { runSync } = await import('@/lib/services');
    startScheduler({
      run: async () => {
        const r = await runSync();
        console.log('Roster-synkronisering', r);
      },
    });
    console.log('Time-planlægger startet');
  }
}
```

- [ ] **Step 4: Kør tests og typecheck**

Run: `npm test -- tests/cron-auth.test.ts tests/scheduler.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: services, time-planlægger, cron-rute og instrumentation"
```

---

### Task 9: Auth.js, session og adgangskontrol

**Files:**
- Create: `auth.ts`, `types/next-auth.d.ts`, `app/api/auth/[...nextauth]/route.ts`, `lib/session.ts`, `app/login/page.tsx`, `app/ingen-adgang/page.tsx`

**Interfaces:**
- Consumes: `applySignIn`, `authDeps()`.
- Produces:
  - `auth`, `signIn`, `signOut`, `handlers` (fra `auth.ts`).
  - `type Member = { userId: number; name: string; image: string | null; isOfficer: boolean }`
  - `requireMember(): Promise<Member>` (redirect til `/login` uden session, `/ingen-adgang` uden medlemskab)
  - `requireOfficer(): Promise<Member>` (kaster `Error('Forbidden')` for ikke-officer; bruges i server actions)

- [ ] **Step 1: Skriv `types/next-auth.d.ts`**

```ts
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: { id: number; isMember: boolean; isOfficer: boolean } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: number;
    isMember?: boolean;
    isOfficer?: boolean;
  }
}
```

- [ ] **Step 2: Skriv `auth.ts`**

```ts
import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';
import { applySignIn, type DiscordProfile } from '@/lib/auth-callbacks';
import { authDeps } from '@/lib/services';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Discord({ authorization: { params: { scope: 'identify guilds.members.read' } } })],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  trustHost: true,
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token && profile) {
        return applySignIn(authDeps(), token, {
          accessToken: account.access_token,
          profile: profile as unknown as DiscordProfile,
        });
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId ?? 0;
      session.user.isMember = token.isMember === true;
      session.user.isOfficer = token.isOfficer === true;
      return session;
    },
  },
});
```
(`jwt`-callbacken kaster `DiscordError` ved Discord-fejl, og Auth.js viser sin fejlside. Ingen session oprettes, så ingen får adgang.)

- [ ] **Step 3: Skriv rute og session-hjælpere**

`app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
```
`lib/session.ts`:
```ts
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export type Member = { userId: number; name: string; image: string | null; isOfficer: boolean };

export async function requireMember(): Promise<Member> {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!session.user.isMember || !session.user.id) redirect('/ingen-adgang');
  return {
    userId: session.user.id,
    name: session.user.name ?? 'Ukendt',
    image: session.user.image ?? null,
    isOfficer: session.user.isOfficer,
  };
}

export async function requireOfficer(): Promise<Member> {
  const member = await requireMember();
  if (!member.isOfficer) throw new Error('Forbidden');
  return member;
}
```

- [ ] **Step 4: Skriv login- og ingen-adgang-sider**

`app/login/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.isMember) redirect('/');
  return (
    <main className="center-card">
      <h1>AULA</h1>
      <p>Log ind med Discord for at komme ind på guildens side.</p>
      <form
        action={async () => {
          'use server';
          await signIn('discord', { redirectTo: '/' });
        }}
      >
        <button type="submit" className="btn">Log ind med Discord</button>
      </form>
    </main>
  );
}
```
`app/ingen-adgang/page.tsx`:
```tsx
import { signOut } from '@/auth';

export default function NoAccessPage() {
  return (
    <main className="center-card">
      <h1>Ingen adgang</h1>
      <p>Din Discord-konto er ikke medlem af guildens Discord-server. Bed en officer om en invitation, og log ind igen.</p>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/login' });
        }}
      >
        <button type="submit" className="btn">Log ud</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: ingen fejl. Fejler typerne for `profile` eller `account` i `jwt`-callbacken på grund af beta-version af `next-auth`, så ret typerne efter de faktiske, men behold logikken uændret.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Auth.js med Discord-login, adgangskontrol og session-hjælpere"
```

---

### Task 10: AULA-skal, tema og server actions

**Files:**
- Create: `app/globals.css`, `components/Shell.tsx`, `components/NavLink.tsx`, `components/ProfileMenu.tsx`, `components/ThemeToggle.tsx`, `app/(app)/layout.tsx`, `app/(app)/actions.ts`
- Modify: `app/layout.tsx`
- Delete: `app/page.tsx` (afløses af `app/(app)/page.tsx` i Task 12)

**Interfaces:**
- Consumes: `requireMember`, `requireOfficer`, `listMyCharacters`, `setActiveCharacter`, `setRole`, `unlinkCharacter`, `addCharacter`, `charactersDeps`, `addCharacterMessage`, `roleLabel`, `signOut`.
- Produces (`app/(app)/actions.ts`, alle `'use server'`):
  - `setActiveAction(formData)` (felt `characterId`)
  - `setRoleAction(formData)` (felter `characterId`, `role`)
  - `unlinkAction(formData)` (felt `characterId`, kun officer)
  - `addCharacterAction(prev: AddState, formData): Promise<AddState>` med `type AddState = { error?: string }`; redirecter til `/kontakter` ved succes
  - `signOutAction()`

- [ ] **Step 1: Skriv `app/globals.css`**

```css
:root {
  --topbar: #00788c;
  --logo: #005b6b;
  --nav: #6c8593;
  --nav-active: #1f4d5c;
  --badge: #a30b52;
  --bg: #e9eff2;
  --card: #ffffff;
  --text: #1c2b33;
  --heading: #00505f;
  --muted: #5d7280;
  --border: #d3dde2;
  --danger: #a30b52;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --bg: #0f1a1f; --card: #172830; --text: #e3edf1; --heading: #7fd0e0;
    --muted: #92a8b3; --border: #26414c; --nav: #2b4650; --nav-active: #00788c;
  }
}
:root[data-theme='dark'] {
  --bg: #0f1a1f; --card: #172830; --text: #e3edf1; --heading: #7fd0e0;
  --muted: #92a8b3; --border: #26414c; --nav: #2b4650; --nav-active: #00788c;
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: Lato, system-ui, sans-serif; }
h1, h2 { color: var(--heading); font-weight: 800; margin: 0 0 12px; }
a { color: inherit; }

.topbar { display: flex; align-items: center; height: 56px; background: var(--topbar); color: #fff; }
.logo { width: 100px; height: 100%; background: var(--logo); display: grid; place-items: center; font-weight: 800; font-size: 22px; }
.topbar-right { margin-left: auto; display: flex; align-items: center; gap: 12px; padding-right: 16px; }
.layout { display: flex; min-height: calc(100vh - 56px); }
.sidenav { width: 100px; background: var(--nav); display: flex; flex-direction: column; }
.navlink { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 4px; color: #fff; text-decoration: none; font-size: 13px; }
.navlink[aria-current='page'] { background: var(--nav-active); }
.content { flex: 1; padding: 24px 16px; max-width: 1100px; margin: 0 auto; width: 100%; }
.card { background: var(--card); border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12); margin-bottom: 16px; }

.btn { background: var(--topbar); color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; font: inherit; font-weight: 700; cursor: pointer; }
.btn.secondary { background: transparent; color: var(--heading); border: 1px solid var(--border); }
.btn.danger { background: transparent; color: var(--danger); border: 1px solid var(--danger); padding: 4px 10px; }
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.field input, .field select { padding: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--card); color: var(--text); font: inherit; }
.error { color: var(--danger); font-weight: 700; }
.muted { color: var(--muted); }
.center-card { max-width: 420px; margin: 12vh auto; background: var(--card); padding: 28px; border-radius: 12px; text-align: center; }

table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; }
tr.left-guild td { opacity: 0.55; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: var(--border); font-size: 12px; }

details.profile { position: relative; }
details.profile summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 8px; }
details.profile .menu { position: absolute; right: 0; top: 40px; width: 280px; background: var(--card); color: var(--text); border-radius: 12px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25); padding: 14px; z-index: 10; }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--logo); object-fit: cover; }

@media (max-width: 700px) {
  .layout { flex-direction: column-reverse; }
  .sidenav { width: 100%; flex-direction: row; position: sticky; bottom: 0; }
  .navlink { flex: 1; }
  .logo { width: 64px; }
  .table-wrap { overflow-x: auto; }
}
```

- [ ] **Step 2: Skriv `app/layout.tsx`**

```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'AULA – guild' };

const themeScript = `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```
Slet `app/page.tsx`.

- [ ] **Step 3: Skriv klientkomponenter**

`components/NavLink.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link href={href} className="navlink" aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  );
}
```
`components/ThemeToggle.tsx`:
```tsx
'use client';

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
  }
  return (
    <button type="button" className="btn secondary" onClick={toggle} aria-label="Skift mellem lys og mørk tilstand">
      Lys/mørk
    </button>
  );
}
```

- [ ] **Step 4: Skriv server actions**

`app/(app)/actions.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { signOut } from '@/auth';
import { addCharacter, setActiveCharacter, setRole, unlinkCharacter } from '@/lib/characters';
import { getDb } from '@/lib/db';
import { roles, type Role } from '@/lib/db/schema';
import { addCharacterMessage } from '@/lib/messages';
import { charactersDeps } from '@/lib/services';
import { requireMember, requireOfficer } from '@/lib/session';

export type AddState = { error?: string };

function toId(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toRole(value: FormDataEntryValue | null): Role | null {
  return roles.find((r) => r === value) ?? null;
}

export async function setActiveAction(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = toId(formData.get('characterId'));
  if (id) await setActiveCharacter(getDb(), member.userId, id);
  revalidatePath('/', 'layout');
}

export async function setRoleAction(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = toId(formData.get('characterId'));
  const role = toRole(formData.get('role'));
  if (id && role) await setRole(getDb(), member.userId, id, role);
  revalidatePath('/', 'layout');
}

export async function unlinkAction(formData: FormData): Promise<void> {
  await requireOfficer();
  const id = toId(formData.get('characterId'));
  if (id) await unlinkCharacter(getDb(), id);
  revalidatePath('/', 'layout');
}

export async function addCharacterAction(_prev: AddState, formData: FormData): Promise<AddState> {
  const member = await requireMember();
  const role = toRole(formData.get('role'));
  const name = String(formData.get('name') ?? '');
  if (!role) return { error: 'Vælg en rolle.' };
  const result = await addCharacter(charactersDeps(), { userId: member.userId, name, role });
  if (!result.ok) return { error: addCharacterMessage(result.reason) };
  revalidatePath('/', 'layout');
  redirect('/kontakter');
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}
```

- [ ] **Step 5: Skriv `ProfileMenu`, `Shell` og `(app)/layout`**

`components/ProfileMenu.tsx`:
```tsx
import Link from 'next/link';
import { roles, type Role } from '@/lib/db/schema';
import { roleLabel } from '@/lib/messages';
import type { MyCharacter } from '@/lib/characters';
import { setActiveAction, setRoleAction, signOutAction } from '@/app/(app)/actions';

export function ProfileMenu({
  name, image, characters, activeId,
}: { name: string; image: string | null; characters: MyCharacter[]; activeId: number | null }) {
  const active = characters.find((c) => c.id === activeId) ?? null;
  return (
    <details className="profile">
      <summary>
        {image ? <img className="avatar" src={image} alt="" /> : <span className="avatar" />}
        <span>{active ? active.name : name}</span>
      </summary>
      <div className="menu">
        <strong>{name}</strong>
        {characters.length === 0 && <p className="muted">Du har ingen karakter endnu.</p>}
        {characters.map((c) => (
          <form key={c.id} action={setActiveAction}>
            <input type="hidden" name="characterId" value={c.id} />
            <button type="submit" className="btn secondary" style={{ width: '100%', margin: '6px 0' }} disabled={c.id === activeId}>
              {c.name} · {c.className} · {roleLabel(c.role)}
              {c.id === activeId ? ' (aktiv)' : ''}
            </button>
          </form>
        ))}
        {active && (
          <form action={setRoleAction} className="field">
            <input type="hidden" name="characterId" value={active.id} />
            <label htmlFor="role">Rolle for {active.name}</label>
            <select id="role" name="role" defaultValue={active.role}>
              {roles.map((r: Role) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
            <button type="submit" className="btn secondary">Gem rolle</button>
          </form>
        )}
        <p><Link href="/karakter/ny">Tilføj karakter</Link></p>
        <form action={signOutAction}><button type="submit" className="btn secondary">Log ud</button></form>
      </div>
    </details>
  );
}
```
`components/Shell.tsx`:
```tsx
import type { MyCharacter } from '@/lib/characters';
import type { Member } from '@/lib/session';
import { NavLink } from './NavLink';
import { ProfileMenu } from './ProfileMenu';
import { ThemeToggle } from './ThemeToggle';

export function Shell({
  member, characters, activeId, children,
}: { member: Member; characters: MyCharacter[]; activeId: number | null; children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="logo">Aula</div>
        <div className="topbar-right">
          <ThemeToggle />
          <ProfileMenu name={member.name} image={member.image} characters={characters} activeId={activeId} />
        </div>
      </header>
      <div className="layout">
        <nav className="sidenav" aria-label="Hovedmenu">
          <NavLink href="/">Overblik</NavLink>
          <NavLink href="/kontakter">Kontakter</NavLink>
        </nav>
        <main className="content">{children}</main>
      </div>
    </>
  );
}
```
`app/(app)/layout.tsx`:
```tsx
import { eq } from 'drizzle-orm';
import { Shell } from '@/components/Shell';
import { listMyCharacters } from '@/lib/characters';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { requireMember } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const db = getDb();
  const [characters, [user]] = await Promise.all([
    listMyCharacters(db, member.userId),
    db.select({ active: users.activeCharacterId }).from(users).where(eq(users.id, member.userId)),
  ]);
  return (
    <Shell member={member} characters={characters} activeId={user?.active ?? null}>
      {children}
    </Shell>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: ingen fejl. (Siderne `/` og `/kontakter` oprettes i næste tasks; `NavLink` linker til dem, men typecheck bryder ikke på det.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: AULA-skal, tema, profilmenu og server actions"
```

---

### Task 11: Overblik, Tilføj karakter og Kontakter

**Files:**
- Create: `app/(app)/page.tsx`, `app/(app)/karakter/ny/page.tsx`, `app/(app)/karakter/ny/AddCharacterForm.tsx`, `app/(app)/kontakter/page.tsx`

**Interfaces:**
- Consumes: `requireMember`, `listContacts`, `getDb`, `addCharacterAction`, `unlinkAction`, `roleLabel`, `formatDateTime`, `roles`.

- [ ] **Step 1: Skriv Overblik**

`app/(app)/page.tsx`:
```tsx
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { characters, users } from '@/lib/db/schema';
import { roleLabel } from '@/lib/messages';
import { requireMember } from '@/lib/session';

export default async function OverviewPage() {
  const member = await requireMember();
  const db = getDb();
  const [row] = await db
    .select({ name: characters.name, className: characters.className, spec: characters.spec, role: characters.role, itemLevel: characters.itemLevel })
    .from(users)
    .innerJoin(characters, eq(characters.id, users.activeCharacterId))
    .where(eq(users.id, member.userId));

  return (
    <>
      <h1>Velkommen, {member.name}</h1>
      <section className="card">
        <h2>Din aktive karakter</h2>
        {row ? (
          <p>
            <strong>{row.name}</strong> · {row.className}
            {row.spec ? ` (${row.spec})` : ''} · {roleLabel(row.role)}
            {row.itemLevel != null ? ` · item level ${row.itemLevel}` : ''}
          </p>
        ) : (
          <p>
            Du har ingen karakter endnu. <Link href="/karakter/ny">Tilføj din første karakter</Link>.
          </p>
        )}
      </section>
      <section className="card">
        <p className="muted">Opslag og næste raid kommer snart.</p>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Skriv Tilføj karakter**

`app/(app)/karakter/ny/AddCharacterForm.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { addCharacterAction, type AddState } from '@/app/(app)/actions';

const roleOptions = [
  { value: 'tank', label: 'Tank' },
  { value: 'healer', label: 'Healer' },
  { value: 'dps', label: 'DPS' },
];

export function AddCharacterForm() {
  const [state, action, pending] = useActionState<AddState, FormData>(addCharacterAction, {});
  return (
    <form action={action} className="card">
      <div className="field">
        <label htmlFor="name">Karakterens navn (fornavn og efternavn)</label>
        <input id="name" name="name" required maxLength={60} autoComplete="off" placeholder="fx Magi Far" />
      </div>
      <div className="field">
        <label htmlFor="role">Rolle</label>
        <select id="role" name="role" defaultValue="dps">
          {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? 'Slår op i armory …' : 'Tilføj karakter'}
      </button>
    </form>
  );
}
```
`app/(app)/karakter/ny/page.tsx`:
```tsx
import { AddCharacterForm } from './AddCharacterForm';

export default function NewCharacterPage() {
  return (
    <>
      <h1>Tilføj karakter</h1>
      <p className="muted">Karakteren slås op i armory og skal stå i guilden AULA. Klasse, spec og item level hentes automatisk.</p>
      <AddCharacterForm />
    </>
  );
}
```

- [ ] **Step 3: Skriv Kontakter**

`app/(app)/kontakter/page.tsx`:
```tsx
import { unlinkAction } from '@/app/(app)/actions';
import { listContacts } from '@/lib/characters';
import { getDb } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { roleLabel } from '@/lib/messages';
import { requireMember } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  const member = await requireMember();
  const contacts = await listContacts(getDb());
  return (
    <>
      <h1>Kontakter</h1>
      <div className="card table-wrap">
        {contacts.length === 0 ? (
          <p>Ingen karakterer endnu.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Karakter</th><th>Spiller</th><th>Klasse</th><th>Rolle</th>
                <th>Item level</th><th>Rang</th><th>Sidst synkroniseret</th>
                {member.isOfficer && <th />}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className={c.inGuild ? undefined : 'left-guild'}>
                  <td>
                    <strong>{c.name}</strong>
                    {!c.inGuild && <> <span className="badge">forladt guild</span></>}
                  </td>
                  <td>{c.ownerName}</td>
                  <td>{c.className}{c.spec ? ` (${c.spec})` : ''}</td>
                  <td>{roleLabel(c.role)}</td>
                  <td>{c.itemLevel ?? '–'}</td>
                  <td>{c.guildRank ?? '–'}</td>
                  <td>{formatDateTime(c.lastSynced)}</td>
                  {member.isOfficer && (
                    <td>
                      <form action={unlinkAction}>
                        <input type="hidden" name="characterId" value={c.id} />
                        <button type="submit" className="btn danger">Frakobl</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Typecheck og build**

Run: `npm run typecheck`
Expected: ingen fejl.

Run (build kræver ingen miljøvariabler, fordi `env()` er doven):
```bash
npm run build
```
Expected: build lykkes. Fejler det med `env`/`DATABASE_URL`, evalueres noget ved import-tidspunkt. Find kilden og gør den doven, i stedet for at sætte falske miljøvariabler til buildet.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Overblik, Tilføj karakter og Kontakter"
```

---

### Task 12: Kontrol af adgangsreglerne og samlet testkørsel

**Files:**
- Create: `tests/access-policy.test.ts`

Formålet er at bevise reglerne "ikke i serveren / medlem / officer" for de to server-side tjek, der ikke er dækket af tidligere tests: `requireMember` og `requireOfficer`.

- [ ] **Step 1: Skriv fejlende test**

`tests/access-policy.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
vi.mock('@/auth', () => ({ auth: () => authMock() }));
class Redirect extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
  }
}
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));

import { requireMember, requireOfficer } from '@/lib/session';

const user = (over: object) => ({ user: { id: 7, name: 'R', image: null, isMember: true, isOfficer: false, ...over } });

beforeEach(() => authMock.mockReset());

describe('requireMember', () => {
  it('sender uden session til /login', async () => {
    authMock.mockResolvedValue(null);
    await expect(requireMember()).rejects.toMatchObject({ to: '/login' });
  });
  it('sender ikke-medlem til /ingen-adgang', async () => {
    authMock.mockResolvedValue(user({ isMember: false, id: 0 }));
    await expect(requireMember()).rejects.toMatchObject({ to: '/ingen-adgang' });
  });
  it('giver medlem adgang', async () => {
    authMock.mockResolvedValue(user({}));
    expect(await requireMember()).toEqual({ userId: 7, name: 'R', image: null, isOfficer: false });
  });
});

describe('requireOfficer', () => {
  it('afviser medlem uden officer-rolle', async () => {
    authMock.mockResolvedValue(user({}));
    await expect(requireOfficer()).rejects.toThrow('Forbidden');
  });
  it('giver officer adgang', async () => {
    authMock.mockResolvedValue(user({ isOfficer: true }));
    expect((await requireOfficer()).isOfficer).toBe(true);
  });
  it('afviser ikke-medlem før officer-tjekket', async () => {
    authMock.mockResolvedValue(user({ isMember: false, isOfficer: true, id: 0 }));
    await expect(requireOfficer()).rejects.toMatchObject({ to: '/ingen-adgang' });
  });
});
```

- [ ] **Step 2: Kør**

Run: `npm test -- tests/access-policy.test.ts`
Expected: PASS (implementationen findes fra Task 9; testen skal være grøn, og hvis den ikke er, så er adgangskontrollen forkert, så ret `lib/session.ts`).

- [ ] **Step 3: Kør alle tests og typecheck**

Run: `npm test && npm run typecheck`
Expected: alle tests grønne.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: adgangsregler for medlem og officer"
```

---

### Task 13: Docker, compose, backup, pipeline og README

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `public/.gitkeep`, `deploy/docker-compose.yml`, `deploy/.env.example`, `deploy/backup.sh`, `deploy/watchtower/docker-compose.yml`, `.github/workflows/build-and-push.yml`, `README.md`

**Interfaces:**
- Produces: image `ghcr.io/rasmusaaendev/aula-guild:main`, lytter på port 3000 i containeren, mapper til `127.0.0.1:8102`.

- [ ] **Step 1: Skriv `.dockerignore` og `Dockerfile`**

`.dockerignore`:
```
node_modules
.next
.git
.env
.env.local
docs
tests
data
```
`Dockerfile`:
```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```
Opret tom `public/.gitkeep`.

- [ ] **Step 2: Byg imaget lokalt**

Run: `docker build -t aula-guild:test .`
Expected: bygger uden fejl. Fejler `COPY drizzle`, er migrationerne ikke genereret, så kør Task 2 Step 5.

- [ ] **Step 3: Skriv `deploy/docker-compose.yml` (efter `sekvens-chat`-mønstret)**

```yaml
name: prod-aula-guild

services:
  app:
    image: ghcr.io/rasmusaaendev/aula-guild:main
    container_name: prod-aula-guild
    restart: unless-stopped
    init: true
    stop_grace_period: 15s
    env_file: .env
    labels:
      - com.centurylinklabs.watchtower.enable=true
      - com.centurylinklabs.watchtower.scope=aula
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "127.0.0.1:8102:3000"

  db:
    image: postgres:16-alpine
    container_name: prod-aula-guild-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: aula
      POSTGRES_USER: aula
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aula -d aula"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```
`deploy/.env.example`:
```
DB_PASSWORD=
DATABASE_URL=postgres://aula:<DB_PASSWORD>@db:5432/aula

AUTH_SECRET=
AUTH_URL=https://aula.aaensoftware.com
AUTH_DISCORD_ID=
AUTH_DISCORD_SECRET=

DISCORD_GUILD_ID=
DISCORD_OFFICER_ROLE_ID=

BLIZZARD_CLIENT_ID=
BLIZZARD_CLIENT_SECRET=
BLIZZARD_GUILD_SLUG=aula
BLIZZARD_GUILD_ID=304114

CRON_SECRET=
SYNC_ENABLED=true
AUTO_MIGRATE=true
```

- [ ] **Step 4: Skriv `deploy/backup.sh`**

```bash
#!/usr/bin/env bash
# Natligt dump af AULA-databasen. Brug: BACKUP_DIR=/srv/backups/aula deploy/backup.sh
set -euo pipefail

CONTAINER="${CONTAINER:-prod-aula-guild-db}"
BACKUP_DIR="${BACKUP_DIR:?Sæt BACKUP_DIR}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/aula-$(date +%Y%m%d-%H%M%S).sql.gz"
docker exec "$CONTAINER" pg_dump -U aula -d aula | gzip > "$file.tmp"
gzip -t "$file.tmp"
mv "$file.tmp" "$file"
find "$BACKUP_DIR" -name 'aula-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "Backup gemt: $file"
```
Run: `chmod +x deploy/backup.sh`

- [ ] **Step 5: Prøv backup mod dev-databasen og gendannelse**

Run:
```bash
CONTAINER=aula-dev-db BACKUP_DIR=/tmp/claude-1000/-home-rasmus-development/4118293f-3c74-48c6-a597-08cf59b6cf55/scratchpad/aula-backup deploy/backup.sh
f=$(ls /tmp/claude-1000/-home-rasmus-development/4118293f-3c74-48c6-a597-08cf59b6cf55/scratchpad/aula-backup/aula-*.sql.gz | head -1)
docker exec aula-dev-db createdb -U aula aula_restore
gunzip -c "$f" | docker exec -i aula-dev-db psql -q -U aula -d aula_restore
docker exec aula-dev-db psql -U aula -d aula_restore -c '\dt'
docker exec aula-dev-db dropdb -U aula aula_restore
```
Expected: `Backup gemt: …`, og `\dt` viser tabellerne `users` og `characters` (og `__drizzle_migrations` i skemaet `drizzle`, som ikke vises her). Det beviser, at en dump kan gendannes.

- [ ] **Step 6: Skriv GitHub Actions-workflow**

`.github/workflows/build-and-push.yml`:
```yaml
name: Build and push

on:
  push:
    branches: [main]

permissions:
  contents: read
  packages: write

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: aula
          POSTGRES_PASSWORD: aula
          POSTGRES_DB: aula_test
        ports: ["55433:5432"]
        options: >-
          --health-cmd "pg_isready -U aula" --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/rasmusaaendev/aula-guild:main
```

- [ ] **Step 7: Skriv `README.md`**

Skriv en kort README på dansk med: hvad projektet er, hvordan man starter udvikling (`docker compose -f docker-compose.dev.yml up -d`, `createdb aula_test`, `cp .env.example .env.local`, `npm run dev`), at tests kræver dev-databasen, miljøvariablerne (henvis til `.env.example`), første deploy (kopiér `deploy/` til en mappe på maskinen, fx `/srv/aula-guild`, `cp .env.example .env`, udfyld, `docker compose pull && up -d`, og start derefter Watchtower med `docker compose -f watchtower/docker-compose.yml up -d`; forklar, at pakken `ghcr.io/rasmusaaendev/aula-guild` enten gøres offentlig (anbefalet, koden indeholder ingen hemmeligheder) eller at `watchtower/docker-compose.yml` får monteret en egen `docker-config.json` med en PAT med `read:packages`), backup-cron-linjen (`15 3 * * * BACKUP_DIR=/srv/backups/aula /srv/aula-guild/backup.sh`), og at Cloudflare Tunnel-route `aula.aaensoftware.com → localhost:8102` oprettes i dashboardet. Ingen hemmeligheder i filen.

- [ ] **Step 8: Egen Watchtower til AULA (adskilt fra Sekvens)**

Der kører ingen Watchtower på denne maskine, og Sekvens' Watchtower (hvis den findes andre steder) må ikke bruges eller ændres. AULA får sin egen instans, som kun rører containere med scope `aula`, og kun app-containeren har den label (databasen får aldrig automatiske opdateringer).

Skriv `deploy/watchtower/docker-compose.yml`:
```yaml
name: aula-watchtower

services:
  watchtower:
    image: containrrr/watchtower
    container_name: aula-watchtower
    restart: unless-stopped
    environment:
      DOCKER_API_VERSION: "1.44"
      WATCHTOWER_SCOPE: aula
      WATCHTOWER_LABEL_ENABLE: "true"
      WATCHTOWER_POLL_INTERVAL: "300"
      WATCHTOWER_CLEANUP: "true"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      # Kun hvis imaget er privat: en docker-login med read:packages til RasmusAaenDev's GHCR.
      # Fjern kommentaren og peg på en fil, der kun indeholder AULA's egen login:
      # - ./docker-config.json:/config.json:ro
```

Denne maskine kører Docker 29 (minimum API 1.40), og det gamle `containrrr/watchtower` er arkiveret og taler som standard en for gammel API-version. Verificér derfor, at instansen virker, i stedet for at antage det:

Run:
```bash
docker compose -f deploy/watchtower/docker-compose.yml run --rm watchtower --run-once --debug
docker compose -f deploy/watchtower/docker-compose.yml logs --no-color 2>&1 | tail -20
```
Expected: ingen fejl om `client version … is too old` eller `API version`, og en linje om at scopet er `aula`. Fejler det stadig med `DOCKER_API_VERSION=1.44`, så skift til et vedligeholdt fork (undersøg hvilket image der er aktivt vedligeholdt, fx ved at læse dets README/releases), ret `image:` i filen, og skriv i commit-beskeden hvilket image du valgte og hvorfor. Opdatér ikke Sekvens' filer, og brug ikke `/home/rasmus/development/server-stacks`.

Prøv derefter, at kun den scopede app-container ville blive opdateret: start en midlertidig test-container med begge labels (`docker run -d --name aula-wt-test --label com.centurylinklabs.watchtower.enable=true --label com.centurylinklabs.watchtower.scope=aula ghcr.io/rasmusaaendev/aula-guild:main`, hvilket fejler, hvis imaget endnu ikke findes, og så er testen ikke udført, og det skrives i rapporten) og en uden labels, og kør `--run-once --debug`. Forventet i loggen: kun den labelede container nævnes. Fjern testcontainerne bagefter (`docker rm -f aula-wt-test`).

Hvis imaget ikke findes endnu (det bygges først af pipelinen efter første push), så skriv ærligt i rapporten, at scope-testen ikke kunne gennemføres, og at den skal køres ved første udrulning.

- [ ] **Step 9: Commit i AULA-Guild**

```bash
git add -A
git commit -m "chore: Docker, compose, backup, pipeline og README"
```

---

### Task 14: Verifikation mod rigtige Blizzard- og Discord-API'er

Dette er den manuelle kørsel, specen kræver. Den kræver, at brugeren har oprettet en **ny** Blizzard-klient og en Discord-app, og at værdierne ligger i `.env.local`. Uden dem kan tasken ikke køres, og det skal siges ligeud i stedet for at antage, at flowet virker.

**Files:**
- Create: `scripts/verify-armory.ts`
- Modify (kun hvis verifikationen afslører afvigelser): `lib/blizzard/client.ts`, `tests/blizzard-client.test.ts`

- [ ] **Step 1: Skriv `scripts/verify-armory.ts`**

```ts
import { createBlizzardClient } from '@/lib/blizzard/client';
import { BlizzardError } from '@/lib/blizzard/types';

const clientId = process.env.BLIZZARD_CLIENT_ID;
const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;
const guildSlug = process.env.BLIZZARD_GUILD_SLUG ?? 'aula';
const guildId = Number(process.env.BLIZZARD_GUILD_ID ?? 304114);
if (!clientId || !clientSecret) throw new Error('Sæt BLIZZARD_CLIENT_ID og BLIZZARD_CLIENT_SECRET');

const blizzard = createBlizzardClient({ clientId, clientSecret });
const roster = await blizzard.getGuildRoster(guildSlug);
console.log(`Roster: ${roster.length} medlemmer`);

let bad = 0;
for (const m of roster) {
  try {
    const c = await blizzard.getCharacter(m.slug);
    const issues: string[] = [];
    if (c.blizzardId !== m.blizzardId) issues.push(`id ${c.blizzardId} ≠ roster ${m.blizzardId}`);
    if (c.guildId !== guildId) issues.push(`guildId ${c.guildId}`);
    if (c.spec === null) issues.push('spec mangler');
    if (c.itemLevel === null) issues.push('item level mangler');
    console.log(`${issues.length ? 'AFVIGELSE' : 'ok       '} ${m.name} (${m.slug}) ${c.className} spec=${c.spec} ilvl=${c.itemLevel} ${issues.join('; ')}`);
    if (issues.length) bad++;
  } catch (e) {
    bad++;
    console.log(`FEJL      ${m.name} (${m.slug}): ${e instanceof BlizzardError ? e.kind : e}`);
  }
}
console.log(bad === 0 ? 'Alle roster-medlemmer kan slås op på rosterens slug.' : `${bad} afvigelser. Se ovenfor.`);
process.exit(bad === 0 ? 0 : 1);
```

- [ ] **Step 2: Kør mod rigtig Blizzard-API**

Run: `npx tsx --env-file=.env.local scripts/verify-armory.ts`
Expected: 12 linjer. Registrér for hver afvigelse hvad der mangler. Gå så igennem de tre antagelser:
- `spec mangler` for alle: Forevers profil har ikke `active_spec`. Tilføj et kald til `/profile/wow/character/{slug}/specializations` i `getCharacter`, bestem ud fra det rigtige svar hvilket felt der angiver aktiv spec, opdatér fixture og test i `tests/blizzard-client.test.ts` til den faktiske form, og kør testene.
- `FEJL … not_found` for medlemmer, hvis slug kommer fra `nameToSlug`: href-antagelsen holder ikke. Undersøg rosterens rigtige felter og ret `slugFromHref`/mappingen og testen.
- Alt `ok`: antagelserne 1 og 2 er bekræftet. Notér det i commit-beskeden.

- [ ] **Step 3: Test slug-opslag for navne, spillerne skriver**

For to eller flere roster-medlemmer, hvor `slug` ≠ `nameToSlug(name)` (fx `Ezzek` → `ezzek-svumpukkel`), kør Tilføj karakter-flowet i appen (Step 5) og bekræft, at fallback via rosteren finder dem. Findes der ingen sådanne medlemmer, så skriv det i commit-beskeden.

- [ ] **Step 4: Verificér Discord-antagelsen**

Start appen (`npm run dev`) med Discord-app og server-id i `.env.local`, og log ind med (a) en konto i serveren, (b) en konto uden for serveren, hvis en findes. Forventet: (a) kommer ind, (b) lander på `/ingen-adgang`. Svarer Discord ikke `404` for (b), men en anden kode, ses det som en Auth.js-fejlside. Så ret `fetchAccess` og testen til det faktiske svar.

- [ ] **Step 5: Manuel gennemgang af hele flowet**

Med `npm run dev`:
1. Log ind som medlem. Forventet: Overblik med "Du har ingen karakter endnu".
2. Tilføj din karakter. Forventet: omdirigering til Kontakter, rækken står der med klasse, spec, item level.
3. Prøv samme karakter fra en anden konto (eller ryd `user_id`-koblingen manuelt). Forventet: "allerede koblet til en anden spiller".
4. Prøv et navn der ikke findes. Forventet: "Karakteren findes ikke i armory".
5. Skift rolle og aktiv karakter i profilmenuen. Forventet: ændringen vises efter genindlæsning.
6. Som officer: frakobl en karakter. Forventet: rækken forsvinder.
7. Som ikke-officer: bekræft, at "Frakobl" ikke vises, og at et direkte kald til `unlinkAction` afvises (kaster `Forbidden`).
8. Kald cron-ruten: `curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/sync-roster` → JSON med `skipped`, `updated`, `failed`. Uden header → 403.
9. Skift browserens tema, og åbn siden i mobilbredde (≤700 px). Forventet: menu i bunden, tabellen kan scrolles.

Fuldfør ikke tasken, hvis et trin ikke er set virke. Skriv resultatet (hvad blev set, hvad blev ikke) i commit-beskeden.

- [ ] **Step 5b: Ekstra kontroller fra slutreviewet (kræver rigtig Cloudflare Tunnel og rigtige nøgler)**

1. Roster-id og profil-id er samme id-rum: `verify-armory.ts` rapporterer allerede `id ≠ roster` som afvigelse. Skulle det ske, ville hver synkronisering markere alle som afvist (profil-id'et matcher ikke), så ret `getCharacter`/rosterens id-felt, før noget udrulles.
2. Cloudflare Tunnel bevarer `Host: aula.aaensoftware.com`. Hvis appen ser `localhost:8102`, afviser Next.js' server actions (inkl. login-knappen) forespørgslen. Prøv login via det rigtige domæne. Hvis det fejler, sæt `experimental.serverActions.allowedOrigins` i `next.config.ts`.
3. `X-Forwarded-Proto: https` når frem, så Auth.js sætter sikre cookies. Tjek i browserens devtools, at sessionscookien har flaget Secure.
4. Login-fejlsiden: tving en Discord-fejl (fx forkert `DISCORD_GUILD_ID` eller offline) og bekræft, at `/login` viser den danske besked.

Fuldfør ikke tasken, hvis et af punkterne ikke er set virke. Skriv hvad der er set og ikke set i commit-beskeden.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: verifikationsscript og rettelser fra kørsel mod rigtige API'er"
```

---

## Self-review (skrevet efter planen)

**Spec-dækning:**
- Hosting, port, Cloudflare Tunnel, prod-only → Task 13 (+ README, portliste). `cloudflared` røres ikke; routen oprettes af brugeren (Task 13 Step 7).
- `lib/blizzard` (token-cache, 401-genforsøg, fejltyper) → Task 4. Namespace/host/ingen realm → Task 4 test.
- `lib/discord-access`, 12 timers JWT, DiscordError giver ikke adgang → Task 5 og 9.
- `lib/characters` inkl. atomisk "én karakter, én bruger", frakobl, overtag → Task 6.
- `lib/sync` inkl. skip ved roster-fejl, forladt guild, rate-limit-genforsøg, fejlisolering, kun tilknyttede → Task 7.
- Indbygget planlægger + manuel cron-rute med `CRON_SECRET` → Task 8.
- Tilføj-flow og alle danske fejlbeskeder fra spec → Task 3 (`messages.ts`) og 6, 10, 11.
- Sider: skal, Overblik, Kontakter, profilmenu, ingen adgang → Task 9–11. Lys/mørk og mobilmenu → Task 10 (CSS, ThemeToggle).
- Officer frakobler, server-side tjek → Task 10 (`requireOfficer`), Task 12.
- Backup → Task 13. Test mod ægte API → Task 14.
- Hemmeligheder aldrig i git → `.gitignore`, `.env.example` uden værdier.

**Placeholders:** Ingen "TODO/TBD". Task 13 Step 7 (README) er beskrevet som indhold i stedet for fuld tekst, fordi det er dokumentation, ikke kode; indholdet er opregnet punkt for punkt.

**Typekonsistens:** `Db`, `Role`, `AddFailure`, `ArmoryCharacter` (`guildId`), `RosterMember`, `BlizzardClient`, `CharactersDeps`, `Contact`, `MyCharacter`, `SyncDeps`, `SyncResult`, `Access`, `Member` bruges med samme navne og felter i alle tasks. `requireMember` returnerer `userId`, som `actions.ts`, `layout` og siderne bruger.

**Kendte risici der ikke kan lukkes uden rigtige nøgler:** de fem punkter under "Kendte usikkerheder". Kun Task 14 kan lukke dem.
