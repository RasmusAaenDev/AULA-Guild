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

Se `.env.example` (udvikling) og `deploy/.env.example` (produktion). Ingen hemmeligheder må committes.

## Første deploy

Mappen `deploy/` er selvstændig og kan flyttes til et eget privat stack-repo.

1. Kopiér `deploy/` til en mappe på maskinen, fx `/srv/aula-guild`.
2. `cd /srv/aula-guild && cp .env.example .env`, og udfyld `.env`. `DB_PASSWORD` skal genereres URL-sikkert (`openssl rand -hex 24`), fordi compose bygger `DATABASE_URL` ud fra den.
3. `docker compose pull && docker compose up -d`
4. Start AULA's egen Watchtower: `docker compose -f watchtower/docker-compose.yml up -d`. Den er afgrænset til scope `aula` og opdaterer kun containere med labelen `com.centurylinklabs.watchtower.enable=true` (kun app-containeren, aldrig databasen).

Watchtower-containeren monterer `/var/run/docker.sock` med skriveadgang, hvilket svarer til root på værten. Det accepteres her, fordi det er en enkeltformåls-instans, der kun rører containere med scope `aula`. Projektet er arkiveret, så versionen er pinnet (`1.7.1`).

Pakken `ghcr.io/rasmusaaendev/aula-guild` skal enten gøres offentlig (anbefalet, koden indeholder ingen hemmeligheder), eller `watchtower/docker-compose.yml` skal have monteret en egen `docker-config.json` med en PAT med `read:packages` (linjen er udkommenteret i filen).

Appen lytter på `127.0.0.1:8102`. Opret en Cloudflare Tunnel-route `aula.aaensoftware.com` til `localhost:8102` i Cloudflare-dashboardet.

Pipelinen (`.github/workflows/build-and-push.yml`) tester og bygger imaget ved push til `main`.

## Backup

Natligt pg_dump med integritetstjek af gzip-filen (se `deploy/backup.sh`). Cron-linje:

```
15 3 * * * BACKUP_DIR=/srv/backups/aula /srv/aula-guild/backup.sh
```

Gendan: `gunzip -c aula-<tid>.sql.gz | docker exec -i prod-aula-guild-db psql -U aula -d aula`
