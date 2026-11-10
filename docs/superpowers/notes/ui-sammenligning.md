# UI-sammenligning: originale AULA vs. AULA-Guild

Dato: 2026-11-10. Ren læse-opgave: kun kode, den tidligere designprototype og offentlige kilder er læst. Intet er gengivet i en browser, og der er ikke logget ind nogen steder.

## 0. Begrænsninger (læs først)

- **Vores UI** er kun vurderet ud fra koden (`app/globals.css`, komponenter, sider). Jeg har ikke set en eneste side gengivet. Alle udsagn om "hvordan det ser ud" er udledt af CSS.
- **Originale AULA** kunne jeg ikke se visuelt. Websøgning og WebFetch giver kun tekst. aulainfo.dk's guidesider har skærmbilleder uden alt-tekst, så farver, ikoner, skygger og pixelmål kunne **ikke verificeres** ud fra kilderne. Det, der står om farver/typografi/ikoner nedenfor, er enten (a) hentet fra designprototypen, som den tidligere session sagde var bygget ud fra AULA-skærmbilleder, eller (b) skøn. Det er markeret.
- Prototypen er ikke en kilde til AULA, men en tidligere fortolkning af den. Hvor prototypen og koden stemmer overens, er der tale om "hvad vi ville ramme".
- Opslag, faner, filer, galleri og chat er **planlagt, ikke bygget** (spec 3-5). De er vurderet som "planlagt", ikke som mangler.

## 1. Det originale AULA: hvad kilderne faktisk siger

### Verificeret (læst i kilderne)

| Emne | Hvad der står | Kilde |
|---|---|---|
| Moduler | Overblik, Beskeder, Kalender, Galleri (og Dokumenter/Filer som standardmodul) | Forældreguide Nobi (dec. 2020) https://nobi.aula.dk/sites/nobi.aula.dk/files/arkiv/Download_filer/For%C3%A6ldreguide%2Btil%2BAula%2Bdecember%2B2020.pdf ; søgeresultater fra Aarhus/Randers/KK-guides (se afsnit 4) |
| Overblik | Det første man møder; her oprettes og læses **opslag** til mange modtagere uden behov for svar. Beskeder bruges, når man vil have svar. | Nobi-guiden; samme søgeresultat |
| Min dag (forsiden) | Dagens aktiviteter med pile frem/tilbage, kolonne markeret «I DAG» der kan foldes ud, link «Se kalender», og «Vigtige datoer» = de næste fem begivenheder fra i morgen og seks måneder frem. | Gladsaxe-vejledning, afsnit 4.1.6 https://gpv.gladsaxe.dk/p/Subsites-Filer/GPV/Begivenheder/Aula-chatbot/42-Kalender-p028-054.pdf |
| Kalendervisninger | Fire: **Dag, Uge, Arbejdsuge, Måned**. Standard er 5-dagesvisningen (man-fre). Gitter i 30-minutters intervaller; klik på et felt åbner «Opret begivenhed». Dags dato er markeret med en **mørkere blå**. Klik på «Dag» vender tilbage til i dag. Heldags-begivenheder og fødselsdage vises i en bar under datoen; mere end tre vises som to + «+ flere». Widget-kolonne til højre i kalenderen. Udskrivning via tre prikker. | Gladsaxe 4.2.8 (samme kilde) |
| Svar på invitation | Svarmuligheder **«Deltag», «Afvis», «Måske»**; også direkte fra notifikationen via «Tilmeld». Afviste events fjernes fra kalenderen. Ubesvaret/«måske» vises med **stribet markering i venstre side** af begivenheden; «deltager» med **ensfarvet** markering. Flyttet begivenhed vises to gange (overstreget gammel tid + «(ny tid)»). | Gladsaxe 4.2.9 |
| Begivenhedsdetalje | Oversigt over inviterede og svar, foldbare grupper **«Deltagere», «Deltager ikke», «Deltager måske», «Mangler svar»**. Maks. antal deltagere (1-2000) og resterende pladser. «Anmod om svar» + deadline for svar. Gentagelse dagligt/ugentligt/månedligt. | Gladsaxe 4.1.x / 4.2.x |
| Flere børn | Kalenderen kan vise flere børn i samme visning eller ét ad gangen. Med to+ børn kan man filtrere pr. barn. «Din profil» ændrer kontaktoplysninger/børnedata. | Nobi-guiden; Aarhus-guide (søgeresultat) |
| App | Bundmenu kan tilpasses (Profil > Indstillinger > Tilpas bundmenu); «Menu» åbner alle moduler og widgets. Appen giver push ved nye beskeder og kalenderinvitationer. | Gladsaxe-chatbot-dokument (søgeresultat); App Store https://apps.apple.com/dk/app/aula/id1330998651 |
| Galleri | Billeder/videoer fra børnenes hverdag, knyttet til samtykke. | Nobi-guiden; Skødstrup-guide (søgeresultat) |
| Tilgængelighed | aulainfo.dk har «Spring til indhold» og en tilgængelighedserklæring. | https://www.aulainfo.dk/hjaelp-og-vejledninger/laer-aula-at-kende |

