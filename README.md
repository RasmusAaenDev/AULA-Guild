# AULA Guild

Hjemmeside for WoW-guildet AULA: login med Discord, tilknytning af Blizzard-karakterer og guild-roster. Next.js 16, Auth.js v5 og Drizzle på Postgres. Brugerfladen er på dansk.

## Udvikling

```bash
docker compose -f docker-compose.dev.yml up -d
docker exec aula-dev-db createdb -U aula aula_test   # kun første gang
cp .env.example .env.local                            # udfyld værdierne
npm run dev
```

Testene (`npm test`) kræver dev-databasen, så den skal køre først. `npm run typecheck` kører typetjek.

## Miljøvariabler

Se `.env.example`. Ingen hemmeligheder må committes. Generér `AUTH_SECRET` og `CRON_SECRET` hver for sig med:

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
