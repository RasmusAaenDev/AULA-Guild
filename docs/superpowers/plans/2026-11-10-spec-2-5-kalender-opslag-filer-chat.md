# Spec 2–5 Implementation Plan (kalender, opslag, filer/galleri, guild-chat)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bygge kalender med tilmelding og ugentlige serier, opslag med kommentarer/faner/ulæst-tæller, filer og galleri med upload, og en valgfri læs-kun guild-chat, oven på spec 1.

**Architecture:** Samme lagdeling som spec 1: små moduler i `lib/` med deres afhængigheder (db, tid, fetch) som parametre og tests mod den rigtige test-database, tynde server-komponenter og server actions i `app/(app)/`, og route handlers kun hvor server actions ikke egner sig (filupload og -download, chat-polling). Nye tabeller via Drizzle-migrationer.

**Tech Stack:** Next.js 16 (app router), React 19, Auth.js v5, Drizzle ORM + Postgres, Zod, Vitest (som spec 1).

**Afvigelse fra writing-plans:** Denne plan indeholder præcise grænseflader, adfærd og testlister, men ikke al kode. Implementererne skriver koden test-først. Specen er `docs/superpowers/specs/2026-11-10-spec-2-5-kalender-opslag-filer-chat-design.md` og er kilden til alle regler. Hver task nævner de afsnit, den bygger på.

## Global Constraints

Gælder implicit for alle tasks:

- UI-sprog er dansk. Ingen engelske brugervendte tekster, heller ikke i fejlbeskeder.
- Tidspunkter gemmes i UTC (`timestamptz`) og vises i `Europe/Copenhagen` via `lib/format.ts`/`lib/time.ts`.
- Alle sider og handlinger kræver `requireMember()` (siderne selv, ikke kun layoutet). Officer-handlinger kræver `requireOfficer()` server-side. Ejerskab og rettigheder tjekkes i SQL eller i modulet, aldrig kun i UI.
- Brugerindhold gengives som tekst (React escaper). Aldrig `dangerouslySetInnerHTML` med brugerdata.
- Al input valideres server-side (Zod eller eksplicitte tjek) med danske fejlbeskeder.
- Moduler i `lib/` tager `db: Db` (fra `@/lib/db`) og evt. `now: Date`/`fetch` som parametre og importerer aldrig `getDb()`/`env()` selv, undtagen `lib/services.ts`, `lib/env.ts` og route/page-lag.
- Tests kører mod test-databasen (`tests/db.ts`: `testDb()`, `resetDb()`). `resetDb` skal udvides, så den også tømmer nye tabeller (se Task 1).
- Hver task: typecheck (`npm run typecheck`), hele testsuiten (`npm test`) og `npm run build` (skal lykkes uden miljøvariabler) før commit.
- Next.js 16 har brudændringer. Læs relevante dokumenter i `node_modules/next/dist/docs/` før du bruger en API (fx async `params`/`searchParams`, route handlers, server actions, `redirect`, `revalidatePath`). `AGENTS.md` i roden siger det samme.
- Hemmeligheder aldrig i git, image eller klientkode. Intet nyt må kræve `NEXT_PUBLIC_`.
- Menu (Task 5, 9, 10 udvider den): Overblik, Kalender, Filer, Galleri, (Chat kun hvis konfigureret), Kontakter. Ingen døde links: et menupunkt tilføjes først, når siden findes.
- Commit-beskeder slutter med de to linjer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` og `Claude-Session: https://claude.ai/code/session_01SwiqsNimvFc2krW7ymVpdH`.

## Eksisterende grænseflader (fra spec 1) som tasks bygger på

- `lib/db/index.ts`: `type Db`, `getDb()`, `createDb(url)`. `lib/db/schema.ts`: `users`, `characters`, `roles`, `Role`, `roleEnum`.
- `lib/session.ts`: `requireMember(): Promise<Member>`, `requireOfficer()`, `type Member = { userId: number; name: string; image: string | null; isOfficer: boolean }`.
- `lib/characters.ts`: `setActiveCharacter(db, userId, characterId): Promise<boolean>`, `unlinkCharacter(db, characterId): Promise<void>`, `listMyCharacters`, `listContacts`.
- `lib/format.ts`: `formatDateTime(date: Date | null): string`. `lib/messages.ts`: `roleLabel(role)`.
- `lib/services.ts`: `runSync()`, `charactersDeps()`, `authDeps()`. `instrumentation.ts` starter planlæggeren, som kalder `runSync`.
- `components/Shell.tsx` (menu), `app/(app)/layout.tsx` (henter session, karakterer, aktiv karakter), `app/globals.css` (temaer, `.card`, `.btn`, `.field`, `.error`, `.badge`, `.muted`, tabelstil).
- `tests/helpers.ts`: `seedUser(db, discordId?)`, `armory`, `member`, `fakeBlizzard`, `jsonResponse`.

---

## Spec 2: Kalender

### Task 1: Tidshjælpere og kalenderskema

**Bygger på:** spec 2 «Datamodel», «Tidshåndtering».

**Files:**
- Create: `lib/time.ts`, `tests/time.test.ts`, migration i `drizzle/`
- Modify: `lib/db/schema.ts`, `tests/db.ts` (`resetDb` tømmer også de nye tabeller; brug `truncate table rsvps, events, event_series, characters, users restart identity cascade`)

**Interfaces — Produces:**
```ts
// lib/time.ts
export type LocalToUtc = { ok: true; utc: Date } | { ok: false; reason: 'invalid' | 'nonexistent' };
export function copenhagenToUtc(date: string /* YYYY-MM-DD */, time: string /* HH:MM */): LocalToUtc;
export function utcToCopenhagen(d: Date): { date: string; time: string; weekday: number /* 0 = mandag … 6 = søndag */ };
export function addDaysToDate(date: string, days: number): string; // ren kalenderregning på YYYY-MM-DD
export function todayInCopenhagen(now: Date): string;
// lib/db/schema.ts
export const eventTypes = ['raid', 'aften'] as const; export type EventType = (typeof eventTypes)[number];
export const rsvpStatuses = ['deltager', 'maaske', 'afbud'] as const; export type RsvpStatus = (typeof rsvpStatuses)[number];
export const eventSeries, events, rsvps // tabeller som i specens datamodel (kolonnenavne i snake_case)
```

**Behavior:**
- `copenhagenToUtc` afviser ugyldige datoer (`2026-02-30`, `24:00`, tom streng) med `invalid`, afviser tider der springes over ved sommertidsskiftet med `nonexistent`, og vælger den første forekomst af en tid, der forekommer to gange ved vintertidsskiftet. Brug `Intl.DateTimeFormat` med `timeZone: 'Europe/Copenhagen'` (ingen ekstra pakke).
- Tabeller: `event_series`, `events`, `rsvps` med kolonner, typer, enums og unikke indeks fra specen (`events (series_id, starts_at)` hvor `series_id is not null`; `rsvps (event_id, user_id)`). Fremmednøgler: `rsvps.event_id → events.id on delete cascade`, `rsvps.user_id → users.id on delete cascade`, `rsvps.character_id → characters.id on delete cascade`, `events.created_by → users.id`, `events.series_id → event_series.id on delete set null`.

**Tests (`tests/time.test.ts`, rene):**
- Vintertid: `2026-11-10 20:00` → `2026-11-10T19:00:00Z`. Sommertid: `2026-07-10 20:00` → `2026-07-10T18:00:00Z`.
- Sommertidsskifte 2027-03-28: `02:30` → `nonexistent`; `03:30` → gyldig (`01:30Z`); `01:59` → `00:59Z`.
- Vintertidsskifte 2026-10-25: `02:30` → første forekomst (`00:30Z`); `03:00` → `02:00Z`.
- Ugyldige: `2026-02-30`, `2026-13-01`, `25:00`, `12:60`, `abc`.
- `utcToCopenhagen` runder rigtigt over midnat (fx `2026-07-10T22:30Z` → `2026-07-11 00:30`, weekday for den 11.) og giver mandag = 0, søndag = 6.
- `addDaysToDate('2026-02-27', 2)` = `2026-03-01`; `todayInCopenhagen` over midnat dansk tid.
- (`tests/db.test.ts` eller en ny `tests/calendar-schema.test.ts`:) unik `(event_id, user_id)` på `rsvps` afviser dublet; unik `(series_id, starts_at)` afviser dublet; slettet event sletter dets tilmeldinger.

