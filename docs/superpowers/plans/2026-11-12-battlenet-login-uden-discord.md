# Battle.net-login uden Discord: byggeplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Erstat Discord-login med Battle.net-login, afled medlemskab og officer fra verificerede karakterer og guild-rang, og fjern al Discord-chat så kun egne kanaler er tilbage.

**Architecture:** Auth.js `battlenet`-provider (EU). Ved login hentes brugerens egne karakterer fra Battle.net-kontoen og gemmes som verificerede. Medlem og officer afledes af databasen (verificeret karakter med `inGuild`, og `guildRank <= OFFICER_MAX_RANK`) og genberegnes ved revalidering, uden eksterne kald. Fire guards (`requireUser`, `requireGuildMember`, `requireOfficer`) afløser `requireMember`.

**Tech Stack:** Next.js 16 app router, React 19, Auth.js v5 (JWT), Drizzle + Postgres, Vitest på rigtig test-db, Blizzard API-klienten i `lib/blizzard`.

Spec: `docs/superpowers/specs/2026-11-12-battlenet-login-uden-discord-design.md` (godkendt af brugeren 2026-11-12; officer-rang 0-1).

## Global Constraints

- Al brugertekst på dansk. WCAG AA i lys og mørk. 360 px uden horisontal scroll. `<form action>` (progressive enhancement). Ingen nye afhængigheder uden grund.
- Alle `npx tsc --noEmit` og `npm test` skal være grønne efter hver opgave (nu 1052 tests; testtal må kun stige undtagen ved bevidst fjernede Discord-tests).
- Dev kører på `http://localhost:3000` (`next dev`, hot reload; genstart efter ændring af auth-config, migration eller singletons). Prod deployes kun efter brugerens «ja».
- Playwright-session: mint cookie `__Secure-authjs.session-token` (salt = cookienavn, `encode` fra `next-auth/jwt`); tokenfelterne ændres i opgave 4 (se der).
- Ingen kald til Blizzard fra prod-containeren; ingen browser-User-Agent-spoofing mod armory-websitet (blokeret af klassifikatoren).
- Commit pr. opgave med dansk besked og linjerne `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` og `Claude-Session: https://claude.ai/code/session_01SwiqsNimvFc2krW7ymVpdH`. Ingen push uden besked fra controlleren.
- Arbejd på grenen `feature/battlenet-login` (opret fra main), ikke på main.

## Filstruktur

- Opret: `lib/access.ts` (afledning af medlem/officer), `lib/account-characters.ts` (hent og knyt egne karakterer), `lib/blizzard/account.ts` (kald til `/profile/user/wow`), `app/ingen-adgang/page.tsx` omskrives til gæsteventeside, `app/(app)/godkendelser/page.tsx` (kun hvis spiken kræver officer-bekræftelse).
- Ændr: `auth.ts`, `types/next-auth.d.ts`, `lib/session.ts`, `lib/auth-callbacks.ts`, `lib/users.ts`, `lib/db/schema.ts` (+ ny migration i `drizzle/`), `lib/services.ts`, `app/login/page.tsx`, alle `app/(app)/**`-sider/actions der bruger `requireMember`, `lib/chat-authors.ts`, `lib/overview-chat.ts`, `app/(app)/chat/**`, `.env.example`, `README.md`, `tests/**`.
- Fjern: `lib/discord-access.ts`, `lib/access-revalidate.ts` (erstattes af DB-genberegning), Discord-delen af `lib/chat.ts`, `lib/chat-config.ts`, `lib/chat-send.ts`, `lib/chat-http.ts` (behold kun det, egne kanaler bruger), `tests/discord-fake.ts`, `tests/discord-access.test.ts`, `tests/access-revalidate.test.ts`, `tests/chat.test.ts`, `tests/chat-send.test.ts` (Discord-dele).

---

### Task 1: Spike — giver `/profile/user/wow` WoW Forever-karakterer?

**Kræver brugeren** (registrering af redirect-adresse og et rigtigt login). Controlleren skaffer det, før opgaven dispatches.

