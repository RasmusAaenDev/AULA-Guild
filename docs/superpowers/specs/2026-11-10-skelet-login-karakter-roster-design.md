# AULA Guild – spec 1: skelet, login, karakter og roster

Hjemmeside til WoW-guilden **AULA** (WoW: Forever, EU) i AULA-udseende. UI-sprog: dansk.
Dette er første af flere specs. Den dækker trin 2–4 i overdragelsens rækkefølge. Kalender/tilmelding, opslag, filer, galleri og raid-parathed får hver sin spec.

Designreference (prototype, ikke officiel designspec): https://claude.ai/artifact/P278BNV5fSULm1VmYfpbGM

## Beslutninger

| Emne | Valg |
|---|---|
| Placering | `~/development/AULA-Guild`, eget git-repo (`RasmusAaenDev/AULA-Guild` på GitHub), Next.js (app router, TypeScript), Auth.js (Discord), Drizzle som ORM |
| Hosting | Selvhostet på brugerens Linux-maskine: Next.js-container + Postgres-container i én compose-fil, Cloudflare Tunnel på `aula.aaensoftware.com`. Kun prod, ingen staging. Image bygges i GitHub Actions til GHCR, Watchtower opdaterer fra `main` (samme mønster som `server-stacks`) |
| Adgang | Medlem af guildens Discord-server. Officer = bestemt Discord-rolle. Scopes: `identify`, `guilds.members.read`. Ingen bot |
| Server-id og officer-rolle-id | Miljøvariabler (værdier leveres af brugeren) |
| Rolle (tank/healer/dps) | Spilleren vælger selv og kan ændre den |
| Karakterer pr. bruger | Flere, én aktiv. Hver karakter tilhører højst én bruger |
| Godkendelse af karakterer | Ingen (besluttet af brugeren) |
| Armory-sync | Opslag ved tilføjelse plus time-cron på guild-roster |
| Blizzard-login | Ingen. Spilleren skriver selv karakterens navn |

Uverificeret: at Discord-scopet `guilds.members.read` giver brugerens egne roller i en bestemt server uden bot skal bekræftes mod Discords dokumentation under implementering.

## Arkitektur

- `lib/blizzard`: token (client credentials, cachet i hukommelsen til lidt før `expires_in`) og typede kald `getCharacter(slug)` og `getGuildRoster()`. Eneste sted der kender host `eu.api.blizzard.com` og namespace `profile-forever-eu`. Resten af koden ser kun normaliserede typer.
- `lib/discord-access`: afgør ved login om brugeren er i serveren og har officer-rollen. Resultatet gemmes i sessionen.
- `lib/characters`: tilføj, skift aktiv, skift rolle, frakobl. Kender hverken Blizzard eller Discord direkte.
- `lib/sync`: roster-synkroniseringen som én funktion. Kaldes af en indbygget planlægger i app-processen (hver time, kun i én instans, slås fra med miljøvariabel) og af `app/api/cron/sync-roster`, som er beskyttet med `CRON_SECRET` og bruges til manuel kørsel.

Alle sider og API-ruter kræver session. Uden medlemskab af Discord-serveren vises en "ingen adgang"-side. Officer-handlinger tjekkes server-side.

Hemmeligheder (Blizzard-secret, Discord-secret, `AUTH_SECRET`, `CRON_SECRET`, database-URL) ligger i `.env` på serveren, aldrig i git, image eller klientkode. `AUTH_URL=https://aula.aaensoftware.com`, og Auth.js skal stole på værten bag tunnelen. Den Blizzard-nøgle, der blev delt i chat, er kompromitteret og må ikke bruges. En ny oprettes af brugeren.

Fejl: Discord 429 eller nedetid ved login giver en tydelig fejlside, aldrig adgang. Udløbet Blizzard-token midt i et kald giver ét nyt token og ét genforsøg.

## Datamodel

- `users`: `discord_id` (unik), `name`, `avatar`, `active_character_id` (nullable).
- `characters`: `blizzard_id` (unik), `slug`, `name`, `class`, `spec`, `role`, `item_level`, `guild_rank`, `in_guild`, `last_login`, `last_synced`, `user_id` (nullable).

Databasens unikke `blizzard_id` håndhæver "én karakter, én bruger", også ved samtidige forsøg. Cron-jobbet opretter ikke karakterer. Roster-siden viser kun registrerede karakterer.

## Tilføj karakter

