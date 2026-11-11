# AULA Guild – spec 2–5: kalender, opslag, filer/galleri og guild-chat

Bygger oven på spec 1 (`2026-11-10-skelet-login-karakter-roster-design.md`). Beslutningerne er truffet af brugeren under planlægningen og står i `docs/superpowers/roadmap.md`. Dette dokument gør dem præcise og tilføjer interaktionsanalysen (input → tilstand → visning, og hvad der kan gå galt). Spec 6 (raid-parathed og attunements) er stadig udskudt, fordi reglerne mangler.

UI-sprog: dansk. Tidspunkter gemmes i UTC og vises i `Europe/Copenhagen`.

## Fælles regler

- Alle sider og handlinger kræver en gyldig medlemssession (`requireMember`). Officer-handlinger kræver `requireOfficer`. Autorisation sker altid server-side, aldrig kun ved skjulte knapper.
- Menu (venstre, bundbjælke på mobil): Overblik, Kalender, Filer, Galleri, (Chat, kun hvis konfigureret), Kontakter.
- Alle formularer bruger server actions eller route handlers, validerer input server-side (Zod) og viser danske fejlbeskeder. Brugerindhold gengives altid som tekst (React escaper). Der gengives aldrig rå HTML.
- Nye tabeller får migrationer via `drizzle-kit generate`. Migrationerne kører ved opstart (`AUTO_MIGRATE`).
- Blizzard-karakterens rolle (`tank`/`healer`/`dps`) og aktiv karakter findes allerede (spec 1).

---

## Spec 2: Kalender og tilmelding (Komme/Gå)

### Beslutninger
- To event-typer: `raid` og `aften`. Kun officerer opretter raids og serier. Alle medlemmer kan oprette aftener.
- Tilmelding pr. karakter: `deltager`, `maaske`, `afbud`. Højst én tilmelding pr. bruger pr. event (unik `(event_id, user_id)`). Tilmeldingen kan ændres frem til eventets start.
- En tilmelding hører til den karakter, der var aktiv, da brugeren meldte til/fra. Skifter brugeren aktiv karakter bagefter, ændres eksisterende tilmeldinger IKKE; først når brugeren melder igen, bruges den karakter, der er aktiv da (ændret efter ønske).
- Ugentlig gentagelse med en regel (serie). Genererede events er almindelige events og kan ændres eller aflyses enkeltvis.
- Rolleoptælling bruger karakterens selvvalgte rolle. Intet loft pr. rolle.

### Datamodel
- `event_series`: `id`, `type`, `title`, `description`, `weekday` (0 = mandag … 6 = søndag, dansk uge), `start_time` (`HH:MM`, dansk tid), `duration_minutes`, `active`, `created_by` (user), `created_at`.
- `events`: `id`, `type`, `title`, `description`, `starts_at` (timestamptz, UTC), `duration_minutes` (nullable), `cancelled_at` (nullable), `series_id` (nullable), `detached` (bool, sættes når et seriens event redigeres enkeltvis), `created_by`, `created_at`. Unik `(series_id, starts_at)`, hvor `series_id` ikke er null.
- `rsvps`: `id`, `event_id`, `user_id`, `character_id`, `status`, `updated_at`. Unik `(event_id, user_id)`.

### Tidshåndtering
Brugeren indtaster dato og klokkeslæt i dansk tid. Serveren omregner til UTC med `Europe/Copenhagen`. Et klokkeslæt, der ikke findes (springet over ved sommertidsskiftet), afvises med en dansk besked. Et klokkeslæt, der forekommer to gange (ved vintertidsskiftet), tolkes som den første forekomst. Serier gemmer klokkeslættet som dansk tid og genererer hver forekomst for sig, så sommertid ikke flytter et raid.

### Rettigheder
- Opret event: `aften` = alle, `raid` = officer. Opret/ændr/deaktivér serie: officer.
- Redigér/aflys event: opretteren (kun aftener) og officerer.
- Tilmelding: kun medlem med aktiv karakter. Lukket når eventet er startet eller aflyst.