- [ ] Skriv testene (RED), implementér `lib/time.ts`, udvid skemaet, kør `npm run db:generate`, læs den genererede SQL (enums, tabeller, unikke indeks), kør alt (GREEN), commit.

### Task 2: Events-modul

**Bygger på:** spec 2 «Rettigheder», «Interaktionsanalyse».

**Files:** Create `lib/events.ts`, `tests/events.test.ts`.

**Interfaces — Produces:**
```ts
export type EventActor = { userId: number; isOfficer: boolean };
export type EventInput = { type: EventType; title: string; description: string | null; startsAt: Date; durationMinutes: number | null };
export type Counts = { tank: number; healer: number; dps: number; total: number }; // kun status 'deltager'
export type EventListItem = { id: number; type: EventType; title: string; startsAt: Date; durationMinutes: number | null; cancelled: boolean; seriesId: number | null; counts: Counts; myStatus: RsvpStatus | null };
export type Attendee = { userId: number; userName: string; characterId: number; characterName: string; className: string; role: Role; status: RsvpStatus };
export type EventDetail = { id: number; type: EventType; title: string; description: string | null; startsAt: Date; durationMinutes: number | null; cancelled: boolean; seriesId: number | null; createdBy: number; creatorName: string; attendees: Attendee[]; counts: Counts };
export function createEvent(db: Db, actor: EventActor, input: EventInput, now?: Date): Promise<{ ok: true; eventId: number } | { ok: false; reason: 'forbidden' | 'invalid' | 'in_past' }>;
export function updateEvent(db: Db, actor: EventActor, eventId: number, patch: Omit<EventInput, 'type'>, now?: Date): Promise<{ ok: true } | { ok: false; reason: 'forbidden' | 'not_found' | 'invalid' | 'in_past' | 'cancelled' }>;
export function cancelEvent(db: Db, actor: EventActor, eventId: number): Promise<{ ok: true } | { ok: false; reason: 'forbidden' | 'not_found' }>;
export function getEvent(db: Db, eventId: number): Promise<EventDetail | null>;
export function listUpcomingEvents(db: Db, userId: number, now?: Date, opts?: { limit?: number }): Promise<EventListItem[]>;
export function validateEventFields(f: { title: string; description: string | null; durationMinutes: number | null }): 'ok' | 'invalid'; // titel 1–100 efter trim, beskrivelse ≤ 2000, varighed null eller 15–720
```

**Behavior:**
- `createEvent`: `raid` kræver `isOfficer`, ellers `forbidden`. Ugyldige felter → `invalid`. `startsAt <= now` → `in_past`. Titel trimmes. `created_by = actor.userId`.
- `updateEvent`: tilladt for officerer og for opretteren af en `aften`. `not_found` hvis eventet ikke findes. `cancelled` hvis aflyst. Er `startsAt` ændret, skal den nye være i fremtiden (`in_past`). Redigering af et event, der hører til en serie, sætter `detached = true`. Typen kan ikke ændres.
- `cancelEvent`: som `updateEvent`-rettighederne; sætter `cancelled_at = now()`; idempotent (aflyste events giver `ok`).
- `listUpcomingEvents`: events med `starts_at > now − 3 timer`, i stigende `starts_at`-rækkefølge, med aflyste events inkluderet (markeret). `counts` tæller tilmeldinger med status `deltager` pr. rolle for den tilmeldte karakters rolle. `myStatus` er brugerens status eller `null`. `limit` standard 50.
- `getEvent`: `attendees` sorteret efter status (`deltager`, `maaske`, `afbud`), derefter rolle (`tank`, `healer`, `dps`), derefter karakternavn.

**Tests:** officer/ikke-officer opretter `raid` og `aften`; ugyldig titel/varighed/beskrivelse; datoer i fortiden; opdatering af egen aften, andens aften (forbidden), officer redigerer andens aften, redigering sætter `detached` kun for serie-events; ændring til tid i fortiden; opdatering af aflyst event; aflysning (idempotent, rettigheder); `listUpcomingEvents` rækkefølge, 3-timers vindue, aflyste vist, rolleoptælling kun for `deltager`, `myStatus`; `getEvent` sortering og `null` for ukendt id. Tilmeldinger indsættes direkte i testene (rsvps-modulet kommer i Task 3).

- [ ] Test først (RED) → implementér → GREEN → commit.

### Task 3: Tilmeldinger og karakterskift

**Bygger på:** spec 2 «Beslutninger», «Interaktionsanalyse».

**Files:** Create `lib/rsvps.ts`, `tests/rsvps.test.ts`. Modify `lib/characters.ts`, `tests/characters.test.ts`.

**Interfaces — Produces:**
```ts
export function setRsvp(db: Db, userId: number, eventId: number, status: RsvpStatus, now?: Date): Promise<{ ok: true } | { ok: false; reason: 'no_character' | 'not_found' | 'closed' }>;
export function clearRsvp(db: Db, userId: number, eventId: number, now?: Date): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'closed' }>;
export function reassignUpcomingRsvps(tx: Db /* db eller transaktion */, args: { userId: number; fromCharacterId?: number; toCharacterId: number | null; now?: Date }): Promise<void>;
```

**Behavior:**
- `setRsvp`: slår brugerens aktive karakter op (`users.active_character_id`; skal tilhøre brugeren, ellers `no_character`). `not_found` hvis eventet ikke findes, `closed` hvis aflyst eller `starts_at <= now`. Upsert på `(event_id, user_id)` med karakteren, status og `updated_at`.
- `reassignUpcomingRsvps`: for kommende (`starts_at > now`), ikke-aflyste events: er `toCharacterId` sat, opdateres brugerens tilmeldinger (kun dem med `character_id = fromCharacterId`, hvis `fromCharacterId` er givet, ellers alle brugerens) til den; er den `null`, slettes de.
- `lib/characters.ts`: `setActiveCharacter` kalder `reassignUpcomingRsvps` med `toCharacterId = characterId` i samme transaktion som opdateringen (kun når opdateringen ramte en række). `unlinkCharacter` kalder den i sin eksisterende transaktion for tilmeldinger med `fromCharacterId = den frakoblede`, med `toCharacterId` = ejerens aktive karakter efter frakoblingen (den, som blev udpeget i frakoblingen) eller `null`. Eksisterende adfærd og tests må ikke ændres.

**Tests:** tilmelding første gang, ændring af status, flere brugere; uden aktiv karakter; lukket (startet/aflyst); ukendt event; `clearRsvp`; skift aktiv karakter flytter kommende tilmeldinger men ikke tidligere/aflyste; frakobling af den aktive karakter flytter til ejerens næste karakter, og uden anden karakter slettes de kommende tilmeldinger; frakobling af en ikke-aktiv karakter flytter kun tilmeldinger med netop den karakter; en anden brugers tilmeldinger røres aldrig; eksisterende tests i `tests/characters.test.ts` er stadig grønne.

- [ ] Test først → implementér → GREEN → commit.

### Task 4: Serier og generator

**Bygger på:** spec 2 «Serier (generator)».

**Files:** Create `lib/series.ts`, `tests/series.test.ts`. Modify `lib/services.ts` (ny `runScheduledJobs`), `instrumentation.ts`, `tests/` for den nye funktion hvor det giver mening.