### Ikke verificeret (skøn / fra prototypen)

Teal topbjælke og mørkere logofelt, smal grå-blå venstremenu med ikon over label og mørk aktiv-markering, magenta tæller-bobler, hvide afrundede kort på lys grå baggrund, Lato, store VERSALE faner (ALLE/ULÆSTE/VIGTIGE) med pil under den aktive, opslagskort med avatar + «Delt med …» + kommentarer + SVAR-knap, «Skriv kommentar»-felt, mobil bundbjælke, kontaktlistens opbygning, profilmenu med barn/rolle-skift. Alt dette kommer fra prototypen og min viden om AULA, ikke fra læsbare kilder. Behandl hex-værdier som tilnærmelser.

Kildeliste: aulainfo.dk (https://www.aulainfo.dk, `/hjaelp-og-vejledninger/laer-aula-at-kende`), Nobi-forældreguide (se ovenfor), Gladsaxe kalendervejledning (se ovenfor), App Store-siden (se ovenfor), samt søgeresultater fra randers.dk, aarhus.dk, Albertslund og KK, som jeg kun har set som uddrag.

## 2. Vores UI nu (kun fra koden)

- **Topbjælke:** `.topbar`, 56 px høj, teal `#00788c`; `.logo` er en 100 px bred, mørkere teal (`#005b6b`) firkant med teksten «Aula» (22 px, 800). Højre side: knappen «Lys/mørk» (tekst) og `ProfileMenu`. Ikke sticky.
- **Venstremenu:** 100 px bred `.sidenav`, farve `#6c8593`, tre tekstlinks (Overblik, Kalender, Kontakter), 13 px, hvid tekst, aktiv = `#1f4d5c` via `aria-current`. **Ingen ikoner, ingen tæller-bobler.** Ikke sticky.
- **Indhold:** `.content` max 1100 px, baggrund `#e9eff2`, `.card` = hvid, radius 12, skygge `0 1px 4px rgba(0,0,0,.12)`. `h1/h2` teal-mørk (`#00505f`), 800. Skrift Lato 400/700/800 fra Google Fonts (`app/layout.tsx`); h1 har ingen eksplicit størrelse (browserstandard 2em).
- **Knapper:** `.btn` solid teal, radius 8, 700; `.secondary` med ramme; `.danger` magenta kontur. Ingen versaler.
- **Formularer:** `.field` med label over input, radius 8, 1px ramme. Ingen egen fokusstil.
- **Overblik:** «Velkommen, <navn>», kort «Din aktive karakter», to kort «Næste raid»/«Næste aften» (titel-link, tid, status, tre RSVP-knapper), og et kort med «Opslag kommer snart.» (planlagt, spec 3).
- **Kalender:** `/kalender` er en **liste grupperet pr. dag** (h2 pr. dag, ét klikbart kort pr. event med typemærke, titel, tid, antal pr. rolle, egen status; aflyste nedtonet). Knapper «Opret event» / «Gentagne events». Detalje: kort med mærker, tid, beskrivelse, Redigér/Aflys; kort «Tilmelding» med tre knapper (aktiv = solid, andre = outline; «Fjern tilmelding»); kort «Deltagere» grupperet pr. status med h3 og punktliste. Formularer er enkle `.card`-formularer. Ingen måned/uge/dag-gitter.
- **Tilmeldingsknapper:** Deltager / Måske / Afbud (rsvpLabel), ens farve, kun solid/outline skelner aktiv.
- **Kontakter:** ét kort med tabel (Karakter, Spiller, Klasse, Rolle, Item level, Rang, Sidst synkroniseret). Versale grå overskrifter, `badge`, nedtonede rækker for forladt guild, «Frakobl» for officerer. `.table-wrap` giver vandret scroll på mobil. Ingen avatarer, ingen søgning/filter.
- **Profilmenu:** `<details>` med avatar (32 px) + aktivt karakternavn; dropdown (280 px) med karakterknapper, rolle-select, «Tilføj karakter», «Log ud». Lukker på klik udenfor/Esc/navigation (`DetailsMenu`).
- **Mørk tilstand:** `prefers-color-scheme` + `data-theme`; tekstknap «Lys/mørk». Topbjælken forbliver teal; nav bliver `#2b4650`.
- **Mobil (<=700 px):** `.layout` bliver `column-reverse`, menuen en bundrække (kun tekst, 3 punkter), logo 64 px. Menuen er `sticky; bottom:0`. Topbjælken er ikke sticky.
- **Login / ingen adgang:** `.center-card` med «AULA»-overskrift og én knap (Discord). Ingen logo-lockup.
- **Tomme tilstande:** kun grå `.muted`-tekst i kort («Ingen kommende events.», «Ingen karakterer endnu.»).

### Designprototypen (artifakt P278BNV5fSULm1VmYfpbGM), hvad vi *vil* ramme

72 px topbjælke med 38 px/900-logo «Aula» og **klokke-ikon med magenta tæller** + profil-pille med karaktervælger; 100 px venstremenu med **30 px linje-ikoner** over label, **tæller-boble** på Komme/Gå og «…»-knap nederst; menupunkter Overblik, Kalender, Filer, Komme/Gå, Galleri, Kontakter; h1 36 px/900; faner i versaler 17 px med teal understreg og **trekantspil** under den aktive; opslagskort radius 8, 58 px avatar, «Navn (Rang)», «Delt med <gruppe>», tid, «Vigtig»-chip, titel 24 px, kommentarer og felt «Skriv kommentar» + **SVAR**-knap; højre kolonne med «Dagens overblik», «Ugens plan» (statuschips); kalender som 7-dages ugegitter med dagfelter; tilmeldingsknapper med ✔/✖/? og farver grøn/rød/gul; Filer som rækker med type-ikon; Galleri som albumkort med gradient; Kontakter som tabel pr. hold med rolle-ikon og farveprik; mobil: fast bundbjælke med ikon + label, sidens bund-padding. Skrift Lato 400/700/900, globalt `:focus-visible` med 3 px teal outline.

## 3. Sammenligning

Prioritet: H = høj, M = mellem, L = lav. «AULA» = kilde-verificeret (V) eller fra prototype/skøn (S).

| Element | Originale AULA | Vores nu | Forskel/gap | Pri. | Konkret forslag |
|---|---|---|---|---|---|
| Topbjælke | Teal bjælke med logo til venstre, ikoner (notifikationer, beskeder) og profil til højre (S) | 56 px teal, logo + tekstknap «Lys/mørk» + profil; ikke sticky | Lidt lav, intet klokke-ikon (vi har ingen notifikationer endnu), ikke sticky | L | `.topbar{position:sticky;top:0;z-index:20;height:64px}`; klokke først når opslag/ulæste findes |
| Logo | Wordmark «Aula» på mørkere felt (S) | Tekst «Aula» 22 px på mørkere felt | Ligner i opbygning; størrelsen er mindre end prototypen. Hele navnet «AULA» på login | L | `.logo{font-size:30px;font-weight:800;justify-content:flex-start;padding-left:18px}` i `globals.css`; login: samme wordmark som lockup |
| Venstremenu | Ikon over label, aktiv punkt mørk, smalt felt (S); modulerne Overblik, Kalender, Galleri, Dokumenter, Kontakter (V) | Kun tekst, 13 px | **Ingen ikoner** er det største visuelle gap | H | Tilføj inline-SVG (24-30 px, `stroke:currentColor`, 1.5) i `NavLink` via en `icon`-prop; genbrug SVG-paths fra prototypen (`P`-objektet); `.navlink{font-size:14px;gap:5px}` |
| Tæller-bobler | Magenta runde tællere på menupunkter og klokke (S) | Ingen; `--badge` findes som variabel, men bruges ikke til tællere | Mangler. Giver først mening, når ulæste opslag (spec 3) og ubesvarede events findes | M | `.cnt{position:absolute;top:6px;left:18px;min-width:20px;height:20px;border-radius:10px;background:var(--badge);color:#fff;font-size:12px;font-weight:800;display:grid;place-items:center}`; først «ubesvarede events» på Kalender (kan bygges nu), «ulæste» på Overblik (spec 3) |
| Farver, lys | Teal topbjælke, grå-blå menu, lys grå baggrund (S) | Samme palet som prototypen (`#00788c`, `#6c8593`, `#e9eff2`, magenta `#a30b52`) | Tæt på. Mangler `--teal`-accent til links/faner (vi bruger `inherit` på links) | M | Tilføj `--teal:#00788c`; `a{color:var(--teal)}` for brødtekstlinks, bevar `inherit` i kort/menu |
| Farver, mørk | AULA har (efter min viden) ikke en officiel mørk tilstand; kunne ikke verificeres | Mørk tilstand via system + knap | **Bevidst afvigelse**, rimelig for spillere om aftenen. Prototypen har lysere `--teal:#4bb6c8` til mørk tekst, det har vi ikke | L | Behold. Tilføj mørk `--teal` hvis links indføres |
| Skrift | Lato (S; matcher prototypen) | Lato 400/700/800 | Samme. Prototypen bruger 900 til overskrifter, vi 800; h1 mangler eksplicit størrelse | L | Hent `wght@400;700;900`; `h1{font-size:32px;line-height:1.1}` `h2{font-size:20px}` |
| Kort og skygger | Hvide afrundede kort, tydelig skygge (S) | Hvid, radius 12, svag skygge `.12` | Radius lidt større og skyggen lysere end prototypen (radius 8, `.22`). Kortene på desktop er fuld bredde; AULA har højre widgetkolonne | M | `.card{border-radius:8px;box-shadow:0 1px 4px rgb(0 40 50/.22)}` (eller behold 12 - smag) |
| Knapper | Konturknapper i versaler med teal ramme (S/prototype) | Solid teal, 700, ingen versaler | Stilen afviger lidt; fuldt funktionelt | L | `.btn{text-transform:uppercase;letter-spacing:.02em;font-weight:800;font-size:14px}` for primær/sekundær; ikke på «Frakobl» |
| Formularer | Rolige felter med label over (S) | `.field` ens | OK. Mangler fokusstil og fejlmarkering pr. felt | M | `.field input:focus-visible,.field select:focus-visible,.field textarea:focus-visible{outline:3px solid var(--topbar);outline-offset:1px}` |
| Tabeller (Kontakter) | Kontaktliste med avatar/navn, gruppe-/rolleinfo, ofte som liste/kort (S) | Bred 7-kolonners tabel i ét kort, vandret scroll på mobil | Datatung (ilvl, rang, sync) hører til guild; mangler avatar/farveprik pr. klasse, søg/filter | M | Tilføj `.cdot`-farveprik pr. klasse og rolle-ikon (som prototypen); sticky `th`; på mobil skjul «Sidst synkroniseret»/«Rang» med `@media` eller vis som kort. Søgefelt senere |
| Kalender-visning | **Dag/Uge/Arbejdsuge/Måned**-gitter, 30-min-intervaller, i dag mørk blå, heldagsbar, «+ flere» (V) | Kommende events som liste pr. dag | Størst funktionelt gap, men listen er bevidst valgt i spec 2 (ingen gitter). Prototypen har ugegitter | M (uge) / L (måned) | Billig middelvej: ugestribe øverst på `/kalender` (7 kolonner, `.week` fra prototypen) med dagnumre og farveklodser pr. event, klik scroller til dagen; marker i dag med `--teal-soft`. Måned/dag-gitter: stor, ikke nu |
| Begivenhedskort | Venstre markering: **ensfarvet = deltager, stribet = ubesvaret/måske** (V); flyttede events vises overstreget (V) | Typemærke + titel + «Din status: …» som tekst; aflyst = opacity .55 | Statusmarkering er kun tekst. Mangler visuel venstre-kant | M | `.event-card{border-left:6px solid var(--border)}` `.event-card.rsvp-yes{border-left-color:var(--topbar)}` `.event-card.rsvp-maybe{border-left-style:dashed}`; klasse sættes fra `e.myStatus` i `kalender/page.tsx` |
| Tilmelding | «Deltag / Afvis / Måske» i en dialog eller direkte fra notifikation (V); «Mangler svar» som gruppe (V); deadline og maks. antal (V) | Deltager / Måske / Afbud som tre knapper + «Fjern tilmelding»; deltagere grupperet; ingen deadline/maks | Labels er **bevidst** guild-sprog (Afbud er vanligt blandt raidere). Aktiv status kun skelnet af solid/outline, ingen farve. «Mangler svar» findes ikke (vi kender ikke alle uden svar) | M | Farvekod aktiv knap (grøn/gul/rød) som prototypen: `.btn.on-ok/on-warn/on-bad` + ikon-prefiks ✔ ? ✖ (ikke kun farve, for tilgængelighed). «Mangler svar»-liste kan udledes af roster minus RSVP (lille forespørgsel) |
| Komme/Gå som egen side | Eget menupunkt/overblik over svar (prototypen; AULA har «Tilmeld» i notifikation, V) | Findes ikke; svar sker på kort/detalje | Prototype ville have fanen; vi har RSVP på Overblik og detalje | L | Overvej ikke en ny side; en «Mangler svar»-boks på Overblik giver samme værdi |
| Profilmenu / skift barn/rolle | Skift mellem børn/profiler og roller i topbjælken, «Din profil» (V delvist) | `<details>`-dropdown: skift aktiv karakter (svarer til barn), rolle-select, tilføj karakter, log ud | God analog, bevidst guild-tilpasset. Mangler avatarpille-look og tydelig «aktiv»-markering | L | `details.profile summary{background:rgb(255 255 255/.14);border-radius:22px;padding:4px 10px 4px 4px}`; vis aktiv karakter med ✓ og klasse-farveprik |
| Mobilvisning | Bundmenu (tilpasbar) + «Menu» med alle moduler (V) | Bundrække med tre tekstlinks, sticky; topbjælke ikke sticky | Rigtig struktur. Mangler ikoner, «Mere»-punkt når menuen bliver 5-6 punkter (Filer, Galleri, Chat) | M | Ikoner i bundbjælken (som desktop-forslaget); `@media` `.navlink{font-size:12px;min-width:62px}`, `.sidenav{overflow-x:auto}`; safe-area: `padding-bottom:env(safe-area-inset-bottom)` |
| Overblik/forside | Opslag-feed + «Min dag» + «Vigtige datoer» (næste fem) (V) | Velkomst, aktiv karakter, to «næste»-kort, «Opslag kommer snart» | Rigtig idé (næste events); mangler højre widgetkolonne og opslag (planlagt spec 3) | M | To-kolonne layout: `.cols{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px}` (kollapser <980 px); NextEvents i højre kolonne, opslag venstre når spec 3 lander. Overvej «Vigtige datoer» = næste fem events |
| Opslag, faner, «Delt med», SVAR | ALLE/ULÆSTE/VIGTIGE, avatar, «Delt med …», kommentar, SVAR (V for opslagsbegrebet; S for udseendet) | **Planlagt** (spec 3) | Ikke et gap i nuet | – | Når bygget: genbrug `.tabs`, `.post`, `.write` fra prototypen (CSS er klar) |
| Filer / Galleri | Dokumenter og Galleri som moduler (V) | **Planlagt** (spec 4) | Ikke et gap i nuet | – | Genbrug `.doc` og `.album`-CSS fra prototypen |
| Chat | Beskeder (V) | **Planlagt** (spec 5), guild-specifik | Bevidst; AULA har beskeder, vi har guild-chat | – | – |
| Tomme tilstande | Lille tekst/illustration (S) | Grå tekst i kort | Fungerer; kolde | L | `.empty{text-align:center;padding:32px;color:var(--muted)}` + en linje om næste skridt («Opret det første event») |
| Tilgængelighed: fokus | aulainfo.dk har «Spring til indhold» (V) | Ingen global `:focus-visible`; kun profil-`summary` har egen; ingen skip-link | Tastaturbrugere får kun browserens standardring, som er svær at se på teal | H | `:focus-visible{outline:3px solid var(--topbar);outline-offset:2px}`, i topbar/nav `outline-color:#fff`; skip-link `<a class="skip" href="#main">Spring til indhold</a>` i `Shell.tsx`, `id="main"` på `<main>` |
| Tilgængelighed: kontrast | (ikke målt for AULA) | Hvid 13 px på `#6c8593` (menu) | Mit estimat (WCAG-formel, ikke målt i browser): ca. 3,9:1 = under 4,5:1 for lille tekst. `--muted #5d7280` på `#e9eff2` ca. 4,3:1, på hvid ca. 5,0:1. Teal `#00788c` på hvid ca. 5,2:1 (OK) | H | Mørkere menu `--nav:#566f7d` eller 15-16 px/700 tekst; `--muted:#4f6572` |
| Tilgængelighed: øvrigt | – | Gode: `aria-current`, `aria-pressed`, `role=alert`, `aria-label` på nav/theme. Mangler: `lang`/skip, aflyst status kun via opacity (+ badge «Aflyst», OK) | Status må ikke kun være farve | M | Ikon/tekst sammen med farve på RSVP; `prefers-reduced-motion` først når animation indføres |
| Login / ingen adgang | AULA-login med UniLogin/MitID (S) | Centreret kort, «AULA», Discord-knap | Bevidst afvigelse (Discord). Mangler teal topbjælke/wordmark-look | L | Giv `.center-card` en teal top (`border-top:56px solid var(--topbar)`) eller genbrug `.topbar`/`.logo` over kortet |

### Bevidste og rimelige afvigelser

- Guild-indhold: karakter, klasse, rolle, item level, raid/aften, serier i stedet for børn, grupper og skema. Rimeligt, og kernen i produktet.
- Mørk tilstand og «Lys/mørk»-knap: AULA har ingen kendt tilsvarende; rimeligt for målgruppen.
- «Afbud» i stedet for «Afvis», «Deltager» i stedet for «Deltag»: tilpasset sprog; rimeligt. Kilden bruger «Deltag/Afvis/Måske».
- Kalender som liste: spec 2's valg; rimeligt til få, gentagne events. Gitter er dyrt og giver lidt for en guild.
- Login via Discord, «Ingen adgang»: nødvendig forskel.
- Disclaimer: prototypen skrev «ikke tilknyttet det rigtige Aula» i bunden. Overvej det samme i footer, når siden er offentlig (varemærke/forveksling) - det er en vurdering, ikke juridisk rådgivning.

## 4. Prioriteret liste (top 10: mest AULA-lighed for mindst arbejde)

1. **Ikoner i venstremenuen og bundbjælken.** Omfang: lille. Filer: `components/NavLink.tsx` (ny `icon`-prop), `components/Shell.tsx`, `app/globals.css` (`.navlink svg`, størrelse 28-30 px). SVG-paths kan kopieres fra prototypen. Størst visuel effekt.
2. **Global fokusring + skip-link.** Omfang: lille. Filer: `app/globals.css`, `components/Shell.tsx` (skip-link, `id` på `<main>`).
3. **Kontrastrettelser** (`--nav` mørkere eller større/federe menutekst, `--muted` mørkere). Omfang: lille. Fil: `app/globals.css`. Mål med rigtigt værktøj (Lighthouse/axe) efter udrulning, mine tal er kun estimater.
4. **Statusfarver og -ikoner på RSVP-knapper** (grøn/gul/rød + ✔ ? ✖) og **venstre kant på event-kort** (ensfarvet = deltager, stribet = måske), som AULA gør (V). Omfang: lille-mellem. Filer: `components/RsvpButtons.tsx`, `app/(app)/kalender/page.tsx`, `app/globals.css`.
5. **Typografi og kortstil:** h1 32-36 px/800-900, versal-knapper, kort radius 8 med kraftigere skygge, `--teal` til links. Omfang: lille. Fil: `app/globals.css` (+ Lato-link `wght@900` i `app/layout.tsx`).
6. **Sticky topbjælke og større logo/wordmark** (64-72 px, 30 px logotekst). Omfang: lille. Fil: `app/globals.css`.
7. **To-kolonne Overblik** med NextEvents i højre widgetkolonne («Dagens overblik»/«Ugens plan»-stil) og plads til opslag-feed. Omfang: mellem. Filer: `app/(app)/page.tsx`, `components/NextEvents.tsx`, `app/globals.css`. Gøres bedst sammen med spec 3.
8. **Ugestribe på `/kalender`** (7 dagsfelter med klodser, i dag fremhævet) som billig genkendelse af AULAs ugevisning. Omfang: mellem. Filer: `app/(app)/kalender/page.tsx`, ny `components/WeekStrip.tsx`, `app/globals.css`.
9. **Tæller-bobler:** først «ubesvarede events» på Kalender, senere «ulæste» på Overblik (spec 3). Omfang: mellem (kræver en tællerforespørgsel i `Shell`/layout). Filer: `components/Shell.tsx`, `components/NavLink.tsx`, `app/globals.css`.
10. **Kontakter:** klasse-farveprik og rolle-ikon, skjul kolonner på mobil, profilpille-look på profilmenu. Omfang: lille. Filer: `app/(app)/kontakter/page.tsx`, `components/ProfileMenu.tsx`, `app/globals.css`.

Efter alle ti vil forsiden og menuen ligne AULA tydeligt; kalender (gitter), opslag, filer, galleri og chat afhænger af spec 3-5 og er ikke med i listen.

**Til sidst, ærligt:** jeg har ikke set vores sider gengivet og heller ikke originale AULA visuelt. Gentag sammenligningen med rigtige skærmbilleder (desktop og mobil, lys og mørk), før detaljer som pixelmål, skygger og farver låses.