1. Spilleren skriver fornavn og efternavn og vælger rolle. Input laves til slug (små bogstaver, mellemrum → bindestreg).
2. Serveren kalder `/profile/wow/character/{slug}`.
   - 404 → "Karakteren findes ikke i armory. Tjek stavningen." Hvis navnet står i guild-rosteren, bruges rosterens slug og opslaget gentages.
   - Guild er ikke AULA → "Karakteren er ikke i guilden AULA."
   - 5xx/timeout → "Armory svarer ikke lige nu, prøv igen om lidt." Intet gemmes.
3. `blizzard_id` er knyttet til en anden bruger → "Karakteren er allerede koblet til en anden spiller. Kontakt en officer."
4. Ellers oprettes rækken. Er det brugerens første karakter, bliver den aktiv.

Slug kan afvige fra visningsnavnet (eksempel fra overdragelsen: `ezzek-svumpukkel` mod "Ezzek"). `blizzard_id` identificerer karakteren, slug opdateres ved sync. Reglen verificeres mod hele rosteren (12 medlemmer) før den regnes for løst.

Officerer kan frakoble en karakter (`user_id` tømmes). Det er et forslag og er ikke aftalt eksplicit.

## Sync (time-planlægger)

1. Hent roster. Fejler kaldet, afbrydes kørslen uden ændringer, så nedetid ikke markerer nogen som forladt.
2. For hver registreret karakter: i rosteren → `in_guild = true` og rang opdateres, ellers `in_guild = false`.
3. For karakterer i guilden hentes profilen (item level, spec, `last_login`, slug). Lav samtidighed. Ved 429 ventes og prøves igen én gang. En enkelt fejlet karakter beholder gamle data, resten fortsætter.
4. `last_synced` sættes kun for dem, der lykkedes.

Blizzard opdaterer karakterdata ved logout, så tallene kan være op til én session gamle.

## Sider

- **AULA-skal:** teal topbjælke, venstremenu (bundbjælke på mobil), lys og mørk tilstand. Kun Overblik og Kontakter vises.
- **Overblik:** velkomst og aktiv karakter. Opslag og næste raid kommer senere.
- **Kontakter:** registrerede karakterer med klasse, spec, rolle, item level, rang og "sidst synkroniseret". `in_guild = false` vises nedtonet som "forladt guild". Officerer ser en frakobl-knap.
- **Profil (øverst til højre):** skift aktiv karakter, tilføj karakter, skift rolle, log ud.
- **Ingen adgang:** side for brugere uden for Discord-serveren.

## Test

- Enhedstest af `lib/blizzard` mod optagede svar (token, 200, 404, 429, 5xx), uden netværk.
- Test af tilføj-flowet inkl. slug-fallback og samtidige forsøg på samme `blizzard_id`.
- Test af adgangsregler: ikke i serveren, medlem, officer.
- Én manuel kørsel mod den rigtige Blizzard-API med den nye nøgle. Før den er kørt, er det ikke verificeret, at flowet virker mod Forever.

## Uden for spec 1

Kalender og tilmelding, opslag og kommentarer, filer, galleri, raid-parathed og attunements, Discord-bot, billedupload, visning af guildmedlemmer uden login.

## Åbne punkter

- Discord-server-id og officer-rolle-id.
- Domæne er valgt: `aula.aaensoftware.com` (DNS i Cloudflare, ikke oprettet endnu). Brugeren tilføjer det som Public Hostname på tunnelen (peger på `localhost:8102`), og Discord-redirect-URL registreres. Ikke verificeret: om zonen `aaensoftware.com` ligger i samme Cloudflare-konto som den eksisterende tunnel. Ligger den ikke, skal der oprettes en tunnel i den konto. `cloudflared` genstartes ikke uden en plan for at genvinde adgang.
- Serveren er kun logget ind mod `SekvensApS`'s GHCR-pakker. Et privat image under `RasmusAaenDev` kræver en ekstra login med en PAT med `read:packages`, eller at pakken gøres offentlig (koden indeholder ingen hemmeligheder).
- Postgres kører i en container. Der er ingen automatisk backup, så et natligt `pg_dump` til en mappe uden for containeren hører med i planen, og en gendannelse skal prøves en gang.
- Port 8102 er næste ledige prod-port i `server-stacks/ADDING-NEW-SERVICE.md`, som opdateres, når servicen oprettes.
- Raid-krav og attunement-quest-ID'er (først relevant i senere spec).
- Forever er ny (lanceret 4. nov. 2026): namespace og svar kan ændre sig.