**Interfaces — Produces:**
```ts
export type SeriesInput = { type: EventType; title: string; description: string | null; weekday: number /* 0–6 */; startTime: string /* HH:MM */; durationMinutes: number | null };
export type SeriesRow = SeriesInput & { id: number; active: boolean; createdBy: number; upcomingCount: number };
export function createSeries(db: Db, actor: EventActor, input: SeriesInput, now?: Date): Promise<{ ok: true; seriesId: number; generated: number } | { ok: false; reason: 'forbidden' | 'invalid' }>;
export function updateSeries(db: Db, actor: EventActor, seriesId: number, input: SeriesInput, now?: Date): Promise<{ ok: true; regenerated: number; keptWithRsvps: number } | { ok: false; reason: 'forbidden' | 'not_found' | 'invalid' }>;
export function deactivateSeries(db: Db, actor: EventActor, seriesId: number, now?: Date): Promise<{ ok: true; removed: number; keptWithRsvps: number } | { ok: false; reason: 'forbidden' | 'not_found' }>;
export function listSeries(db: Db, now?: Date): Promise<SeriesRow[]>;
export function generateSeriesEvents(db: Db, now?: Date, horizonDays?: number /* 28 */): Promise<{ created: number }>;
// lib/services.ts
export function runScheduledJobs(): Promise<{ sync: SyncResult | { error: string }; series: { created: number } | { error: string } }>;
```

**Behavior:** præcis som specens «Serier (generator)» og «Rettigheder»: kun officerer; `invalid` ved ugyldig `weekday`/`startTime`/felter. Forekomster beregnes i dansk tid med `lib/time.ts`; et ikke-eksisterende klokkeslæt (sommertidshul) springes over for den dato; kun forekomster med `starts_at > now` i `[i dag, i dag + horisont]`. Indsættelse med `ON CONFLICT (series_id, starts_at) DO NOTHING`; `created` = antal faktisk indsatte. `updateSeries`/`deactivateSeries`: slet fremtidige, ikke-aflyste, ikke-`detached` events uden tilmeldinger (`removed`), tæl dem med tilmeldinger (`keptWithRsvps`), opdatér serien, og for `updateSeries` generér derefter (`regenerated` = nyoprettede). `deactivateSeries` sætter `active = false`. `runScheduledJobs` kører `runSync()` og dernæst `generateSeriesEvents(getDb())`, hver for sig i try/catch, og logger fejl. Planlæggeren i `instrumentation.ts` kalder `runScheduledJobs` i stedet for `runSync` (cron-ruten forbliver uændret).

**Tests:** oprettelse genererer 4 eller 5 forekomster for ugedagen inden for 28 dage; kører generatoren to gange, oprettes intet nyt; sommer- og vintertid giver samme dansk klokkeslæt men forskellig UTC; hul-dato springes over; aflyst forekomst genskabes ikke; ændring af klokkeslæt flytter fremtidige uberørte events; event med tilmelding forbliver uændret og tælles; `detached` event røres ikke; deaktivering fjerner kun uberørte fremtidige events; kun officerer; `runScheduledJobs` kører generatoren selv om synkroniseringen fejler (stub afhængigheder; hvis `runScheduledJobs` ikke kan testes direkte, flyt logikken til en lille funktion med injicerede afhængigheder og test den).

- [ ] Test først → implementér → GREEN → commit.

### Task 5: Kalendersider og menu

**Bygger på:** spec 2 «Sider», «Interaktionsanalyse».

**Files:** Create `app/(app)/kalender/page.tsx`, `app/(app)/kalender/[id]/page.tsx`, `app/(app)/kalender/[id]/rediger/page.tsx`, `app/(app)/kalender/ny/page.tsx`, `app/(app)/kalender/serier/page.tsx`, `app/(app)/kalender/actions.ts`, `app/(app)/kalender/EventForm.tsx`, `app/(app)/kalender/SeriesForm.tsx`, `components/NextEvents.tsx`. Modify `components/Shell.tsx` (menupunkt «Kalender»), `app/(app)/page.tsx` (indsæt `NextEvents`), `app/globals.css` (det der skal bruges).

**Interfaces — Consumes:** Task 1–4 (`lib/time.ts`, `lib/events.ts`, `lib/rsvps.ts`, `lib/series.ts`), `requireMember`, `requireOfficer`.

**Interfaces — Produces (server actions i `kalender/actions.ts`, alle `'use server'`):**
```ts
export type FormState = { error?: string };
export function createEventAction(prev: FormState, formData: FormData): Promise<FormState>; // redirecter til /kalender/[id]
export function updateEventAction(prev: FormState, formData: FormData): Promise<FormState>;
export function cancelEventAction(formData: FormData): Promise<void>;
export function setRsvpAction(formData: FormData): Promise<void>; // felter: eventId, status
export function clearRsvpAction(formData: FormData): Promise<void>;
export function createSeriesAction(prev: FormState, formData: FormData): Promise<FormState>;
export function updateSeriesAction(prev: FormState, formData: FormData): Promise<FormState>;
export function deactivateSeriesAction(formData: FormData): Promise<void>;
```

**Behavior:**
- Formularer (klientkomponenter med `useActionState`): `EventForm` (type — «Raid» vises kun for officerer —, titel, dato, tid, varighed i minutter, beskrivelse), `SeriesForm` (type, titel, ugedag, klokkeslæt, varighed, beskrivelse). Actions parser felter med Zod, omregner dato+tid med `copenhagenToUtc` (fejlbeskeder på dansk: «Tidspunktet findes ikke (sommertidsskifte)», «Ugyldig dato eller tid», «Tidspunktet ligger i fortiden», …), kalder modulerne, mapper `reason` til danske beskeder og revaliderer (`revalidatePath`). Alle actions starter med `requireMember()`/`requireOfficer()`.
- `/kalender`: kommende events grupperet pr. dag (overskrift = «mandag 16. november» dansk format), kort med type-mærke, titel, tid, rolleoptælling («2 tank · 3 healer · 8 dps») og egen status. Aflyste nedtonet med «Aflyst». Knap «Opret event»; officerer ser «Gentagne events».
- `/kalender/[id]` (`params` er async i Next 16): detaljer; tilmeldingspanel med tre knapper (aktiv status fremhævet), «Fjern tilmelding»; deaktiveret med forklaring hvis lukket; hvis ingen aktiv karakter: link til «Tilføj karakter». Deltagerliste grupperet efter status. Knapper «Redigér» og «Aflys» for dem, der må (opretter af egen aften, officerer). Ukendt id → `notFound()`.
- `/kalender/serier`: officerer (ellers redirect til `/kalender`): liste med ugedag, tid, antal kommende events og aktiv/inaktiv; opret; redigér og deaktivér; efter redigering/deaktivering vises «N events har tilmeldinger og blev ikke ændret», hvis N > 0 (send som søgeparameter eller flash i URL).
- `NextEvents` (server-komponent): «Næste raid» og «Næste aften» (første ikke-aflyste kommende event af hver type) med brugerens status og de tre tilmeldingsknapper; «Ingen planlagte raids/aftener» når der ingen er.
- Datoformat via `lib/time.ts`/`Intl` med `timeZone: 'Europe/Copenhagen'` og `da-DK`.

**Tests:** logikken er dækket af Task 1–4. Skriv en test for en lille ren hjælper, hvis du tilføjer en (fx gruppering af events pr. dag, `groupByDay(items)`, og mapping `reason → dansk besked`). Verificér ellers med typecheck, `npm run build` og kør dev-serveren (`npm run dev`, port 3000, intet login muligt uden session; tjek at ruterne bygger og at siderne redirecter til `/login` uden session via `curl -i`).

- [ ] Implementér, verificér, commit.

---

## Spec 3: Opslag og kommentarer

### Task 6: Opslagsskema og -modul

