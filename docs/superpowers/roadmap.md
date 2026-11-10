# AULA Guild – køreplan

Hver linje er en egen spec → plan → implementering. Beslutninger er truffet af brugeren 2026-11-10 under brainstorming, medmindre andet er angivet.

## Status (2026-11-10)

Spec 1 er bygget. Spec 2–5 (kalender, opslag, filer og galleri, chat) er bygget på grenen `feature/spec-2-5` med udrulningsfiler i server-stacks-repoet; slutreview, merge og udrulning mangler. Spec 6 venter stadig på reglerne. Gennemgang af brugerfladen er Task 12 i planen.

## Rækkefølge

1. **Spec 1: skelet, login, karakter, roster** – skrevet, se `specs/2026-11-10-skelet-login-karakter-roster-design.md`.
2. **Kalender og tilmelding (Komme/Gå)**
3. **Opslag og kommentarer (Overblik)**
4. **Filer og galleri**
5. **Guild-chat (læs-kun)**
6. **Raid-parathed og attunements** – blokeret, venter på regler.

## Fælles for alle specs

- Hosting: selvhostet på brugerens Linux-maskine, Cloudflare Tunnel, kun prod (port 8102). Repo `RasmusAaenDev/AULA-Guild`, image til GHCR, Watchtower. Se spec 1 for detaljer og uverificerede punkter.
- Domæne: `aula.aaensoftware.com`. DNS ligger i Cloudflare (nameservere `adele`/`amos`). `aula` er ikke oprettet endnu. Discord-login skal have redirect-URL registreret for det endelige domæne.
- Tidspunkter gemmes i UTC og vises i `Europe/Copenhagen`.
- Officer = Discord-rolle. Rettigheder tjekkes altid server-side.

## 2. Kalender og tilmelding

- To event-typer: `raid` og `aften`. Kun officerer opretter raids. Alle kan oprette aftener.
- Tilmelding pr. karakter: Deltager, Afbud, Måske. Kan ændres frem til start.
- Højst én karakter pr. bruger pr. event. Skifter man karakter, flytter tilmeldingen med.
- Ugentlig gentagelse med regel (fx hver onsdag kl. 20). Systemet genererer kommende events (forslag: fire uger frem). Genererede events er almindelige events og kan ændres eller aflyses enkeltvis.
- Ændres reglen, rammer det kun fremtidige events uden tilmeldinger. Events med tilmeldinger bliver stående, og officeren får besked om, at de ikke er ændret.
- Rolleoptælling bruger karakterens selvvalgte rolle. Ingen loft pr. rolle (ikke valgt).
- Åbent: hvem må ændre eller slette en aften, en bruger har oprettet (forslag: opretteren og officerer).

## 3. Opslag og kommentarer

- Alle medlemmer kan skrive opslag og kommentere. Officerer kan fastgøre opslag og moderere. Det afløser "kun opslag fra officerer" i overdragelsen.
- Faner: ALLE, ULÆSTE, VIGTIGE. VIGTIGE = fastgjorte af en officer. ULÆSTE kræver en "set"-markering pr. bruger og opslag, og menuens tæller bruger samme data.
- Et opslag med nye kommentarer tæller ikke som ulæst igen i første version.

## 4. Filer og galleri

- Begge dele kan uploades af alle. Officerer modererer (slette, omdøbe) og kan fastgøre en fil øverst, så guild-reglerne ikke drukner.
- Lagring på en volumen på serveren (forslag), leveret gennem en autentificeret rute, ikke som offentlige filer i nginx. Med i backup. Størrelsesgrænse. Kun billeder og PDF'er (forslag).
- Åbent: grænser og om man selv kan slette sine egne filer og billeder (forslag: ja).

## 5. Guild-chat (læs-kun)

- Ny, separat Discord-bot med rettighederne "se kanal" og "læs beskedhistorik". Må ikke dele nøgle med jeres eksisterende bro mellem spil og Discord.
- Siden poller via egen server (en proces, der kører hele tiden, åbner for andre løsninger, men beslutningen er stadig polling og læs-kun) (`GET /channels/{id}/messages`) og viser kun chatten til indloggede medlemmer. Ingen skrivning til Discord og ingen webhook.
- Skal verificeres mod Discords dokumentation: om Message Content Intent kræves, og hvordan broens beskeder ser ud (bot eller webhook), så afsenderens karakternavn vises korrekt.
- Forsinkelse på nogle sekunder accepteres.

## 6. Raid-parathed og attunements

- Udskudt, til reglerne er leveret: Forever-raids, krav og attunement-quest-ID'er.
- Skal først testes: hvad `quests/completed` faktisk returnerer, hvordan enchants og gems vises i udstyr, rate limits.
- Tidligere forslag, ikke valgt: officerer opretter selv krav pr. raid (minimum item level og tekstlig attunement-liste).

## Afvist eller droppet

- Beskeder fra Discord-webhook om nye raids: droppet for nu.
- Fuld Discord-bot med påmindelser og skrivning: ikke valgt.
- Loft pr. rolle i tilmeldinger: ikke valgt.