### Serier (generator)
- Horisont: 28 dage frem. Generatoren sikrer, at hver forekomst (ugedag + klokkeslæt) inden for horisonten findes som event. Eksisterende (også aflyste) events genskabes ikke. Den kører efter hver roster-synkronisering i planlæggeren og straks, når en serie oprettes eller ændres.
- Ændres en serie (titel, beskrivelse, ugedag, tid, varighed), eller deaktiveres den: fremtidige, ikke-aflyste, ikke-`detached` events **uden tilmeldinger** slettes og genereres på ny (ved ændring). Events med tilmeldinger, `detached` events og aflyste events røres ikke. Handlingen returnerer antallet af events, der ikke kunne ændres, og UI'et viser det til officeren.
- Redigeres eller aflyses et seriens event enkeltvis, sættes `detached = true` ved redigering. Aflysning sætter kun `cancelled_at`.

### Sider
- `/kalender`: kommende events i datorækkefølge, grupperet pr. dag. Hvert kort viser type, titel, tid, antal deltagere pr. rolle og brugerens egen status. Aflyste events vises nedtonet. Knap "Opret event". Officerer ser også "Gentagne events".
- `/kalender/[id]`: detaljer, brugerens tilmelding (tre knapper), deltagerlisten grupperet efter status med rolleoptælling for "deltager", og redigér/aflys for dem, der må.
- `/kalender/ny`: formular (type, titel, dato, tid, varighed, beskrivelse). Typevalget `raid` vises kun for officerer.
- `/kalender/[id]/rediger`: samme formular, forudfyldt.
- `/kalender/serier`: officerer: liste over serier, opret, redigér, deaktivér.
- Overblik: kort "Næste raid" og "Næste aften" med brugerens status og hurtige tilmeldingsknapper.

### Interaktionsanalyse
- **Tilmeld:** klik på status → server action med `eventId` og `status` → tjek session, aktiv karakter, event findes, ikke aflyst, ikke startet → upsert på `(event_id, user_id)` med den aktive karakter → siden revalideres. Fejl: ingen aktiv karakter ("Tilføj en karakter først"), event startet/aflyst ("Tilmelding er lukket"), ugyldig status (afvises).
- **Skift aktiv karakter:** `setActiveCharacter` opdaterer også brugerens tilmeldinger på kommende events i samme transaktion.
- **Frakobling:** `unlinkCharacter` flytter ejerens tilmeldinger til ejerens nye aktive karakter, og findes ingen, slettes tilmeldingerne på kommende events.
- **Opret event:** formular → Zod (titel 1–100, beskrivelse højst 2000, varighed 15–720 min, dato/tid) → ret til type → omregning til UTC → afvis datoer i fortiden → insert → redirect til detaljesiden.
- **Samtidighed:** to tilmeldinger fra samme bruger afgøres af den unikke indeks (upsert). To generatorkørsler (planlæggeren og en seriesredigering) afgøres af den unikke `(series_id, starts_at)` (`ON CONFLICT DO NOTHING`).
- **Hvad kan gå galt:** tidszone/sommertid (se ovenfor), serie ændres mens nogen tilmelder sig (events med tilmeldinger røres ikke), event slettes under en tilmelding (insert fejler pænt som "Eventet findes ikke længere"), officer mister rollen mellem formularvisning og afsendelse (server tjekker igen).

---

## Spec 3: Opslag og kommentarer (Overblik)

### Beslutninger
- Alle medlemmer kan skrive opslag og kommentere. Officerer kan fastgøre/frigøre opslag og slette alle opslag og kommentarer. Forfattere kan slette egne.
- Faner: ALLE, ULÆSTE, VIGTIGE. VIGTIGE = fastgjorte.
- ULÆSTE kræver en "set"-markering pr. bruger og opslag. Et opslag med nye kommentarer bliver ikke ulæst igen (første version).
- Ingen redigering af opslag (YAGNI). Man sletter og skriver igen.

### Datamodel
- `posts`: `id`, `author_id` (user), `title`, `body`, `pinned` (bool), `pinned_at`, `created_at`, `deleted_at`.
- `comments`: `id`, `post_id`, `author_id`, `body`, `created_at`, `deleted_at`.
- `post_reads`: `(user_id, post_id)` primærnøgle, `read_at`.