**Bygger på:** spec 3 «Datamodel», «Regler», «Interaktionsanalyse».

**Files:** Create `lib/posts.ts`, `tests/posts.test.ts`, migration. Modify `lib/db/schema.ts`, `tests/db.ts` (`resetDb` tømmer også `post_reads, comments, posts`).

**Interfaces — Produces:**
```ts
export type PostTab = 'alle' | 'ulaeste' | 'vigtige';
export type PostListItem = { id: number; title: string; excerpt: string /* højst 200 tegn */; authorName: string; createdAt: Date; pinned: boolean; commentCount: number; unread: boolean };
export type CommentItem = { id: number; authorId: number; authorName: string; body: string; createdAt: Date };
export type PostDetail = { id: number; title: string; body: string; authorId: number; authorName: string; createdAt: Date; pinned: boolean; comments: CommentItem[]; unread: boolean };
export function createPost(db: Db, userId: number, input: { title: string; body: string }): Promise<{ ok: true; postId: number } | { ok: false; reason: 'invalid' }>;
export function addComment(db: Db, userId: number, postId: number, body: string): Promise<{ ok: true; commentId: number } | { ok: false; reason: 'invalid' | 'not_found' }>;
export function deletePost(db: Db, actor: { userId: number; isOfficer: boolean }, postId: number): Promise<{ ok: true } | { ok: false; reason: 'forbidden' | 'not_found' }>;
export function deleteComment(db: Db, actor: { userId: number; isOfficer: boolean }, commentId: number): Promise<{ ok: true } | { ok: false; reason: 'forbidden' | 'not_found' }>;
export function setPinned(db: Db, actor: { userId: number; isOfficer: boolean }, postId: number, pinned: boolean): Promise<{ ok: true } | { ok: false; reason: 'forbidden' | 'not_found' }>;
export function markPostRead(db: Db, userId: number, postId: number): Promise<void>;
export function listPosts(db: Db, userId: number, tab: PostTab, page: number /* 1-baseret */, pageSize?: number /* 20 */): Promise<{ items: PostListItem[]; hasMore: boolean }>;
export function getPost(db: Db, userId: number, postId: number): Promise<PostDetail | null>;
export function countUnread(db: Db, userId: number): Promise<number>;
```
Tabeller `posts`, `comments`, `post_reads` som i specen (soft delete via `deleted_at`; `post_reads` primærnøgle `(user_id, post_id)`; fremmednøgler med `on delete cascade` hvor det er naturligt).

**Behavior:** Regler og grænser som specen (titel 1–120 efter trim, tekst 1–5000, kommentar 1–2000). `createPost` indsætter opslag og forfatterens `post_reads`-række i én transaktion. Forfatteren kan slette eget opslag/kommentar; officerer alle; kun officerer fastgør (`setPinned` sætter også `pinned_at`). Slettede opslag og kommentarer returneres aldrig og kan ikke kommenteres. `listPosts`: fastgjorte først (nyeste `pinned_at` først), derefter nyeste `created_at`; fane `ulaeste` = ikke slettede uden læsemarkering for brugeren; fane `vigtige` = fastgjorte; `hasMore` bestemmes ved at hente `pageSize + 1`. `commentCount` tæller kun ikke-slettede kommentarer. `getPost` returnerer kommentarer i stigende tid. `countUnread` er antallet i fanen `ulaeste`. `authorName` = brugerens Discord-navn (`users.name`).

**Tests:** oprettelse og validering (grænser præcist), forfatterens opslag er læst fra start, kommentarer (inkl. slettet opslag), sletterettigheder (forfatter, officer, fremmed), fastgør (kun officer), sortering, faner, sideinddeling (`pageSize` 2), tæller, `markPostRead` idempotent, slettede ting skjules og tæller ikke som ulæste, `getPost` for slettet/ukendt giver `null`.

- [ ] Test først → implementér → migration → GREEN → commit.

### Task 7: Opslagssider, Overblik og tæller

**Bygger på:** spec 3 «Sider».

**Files:** Create `app/(app)/opslag/ny/page.tsx`, `app/(app)/opslag/[id]/page.tsx`, `app/(app)/opslag/actions.ts`, `app/(app)/opslag/PostForm.tsx`, `app/(app)/opslag/CommentForm.tsx`, `app/(app)/opslag/MarkRead.tsx`. Modify `app/(app)/page.tsx` (Overblik), `app/(app)/layout.tsx` og `components/Shell.tsx` (ulæst-tæller på menupunktet «Overblik»), `app/globals.css`.

**Interfaces — Consumes:** Task 6 og Task 5 (`NextEvents`). **Produces (`opslag/actions.ts`, `'use server'`):** `createPostAction(prev, formData): Promise<FormState>` (redirect til opslaget), `addCommentAction(prev, formData): Promise<FormState>`, `deletePostAction(formData)`, `deleteCommentAction(formData)`, `setPinnedAction(formData)`, `markReadAction(postId: number): Promise<void>`.

**Behavior:** Overblik (`/`) viser velkomst og aktiv karakter (som nu), «Næste raid/aften» (`NextEvents`), faner ALLE/ULÆSTE/VIGTIGE som lænker `?fane=alle|ulaeste|vigtige` (`searchParams` er async; ukendt værdi → alle), opslagskort (fastgjort-mærke, forfatter, tid, titel, uddrag, antal kommentarer, «Ny»-mærke for ulæste), «Vis flere» (`?side=`), og «Nyt opslag». `/opslag/[id]`: hele opslaget (linjeskift bevares via `white-space: pre-wrap`), kommentarer, kommentarformular, slet/fastgør efter ret; `MarkRead` er en klientkomponent, der ved montering kalder `markReadAction` (kun hvis opslaget er ulæst) og derefter `router.refresh()`. Ulæst-tælleren hentes i `(app)/layout.tsx` med `countUnread` og vises som magenta tæller (`--badge`) ved siden af «Overblik», skjult ved 0. Alle actions starter med `requireMember()`; officer-handlinger med `requireOfficer()`.

**Tests:** ren hjælper (uddrag/afkortning) hvis du tilføjer en. Ellers typecheck, build og røgtest af ruter (`curl -i` giver redirect til `/login` uden session).

- [ ] Implementér, verificér, commit.

---

## Spec 4: Filer og galleri

### Task 8: Filskema, lagring og ruter

**Bygger på:** spec 4 «Regler», «Interaktionsanalyse».

**Files:** Create `lib/files.ts`, `tests/files.test.ts`, `app/api/filer/route.ts` (POST), `app/api/filer/[id]/route.ts` (GET), migration. Modify `lib/db/schema.ts`, `tests/db.ts` (`resetDb` tømmer `files`), `lib/env.ts` (valgfrie `UPLOAD_DIR` standard `./data/uploads`, `MAX_UPLOAD_MB` standard 10, `MAX_TOTAL_MB` standard 2048; `.env.example`).

**Interfaces — Produces:**
```ts
export type FileSection = 'filer' | 'galleri';
export type DetectedType = { mime: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'application/pdf' };
export function detectType(head: Uint8Array): DetectedType | null; // magic bytes
export function allowedInSection(section: FileSection, mime: string): boolean; // galleri: kun billeder; filer: billeder og pdf
export function sanitizeFileName(name: string): string; // fjerner stier/kontroltegn, max 120 tegn, tomt → "fil"
export type StorageDeps = { db: Db; uploadDir: string; maxBytes: number; maxTotalBytes: number };
export type FileItem = { id: number; section: FileSection; title: string; originalName: string; mime: string; sizeBytes: number; uploadedBy: number; uploaderName: string; pinned: boolean; createdAt: Date };
export function storeUpload(deps: StorageDeps, input: { userId: number; section: FileSection; title: string; originalName: string; stream: ReadableStream<Uint8Array>; declaredLength: number | null }): Promise<{ ok: true; id: number } | { ok: false; reason: 'invalid' | 'too_large' | 'quota' | 'bad_type' | 'io' }>;
export function deleteFile(deps: Pick<StorageDeps, 'db' | 'uploadDir'>, actor: { userId: number; isOfficer: boolean }, fileId: number): Promise<{ ok: true } | { ok: false; reason: 'forbidden' | 'not_found' }>;
export function setFilePinned(db: Db, actor: { userId: number; isOfficer: boolean }, fileId: number, pinned: boolean): Promise<{ ok: true } | { ok: false; reason: 'forbidden' | 'not_found' }>;
export function listFiles(db: Db, section: FileSection): Promise<FileItem[]>; // fastgjorte først, derefter nyeste, uden slettede
export function getFile(db: Db, id: number): Promise<{ id: number; mime: string; originalName: string; storageKey: string; sizeBytes: number } | null>;
```
Tabel `files` som i specen.

