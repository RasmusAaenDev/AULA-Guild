# simc-worker

Lille HTTP-tjeneste der kører [SimulationCraft (simc-forever)](https://github.com/simulationcraft/simc-forever) på en indsendt profil og svarer med et kort resultat. Kun til intern brug (ingen åbne porte); appen kalder den via `SIMC_WORKER_URL`. Kun Node-standardbiblioteket, ingen npm-afhængigheder.

## API

- `GET /health` → `{"ok":true,"simc":"<version>"}`
- `POST /run` (`Content-Type: application/json`), body `{ "input": "<simc-profil>", "iterations": 5000 }`
  - `input`: tekst, højst 32 KB. `iterations`: heltal 100–20000 (standard 5000). Body højst 64 KB (ellers 413).
  - 200: `{ ok, result: { simc, player, iterations, dps: { mean, stdDev, meanStdDev }, scaleFactors, elapsedMs }, warnings? }`
  - 400 ugyldig profil (dansk fejl med linjenummer), 422 simc kunne ikke køre, 429 kø fuld.

## Sikkerhedsgrænser

- Profilen hvidlistes linje for linje (`sanitize.mjs`): præcis én spillerlinje og kendte nøgler. Nøgler der kan læse/skrive filer eller netværk (`input=`, `json2=`, `html=`, `apikey=`, `armory=` osv.) afvises, og kommentarer fjernes.
- Worker bygger selv inputfilen med faste indstillinger (`threads=1`, `default_actions=1`, Patchwerk, `max_time=300`) i en frisk 0700-mappe i `/tmp`, som slettes bagefter.
- `spawn` uden shell, timeout 90 s (SIGKILL), output afkortet til 20 KB og sendes aldrig til klienten.
- Én kørsel ad gangen (FIFO), højst 10 ventende. Ingen udgående netværkskald; kør containeren på et `internal`-netværk, read-only, uden capabilities, som uid 10001.

## Opdatér simc

Ret `ARG SIMC_REF` i `Dockerfile` til den ønskede commit i simc-forever (eller byg med `--build-arg SIMC_REF=<sha>`). `ARG JOBS` (standard 4) styrer parallelle compile-jobs. CI (`.github/workflows/build-simc.yml`) bygger og pusher `ghcr.io/rasmusaaendev/aula-simc:main`.

Test: `node --test "simc-worker/test/*.test.mjs"`.

## Licens

SimulationCraft er GPL-3. Imaget indeholder en uændret `simc`-binær bygget fra kilden ovenfor; kilden er tilgængelig på den fastlåste commit.