### Regler
- Opslag: titel 1–120, tekst 1–5000. Kommentar: 1–2000. Teksten gengives med linjeskift bevaret.
- Eget opslag er læst fra oprettelsen (der indsættes en `post_reads`-række).
- Sortering: fastgjorte først (nyeste fastgjort først), derefter nyeste. 20 pr. side med "Vis flere" (`?side=`).
- ULÆSTE: ikke slettede opslag uden `post_reads`-række for brugeren. Antallet vises som magentafarvet tæller på menupunktet Overblik.

### Sider
- Overblik (`/`): velkomst, aktiv karakter, "Næste raid"-kort (spec 2), faner ALLE/ULÆSTE/VIGTIGE (`?fane=`), opslagskort (forfatter, tid, titel, uddrag, antal kommentarer, fastgjort-mærke) og knappen "Nyt opslag".
- `/opslag/ny`: formular.
- `/opslag/[id]`: hele opslaget, kommentarer, kommentarformular, slet/fastgør efter ret. Siden markerer opslaget som læst via en lille klientkomponent, der kalder en server action ved visning.

### Interaktionsanalyse
- **Skriv opslag:** formular → Zod → insert i `posts` + `post_reads` for forfatteren i én transaktion → redirect til opslaget. Fejl: tom titel/tekst, for lang tekst.
- **Åbn opslag:** serversiden henter opslag og kommentarer; klientkomponenten kalder `markPostRead` (idempotent `INSERT … ON CONFLICT DO NOTHING`) og revaliderer tælleren.
- **Kommenter:** formular → Zod → insert → siden revalideres. Slettet opslag kan ikke kommenteres.
- **Fastgør/slet:** officer-tjek server-side. Slet er blød (`deleted_at`), og slettede opslag og kommentarer vises ikke og tæller ikke som ulæste.
- **Hvad kan gå galt:** opslag slettes, mens nogen kommenterer (afvises: "Opslaget findes ikke længere"), tællerens forældelse ved samtidige åbninger (tælleren er en simpel `COUNT` ved hver visning), lange tekster og tegn (React escaper, ingen HTML).

---

## Spec 4: Filer og galleri

### Beslutninger
- Både Filer og Galleri kan uploades af alle medlemmer. Officerer modererer: de kan slette og fastgøre alle filer. Brugere kan slette deres egne.
- Filer = guides og regler (PDF og billeder). Galleri = screenshots (kun billeder).
- Lagring på serverens disk i en Docker-volumen (`UPLOAD_DIR`), ikke offentlige filer. Alt leveres gennem en rute, der tjekker session.

### Datamodel
`files`: `id`, `section` (`filer`|`galleri`), `title`, `original_name`, `mime` (afgjort af serveren), `size_bytes`, `storage_key` (tilfældig, ingen brugerinput), `uploaded_by`, `pinned` (bool, kun relevant i Filer), `created_at`, `deleted_at`.

### Regler
- Tilladte typer afgøres af filens indhold (magic bytes), ikke af klientens filtype eller filendelse: PNG, JPEG, WebP, GIF og (kun i Filer) PDF. SVG afvises.
- Størrelse: højst `MAX_UPLOAD_MB` (standard 10) pr. fil og højst `MAX_TOTAL_MB` (standard 2048) samlet. Længden kontrolleres under streaming, ikke kun i `Content-Length`.
- Filer gemmes som `UPLOAD_DIR/<storage_key>` (tilfældigt id uden filendelse). Visningsnavnet er det rensede originale navn.
- Levering: `GET /api/filer/[id]` kræver session. Billeder leveres `inline`, PDF som `attachment`. Altid `X-Content-Type-Options: nosniff` og `Cache-Control: private`.
- Sletning: rækken får `deleted_at`, og filen fjernes fra disken.

### Sider og ruter
- `/filer`: fastgjorte øverst, derefter nyeste. Upload-formular. Liste med titel, type, størrelse, uploader og dato. Officer: fastgør, slet. Uploader: slet.
- `/galleri`: gitter af billeder (CSS `object-fit`, ingen miniaturegenerering). Klik åbner billedet. Upload-formular. Slet efter ret.
- `POST /api/filer`: multipart (`section`, `title`, `file`). Svarer JSON `{ ok: true, id }` eller `{ ok: false, error }`. Route handler i stedet for server action, fordi server actions har en lav grænse for body-størrelse.

