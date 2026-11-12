# AULA Guild

Hjemmeside for WoW-guildet AULA: login med Battle.net, verificerede karakterer og guild-roster, kalender med tilmelding, opslag og kommentarer, filer og galleri samt egne beskedkanaler. Next.js 16, Auth.js v5 og Drizzle på Postgres. Brugerfladen er på dansk.

## Udvikling

```bash
docker compose -f docker-compose.dev.yml up -d
docker exec aula-dev-db createdb -U aula aula_test   # kun første gang
cp .env.example .env.local                            # udfyld værdierne
npm run dev
```

Testene (`npm test`) kræver dev-databasen, så den skal køre først. `npm run typecheck` kører typetjek.

## Funktioner

- **Kalender:** raids (kun officerer) og aftener, tilmelding pr. karakter (Deltager, Afbud, Måske), ugentlige serier der genererer kommende events.
- **Opslag (Overblik):** opslag og kommentarer, officerer kan fastgøre og moderere; faner for alle, ulæste og vigtige.
- **Filer og galleri:** upload af billeder og PDF'er (blokerede filtyper afvises), leveret gennem en autentificeret rute. Officerer modererer og fastgør.
- **Beskeder:** egne kanaler, der kun findes her på siden. Alle indloggede kan oprette kanaler og skrive; opretteren og officerer kan slette.
- **Roster og karakterer:** login med Battle.net, karakterer fra Battle.net-kontoen (verificerede) og guild-roster.

## Login og adgang

Man logger ind med Battle.net (region EU, scopes `openid wow.profile`). Alle med en Battle.net-konto kan logge ind. Ved login hentes brugerens egne WoW Forever-karakterer fra kontoen og knyttes til brugeren som verificerede; brugerens Battle.net-token bruges kun til det og gemmes ikke. Karakterer tilføjet i hånden er uverificerede og giver ikke adgang.

- **Gæst:** indlogget uden verificeret karakter i guilden.
- **I guilden (medlem):** mindst én verificeret karakter i guilden.
- **Officer:** en verificeret karakter i guilden med guild-rang højst `OFFICER_MAX_RANK` (standard 1: guildmester og rang 1).

Medlem og officer afledes af databasen ved login og genberegnes hvert 10. minut, uden eksterne kald.

| Område | Gæst | I guilden | Officer |
|---|---|---|---|
| Overblik, kalender, opslag, kontakter | læse | læse + skrive | + moderere |
| Tilmelde sig events (RSVP) | ja | ja | ja |
| Skolehjem (SimC) | nej (venteside) | ja | ja |
| Galleri | nej | ja | ja |
| Filer | nej | ja | ja |
| Egne kanaler (Beskeder) | ja | ja | + slette kanaler |
| Officer-funktioner (raids, ugentlige serier, roster-handlinger) | nej | nej | ja |

**Første officer:** der skal ikke sættes noget i hånden. Den første, der logger ind med en verificeret karakter med guildens rang 0 eller 1, bliver officer. Rangen kommer fra guild-rosteren, som hentes ved login og ved roster-synkroniseringen.

## Miljøvariabler

Se `.env.example`. Ingen hemmeligheder må committes. Valgfrie variabler:

| Variabel | Standard | Betydning |
|---|---|---|
| `UPLOAD_DIR` | `./data/uploads` | Mappen uploads gemmes i. I produktion sætter compose den til `/app/data/uploads` |
| `MAX_UPLOAD_MB` | 10 | Største fil i MB |
| `MAX_TOTAL_MB` | 2048 | Samlet plads til uploads i MB |
| `AUTH_BATTLENET_ID`, `AUTH_BATTLENET_SECRET` | `BLIZZARD_CLIENT_ID`/`-SECRET` | Battle.net-klienten til login; tomme eller ikke sat bruger Blizzard-API-klienten |
| `OFFICER_MAX_RANK` | 1 | Højeste guild-rang (0 = guildmester), der giver officer-adgang |
| `SIMC_WORKER_URL` | ikke sat | Adressen på simc-worker (fx `http://simc:8080`); uden den er Sim-siden slået fra |

`AUTH_URL` skal være den adresse, siden nås på (produktion: `https://aula-forever.dk`); uploadruten afviser forespørgsler med en anden `Origin`. Generér `AUTH_SECRET` og `CRON_SECRET` hver for sig med:

```bash
openssl rand -base64 32
```

## Battle.net-klient

Login bruger en klient fra [Blizzards udviklerportal](https://develop.battle.net/access/clients) (den samme som API-klienten, medmindre `AUTH_BATTLENET_ID`/`-SECRET` er sat). Under klientens **Redirect URLs** registreres hver adresse, siden nås på, som `<AUTH_URL>/api/auth/callback/battlenet`:

- Produktion: `https://aula-forever.dk/api/auth/callback/battlenet`
- Dev: `https://dev.aaensoftware.com/api/auth/callback/battlenet`
- Lokal udvikling: `http://localhost:3000/api/auth/callback/battlenet`

Adressen skal matche præcist (skema, vært og sti); ellers afviser Battle.net login med en redirect-fejl.

## Build og drift

Imaget bygges af `.github/workflows/build-and-push.yml` ved push til `main` (typetjek og tests først) og udgives som `ghcr.io/rasmusaaendev/aula-guild:main`.

Selve kørslen på serveren (compose, `.env`, Watchtower, backup og Cloudflare Tunnel) ligger i det private repo [RasmusAaenDev/server-stacks](https://github.com/RasmusAaenDev/server-stacks): tjenesten i `prod/aula-guild/` og Watchtower i `infra/watchtower/`. Følg dets README i stedet for at gentage trinnene her.

Uploads ligger i den navngivne Docker-volumen `prod-aula-guild_uploads` (monteret på `/app/data/uploads`). Den tages med i serverens `backup.sh` (separat `aula-uploads-<tid>.tar.gz`); gendannelse er beskrevet i server-stacks-repoets README.
