# simc-worker

Lille HTTP-tjeneste der kører [SimulationCraft (simc-forever)](https://github.com/simulationcraft/simc-forever) på en indsendt profil og svarer med et kort resultat. Kun til intern brug (ingen åbne porte); appen kalder den via `SIMC_WORKER_URL`. Kun Node-standardbiblioteket, ingen npm-afhængigheder.

## API

- `GET /health` → `{"ok":true,"simc":"<version>"}`
- `POST /run` (`Content-Type: application/json`), body `{ "input": "<simc-profil>", "iterations": 5000, "fightStyles": ["Patchwerk"], "bagItems": [{ "slot": "hands", "id": 3308, "label": "Barbaric Cloth Gloves" }] }`
  - `input`: tekst, højst 32 KB. `iterations`: heltal 100-20000 (standard 5000). Body højst 64 KB (ellers 413).
  - `fightStyles` (valgfri): 1-2 unikke af `Patchwerk` (standard) og `DungeonSlice`. Simc køres én gang pr. kampstil; DungeonSlice sætter selv `max_time` (360 s) og mål, og virker med Forever-data. Fejler én stil, får den `error`, og de øvrige returneres alligevel.
  - `bagItems` (valgfri, højst 40): `slot` (head, neck, shoulders, back, chest, wrist, hands, waist, legs, feet, finger1/2, trinket1/2, main_hand, off_hand, ranged), `id` (1-9999999), `label` (højst 60 tegn: bogstaver, tal, mellemrum og `( ) ' - . ,`). Workeren bygger selv simc-profilesets (`profileset.i<index>+=slot=,id=N`; labelen når aldrig simc). Finger/trinket giver to profilesets (`i<n>a`/`i<n>b`, erstat slot 1 hhv. 2). Items der allerede er udstyret springes over. Simc kontrollerer ikke at et item passer til slotten.
  - Profilesets køres i samme simc-kørsel som basisprofilen (`profileset_work_threads=1`). Iterationer pr. profileset = `min(iterations, max(500, 60000 / antal profilesets))`, så 80 profilesets giver 750, og en kørsel med to kampstile holder sig inden for tidsgrænsen (målt ca. 1,2 ms/iteration). Under ca. 12 profilesets bruges fuld `iterations`.
  - Ukendt/ugyldigt item-id får simc til at afbryde med det samme (den forsøger et opslag mod Blizzards API); workeren udelader da det item (`error` på itemet) og kører igen.
  - Samlet tidsgrænse for hele kaldet: 240 s (SIGKILL); hver simc-kørsel får resten af budgettet, og stile der ikke når at køre får `error`.
  - 200: `{ ok, result: { apiVersion: 2, simc, player, iterations, elapsedMs, dps, scaleFactors: null, results: [{ fightStyle, dps: { mean, stdDev, meanStdDev }, items?: [{ index, slot, id, label, dpsMean, dpsStdDev, delta, deltaPercent, error? }], error? }] }, warnings? }`. `dps` er første vellykkede stils basis (som før). `items` er sorteret efter `delta` faldende (items med fejl sidst).
  - **Log-stream:** med `Accept: application/x-ndjson` svarer `/run` 200 `application/x-ndjson` og skriver én JSON pr. linje: `{"type":"log","text":"…"}` (simcs stdout/stderr i ankomstrækkefølge, samlet og sendt højst hver ca. 500 ms; «Venter i kø …» højst hver sekund mens jobbet venter) og til sidst præcis én `{"type":"result", …}` med samme krop som det almindelige svar (også `{"type":"result","ok":false,"error":"…"}`). Fejl før streamen starter (400/413/415/429) er stadig almindelig JSON med statuskode. Lukker klienten forbindelsen, dræbes simc og temp-mappen ryddes. Uden headeren er svaret uændret.
  - 400 ugyldig profil eller ugyldige nye felter (dansk fejl med linjenummer/indeks), 422 ingen kampstil kunne køre, 429 kø fuld.

## Sikkerhedsgrænser

- Profilen hvidlistes linje for linje (`sanitize.mjs`): præcis én spillerlinje og kendte nøgler. Nøgler der kan læse/skrive filer eller netværk (`input=`, `json2=`, `html=`, `apikey=`, `armory=` osv.) afvises, og kommentarer fjernes.
- Worker bygger selv inputfilen med faste indstillinger (`threads=1`, `default_actions=1`, valgt kampstil, `max_time=300` for Patchwerk) i en frisk 0700-mappe i `/tmp`, som slettes bagefter.
- `spawn` uden shell, samlet timeout 240 s (SIGKILL), output afkortet til 20 KB internt. Simcs output sendes kun til klienten via log-streamen ovenfor, og kun renset (`logsanitize.mjs`): kontroltegn og ANSI fjernes (undtagen linjeskift/tab), `\r`-fremdriftslinjer reduceres til seneste tilstand, job-mappen og andre absolutte stier (`/tmp/…`, `/opt/…`, `/app/…`) erstattes med `<mappe>`, linjer afkortes til 300 tegn og samlet log til 64 KB (så `[log afkortet]`). Profilen ekkoes aldrig af workeren; kun hvad simc selv skriver.
- Én kørsel ad gangen (FIFO), højst 10 ventende. Ingen udgående netværkskald; kør containeren på et `internal`-netværk, read-only, uden capabilities, som uid 10001.

## Opdatér simc

Ret `ARG SIMC_REF` i `Dockerfile` til den ønskede commit i simc-forever (eller byg med `--build-arg SIMC_REF=<sha>`). `ARG JOBS` (standard 4) styrer parallelle compile-jobs. CI (`.github/workflows/build-simc.yml`) bygger og pusher `ghcr.io/rasmusaaendev/aula-simc:main`.

Test: `node --test "simc-worker/test/*.test.mjs"`.

## Licens

SimulationCraft er GPL-3. Imaget indeholder en uændret `simc`-binær bygget fra kilden ovenfor; kilden er tilgængelig på den fastlåste commit.
