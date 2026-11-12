# simc-worker

Lille HTTP-tjeneste der kører [SimulationCraft (simc-forever)](https://github.com/simulationcraft/simc-forever) på en indsendt profil og svarer med et kort resultat. Kun til intern brug (ingen åbne porte); appen kalder den via `SIMC_WORKER_URL`. Kun Node-standardbiblioteket, ingen npm-afhængigheder.

## API

- `GET /health` → `{"ok":true,"simc":"<version>","patches":[{"class":"mage","status":"applied"}]}`. `patches` læses ved opstart fra `/opt/simc/PATCHES_APPLIED` (skrevet af `patches/apply.sh` i bygget; `status` er `applied` eller `dropped-upstream`); mangler filen, er listen tom.
- `POST /run` (`Content-Type: application/json`), body `{ "input": "<simc-profil>", "iterations": 5000, "fightStyles": ["Patchwerk"], "bagItems": [{ "slot": "hands", "id": 3308, "label": "Barbaric Cloth Gloves" }] }`
  - `input`: tekst, højst 32 KB. `iterations`: heltal 100-20000 (standard 5000). Body højst 64 KB (ellers 413).
  - `fightStyles` (valgfri): 1-2 unikke af `Patchwerk` (standard) og `DungeonSlice`. Simc køres én gang pr. kampstil; DungeonSlice sætter selv `max_time` (360 s) og mål, og virker med Forever-data. Fejler én stil, får den `error`, og de øvrige returneres alligevel.
  - `bagItems` (valgfri, højst 40): `slot` (head, neck, shoulders, back, chest, wrist, hands, waist, legs, feet, finger1/2, trinket1/2, main_hand, off_hand, ranged), `id` (1-9999999), `label` (højst 60 tegn: bogstaver, tal, mellemrum og `( ) ' - . ,`). Workeren bygger selv simc-profilesets (`profileset.i<index>+=slot=,id=N`; labelen når aldrig simc). Finger/trinket giver to profilesets (`i<n>a`/`i<n>b`, erstat slot 1 hhv. 2). Items der allerede er udstyret springes over. Simc kontrollerer ikke at et item passer til slotten.
  - Profilesets køres i samme simc-kørsel som basisprofilen (`profileset_work_threads=1`). Iterationer pr. profileset = `min(iterations, max(500, 60000 / antal profilesets))`, så 80 profilesets giver 750, og en kørsel med to kampstile holder sig inden for tidsgrænsen (målt ca. 1,2 ms/iteration). Under ca. 12 profilesets bruges fuld `iterations`.
  - Ukendt/ugyldigt item-id får simc til at afbryde med det samme (den forsøger et opslag mod Blizzards API); workeren udelader da det item (`error` på itemet) og kører igen.
  - Samlet tidsgrænse for hele kaldet: 240 s (SIGKILL); hver simc-kørsel får resten af budgettet, og stile der ikke når at køre får `error`.
  - 200: `{ ok, result: { apiVersion: 2, simc, patches, model?, player, iterations, elapsedMs, dps, scaleFactors: null, results: [{ fightStyle, dps: { mean, stdDev, meanStdDev }, items?: [{ index, slot, id, label, dpsMean, dpsStdDev, delta, deltaPercent, error? }], error? }] }, warnings? }`. `dps` er første vellykkede stils basis (som før). `items` er sorteret efter `delta` faldende (items med fejl sidst). `patches` er som i `/health`. Kører spillerens klasse på en anvendt Aula-rettelse, får resultatet `model: "aula-rettelse"`, og `warnings` starter med «Grov model: klassen er implementeret af Aula, ikke af SimulationCraft. Tallene er vejledende.» (for druid, priest, warlock og shaman, hvor rettelsen ligger oven på SimulationCraft's egen grundmodel: «Grov model: SimulationCraft's grundmodel med Aulas rettelser. Tallene er vejledende.»); for andre klasser er der hverken `model` eller ekstra advarsel.
  - **Log-stream:** med `Accept: application/x-ndjson` svarer `/run` 200 `application/x-ndjson` og skriver én JSON pr. linje: `{"type":"log","text":"…"}` (simcs stdout/stderr i ankomstrækkefølge, samlet og sendt højst hver ca. 500 ms; «Venter i kø …» højst hver sekund mens jobbet venter) og til sidst præcis én `{"type":"result", …}` med samme krop som det almindelige svar (også `{"type":"result","ok":false,"error":"…"}`). Fejl før streamen starter (400/413/415/429) er stadig almindelig JSON med statuskode. Lukker klienten forbindelsen, dræbes simc og temp-mappen ryddes. Uden headeren er svaret uændret.
  - 400 ugyldig profil eller ugyldige nye felter (dansk fejl med linjenummer/indeks), 422 ingen kampstil kunne køre, 429 kø fuld.

## Sikkerhedsgrænser

- Profilen hvidlistes linje for linje (`sanitize.mjs`): præcis én spillerlinje og kendte nøgler. Nøgler der kan læse/skrive filer eller netværk (`input=`, `json2=`, `html=`, `apikey=`, `armory=` osv.) afvises, og kommentarer fjernes.
- Worker bygger selv inputfilen med faste indstillinger (`threads=1`, `default_actions=1`, valgt kampstil, `max_time=300` for Patchwerk) i en frisk 0700-mappe i `/tmp`, som slettes bagefter.
- `spawn` uden shell, samlet timeout 240 s (SIGKILL), output afkortet til 20 KB internt. Simcs output sendes kun til klienten via log-streamen ovenfor, og kun renset (`logsanitize.mjs`): kontroltegn og ANSI fjernes (undtagen linjeskift/tab), `\r`-fremdriftslinjer reduceres til seneste tilstand, job-mappen og andre absolutte stier (`/tmp/…`, `/opt/…`, `/app/…`) erstattes med `<mappe>`, linjer afkortes til 300 tegn og samlet log til 64 KB (så `[log afkortet]`). Profilen ekkoes aldrig af workeren; kun hvad simc selv skriver.
- Én kørsel ad gangen (FIFO), højst 10 ventende. Ingen udgående netværkskald; kør containeren på et `internal`-netværk, read-only, uden capabilities, som uid 10001.

## Opdatér simc

`ARG SIMC_REF` i `Dockerfile` er den fastlåste simc-forever-commit (eller byg med `--build-arg SIMC_REF=<sha>`). `ARG JOBS` (standard 4) styrer parallelle compile-jobs. CI (`.github/workflows/build-simc.yml`) bygger og pusher `ghcr.io/rasmusaaendev/aula-simc:main`.

Oven på simc ligger Aulas rettelser i `patches/` (én pr. klasse; se `patches/PATCHES.md`). De anvendes i bygget af `patches/apply.sh`; har upstream selv implementeret klassen (efter `<klasse>.check`), droppes vores rettelse automatisk, og passer en rettelse ikke, fejler bygget.

1. **Tjek den nye commit uden at bygge:** `sh simc-worker/patches/check-upstream.sh <ny-sha>` (eller `main`). Én linje pr. klasse: `OK (kan anvendes)`, `DROP (upstream har den nu)` eller `KONFLIKT (skal flettes: …)`. CI kører samme tjek mod simc-forever `main` ved hvert byg og skriver rapporten i jobbets summary (kun information).
2. **Alle OK eller DROP:** ret `ARG SIMC_REF`, regenerér appens talenttabel med `node scripts/gen-simc-talents.mjs <simc-klon på ny-sha>` (armory-talenterne kodes som `talents=` ud fra simcs `trait_data.inc`; `tests/simc-talents.test.ts` fejler, indtil `lib/simc-talents.generated.ts` har samme SIMC_REF), kopiér de rene upstream-filer, som rettelserne rører, til `test/fixtures/simc-upstream/` (se 3c; testen sammenligner dem med patchens `index`-linjer), byg og kør testene.
3. **KONFLIKT – lav rettelsen igen** i en arbejdskopi:
   ```sh
   git clone https://github.com/simulationcraft/simc-forever.git simc && cd simc && git checkout <ny-sha>
   git apply --3way ../AULA-Guild/simc-worker/patches/mage.patch   # konfliktmarkører hvor upstream og rettelsen mødes
   # løs konflikterne, byg (make -C engine release) og prøv en mage-profil
   git diff -- engine/class_modules/sc_mage.cpp engine/class_modules/apl/mage.cpp engine/class_modules/apl/mage.hpp \
     > ../AULA-Guild/simc-worker/patches/mage.patch
   # 3c: rene upstream-filer til testen
   for f in engine/class_modules/sc_mage.cpp engine/class_modules/apl/mage.cpp engine/class_modules/apl/mage.hpp; do
     git show HEAD:$f > ../AULA-Guild/simc-worker/test/fixtures/simc-upstream/$f; done
   ```
   Kør `check-upstream.sh <ny-sha>` igen (skal give OK) og opdatér målingerne i `PATCHES.md`.
4. **DROP – upstream har klassen:** slet `patches/<klasse>.patch` og `patches/<klasse>.check` (og klassens afsnit i `PATCHES.md` samt `test/fixtures/simc-upstream/` hvis ingen rettelse bruger dem). Indtil da gør bygget det selv: rettelsen springes over, og workeren melder `dropped-upstream` uden `model`/advarsel.
5. **Ny klasse:** ret i en arbejdskopi som i 3, gem `git diff` som `patches/<klasse>.patch`, skriv `patches/<klasse>.check` (kun betingelser der er falske på den rene upstream-kilde) og et afsnit i `PATCHES.md`. Har upstream allerede en grundmodel af klassen (druid, priest, warlock …), skal `.check` teste på det konkrete, rettelsen tilføjer (`has_action <fil> <navn>`, `contains_re <fil> <udtryk>`), ikke på linjeantal; se «`.check`-format» i `PATCHES.md`.

Test: `node --test "simc-worker/test/*.test.mjs"` (kræver `git` og `sh`; bygger ikke simc).

## Licens

SimulationCraft er GPL-3. Imaget indeholder en `simc`-binær bygget fra simc-forever på den fastlåste commit **plus Aulas rettelser i `patches/`** (se `/opt/simc/PATCHES_APPLIED` i imaget). Rettelserne er afledt af GPL-koden og selv GPL-3; de er en del af denne offentlige repo og skal forblive det, så længe imaget distribueres.
