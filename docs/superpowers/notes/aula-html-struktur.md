# Det originale AULA: struktur aflæst af brugerens HTML-uddrag (2026-11-10)

Kilde: HTML (kun markup, ingen CSS) fra en indlogget forældreprofil på forsiden «Overblik», indsendt af brugeren. Alle personoplysninger (navne på børn, personale og forældre, profilbilleder, sessions-ID'er, tokens, institutionskoder) er med vilje udeladt her. Kun struktur, rækkefølge, klassenavne og tekster til grænsefladen er gengivet.

**Hvad dokumentet IKKE viser:** farver, størrelser, afstande, skrifttyper og ikon-udseende. De ligger i eksterne CSS-filer og en ikonskrift (`icon-Aula_*`), som ikke var med. Alle værdier nedenfor er derfor struktur, ikke design. Vores egne farver og ikoner er stadig skøn og egne tegninger, og AULAs logo, ikonskrift og CSS bør ikke kopieres ind (ophavsret/varemærke).

## Overordnet layout
- `body.theme-guardian` (temaklasse pr. rolle). Rod: `#aula-content` med tre dele: `<header id="aula-header">`, `<nav id="aula-menu">`, `.content-wrapper` (indeholder `<main>` og `<aside>`).
- To-kolonne indhold på forsiden: bred hovedkolonne (`main`) og en smal højre kolonne (`aside`).

## Topbjælke (`#top-bar`)
- Venstre: logo som knap («Gå til startsiden»).
- Midte: global søgelinje, pladsholder «Søg efter indhold i Aula», søgeknap med forstørrelsesglas.
- Række under (`.menu-row`): **børnefilter** (en cirkulær avatar pr. barn med afkrydsningsfelt, klik skjuler/viser indhold fra barnet), **gruppe-dropdown** («MINE GRUPPER», liste med gruppenavn og pil frem) og **profil-dropdown** (avatar med initialer).
- Profil-dropdown: lukkeknap, stor avatar, fulde navn, «(Barn A, Barn B)», liste med valg: Kontaktoplysninger, Stamkort, App historik, Notifikationer, Hjælp til Aula (eksternt link), og fod med «Privatlivspolitik» (linkknap) og **LOG UD** (sekundær knap med store bogstaver).

## Venstremenu (`#aula-menu`, rolle `navigation`)
Rækkefølge og tekster: **Overblik, Kalender, Beskeder, Komme/gå, Galleri, Kontakter, Filer** (Filer sidst; overflow i «mere»-menu `#more-menu`).
- Hvert punkt: ikon over tekst (`.menu-item`), tekst afkortes med ellipsis, aktivt punkt `data-selected="true"`.
- **Tæller-boble** (`.badge-notification` / `.aula-badge`) med tal øverst på ikonet, kun når der er nyt (Overblik, Kalender, Beskeder, Galleri). Skjult tekst «Nyt indhold». Hele punktet har `aria-label` med antal: «Der er N notifikationer, naviger til …».

## Forside (`main`)
- Øverst: **advarsels-/notifikationsbånd** (`.aula-alert`) med rundt udråbstegn-ikon, tekst (fx at en anden forælder har svaret på en begivenhed) og en lukkeknap.
- Sidehoved: `h1` «Overblik» (klassen `posts-title`), og til højre en stor sekundær knap **«Opret»** med dropdown: Opslag, Begivenhed, Besked, Album (hver med ikon).
- **Faner** (`.tabs-nav`, knapper med store bogstaver, aktiv markeret): ALLE, ULÆSTE, VIGTIGE, PERSONALE, FORÆLDRE, EGNE OPSLAG, GEMTE. Skærmlæserbeskeder «Vis opslag fra …».
- **Opslagsliste** (`.post-list`, hvert opslag er et `<article class="post">`):
  - Badge-række øverst (`.post-badges`), fx **«Vigtig»** for vigtige opslag.
  - Hoved: rund avatar, fed afsendernavn med **titel og institution i parentes**, derefter «**Delt med**» + gruppenavn (+ «N andre grupper» som klikbar tekst), derefter tid: «I går 16:45 (redigeret) · I går 11:16 (oprettet)» (relativ tid, fuld dato i `title`).
  - Højre i hovedet: små avatarer for de børn, opslaget vedrører, og en **bogmærke-knap** («Gem opslag»).
  - Krop: `h2` titel, indholdet som formateret tekst/HTML (afsnit, links, emoji).
  - Vedhæftninger: **billedgitter** (miniaturer, klik åbner) og **filliste** (filnavn, «Åbn» + ikon).
  - Uendelig scroll (`.sentinel` pr. opslag).
- Skuffe (`.vue-drawer`): højre sidepanel, der glider ind til «Nyt opslag»/detaljer, med titel, tilbage-pil (mobil) og lukkeknap.

## Højre kolonne (`aside`)
- **Dagsoverblik**: «Uge 46», «I dag»-knap, dato, forrige/næste dag, tidsgitter 08.00–17.30 i halve timer med en kolonne pr. barn og en «nu»-linje; hændelser som små blokke. Knap «Se kalender» og lukkeknap.
- **Vigtige datoer**: liste, hver række med stor dato + måned (kort, «nov»), beskrivelse, tidsrum («14:10 - 14:30» eller «Hele dagen») og barnets avatar.
- **Fødselsdag**: «Kommende», tekst «Om 5 dage har … fødselsdag».
- **Widgets** (kasser): «Nyttige links», eksterne systemer (fravær, karakterer, bibliotek, Meebook), hver med navn og «Leveret af …».

## Kendte mønstre, vi kan genbruge (egne ikoner/farver)
1. Menurækkefølge og tæller-bobler på flere punkter, med `aria-label` med antal.
2. «Opret»-dropdown som fælles startsted (Opslag, Begivenhed, …) i stedet for separate knapper.
3. Faner med store bogstaver; tilføj fx «EGNE OPSLAG» og «GEMTE» (bogmærker) hvis det giver mening.
4. Opslagskort: afsender (titel), «Delt med», «oprettet/redigeret», «Vigtig»-badge, bogmærke, vedhæftninger som gitter + filliste med «Åbn».
5. Højre kolonne på brede skærme: dagens/ugens begivenheder, «Vigtige datoer», «Kommende fødselsdage» (kunne være «Næste raid»/«Næste aften»), og evt. «Nyttige links».
6. Notifikationsbånd øverst med lukkeknap.
7. Profil-dropdown med skift af profil, indstillinger, privatlivspolitik og **LOG UD** (store bogstaver).
8. Relativ tid («I går 16:45», «Fre. 13:50») med fuld dato i `title`.