**Behavior:**
- `storeUpload`: afviser straks `declaredLength > maxBytes` (`too_large`); læs streamen i bidder til en midlertidig fil i `uploadDir` (opret mappen om nødvendigt, mode 0700), tæl bytes og afbryd + slet ved `> maxBytes`; afgør typen ud fra de første ≥ 12 bytes (`detectType`); `bad_type` hvis ukendt eller ikke tilladt i sektionen; `quota` hvis samlet størrelse af ikke-slettede filer + denne fil > `maxTotalBytes`; omdøb til `storage_key` (tilfældigt `crypto.randomUUID()`, ingen filendelse) og indsæt rækken; ethvert fejltrin sletter den midlertidige fil. Titel trimmes (1–120, tom → originalnavn uden endelse).
- `deleteFile`: uploader eller officer; sætter `deleted_at` og fjerner filen fra disken (manglende fil er ikke en fejl).
- `POST /api/filer`: `requireMember`-ækvivalent (hent session med `auth()`; ikke medlem → 401 JSON), multipart (`section`, `title`, `file`), kalder `storeUpload` med `Request.formData()` hvis du kan vise at streaming ikke er muligt; **foretræk streaming**, så store filer ikke læses helt ind i hukommelsen (undersøg i Next 16-dokumenterne, om `request.body`/`busboy`-lignende parsing er mulig; ellers begræns med `Content-Length` først og dokumentér valget i rapporten). Svarer JSON `{ ok: true, id }` eller `{ ok: false, error: <dansk besked> }` med passende statuskode.
- `GET /api/filer/[id]`: kræver session (401 ellers), 404 for ukendt/slettet; billeder `Content-Disposition: inline`, PDF `attachment`; `Content-Type` fra rækken (aldrig fra klienten), `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=3600`, `Content-Length`; filindhold streames fra disken.

**Tests:** `detectType` for PNG/JPEG/WebP/GIF/PDF, SVG/EXE/tom → `null`; `allowedInSection`; `sanitizeFileName` (stier, `..`, kontroltegn, lange navne, tomt); `storeUpload` mod en midlertidig mappe og test-databasen: gyldigt billede, PDF i filer, PDF afvist i galleri, falsk filendelse men forkert indhold, for stor (både deklareret og stream uden længde, og at den midlertidige fil er væk), kvote, ugyldig titel; `deleteFile` (ejer, officer, fremmed, fil fjernet fra disk); fastgørelse; `listFiles` rækkefølge og slettede skjult. Rute-handlerne verificeres ved kørsel (curl mod dev-serveren er ikke muligt uden session; beskriv i rapporten hvad der er verificeret og hvad ikke, og skriv i det mindste en enhedstest af den rene hjælpelogik, du bruger i rutehandlerne).

- [ ] Test først → implementér → migration → GREEN → commit.

### Task 9: Filer- og galleri-sider, Dockerfile

**Bygger på:** spec 4 «Sider og ruter», «Fælles implementeringsnoter».

**Files:** Create `app/(app)/filer/page.tsx`, `app/(app)/galleri/page.tsx`, `app/(app)/filer/actions.ts`, `components/UploadForm.tsx`. Modify `components/Shell.tsx` (menupunkter «Filer» og «Galleri»), `Dockerfile` (opret `/app/data/uploads` ejet af `node`, og `ENV UPLOAD_DIR=/app/data/uploads` er ikke nødvendigt; compose sætter den), `.dockerignore` (hvis nødvendigt), `app/globals.css`.

**Interfaces — Consumes:** Task 8. **Produces (`filer/actions.ts`):** `deleteFileAction(formData)`, `setFilePinnedAction(formData)` (`'use server'`; `requireMember`/`requireOfficer`; `revalidatePath`).

**Behavior:** `UploadForm` (klientkomponent): sektion (skjult input), titel, filvalg (`accept` efter sektion), «Upload»-knap, `fetch('/api/filer', { method: 'POST', body: FormData })`, viser dansk fejl fra svaret, deaktiveret mens den uploader, `router.refresh()` ved succes. `/filer`: fastgjorte øverst, tabel/liste (titel, type, størrelse i KB/MB, uploader, dato, download-link `/api/filer/[id]`), officer: fastgør/frigør og slet; uploader: slet; billeder kan også åbnes. `/galleri`: gitter af billeder (`<img>` med `loading="lazy"`, faste størrelser og `object-fit: cover`), klik åbner `/api/filer/[id]` i ny fane, slet efter ret. Begge sider `requireMember()` selv.

**Tests:** hjælpere (fx størrelsesformatering `formatBytes`) med enhedstest. Ellers typecheck/build og `docker build -t aula-guild:test .`, og start et testcontainer-kørsel er **ikke** nødvendig; verificér i stedet i Dockerfilen, at mappen findes og ejes af `node` (`docker run --rm --entrypoint sh aula-guild:test -c 'ls -ld /app/data/uploads && id'`).

- [ ] Implementér, verificér, commit.

---

## Spec 5: Guild-chat

### Task 10: Chat-klient, rute og side

**Bygger på:** spec 5 (hele afsnittet).

**Files:** Create `lib/chat.ts`, `tests/chat.test.ts`, `app/api/chat/route.ts`, `app/(app)/chat/page.tsx`, `app/(app)/chat/ChatView.tsx`. Modify `lib/env.ts` (valgfrie `DISCORD_BOT_TOKEN`, `DISCORD_CHAT_CHANNEL_ID`), `.env.example`, `lib/services.ts` (`getChat()` singleton eller `null`, `isChatConfigured()`), `components/Shell.tsx` + `app/(app)/layout.tsx` (menupunkt «Chat» kun hvis konfigureret).

**Interfaces — Produces:**
```ts
export type ChatMessage = { id: string; author: string; content: string; timestamp: string /* ISO */; bot: boolean };
export type ChatError = 'no_access' | 'not_found' | 'unavailable';
export type ChatResult = { messages: ChatMessage[]; stale: boolean; error?: ChatError; hint?: 'no_content_intent' };
export type ChatClient = { getMessages(): Promise<ChatResult> };
export function createChatClient(opts: { token: string; channelId: string; fetch?: typeof fetch; now?: () => number; ttlMs?: number /* 4000 */ }): ChatClient;
```