**Files:**
- Create (kun på spike-grenen, kasseres bagefter): `app/api/dev/bnet-probe/route.ts`
- Modify (spike): `auth.ts` (tilføj `BattleNet`-provider ved siden af Discord, `issuer: 'https://oauth.battle.net'`, scope `openid wow.profile`, region EU)
- Create: `docs/superpowers/notes/2026-11-12-bnet-spike.md` (resultatet)

**Interfaces:**
- Produces: afgørelsen «verificering via konto» (A) eller «officer-bekræftelse» (B) samt det præcise svarformat, opgave 5 skal parse (`namespace`, felter for `id`, `name`, `realm.slug`, `playable_class`, `level`).

- [ ] **Step 1:** Bed brugeren registrere `http://localhost:3000/api/auth/callback/battlenet` og `https://dev.aaensoftware.com/api/auth/callback/battlenet` hos Blizzard og give `AUTH_BATTLENET_ID`/`AUTH_BATTLENET_SECRET` (må være `BLIZZARD_CLIENT_*` hvis klienten tillader redirects). Sæt dem i `.env.local`.
- [ ] **Step 2:** Tilføj provideren og en rute, der med brugerens `access_token` kalder `https://eu.api.blizzard.com/profile/user/wow?namespace=<ns>&locale=en_GB` for `ns` i `profile-forever-eu`, `profile-classic-eu`, `profile-classic1x-eu`, `profile-eu` og returnerer HTTP-status og de første 2000 tegn pr. namespace som JSON.
- [ ] **Step 3:** Bed brugeren logge ind på dev og åbne ruten. Notér status og om hendes karakterer (fx Magi Far) optræder.
- [ ] **Step 4:** Skriv resultatet i noten. Afgørelse: A hvis en Forever-namespace returnerer hendes karakterer; ellers B.
- [ ] **Step 5:** Commit noten på `feature/battlenet-login`. Kassér proberute og midlertidig provider (`git checkout -- auth.ts; rm app/api/dev/bnet-probe/route.ts`).

---

### Task 2: Skema og migration

**Files:**
- Modify: `lib/db/schema.ts`
- Create: ny migration via `npx drizzle-kit generate`
- Modify: `lib/users.ts`, `tests/helpers.ts`
- Test: `tests/users.test.ts` (ny), `tests/db.test.ts`

**Interfaces:**
- Produces: `users.battlenetId: text notNull unique`, `users.battletag: text notNull`, `users.avatar` fjernes, `characters.verifiedAt: timestamp | null`; `upsertUser(db, {battlenetId, battletag}): Promise<number>`.

