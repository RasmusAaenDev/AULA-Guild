# AULA Guild

Hjemmeside for WoW-guildet AULA: login med Discord, tilknytning af Blizzard-karakterer og guild-roster, kalender med tilmelding, opslag og kommentarer, filer og galleri samt en læs-kun guild-chat. Next.js 16, Auth.js v5 og Drizzle på Postgres. Brugerfladen er på dansk.

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
- **Chat:** læs-kun visning af én Discord-kanal via en separat bot. Menupunktet vises kun, hvis chatten er konfigureret.
- **Roster og karakterer:** login med Discord, tilknytning af Blizzard-karakterer og guild-roster.

## Miljøvariabler

Se `.env.example`. Ingen hemmeligheder må committes. Nye valgfrie variabler:

| Variabel | Standard | Betydning |
|---|---|---|
| `UPLOAD_DIR` | `./data/uploads` | Mappen uploads gemmes i. I produktion sætter compose den til `/app/data/uploads` |
| `MAX_UPLOAD_MB` | 10 | Største fil i MB |
| `MAX_TOTAL_MB` | 2048 | Samlet plads til uploads i MB |
| `DISCORD_BOT_TOKEN`, `DISCORD_CHAT_CHANNEL_ID` | ikke sat | Chatten er kun aktiv, hvis begge er sat |
| `SIMC_WORKER_URL` | ikke sat | Adressen på simc-worker (fx `http://simc:8080`); uden den er Sim-siden slået fra |

`AUTH_URL` skal være den adresse, siden nås på (produktion: `https://aula.aaensoftware.com`); uploadruten afviser forespørgsler med en anden `Origin`. Generér `AUTH_SECRET` og `CRON_SECRET` hver for sig med:

```bash
openssl rand -base64 32
```

## Discord-applikation

Registrér redirect-URL'erne i Discord-applikationens OAuth2-indstillinger:

- Produktion: `https://aula.aaensoftware.com/api/auth/callback/discord`
- Lokal udvikling: `http://localhost:3000/api/auth/callback/discord`

## Build og drift

Imaget bygges af `.github/workflows/build-and-push.yml` ved push til `main` (typetjek og tests først) og udgives som `ghcr.io/rasmusaaendev/aula-guild:main`.

Selve kørslen på serveren (compose, `.env`, Watchtower, backup og Cloudflare Tunnel) ligger i det private repo [RasmusAaenDev/server-stacks](https://github.com/RasmusAaenDev/server-stacks): tjenesten i `prod/aula-guild/` og Watchtower i `infra/watchtower/`. Følg dets README i stedet for at gentage trinnene her.

Uploads ligger i den navngivne Docker-volumen `prod-aula-guild_uploads` (monteret på `/app/data/uploads`). Den tages med i serverens `backup.sh` (separat `aula-uploads-<tid>.tar.gz`); gendannelse og opsætning af chatbotten er beskrevet i server-stacks-repoets README.