### Interaktionsanalyse
- **Upload:** formular (klientkomponent med `fetch`) → rute: session → afvis for stor `Content-Length` → streame til en midlertidig fil med taltæller → afbryd og slet ved overskridelse → læs de første bytes og afgør type → tjek sektionens tilladte typer → tjek samlet kvote → flyt til endeligt navn → insert række. Fejl på noget trin sletter den midlertidige fil.
- **Hvad kan gå galt:** disken fuld (fejl → "Upload mislykkedes"), halv upload (midlertidig fil ryddes), forkert filtype med falsk endelse (afvises af magic bytes), stiindsprøjtning (storage_key er serverens eget id, aldrig brugerinput), cache af private billeder (kun `private`), Docker-volumen med forkerte rettigheder (Dockerfile opretter og `chown`er mappen), backup (volumen skal med).

---

## Spec 5: Guild-chat (læs-kun)

### Beslutninger
- Kun læsning. Ingen skrivning til Discord og ingen webhook.
- Ny, separat Discord-bot med rettighederne "se kanal" og "læs beskedhistorik". Den må ikke dele nøgle med jeres eksisterende bro mellem spillet og Discord.
- Siden poller via egen server. Forsinkelsen på nogle sekunder accepteres.
- Funktionen er valgfri: uden `DISCORD_BOT_TOKEN` og `DISCORD_CHAT_CHANNEL_ID` vises menupunktet ikke, og `/chat` svarer "Chatten er ikke sat op".

### Teknik
- `GET https://discord.com/api/v10/channels/{id}/messages?limit=50` med `Authorization: Bot <token>` (REST, ingen langvarig forbindelse nødvendig).
- Hukommelsescache på serveren (4 sekunder) med deling af igangværende kald, så mange åbne faner ikke belaster Discord. Ved 429 respekteres `retry_after`, og seneste svar leveres som forældet. Ved 5xx/netværk leveres seneste svar markeret forældet, eller en fejl, hvis der intet er.
- Beskeder mappes til `{ id, author, content, timestamp, bot }`: forfatter = `global_name ?? username`; `<@id>` i teksten erstattes med `@navn` ud fra `mentions`; er `content` tomt, bruges første embed (titel/beskrivelse), ellers vises "[vedhæftet fil]" ved vedhæftninger.
- Er alle hentede beskeder uden indhold, men der er beskeder, vises tipset "Slå Message Content Intent til for botten i Discords udviklerportal".
- `GET /api/chat` kræver session og svarer `{ messages, stale, error? }`. Siden `/chat` er en klientkomponent, der poller hvert 5. sekund, mens fanen er synlig, og ruller til bunden, medmindre brugeren har scrollet op.

### Interaktionsanalyse og risici
- Input: ingen (kun læsning). Tilstand: seneste 50 beskeder, forældet-flag, fejl. Visning: tekst uden HTML.
- Hvad kan gå galt: botten mangler rettigheder (401/403 → "Botten har ikke adgang til kanalen"), forkert kanal-id (404), rate limit (cache), broens beskeder ser anderledes ud (afsendernavnet kan stå i teksten; dette kendes først med rigtige data og justeres bagefter), Message Content Intent slået fra (tom tekst, se tip).
- Uverificeret og kan kun ses med en rigtig bot: hvordan broens beskeder ser ud, og om intent-kravet gælder for jer.

---

## Fælles implementeringsnoter

- Næste migrationer tilføjes oven på `drizzle/0000_*`. Hver ny tabel testes mod den rigtige test-database.
- Nye miljøvariabler (alle valgfrie med standardværdier): `UPLOAD_DIR` (standard `./data/uploads`), `MAX_UPLOAD_MB` (10), `MAX_TOTAL_MB` (2048), `DISCORD_BOT_TOKEN`, `DISCORD_CHAT_CHANNEL_ID`.
- Udrulning: `Dockerfile` opretter `/app/data/uploads` ejet af `node`. `prod/aula-guild/docker-compose.yml` i `server-stacks` får en navngiven volumen til uploads, og backup-scriptet skal tage uploads med.
- Test-strategi: forretningsregler som rene funktioner/moduler med tests mod test-databasen. Sider verificeres med typecheck, build og kørsel af dev-serveren.