**Behavior:** Som spec 5: `GET https://discord.com/api/v10/channels/{channelId}/messages?limit=50` med `Authorization: Bot <token>`. Resultatet gemmes i `ttlMs`; samtidige kald deler ét igangværende kald. 401/403 → `error: 'no_access'` (ingen gamle beskeder at vise hvis ingen cache), 404 → `not_found`, 429 → respektér `retry_after` (sekunder, i svarets JSON eller `Retry-After`-header): lever seneste cache som `stale: true`, og forsøg ikke igen før tiden er gået, 5xx/netværk/misdannet svar → seneste cache som `stale: true` eller `error: 'unavailable'` hvis ingen cache. Beskeder returneres i stigende tid. Mapping og `<@id>`-erstatning som i specen; `content` tom + embed → embedtitel/-beskrivelse; vedhæftning → «[vedhæftet fil]». `hint: 'no_content_intent'` når der er beskeder, men alle har tom `content` og ingen embeds/vedhæftninger. Validér svarets form defensivt (ingen rå TypeError ud; alt giver `unavailable`).
`GET /api/chat`: kræver session via `auth()` (ellers 401), 404 hvis chatten ikke er konfigureret, ellers `NextResponse.json(result)` med `Cache-Control: no-store`. `/chat`: `requireMember()`; er chatten ikke konfigureret, vis «Chatten er ikke sat op.»; ellers `ChatView` (klientkomponent): poller `/api/chat` hvert 5. sekund mens `document.visibilityState === 'visible'` (afbryd/genoptag ved skift), viser beskeder (afsender, klokkeslæt i dansk tid, tekst), «forældet»-mærke, danske fejlbeskeder og tippet om Message Content Intent, ruller til bunden ved nye beskeder medmindre brugeren har scrollet op, og rydder sit interval ved afmontering.

**Tests (`tests/chat.test.ts`, fake `fetch` og fake `now`):** URL og headers; mapping (forfatter, mentions, embed, vedhæftning, bot-flag); rækkefølge; cache inden for TTL (kun ét kald) og nyt kald efter TTL; deling af igangværende kald; 401/403/404; 429 med `retry_after` og cache som stale; 5xx og netværksfejl med og uden cache; misdannede svar (ikke-array, manglende felter) → `unavailable`; `no_content_intent`-tip; tokenet forekommer aldrig i resultatet.

- [ ] Test først → implementér → GREEN → verificér typecheck/build → commit.

---

## UI-pas

### Task 12: AULA-udseende (efter at opslag, filer, galleri og chat findes)

**Bygger på:** `docs/superpowers/notes/ui-sammenligning.md` (sammenligning med det originale AULA, lavet af en hjælper ud fra tekstkilder og koden; farver og ikoner for AULA er skønnet) og brugerens aftale om, at de tre første forslag tages som en samlet pas til sidst.

**Files:** `components/NavLink.tsx`, `components/Shell.tsx`, `app/globals.css`, `components/RsvpButtons.tsx`, `app/(app)/kalender/page.tsx`, `components/NextEvents.tsx` (præcise filer afgøres af rapporten og den færdige kode).