- [ ] **Step 1: Skriv fejlende test** `tests/users.test.ts`: `upsertUser` opretter en bruger ved nyt `battlenetId`, opdaterer `battletag` ved samme id og returnerer samme `id`.
- [ ] **Step 2:** Kør `npx vitest run tests/users.test.ts`; forvent fejl (funktionen har anden signatur).
- [ ] **Step 3:** Ret skemaet: erstat `discordId` med `battlenetId`, tilføj `battletag`, fjern `avatar`, tilføj `characters.verifiedAt`. `name` beholdes som visningsnavn (= battletag uden `#nummer` som standard).
- [ ] **Step 4:** Skriv migrationen i hånden ud over det genererede, så den (a) tømmer brugerafhængige tabeller i rækkefølge (RSVP'er, læsninger, bogmærker, sim-jobs, aktiv karakter, sessionsafhængige rækker) og nulstiller `characters.user_id` til null, (b) bevarer opslag/kommentarer/chatbeskeder med deres `author_name` og sætter ejer-kolonner til `NULL` (gør kolonner nullable hvor de i dag er `notNull references users`, og ret koden, der læser dem), (c) sletter `users` og tilføjer de nye kolonner. Dump først prod-DB (se opgave 9). Kør migration på tom test-db.
- [ ] **Step 5:** Opdatér `upsertUser`, `tests/helpers.ts` (testbrugere med `battlenetId`) og alle testfiler der oprettede brugere med `discordId` (søg `discordId` i `tests/`).
- [ ] **Step 6:** Kør `npx tsc --noEmit` og `npm test`; ret fald. Commit.

---

### Task 3: Adgangsmodel (medlem og officer fra databasen)

**Files:**
- Create: `lib/access.ts`
- Test: `tests/access.test.ts`
- Modify: `lib/env.ts` (eller hvor miljø læses): `OFFICER_MAX_RANK` (heltal, standard 1)

**Interfaces:**
- Produces: `deriveAccess(db: Db, userId: number, opts: { officerMaxRank: number }): Promise<{ isGuildMember: boolean; isOfficer: boolean }>`; medlem = bruger har en karakter med `verifiedAt IS NOT NULL AND inGuild = true`; officer = medlem og samme karakter har `guildRank <= officerMaxRank`.

- [ ] **Step 1: Skriv fejlende tests** i `tests/access.test.ts`:
  - ingen karakterer → `{false,false}`
  - uverificeret guild-karakter → `{false,false}`
  - verificeret karakter ikke i guilden → `{false,false}`
  - verificeret karakter i guilden, rang 5, max 1 → `{true,false}`
  - rang 1 → `{true,true}`; rang 0 → `{true,true}`
  - en rang-1-karakter tilhørende en anden bruger giver ikke officer.
  - karakter med `guildRank = null` giver medlem, ikke officer.
- [ ] **Step 2:** Kør testen; forvent fejl.
- [ ] **Step 3:** Implementér med én forespørgsel (min rang blandt brugerens verificerede guild-karakterer).
- [ ] **Step 4:** Kør `npx vitest run tests/access.test.ts`; forvent grøn. Commit.

---

### Task 4: Login, session og guards

**Files:**
- Modify: `auth.ts`, `types/next-auth.d.ts`, `lib/auth-callbacks.ts`, `lib/session.ts`, `lib/services.ts` (`authDeps`), `app/login/page.tsx`, `lib/env.ts`
- Remove: `lib/discord-access.ts`, `lib/access-revalidate.ts`, `tests/discord-access.test.ts`, `tests/access-revalidate.test.ts`
- Test: `tests/auth-callbacks.test.ts` (omskriv), `tests/session.test.ts`

**Interfaces:**
- Consumes: `deriveAccess` (opgave 3), `upsertUser` (opgave 2), account-synk (opgave 5; i denne opgave en tom `syncAccountCharacters` som placeholder med samme signatur).
- Produces: JWT-felter `{ userId, battlenetId, isGuildMember, isOfficer }` (Playwright-mintede tokens i senere opgaver bruger disse); `session.user = { id, isGuildMember, isOfficer, name, image: null }`; `requireUser(): Promise<Member>` (redirect `/login` uden session), `requireGuildMember()` (redirect `/ingen-adgang` hvis ikke medlem), `requireOfficer()` (kaster `Forbidden`). `Member = { userId, name, isGuildMember, isOfficer }`.

- [ ] **Step 1: Skriv fejlende tests** for `applySignIn` (profil `{ sub, battletag }` + access token → upsert af bruger, kald til `syncAccountCharacters`, afledt adgang i token) og for `requireGuildMember`/`requireOfficer` med mocked `auth()`.
- [ ] **Step 2:** Implementér provideren (`next-auth/providers/battlenet`, `issuer: 'https://oauth.battle.net'`, `authorization: { params: { scope: 'openid wow.profile' } }`), `jwt`-callback: ved login `applySignIn`; ellers genberegn adgang fra DB højst hver 10. minut (cache i token: `checkedAt`); fejl beholder eksisterende adgang. `maxAge` altid 30 dage. Session-callback kopierer felterne.
- [ ] **Step 3:** Login-siden: knap «Log ind med Battle.net» (`signIn('battlenet', { redirectTo: '/' })`), fjern Discord-tekst.
- [ ] **Step 4:** Guards i `lib/session.ts`. Opdatér `requireMember`-kald: `app/(app)/layout.tsx`, kalender, opslag, kontakter, overblik, satire/feed/chat-actions → `requireUser`; `sim/**`, `galleri/**`, `filer/**` → `requireGuildMember`; officer-sider/-handlinger → `requireOfficer`. RSVP-handlingen (`kalender/actions.ts`) → `requireUser`.
- [ ] **Step 5:** Kør `npx tsc --noEmit` og `npm test`. Commit.

---

### Task 5: Verificerede karakterer fra Battle.net-kontoen

Afhænger af spikens afgørelse. Afgørelse A: følg A. Afgørelse B: følg B.

**Files (A):**
- Create: `lib/blizzard/account.ts`, `lib/account-characters.ts`
- Test: `tests/account-characters.test.ts`
- Modify: `lib/auth-callbacks.ts` (kald synken ved login), `app/(app)/kontakter/refresh-actions.ts` eller karakter-siden («Opdatér mine karakterer»-knap)

**Interfaces (A):**
- Produces: `fetchAccountCharacters(accessToken): Promise<AccountCharacter[]>` hvor `AccountCharacter = { blizzardId: number; name: string; slug: string; realmSlug: string }` (kun WoW Forever EU); `syncAccountCharacters(db, blizzard, userId, accountChars): Promise<void>`: for hver tilsvarende karakter: opret via eksisterende `addCharacter`-vej hvis ukendt, sæt `userId` og `verifiedAt = now`, opdatér `inGuild`/`guildRank` fra roster; en karakter allerede verificeret på en anden bruger flyttes ikke (logges).

- [ ] **Step 1: Skriv fejlende tests** med fake Blizzard-klient: ny karakter oprettes og verificeres; kendt (roster-)karakter får `userId` og `verifiedAt`; karakter ejet af anden bruger flyttes ikke; fejl fra Blizzard kaster ikke ved login (returnerer tom liste og logger).
- [ ] **Step 2:** Implementér `account.ts` efter svarformatet i spike-noten og `account-characters.ts`. Brug `getCharacterProfile`/roster-opslag fra `lib/characters.ts` og `lib/sync.ts`; genbrug, kopiér ikke.
- [ ] **Step 3:** Fri tekst «tilføj karakter» (`lib/characters.ts addCharacter`) sætter `verifiedAt = null`; UI markerer «ikke verificeret».
- [ ] **Step 4:** Kør alle tests. Commit.

**Files (B, hvis spiken er negativ):**
- Create: `app/(app)/godkendelser/page.tsx`, `lib/verification.ts`, `tests/verification.test.ts`

**Interfaces (B):** `requestVerification(db, userId, characterId)`, `listPending(db)`, `approve(db, officerId, characterId)` (sætter `verifiedAt`), kun officerer kan godkende; en gæst ser status «afventer».

- [ ] **Step B1–B4:** Test først for `requestVerification`/`approve`/rettigheder, implementér, siden for officerer, knap «Bed om bekræftelse» ved ikke-verificerede karakterer. Første officer: sæt via SQL-seed for guildmesterens bruger (dokumentér i README).

---

### Task 6: Gæsteventeside og adgangsmeddelelser

**Files:**
- Modify: `app/ingen-adgang/page.tsx` (bliver «Du er ikke i guilden endnu»), skærme for Skolehjem/Galleri/Filer
- Test: `tests/ingen-adgang.test.tsx` (hvis renderingstests bruges ellers komponentlogik)

- [ ] **Step 1:** Siden forklarer på dansk hvorfor adgang mangler (ingen verificeret karakter i guilden), og linker til «Tilføj karakter» / «Opdatér mine karakterer» (A) eller «Bed om bekræftelse» (B).
- [ ] **Step 2:** Sidebar skjuler eller markerer Skolehjem/Galleri/Filer for gæster (ikon med lås, link til ingen-adgang). Kontrast og fokus tjekkes.
- [ ] **Step 3:** Tests for den rene logik (hvilke menupunkter vises for gæst/medlem/officer). Commit.

---

### Task 7: Fjern Discord-chatten

**Files:**
- Modify: `app/(app)/chat/page.tsx`, `ChatThread.tsx`, `ChatComposer.tsx`, `app/(app)/chat/actions.ts`, `lib/chat-authors.ts`, `lib/overview-chat.ts`, `lib/services.ts`, `app/api/chat/**`
- Remove: Discord-klienten i `lib/chat.ts`, `lib/chat-config.ts`, `lib/chat-send.ts`, `tests/discord-fake.ts`, tilhørende Discord-tests
- Test: opdatér `tests/site-chat.test.ts`, `tests/chat-channels.test.ts`, `tests/overview-chat.test.ts`, `tests/chat-item-card.test.ts`

**Interfaces:**
- Behold uændret for egne kanaler: `chat-ui.ts` (`buildThread`, `dayLabel` m.fl.), `chatChannels`/`chatMessages`, `listMessages`, soft delete.
- Chatforfattere: oversæt til karakter via `users.id` (ikke `discordId`): `resolveAuthors` bruger `authorName` fra egne kanaler.

- [ ] **Step 1:** Fjern Discord-klientens importer fra siderne; chatsiden viser kun egne kanaler og «Ny kanal». Tom tilstand: «Ingen kanaler endnu — opret den første».
- [ ] **Step 2:** `recentChatItems` på Overblik læser kun egne kanaler.
- [ ] **Step 3:** Slet filer og tests der kun dækker Discord. Kør `npm test`; ret hvad der importerede dem.
- [ ] **Step 4:** Søg `discord` (case-insensitive) i `app`, `lib`, `components`, `tests`; kun historiske specs/planer må være tilbage. Commit.

---

### Task 8: Konfiguration og dokumentation

**Files:**
- Modify: `.env.example`, `README.md`, `lib/env.ts`, `docs/` (ny sektion «Login med Battle.net»), `/srv/stacks/prod/aula-guild/*.env` og compose (kun beskrivelse i planen; ændres af controlleren ved udrulning)

- [ ] **Step 1:** `.env.example`: fjern `AUTH_DISCORD_*`, `DISCORD_*`; tilføj `AUTH_BATTLENET_ID`, `AUTH_BATTLENET_SECRET`, `OFFICER_MAX_RANK=1`.
- [ ] **Step 2:** README: login, adgang pr. område (tabellen fra specen), første officer, hvordan man registrerer redirect-adresserne.
- [ ] **Step 3:** `npm test`, `npx tsc --noEmit`. Commit.

---

### Task 9: Helhedstest, billeder og udrulningsliste

**Files:** ingen kode, kun verifikation og noter.

- [ ] **Step 1:** Playwright med tre mintede sessioner (gæst: ingen verificeret karakter; medlem: verificeret i guilden, rang 5; officer: rang 1): bekræft menu, adgang (Skolehjem/Galleri/Filer lukkede for gæst), RSVP for gæst, officer-sider, chat med egne kanaler. Desktop og mobil, lys og mørk. Uden JS: login-link og ingen-adgang virker.
- [ ] **Step 2:** Controlleren sender skærmbillederne til brugeren (SendUserFile).
- [ ] **Step 3:** Udrulningsliste, som controlleren gennemgår med brugeren før prod: Blizzard-redirects registreret, `.env` i `/srv/stacks` opdateret, `pg_dump` af prod-DB gemt, migrering kørt, første officer sat, brugerne varslet om at alle skal logge ind igen og starte forfra.
- [ ] **Step 4:** Efter brugerens «ja»: push, vent på CI, `docker compose pull && up -d`, verificér login på `https://aula-forever.dk`.

---

## Selvreview

- Spec-dækning: login (4), alle starter forfra (2), officer efter rang (3), verificerede karakterer (1, 5), adgangstabel (4, 6), Discord fjernet (7), konfiguration (8), udrulning og dump (9).
- Åben afhængighed: opgave 5 kan først skrives færdig efter opgave 1; planen har begge grene.
- Typer: `Member`, `deriveAccess`, `upsertUser`, `syncAccountCharacters`, `requireUser/GuildMember/Officer` bruges ens i opgave 2-7.