**Behavior (i prioriteret rækkefølge, lille først):**
1. Ikoner i venstremenuen og bundbjælken (inline SVG, ingen ny pakke; genbrug stier fra designprototypen https://claude.ai/artifact/P278BNV5fSULm1VmYfpbGM hvis de kan læses, ellers simple egne). Ikon + tekst, `aria-hidden` på ikonet, aktiv tilstand uændret. Menupunkter: Overblik, Kalender, Filer, Galleri, (Chat), Kontakter. Magentatæller (`--badge`) på Overblik (ulæste) findes fra Task 7.
2. Global `:focus-visible`-fokusring på alle interaktive elementer, et «Spring til indhold»-link øverst, og kontrastrettelse af `--nav` og `--muted`, så hvid 13 px tekst og dæmpet tekst når mindst 4,5:1 i både lys og mørk tilstand (mål efter WCAG-formlen og skriv tallene i commit-beskeden).
3. Farvekodede tilmeldingsknapper (ikon + tekst, ikke kun farve) og en venstrekant på event-kort: ensfarvet for «Deltager», stribet for «Måske»/ubesvaret, dæmpet for «Afbud»; samme kodning i lys og mørk tilstand.
4. Øvrige forslag fra rapportens top-10, i den rækkefølge rapporten giver dem, så længe de er små (CSS/komponent) og ikke ændrer funktion. Alt, der kræver et nyt layout (månedsgitter, højre widgetkolonne), udelades og noteres.

**Tests:** rene hjælpere (fx statusklasse-mapning) får enhedstests. Ellers typecheck, build og kørsel af dev-serveren; kontrast beregnes med en lille testbar funktion. Skærmbilleder kan ikke tages uden login — det siges ærligt i rapporten.

### Task 13: UI-pas 2 — AULA-struktur (efter Task 12, før slutreview)

**Bygger på:** `docs/superpowers/notes/aula-html-struktur.md` (struktur aflæst af brugerens HTML fra det rigtige AULA; ingen CSS, så farver/ikoner er vores egne) og brugerens ønske «tag det med». Vi kopierer ikke AULAs ikoner, logo eller CSS.

**Beslutninger (controller):**
- Menuen får rækkefølgen **Overblik, Kalender, (Chat), Galleri, Kontakter, Filer** (Chat spejler AULAs «Beskeder» og vises kun når den er sat op). Tæller-bobler på **Overblik** (ulæste opslag, findes) og **Kalender** (antal kommende, ikke-aflyste events inden for 14 dage, som brugeren IKKE har svaret på). Ingen boble på Galleri (kræver «set»-sporing; udeladt).
- Én **«Opret»-dropdown** (sekundær knap, bruger `DetailsMenu`-mønstret) på Overblik og Kalender med punkter: Opslag (`/opslag/ny`), Begivenhed (`/kalender/ny`), Fil (`/filer`), Billede (`/galleri`). Ingen ny funktion bag punkterne.
- Faner på Overblik: **ALLE, ULÆSTE, VIGTIGE, EGNE OPSLAG, GEMTE** (store bogstaver). «PERSONALE»/«FORÆLDRE» udelades (vi har ikke de roller). **EGNE OPSLAG** = opslag skrevet af brugeren. **GEMTE** = bogmærker: ny tabel `post_bookmarks (user_id, post_id, created_at)` med primærnøgle `(user_id, post_id)` (cascade), modulfunktioner `toggleBookmark(db, userId, postId): Promise<{ ok: true; bookmarked: boolean } | { ok: false; reason: 'not_found' }>`, fane `gemte`/`egne` i `listPosts`, og et `bookmarked`-felt på `PostListItem`/`PostDetail`; bogmærke-knap (ikon + `aria-pressed`, Danish label «Gem opslag»/«Fjern fra gemte») på opslagskort og opslagsside. Fanernes URL-værdier: `alle`, `ulaeste`, `vigtige`, `egne`, `gemte`; `parseTab` udvides.
- Opslagskort: afsender vises som «Discord-navn (aktiv karakter)» hvis brugeren har en aktiv karakter, ellers kun navnet (join på `users.active_character_id`); «Delt med hele guilden» som fast tekst; «oprettet» som relativ tid med fuld dato i `title`; badgen hedder **«Vigtig»** (fastgjort); bogmærkeknap; opslag har ingen vedhæftninger (udelades).
- **Højre kolonne** (`aside`) på Overblik fra bredde ≥ 1100 px (CSS grid: hovedkolonne + 320 px aside; under 1100 px lægges asiden under hovedindholdet): kort «Næste begivenheder» (de næste op til 5 kommende, ikke-aflyste events: stor dato + måned kort (`nov`), titel, tidsrum i dansk tid, brugerens status som ikon+tekst, link til eventet; tom tilstand), og kort «Dine karakterer» (aktiv karakter + rolle) — ingen fødselsdage/widgets/søgning.
- **Notifikationsbånd** øverst på Overblik/Kalender når brugeren har ubesvarede kommende events (≤ 14 dage): rundt udråbstegn-ikon, tekst «Du har ikke svaret på N kommende begivenheder» med link til `/kalender`, og en lukkeknap (klientkomponent; afvist tilstand gemmes pr. fane-session i `sessionStorage`, med try/catch).
- Topbjælke/profil: **LOG UD**-knappen i profilmenuen får store bogstaver og sekundær stil. Ingen global søgning.
- Relativ tid-hjælper (`formatRelative` findes): «I går 16:45», «I dag 09:05», ugedagsforkortelse for dage inden for 6 dage («Fre. 13:50»), ellers dato. Fuld dato i `title`.

**Også med (fra Task 12-review):** `AddCharacterForm` (karakter/ny) bruger stadig `action={action}` med ukontrollerede felter, så navn og rolle nulstilles efter en armory-fejl; skift til `onSubmit={submitHandler(action)}` (fra `components/useFormValues.ts`) med kontrollerede felter, så det indtastede karakternavn og den valgte rolle bevares.

**Moduler:** `lib/events.ts`: `countUnansweredUpcoming(db, userId, now?, days = 14): Promise<number>`; `lib/posts.ts`: `toggleBookmark`, `PostTab` udvides med `'egne' | 'gemte'`, `PostListItem.bookmarked`, `PostDetail.bookmarked`, `PostListItem.authorCharacter: string | null`; migration for `post_bookmarks`; `resetDb` tømmer den.

**Tests (RED→GREEN):** `countUnansweredUpcoming` (kun kommende, ikke aflyste, ikke besvarede, inden for vinduet, 14-dages grænse, egen tilmelding tæller som besvaret uanset status); `toggleBookmark` (til/fra, ukendt/slettet opslag, kun egne bogmærker); `listPosts` for `egne` og `gemte` (rækkefølge, paging, slettede skjult, andres bogmærker ikke synlige); `bookmarked`-flag; `parseTab`; relativ tid-hjælper (I går/I dag/ugedag/dato, tidszone og sommertid); menu-rækkefølge som ren funktion (`menuItems({ chat: boolean })`) med test; kontrast-testen holdes grøn for nye farver (tilføj nye par). Pages verificeres med typecheck, build og curl (307 til /login).

**Regler:** dansk UI; ingen nye pakker; autorisation i modulerne som før (`requireMember` i sider/actions); `toggleBookmarkAction` er en server action med `parseId`, `requireMember`, FormState-lignende fejlhåndtering og `revalidatePath`; formularer og knapper bevarer brugerinput (`onSubmit`-mønstret fra Task 12 hvor der er kontrollerede felter). Intet i AULAs ophavsretsbeskyttede materiale kopieres (ingen ikonskrift, ingen CSS, intet logo).

### Task 14: Satire-opslag (fake AULA-opslag) i Overblik

**Bygger på:** brugerens ønske om at blande «fake AULA posts» ind i Overblik, så det er tydeligt, hvad der er fake og hvad der er ægte. Indhold: `docs/superpowers/notes/aula-satire-posts.json` (24 originale, fiktive opslag; research og kilder i `docs/superpowers/notes/aula-satire-research.md`). Indholdet er skrevet fra grunden og må ikke indeholde rigtige personer, børnenavne eller kopier af rigtige opslag.

**Beslutninger (controller):**
- **Data:** kopiér JSON-filen til `lib/satire-posts.json` og læs den via en lille modul `lib/satire.ts` (`SatirePost`-type, `satirePosts: SatirePost[]`, validering ved indlæsning i en test: 24 unikke id'er, felterne fra research-filen, `body` 200–600 tegn, alle `author` indeholder «fiktiv»). Ingen database; ingen ændring af ægte opslag/ulæst-tællere.
- **Vises kun i fanerne ALLE (indflettet) og SATIRE (alle 24, ny fane)**; aldrig i ULÆSTE, VIGTIGE, EGNE OPSLAG eller GEMTE, aldrig i ulæst-tælleren, og ikke i ægte søgning/paging-tal. I ALLE flettes ét satire-opslag ind efter hvert 3. ægte opslag på hver side; valget er deterministisk pr. dag og side (ren funktion `pickSatire(dateKey: string, pageNumber: number, count: number): SatirePost[]` + `interleave(real, satire, every = 3)`), så siden ikke skifter ved genindlæsning inden for samme dag.
- **Tydelig mærkning (ufravigeligt):** hvert satire-kort har (a) en synlig badge **«FAKE · SATIRE»** med ikon og tekst (ikke kun farve), (b) et visuelt adskilt udseende (stiplet kant, let farvet baggrund, og ingen ægte avatar men et neutralt maske-ikon), (c) en fodlinje «Dette er et fiktivt opslag. Alle personer er opdigtede.», (d) ingen tidsstempel (viser «Satire» i stedet), ingen bogmærke-/kommentar-/læst-funktion, ingen link til detaljeside, og (e) `<article aria-label="Fake opslag (satire)">`. Kommentarer vises statisk og er også mærket «fiktiv». Fanen SATIRE har en forklaringsboks øverst. Overblik har en kort tekstlinje under fanerne: «Opslag mærket FAKE · SATIRE er opdigtede.»
- **Skjul/vis:** brugeren kan slå satire fra/til med en knap («Skjul satire»/«Vis satire») ved fanerne. Valget gemmes i en cookie `aula_satire` (`off`/`on`, 1 år, `SameSite=Lax`, `Path=/`, ikke følsomt) sat af en server action `setSatirePreferenceAction(formData)`; siden læser cookien server-side (ingen flimmer). Er den slået fra, vises hverken indflettede opslag eller fanen SATIRE.
- Kontrast og tilgængelighed som i Task 12 (nye farver tilføjes til kontrast-testen i begge temaer; fokusring; ikke kun farve).

**Tests (RED→GREEN):** data-valideringen; `pickSatire` (deterministisk, ingen dubletter på en side, bredden `count`, forskellige sider giver forskellige valg); `interleave` (efter hvert 3. element, ender uden afsluttende satire hvis færre end 3 ægte, tom liste, `every` grænser); cookie-parse hjælper (`parseSatirePreference(value | undefined): boolean`, default true); at ulæst-/egne-/gemte-/vigtige-visninger ikke indeholder satire (rene funktioner for fane → visning); kontrastpar for den nye badge og baggrund. Pages verificeres med typecheck, build og curl (307 til /login).

**Regler:** dansk UI; ingen nye pakker; ingen rigtige personer/institutioner i indholdet (hvis research-filens opslag indeholder noget sådant, fjernes det i Task 14 og noteres i rapporten); satire-opslag må ikke kunne forveksles med ægte i skærmlæsere (aria-label og skjult tekst «Fake opslag (satire)» først i kortet).

### Task 15: Karakterer i topbjælken og fulde navne (fornavn + efternavn)

**Bygger på:** brugerens ønske: (1) som AULA viser børnene øverst, skal topbjælken vise ALLE brugerens karakterer, med et flueben på den primære (aktive) karakter, og et klik skifter primær; (2) alle karakterer skal vises med både fornavn og efternavn overalt. Undersøgelse af det rigtige Blizzard-API (2026-11-10): rosterens medlemsobjekt har `character.name` (kun fornavn, fx «Ezzek»), **`character.surname`** («Svumpukkel») og `character.slug` (`ezzek-svumpukkel`); profilen har `name`, **`surname`** og `name_search` («Ezzek Svumpukkel»). Alle 12 guildmedlemmer har efternavn; sluggen er altid `lowercase(name + "-" + surname)`. Profilopslag på slug med tegn som `ø` (Knud Klunkekløe) gav tom `surname`/`name_search` i en direkte hentning (årsag ukendt, rosteren har dem korrekt) — fuldt navn skal derfor kunne komme fra rosteren og, som fallback, fra sluggen.

**Beslutninger (controller):**
- **Data:** tilføj `characters.surname text` (nullable). `ArmoryCharacter.surname: string | null` og `RosterMember.surname: string | null` (Blizzard-klienten læser `surname` fra profil og roster, trimmet, tom → null, defensiv validering som øvrige felter). `addCharacter` og `syncRoster` gemmer/opdaterer `surname` (profil først; hvis profilen mangler `surname`, brug rosterens; ændrer et sync kun surname, når en ikke-tom værdi er kendt — aldrig overskriv en kendt værdi med null). Migration uden tvunget backfill; eksisterende rækker vises via fallback nedenfor, og næste sync udfylder dem.
- **Fuldt navn:** ren funktion `fullName({ name, surname, slug }): string` i `lib/names.ts`: `NFC`-normalisér; hvis `surname` er ikke-tom → `name + " " + surname`; ellers hvis `slug` starter med `name.toLowerCase() + "-"` → `name + " " + capitalizeFirst(resten af sluggen)` (Unicode-korrekt, første kodepunkt med `toLocaleUpperCase('da')`; ved flere bindestreger bevares resten uændret); ellers `name`. `initials(fullName)`: første bogstav (kodepunkt) af første og sidste ord, store bogstaver.
- **Overalt fuldt navn** (erstat visningen af `characters.name`): Kontakter (tabellen), kalender (deltagerlister, rolleoptælling, event-detalje), profilmenuen (karakterliste), «Dine karakterer» i højre kolonne, opslagskortenes `authorCharacter`, tilmeldingsresultater og eventuelle andre steder, hvor en karakters navn vises (søg i koden efter `characterName`, `.name` på karakterer, `authorCharacter`, `listMyCharacters`, `listContacts`, attendee-typer). Modulernes resultattyper får et `fullName: string`-felt (beregnet med `fullName(...)`), og `name` bevares som fornavn. SQL-udtræk hentes med `surname` og `slug`.
- **Topbjælke: `CharacterSwitcher`** (server-komponent med små formularer): en `nav` med `aria-label="Dine karakterer"` og én rund «avatar» pr. karakter (ingen billeder: initialer på en baggrund, hvis farve kommer fra klassen via en lille fast mapping/CSS-variabler med tilstrækkelig kontrast), sorteret efter fuldt navn, den primære FØRST? (nej: behold fast alfabetisk rækkefølge så knapperne ikke hopper). Den primære karakter har et synligt **flueben** (ikon i en lille cirkel nederst til højre; ikke kun farve), `aria-current="true"`, og alle har `title` og `aria-label` «Skift primær karakter til {fuldt navn}» (den primære: «{fuldt navn} (primær karakter)»). Klik på en ikke-primær submitter `setActiveAction` (findes; flytter også kommende tilmeldinger) via en formular med skjult `characterId`; klik på den primære gør intet. Ved >6 karakterer: vandret scroll. Har brugeren ingen karakter: vis en knap/link «Tilføj karakter» (til /karakter/ny) i stedet. Placeres i topbjælken mellem logo og højre-kontrollerne (på mobil som egen række under topbjælken eller komprimeret; sørg for at topbjælkens højde, sticky-positionen og `scroll-padding` fortsat passer).
- Eksisterende «aktiv karakter»-vælgere i profilmenuen beholdes (ingen funktion fjernes), men viser fulde navne.

**Tests (RED→GREEN):** `fullName` (med surname; uden surname men med slug; æ/ø/å; flere bindestreger; tomt surname; navn der ikke matcher slug; NFC); `initials`; Blizzard-klienten læser `surname` fra profil og roster (fixtures opdateres til de virkelige former: `name: 'Magi'`, `surname: 'Far'`, `name_search`), tom/manglende `surname` → null; `addCharacter` gemmer surname; sync opdaterer surname uden at overskrive med null; listefunktionerne returnerer `fullName`; rendering-hjælpere for switcheren (mapping klasse→farve, sortering, aria-tekster som rene funktioner); kontrastpar for avatar-farver og flueben i begge temaer (parse CSS). Opdater testhjælpere (`armory()`, `member()`) og eksisterende tests til realistiske navne (fornavn og efternavn adskilt).

**Regler:** dansk UI; ingen nye pakker; ingen AULA-ikoner/CSS kopieres (egne SVG-ikoner); autorisation uændret (`setActiveAction` bruger `requireMember` og modulets ejerskabstjek); intet i switcheren må kunne skifte en andens karakter.

### Task 16: Satire v2 — korte forældrebesked-opslag og klovne/joker-ikon

**Bygger på:** brugerens feedback: de fake opslag må gerne have klovne/joker-ikonet, men skal være mere som «Henriette må ikke få remulade. Hilsen Henriettes mor» (korte, tørre, overspecifikke forældrebeskeder). Nyt indhold: `docs/superpowers/notes/aula-satire-posts-v2.json` (30 opslag, 5 med guild-twist, resten ren forældrebesked-humor; fiktive afsendere; opdigtede almindelige fornavne på børn er nu tilladt, uden efternavne eller andre personoplysninger).

**Beslutninger:** erstat `lib/satire-posts.json` med v2-indholdet (felterne `inspiration` og `sources` strippes som før); opdatér datavaliderings-testen til de nye regler: 30 unikke id'er `satire-01`…`satire-30`, `body` 40–300 tegn, `title` højst 60 tegn, alle `author` (og kommentarforfattere) indeholder «(fiktiv)», præcis 6 `important`, præcis 10 med kommentarer, kommentarer 10–120 tegn, ingen `http`, `@` eller cifferfølge på 6+ i title/body/kommentarer; fjern alle hårdkodede «24»-antal i kode og tekster/tests (brug `satirePosts.length`). Skift det neutrale maske-ikon i `SatireCard` (og evt. andre steder, hvor masken bruges som avatar) til et **klovne/joker-ikon**: eget inline-SVG (narrehue med to-tre spidser og bjælder, simpelt ansigt; `currentColor`, `aria-hidden`), ingen kopier af eksisterende ikonsæt. Al mærkning og alle isolationsregler fra Task 14 er UÆNDREDE (badge «FAKE · SATIRE», stiplet kant, fodlinje, «Satire» i stedet for tid, ingen links/bogmærke/kommentarformular, ét tilgængeligt label, osv.), og render-testen opdateres til det nye ikon uden at svække assertions. Kontrastpar for nye farver (hvis nogen) tilføjes.

**Tests:** datavalidering (nye regler), `pickSatire`/`interleave` med 30, SATIRE-fanen viser alle, render-test af kort, uændrede isolationstests, kontrast. Verificér med typecheck, build og `curl` (307 til /login).

## Udrulning og afslutning

### Task 11: Udrulningsfiler og dokumentation

**Files:** i dette repo: `README.md` (nye miljøvariabler, funktioner), `docs/superpowers/roadmap.md` (status). I `server-stacks`-repoet (lokalt `/home/rasmus/development/rasmus-server-stacks`, privat): `prod/aula-guild/docker-compose.yml` (navngiven volumen `uploads:/app/data/uploads`, `UPLOAD_DIR`/`MAX_UPLOAD_MB`/`MAX_TOTAL_MB` som valgfrie `environment`-linjer), `prod/aula-guild/backup.sh` (tag uploads-volumenen med: `docker run --rm -v prod-aula-guild_uploads:/data:ro … tar czf`, med `umask 077` og samme `.tmp`-mønster), `prod/aula-guild/.env.example` (valgfrie `DISCORD_BOT_TOKEN`, `DISCORD_CHAT_CHANNEL_ID` med forklaring), `README.md`.

**Behavior:** Compose-filen valideres med `docker compose config` (kastet-væk `.env` i scratchpad). Backup-scriptet afprøves mod en midlertidig volumen (`docker volume create aula-test-uploads`, læg en fil i den, kør tar-delen, kontrollér arkivet, fjern volumen). Der pushes **ikke** af implementeren; controlleren pusher og opdaterer serveren.

- [ ] Gennemfør og commit i begge repoer (lokalt).

### Slutreview og udrulning (controller)

Slutreview af hele grenen på den mest kapable model, derefter én rettelsesbølge, merge til `main`, push (workflowet bygger imaget), `git pull` i `/srv/stacks`, `docker compose pull && up -d`, og genstart af dev-serveren (migrationerne kører ved opstart).
