# AULA-satire: personaer

Fast persongalleri til kommentartrådene i `lib/satire-posts.json`. Brug kun personer herfra, og læs personens stemmefiche, før du lader den skrive. Alle har «(fiktiv)» i `author` i data (det vises ikke synligt på kortet). Galleriet er også listet i `tests/satire.test.ts`, så en ny person skal tilføjes begge steder.

Dokumentet er bygget til at slå op i: oversigten giver hver figurs komiske motor på én linje, reglerne og stilreglerne gælder alle, og hver person har sin egen fiche med stemme, greb, «aldrig»-liste, relationer og nye eksempelreplikker. Eksempelreplikkerne er til at lære stemmen af, ikke til at kopiere ind i data.

Tal om den nuværende data er optalt 2026-11-14 på 205 opslag og 1.435 kommentarer.

## Oversigt

| Person | Gruppe | Komisk motor (én linje) | Fast modspil |
|---|---|---|---|
| Oscars far | Forældre | Den ivrige bogstavelige: vil være med og gøre det rigtigt, men hans spørgsmål åbner debatter | Storms mor, Klasseforældrerådet |
| Oscars mor | Forældre | Husstandens eneste voksne: rydder kort og roligt op efter far og mormor | Oscars far, Storms mor |
| Oscars mormor | Familie | Overflod: bestiller, bager og betaler for meget, har ikke selv Aula | Kageudvalget, Idas mormor |
| Idas mor | Forældre | Forbedreren: har altid et sundere, grønnere alternativ og deler det | Emils far, Oscars far, Skolekøkkenet |
| Idas far | Forældre | Næsten usynlig; fem ord, der afslører hjemmet | Idas mor, Lærer Klausen |
| Idas mormor | Familie | Blander alle begivenheder sammen: «Er det den samme som…?» | Frejas mormor, Oscars mormor |
| Emils far | Forældre | Den absurde improvisator: tager hvert opslag ét skridt for langt, helt roligt | Storms mor, bibliotekaren |
| Storms mor | Forældre | Pedanten med en sag: har talt alt og vil have ret offentligt | Oscars far, Emils far, Storms far |
| Storms far | Forældre | Den tørre modvægt, der punkterer Storms mors sager med fakta hjemmefra | Storms mor, Lærer Klausen |
| Valdemars far | Forældre | Data-faren: møder usikkerhed med regneark, målinger og versionsnumre | Valdemars mor, Skolelederen |
| Valdemars mor | Forældre | Stille korrektur af manden med virkeligheden | Valdemars far |
| Majas mor | Forældre | Majas pressesekretær: tager hendes projekter dybt alvorligt | Skolelederen, Pædagog Bent |
| Majas far | Forældre | Den undskyldende praktiker med den stabile sandkage | Majas mor, Kageudvalget |
| Sofies mor | Forældre | Den uanfægtede: Sofies logik er aftalt derhjemme | Storms mor, Oscars far |
| Alberts mor | Forældre | Glemmekassens stamkunde: alt blåt er nok Alberts | Pedellen, SFO-personalet |
| Lucas' far | Forældre | Kalenderforvirringen: ugedage glider, han undskylder og prøver igen | Klasselærer Anja |
| Frejas mormor | Familie | Den robuste veteran: «I min tid», husråd der virker og lugter | Mathildes forældre, Idas mor |
| Noahs mor | Forældre | Logistikeren med et overbooket barn; minutter, ikke meninger | Emils far, Storms mor |
| Karls mor | Forældre | Karl tager alt bogstaveligt og drikker kakao af kaffekrus | Skolekøkkenet |
| Wilmas far | Forældre | Pastamanden: alt måles mod pasta; kort og skarp mod Klausen | Skolekøkkenet, Lærer Klausen |
| Malthes far | Forældre | Den udmattede: ærlig, resigneret, «vi er meget kedelige» | Storms mor |
| Ebbas mor (ny) | Forældre | Kontrolbehov i allergilistens form; løsningerne er fysisk absurde | Anja, Skolelederen |
| Prinsesse Josephines mor (ny) | Forældre | Afleverer sent og henter tidligt, så hun sidder med, og det er for svært | Skolesekretæren, Anja |
| Mathildes forældre (ny) | Forældre | «Vi» kræver skriftlige garantier mod alt og skærmer Mathilde mod verden | Skolelederen, Anja |
| Naboen Preben | Nabo | Den hyggelige udenforstående med kat, papegøje og kaffe | Pedellen |
| Klasselærer Anja | Skolen | Den afslappede professionelle: lukker tråde, «det plejer at gå» | Skolelederen, Ebbas mor, Klausen |
| Lærer Klausen (ny) | Skolen | Kollegaen uden filter: pinlig logistik-flirt med voksne | Anja, Vikaren, Storms far |
| Skolelederen | Skolen | Regelrytteren, der behandler absurde sager som sager | Anja, Ebbas mor, Mathildes forældre |
| SFO-personalet | Skolen | Svarer præcist på det, der blev spurgt om, ikke det, der blev ment | Oscars far, Alberts mor |
| Pædagog Bent | Skolen | Den blide, der giver ting navne og følelser | Skolelederen |
| Skolens pedel | Skolen | Ved, hvor alt står, måler alt og løser det uden tilladelse | Skolelederen, Preben |
| Skolens bibliotekar | Skolen | Bogens missionær: alt bliver en hylde, en genre eller en slutning | Emils far, Klausen |
| Skolesekretæren | Skolen | Kontorets sidste instans; ved, hvor blanketten er; ingen tænker på hende | Prinsesse Josephines mor |
| Vikaren | Skolen | Den ærlige udefrakommende, der var der i går og helst sidder alene | Lærer Klausen, Anja |
| Klasseforældrerådet | Udvalg | Formelt kollektiv, der uddeler pligter som straf | Oscars far, Storms mor |
| Kageudvalget | Udvalg | Kagelogik: kagen har rettigheder, listen har ret | Storms mor, Emils far |
| Skolekøkkenet | Udvalg | Menuer, der aldrig helt er besluttet; høfligt og kort | Wilmas far, Idas mor |

## Regler for kommentarer

- 1-10 kommentarer pr. opslag, alle 205 opslag har kommentarer. Puljen skal kunne deles med 5 (rotation: fem nye opslag om dagen, 205 opslag = 41 dages cyklus).
- 10-120 tegn pr. kommentar. Ingen links, `@` eller lange cifferfølger (seks cifre eller flere).
- Svar til en bestemt kommentar starter med `Til X:` (X = den, der svares), uden «(fiktiv)». Omkring hver tredje kommentar er et sådant svar. X skal være opslagets afsender eller en, der allerede har kommenteret i tråden, og skrives præcis som i galleriet: ét navn, stort begyndelsesbogstav («Til Vikaren:», ikke «Til vikaren:», «Til begge:» eller to navne).
- Humoren er tør og venlig. Ingen grov, diskriminerende eller seksuel humor, og ingen rigtige personer, skoler, firmaer, mærker eller børn. Børn findes kun som fiktive navne i forældrenes fortællinger og er aldrig skydeskive.
- Samme åbning bruges højst få gange pr. person: «Tak for info.», «Med al respekt,», «Er den blå?», «Hvad hvis…», «Kan I garantere» og «Jeg sad med» er allerede slidt (se stilreglerne).
- Ikke alle skal med i alle tråde. 3-6 stemmer pr. tråd er nok; tråden skal have en retning (spørgsmål, eskalering, afrunding).
- Anja eller en anden voksen afrunder ofte, men ikke altid: pedellen, Preben og Bent kan også få det sidste ord, og nogle tråde må gerne ende uafsluttet.
- Grænsen for Lærer Klausen (besluttet af brugeren 2026-11-14): han skal blive ved med at være upassende: pågående, pinlig og grænseløs over for voksne, med private komplimenter, kropsnære dobbeltbetydninger og sene invitationer («tager gerne trøjen af», «mund til mund må gerne øves på mig», «låse døren indefra» er på niveau). Grænsen er: aldrig noget grafisk eller en eksplicit seksuel handling, og aldrig noget omkring børn. Han kommenterer aldrig et barn eller børns tøj, ting, briller, frikvarter eller aktiviteter som andet end en bortvisning («uden Wilma»), og flirten rettes kun mod voksne.
- Ebbas mor gør aldrig grin med rigtige allergikere, og Mathildes forældre bruger aldrig rigtige skader eller børn, der faktisk har det skidt, som pointe. Pointen er kontrolbehovet og systemet omkring det.

## Globale stilregler

**Tråden er en scene, ikke et opråb.** Hver tråd har tre takter: et udspil (en misforståelse, et naivt spørgsmål, en indsigelse), en eskalering (to-tre forsøg på at løse det, der gør det værre) og en udgang (afrunding, et tørt svar eller et spørgsmål, ingen svarer på). Vælg figurer, der passer til opslagets emne: mad og materialer giver Ebbas mor; fald, nyheder og følelser giver Mathildes forældre; glemte ting giver Alberts mor; tider giver Noahs mor, Lucas' far eller Prinsesse Josephines mor. En figur, der ikke har noget at gøre i tråden, skal ikke med.

**Størrelse.** 4-7 kommentarer og 3-6 stemmer er normalen. 8-10 kommentarer kun i tråde, der handler om eskalering (referater, kagelister, allergilister). Højst én kommentar over 100 tegn pr. tråd, og den tilhører en eskalerende figur (Ebbas mor, Mathildes forældre, Storms mor). Normal længde er 30-90 tegn.

**Rotation af de store figurer.** Ingen figur skal være i mere end hver tredje tråd. Ebbas mor, Mathildes forældre og Lærer Klausen sammen i én tråd er en undtagelse (højst én gang pr. 20 tråde). Brug de små figurer: en tråd, hvor Karls mor, Noahs mor eller Idas far bærer en takt, er friskere end endnu en tur gennem de faste formler.

**«Til X:»-svar.** Omkring hver tredje kommentar, typisk 1-3 pr. tråd og højst to i træk. Fordel dem: institutionerne (Skolelederen, rådet, sekretæren, køkkenet, bibliotekaren) skal også skrive selvstændige meldinger til alle, og monologfigurerne (Ebbas mor, Klausen, Prinsesse Josephines mor, Mathildes forældre) skal også svare og blive svaret. Et svar skal tage et konkret ord fra det, det svarer på, og dreje det (ekko og twist). Hvis svaret kunne stå under et hvilket som helst opslag, er det ikke et svar.

**Rytme.** Næsten alt i dag er korte staccatosætninger («X. Y. Z.»). Bland bevidst:
- ét-sætnings-spørgsmål (Oscars far, Lucas' far, Idas far);
- to takter, oplæg og punch (de fleste);
- én lang, kommaramt, nervøs sætning (Ebbas mor, Mathildes forældre, Valdemars far);
- fragmenter og enstavelsessvar (pedellen, Vikaren, Wilmas far), men sjældent.
Forældre må bruge et enkelt udråbstegn (Oscars far, Oscars mormor, Idas mor). Skolens voksne aldrig. Ingen emojis og ingen versaler i kommentarer; det hører til opslagene.

**Punchlinen.** Joken skal ikke altid ligge i en kort efterhængssætning til sidst. Den kan ligge i et tal («3,2 meter»), i første ord, i et navn (Hylde 7), i et ekko af en anden kommentar, eller i det, der ikke bliver sagt. Hvis sidste sætning forklarer den forrige, så slet den.

**Afrunding.** Anja har det sidste ord i højst hver femte tråd. Lærer Klausen har det sidste ord i højst hver tiende (hans pinlighed er en takt, ikke en pointe). Lad også en lille stemme slutte (Idas far, Oscars mor, pedellen), en forkert afrunding (Lucas' far takker for noget andet), eller et spørgsmål uden svar.

**Slidte åbninger og afslutninger.** Hver af disse højst én gang pr. 10 tråde, og aldrig to af dem i samme tråd: «Tak for info.», «Med al respekt,», «Er den blå? Så er det nok min.», «Hvad hvis…», «Kan I garantere…», «Jeg sad med…», «[Ting] har/er A, B og C.», «Det plejer at gå.», «Vi noterer ønsket.», «Vi skriver et notat.», «Lad os holde tonen venlig.», «Til X: Nej.». Hver fiche nævner figurens egne alternativer. Undgå også at mange kommentarer i samme tråd starter med «Det er», «Jeg har», «Vi har» eller «Kan I».

**Callbacks.** Faste genstande (sneglen Hylde 7, bamsen Bjørn, græskarret Søren, pindsvinet Bent, hønsene Karen, Ebbas liste på 37 sider, Emils kasse med huller) må gerne genbruges, men højst én callback pr. tråd, og callbacken skal flytte sig (ny detalje, nyt tal).

## Typiske dårligdomme at rette

Fundet i den nuværende data (2026-11-14). Omskrivning skal især rette disse.

1. **Fire figurer bærer feedet.** Ebbas mor er i 136 af 205 tråde (66 %), Oscars far i 120, Anja i 98, Skolelederen i 94, Mathildes forældre i 93, Storms mor i 87, Lærer Klausen i 80 og Prinsesse Josephines mor i 77. De fire nye figurer har 406 af 1.435 kommentarer (28 %). Imens har 18 figurer 10 kommentarer eller færre (Idas far 1, Oscars mor 3, Valdemars mor 5). Oscars far skriver første kommentar i 65 tråde (32 %).
2. **Formler i stedet for figurer.** Mathildes forældre bruger «garanter» i 74 af 104 kommentarer («Kan I garantere, at» 71 gange). Ebbas mor åbner 54 af 143 med «[Ting] har/er A, B og C», og «allergisk over for alle tre» står 7 gange. Storms mor har «Med al respekt» i 47 af 111. Alberts mor: 10 af 19 kommentarer er varianter af «Er den blå? Så er det nok min.». Prinsesse Josephines mor: «sad med» eller «forstod» i 24 af 79.
3. **Svarene er skævt fordelt.** 505 af 1.435 er «Til X:»-svar (35 %, altså det rigtige niveau samlet), men institutionerne svarer næsten kun (Skolelederen 91 af 111, Klasseforældrerådet 20 af 21, Skolesekretæren 10 af 11, bibliotekaren 10 af 10, køkkenet 9 af 10), mens monologfigurerne næsten aldrig gør (Ebbas mor 9 af 143, Klausen 5 af 80, Prinsesse Josephines mor 5 af 79). De nye figurer taler derfor ved siden af tråden i stedet for i den. 14 tråde har tre «Til»-svar i træk, og 12 tråde består for over halvdelens vedkommende af svar.
4. **For mange stemmer pr. tråd.** 87 tråde har 8-10 kommentarer, og 85 tråde har 7-8 forskellige stemmer, selv om reglen siger 3-6. Mange tråde er en parade, hvor hver figur kommer forbi med sin tic, i stedet for en scene.
5. **Den faste kæde.** Ebbas mor → Anja («det plejer at gå») → Skolelederen (en regel) står i nøjagtig den rækkefølge 10 gange, og Skolelederen svarer Ebbas mor 25 gange. Dynamikken er god, men forudsigelig. Byt rækkefølgen, lad sekretæren eller køkkenet tage svaret, lad Ebbas mor få ret en gang, eller lad Anja og Skolelederen tale indbyrdes uden Ebba.
6. **Gentagne afslutninger.** «Til Oscars far: Nej.» 7 gange (fordelt på pedel, sekretær og råd, så de lyder ens), «Det plejer at gå.» 6, «Vi noterer ønsket.» 4, «Lad os holde tonen venlig.» 3, «Vi skriver et notat.» 3, «Nej.» alene 8. Nej-svaret er sjovt én gang.
7. **Stemmer, der flyder sammen.** Skolelederen, Skolesekretæren, Klasseforældrerådet og SFO-personalet skriver alle korte, formelle «Det er ikke…»-svar og kan byttes rundt. Oscars far, Lucas' far og Prinsesse Josephines mor er alle «forvirrede», og Idas mormor, Oscars mormor og Frejas mormor deler replikker (Idas mormor siger fx «i fjor», som er Oscars mormors). Fichernes «Aldrig»-linjer er skrevet for at skille dem ad.
8. **Lærer Klausen er for ens og for lang, og nogle af hans kommentarer ligger tæt på børn.** Han er længst i snit (92 tegn) og har det sidste ord i 24 tråde. Brugeren vil have ham ved at være upassende over for voksne, så niveauet bevares, men kommentarer, der bruger børn, børns ting eller børneaktiviteter som afsæt (fx satire-118 Wilmas briller, 120 bænken ved frikvarteret, 188 Wilma i frikvarteret), skal omskrives, så flirten kun gælder voksne. Giv ham varierede greb (kaffe, lån af nøgle, kørsel, vin, invitation, kompliment, afklædning som tilbud) og kortere replikker.
9. **Punchlines, der forklarer sig selv, og for lange kommentarer.** 350 kommentarer har tre eller flere sætninger, og den sidste forklarer ofte joken: «Ebba er allergisk over for alle tre» efter en liste, der allerede sagde det; «Jeg har tænkt over det» efter Klausens hentydning; «Vi taler ikke om det» efter Mathildes forældres afsløring. 46 kommentarer er over 100 tegn; Mathildes forældre ligger i snit på 86 og Klausen på 92.
10. **Svar, der ikke rammer.** Tre svar går til en, der ikke findes som navngiven deltager: satire-73 «Til vikaren» (lille v), satire-115 «Til Valdemars far og Storms far», satire-125 «Til begge». Nogle svar er generiske og kunne stå under et hvilket som helst opslag (fx Skolelederens «Vi følger udviklingen nøje» uden en konkret udvikling). Svar til opslagets afsender (22 tilfælde) er i orden.

## Sådan læses en stemmefiche

- **Motor:** hvem de er, hvad joken er, hvad de vil, og hvad der forhindrer dem.
- **Stemme:** sætningslængde, ordvalg, tegnsætning og tone, så figuren kan genkendes uden afsender.
- **Greb:** 2-4 signaturtricks. Brug højst ét pr. kommentar og ikke det samme to gange i træk.
- **Aldrig:** det, der hører til en anden figur. Er du i tvivl om, hvem der skal sige en replik, så find den figur, hvis «aldrig» ikke udelukker den.
- **Relationer:** hvem de svarer, hvem der svarer dem, faste duetter.
- **Eksempler:** nye replikker til at høre stemmen. Ikke til at kopiere ind i data.

## Forældre og familie

### Oscars far

**Motor:** Den ivrige bogstavelige. Han vil være med til alt og gøre det rigtigt, men han læser hvert opslag som en kontrakt med huller, og hans uskyldige spørgsmål åbner debatter, han ikke ser komme.

**Stemme:** Korte spørgsmål, en eller to sætninger. Hverdagsord, ingen fagudtryk. Entusiastisk og helt uden ironi; han tager andres sarkasme for pålydende og takker for den. Han må gerne bruge et udråbstegn, når han melder sig.

**Greb:**
- Et bogstaveligt spørgsmål plus en Oscar-oplysning, der gør det værre («Må man hente den? Oscar har en stige.»).
- Melder sig til noget, ingen bad om, og opdager bagefter, hvad det var.
- Svarer på en irettesættelse med oprigtig taknemmelighed.
- Alternativer til de slidte åbninger: «Bare et hurtigt spørgsmål:», «Gælder det også…», «Hvordan gør man, hvis…», eller direkte ind i spørgsmålet.

**Aldrig:** Ironisk, fornærmet, belærende. Ingen regler, tal eller sidehenvisninger (Storms mor, Valdemars far). Han ved ikke, at han er sjov (det er forskellen på ham og Emils far). Han er ikke forvirret over kalenderen (Lucas' far); han forstår det hele, bare for bogstaveligt. «Må man» højst i hver tredje kommentar, «Tak for info.» højst hver tiende, og han åbner højst hver femte tråd.

**Relationer:** Storms mors faste offer: hun retter, han takker (de har 25 svar til hinanden). Klasseforældrerådet giver ham en pligt, hver gang han melder sig. Pedellen, SFO og sekretæren svarer ham kort. Oscars mor redder ham sjældent og stille. Lucas' far er hans allierede i misforståelser.

**Eksempler:**
- «Er kl. 8 det samme som kl. 8.00? Vi vil nødig komme for tidligt.»
- «Jeg melder mig til opvasken! Og til at bære. Og til det, der ikke står her endnu.»
- «Må man tage en ven med, hvis vennen er en kusine? Oscar siger, det tæller.»
- «Til Storms mor: Tak for listen. Den hænger på køleskabet ved siden af din forrige.»
- «Til Klasseforældrerådet: Det gør jeg gerne. Hvad er det, jeg har sagt ja til?»
- «Oscar har øvet sig i at vente. Han er nået op på fire minutter.»

### Oscars mor

**Motor:** Husstandens eneste voksne. Rolig og praktisk; rydder op efter Oscars far og Oscars mormor uden at gøre et nummer ud af det.

**Stemme:** Kort, lavmælt, højst 70 tegn. Konstaterer i stedet for at spørge. Én tør detalje fra hjemmet.

**Greb:**
- Oversætter Oscars fars spørgsmål til virkeligheden.
- Betinget ja: «Ja, hvis den ikke er levende.»
- «Vi har talt om det» som afslutning på en sag, hun ikke uddyber.

**Aldrig:** Lange svar, «Med al respekt», undskyldninger på Oscars fars vegne, vrede. Hun er sjælden: højst i hver 15. tråd, og helst som sidste ord på en Oscar-tråd.

**Relationer:** Svarer Storms mor og Oscars far. Bremser Oscars mormors indkøb. Er den, der lukker en Oscar-tråd, før den eskalerer.

**Eksempler:**
- «Til Oscars far: Nej. Men det var sødt spurgt.»
- «Oscar har pakket selv. Vi har pakket om.»
- «Til Storms mor: Det var os. Vi har talt om det.»
- «Til Oscars mormor: Fire er nok. To er også nok.»
- «Vi kommer. Oscar har valgt tøj. Vi har valgt noget andet.»
- «Til Klasselærer Anja: Modtaget. Hans far har spørgsmål. Dem tager vi derhjemme.»

### Oscars mormor

**Motor:** Overflodsmormoren. Bestiller, bager, køber og betaler for meget for at være med, og hun har ikke selv Aula (datteren viser hende opslagene).

**Stemme:** Varm, lidt for lang, hele sætninger. Mormorord («søde», «lille»). Tallene er altid for store (tre kager, fire billeder, en hel plade). Kan bruge et udråbstegn af glæde.

**Greb:**
- Mængder: «Jeg bager tre.»
- «Jeg har ikke Aula, men…» eller «Min datter har vist mig…».
- Betaler for alle eller køber reserver.
- Oscar ligner sin morfar.

**Aldrig:** Forvirret om begivenheder (det er Idas mormor). Aldrig «I min tid» (Frejas mormor). Aldrig kritisk eller bekymret. Hun vil være med, ikke rette.

**Relationer:** Kageudvalget må stoppe hende. Oscars mor sætter grænsen. Idas mormor er hendes høflige konkurrent på bagerfronten.

**Eksempler:**
- «Jeg bager tre. En til klassen, en til de voksne og en, hvis nogen bliver kede af det.»
- «Min datter har vist mig opslaget. Jeg vil gerne bestille, men hvor er knappen?»
- «Til Kageudvalget: Så tager jeg torsdag også. Jeg har mel til en hel uge!»
- «Jeg betaler gerne for dem, der har glemt det. Og for dem, der har husket det.»
- «Til Idas mormor: Ja, det er en ny. Jeg har købt to, hvis den forsvinder.»
- «Oscar ligner sin morfar på billedet. Jeg bestiller det i plakatstørrelse.»

### Idas mor

**Motor:** Forbedreren. Hun har altid et sundere, grønnere, mere bevidst alternativ og deler det generøst, uanset om nogen har spurgt.

**Stemme:** Venlig, pædagogisk, lidt belærende uden at hæve stemmen. «Vi» om familien. Forslag i stedet for krav. Ord som «bevidst», «alternativ», «guide», «kursus», «økologisk».

**Greb:**
- Den alternative udgave af tingen, som ender som noget andet («en kanelsnegl uden sukker og kanel»).
- «Vi har gode erfaringer med…» og «Jeg deler gerne opskriften/guiden».
- «Kunne man ikke…?» med et forslag, der kræver mere arbejde af andre.
- Ida som mild ambassadør: «Ida er meget optaget af…».

**Aldrig:** Forbud og allergener (Ebbas mor), garantier og frygt (Mathildes forældre), sur korrektion (Storms mor), sarkasme. Hun tror oprigtigt, hun hjælper.

**Relationer:** Oscars far svarer hende forvirret. Emils far driller hende, og hun svarer med pædagogisk tålmodighed. Storms mor er uenig om principper. Skolekøkkenet afviser hendes ønsker høfligt. Lærer Klausen flirter med hende, og hun takker høfligt nej og sender sin mand.

**Eksempler:**
- «Vi har gode erfaringer med at fejre fødselsdage med en gåtur. Ida bestemmer ruten.»
- «Kunne vi lave en byttehylde i stedet for en glemmekasse? Jeg har allerede en skitse.»
- «Til Skolekøkkenet: Helt fint. Er frikadellen i det mindste lokal?»
- «Til Lærer Klausen: Tak, det er pænt sagt. Jeg sender min mand.»
- «Til Emils far: Det var ikke en kritik. Det var en invitation til refleksion.»
- «Jeg bager boller med havregryn og gulerod. De smager af omtanke!»

### Idas far

**Motor:** Næsten usynlig. Når han skriver, er det fem ord, der afslører, hvem der bestemmer derhjemme.

**Stemme:** 10-40 tegn. Én sætning. Ingen hilsen, ingen forklaring.

**Greb:**
- Det praktiske enkeltspørgsmål («Er der kaffe?»).
- Tør erkendelse af, at Idas mor har styr på det.
- Dukker op, når Klausen inviterer hans kone.

**Aldrig:** Mere end én sætning, mere end én replik pr. tråd, meninger om sundhed eller pædagogik.

**Relationer:** Idas mor (han er hendes fodnote). Lærer Klausen. Kan bruges som et lille, uventet sidste ord.

**Eksempler:**
- «Kan vi få den uden rødbede?»
- «Til Lærer Klausen: Jeg kommer også.»
- «Min kone har svaret. Jeg er enig.»
- «Er der kaffe? Rigtig kaffe?»
- «Ida har pakket. Jeg har båret.»
- «Til Idas mor: Det tager jeg.»

### Idas mormor

**Motor:** Blander alle begivenheder sammen. Hendes «Er det den samme som…?» gør hver nyhed til en genkomst af noget, der aldrig skete.

**Stemme:** Høflig, spørgende, gammeldags. Korte sætninger. Henviser selvsikkert til ting, der ikke findes, eller som var noget helt andet.

**Greb:**
- «Er det den samme X som til Y?» (højst hver anden kommentar; variér med «Det er vel den med…»).
- Fejlhusker en detalje med fuld overbevisning.
- Lykønsker eller roser det forkerte barn.

**Aldrig:** «I min tid» (Frejas mormor). «I fjor», indkøb og bagning (Oscars mormor). Bekymring. Hun er glad og forvirret, aldrig ked af det.

**Relationer:** Frejas mormor og Oscars mormor (bedstemødrene). Majas far, SFO og Anja retter hende blidt.

**Eksempler:**
- «Er det den samme tur som sidste år, hvor bussen var en båd?»
- «Tillykke til Ida. Eller hvem det nu er. Det er altid godt.»
- «Jeg kommer til sommerfesten. Det er vel den med lygterne?»
- «Til Frejas mormor: Nej, det var den anden gynge. Den med hunden.»
- «Er det den samme lærer, der spillede nisse? Han havde skæg dengang.»
- «Har de flyttet skolen? Jeg kørte hen til den gamle, og der var en frisør.»

### Emils far

**Motor:** Den absurde improvisator. Han tager hvert opslag ét logisk skridt for langt og rapporterer Emils mærkelige projekter med fuldstændig ro.

**Stemme:** Deadpan. Korte sætninger i nutid. Konkrete, skæve genstande (ost, sennep, en høj hat, en kasse med huller, hamsteren). Stilfærdig selvironi; han ved godt, det er skævt.

**Greb:**
- «Emil har [mærkelig handling].» plus en rolig konstatering («Vi har accepteret det.»).
- Byttehandel og forhandling med absurde varer (sennep til gengæld).
- Bevidst misforståelse, der gør reglen sjovere end den var.
- «Jeg spørger for en ven, som er mig.» er hans signatur, men må kun bruges én gang til i hele datasættet.

**Aldrig:** Forarget, korrekt, regelbundet. Ingen lister og tal (Storms mor, Valdemars far). Ikke naiv: Oscars far spørger, Emils far har allerede gjort det. Ikke ond mod Storms mor; han driller.

**Relationer:** Storms mors faste modspiller (17 svar mellem dem). Bibliotekaren tager hans værker alvorligt. Idas mor prøver at opdrage ham. Anja svarer «vi læser den gerne». Pedellen svarer om hattens højde.

**Eksempler:**
- «Emil har skrevet en klage til hamsteren. Den er på rim. Vi venter på svar.»
- «Må man komme udklædt som opslaget? Emil har allerede klippet sig en overskrift.»
- «Til Storms mor: Det var ikke en sikkerhedsrisiko. Det var kunst. Med hat.»
- «Til Skolens bibliotekar: Den kommer tilbage. Emil har bare skrevet en bedre slutning.»
- «Jeg tilbyder sennep til fællesbordet. Det er det, vi har.»
- «Emil har lagt en seddel i glemmekassen: Glem mig ikke. Den er væk nu.»

### Storms mor

**Motor:** Pedanten med en sag. Hun har læst alt, talt alt og forudset alt, og hun vil have ret offentligt; hver korrektion graver hende dybere ned.

**Stemme:** Skarp og formel. Hele sætninger med tal, datoer og sidehenvisninger. Ordforråd: «princippet», «referatet», «kommissorium», «jeg har optalt». Hun svarer i kæder (to-tre gange i samme tråd) og giver sig aldrig helt.

**Greb:**
- Korrektion med tal: «Jeg har optalt det. Det var 16.»
- «Jeg sagde det på mødet i september.» (hun forudså det).
- Forslag om regler, lister, kommissorier og dagsordenspunkter.
- «Med al respekt,» højst hver sjette kommentar (i dag næsten hver anden). Alternativer: «For en ordens skyld:», «Rettelse:», «Jeg vil bare nævne, at…», eller direkte i korrektionen.

**Aldrig:** Sød, absurd eller billedrig (Emils far). Aldrig naivt spørgende (Oscars far). Aldrig paragraffer på skolens vegne (Skolelederen); hendes regler er hendes egne. Indrømmer aldrig en fejl uden at præcisere den.

**Relationer:** Retter Oscars far (hovedduet), drillet af Emils far, punkteret af Storms far («Det var mig.»). Strides med Kageudvalget om dage og med Klasseforældrerådet om referater. Malthes far og Sofies mor er hendes ligeglade modpoler.

**Eksempler:**
- «Medio er ikke en dato. Jeg har foreslået en dato tre gange nu.»
- «Jeg sagde det på mødet i september. Det står ikke i referatet, men jeg sagde det.»
- «Til Emils far: Det er ikke sjovt. Det er en sikkerhedsrisiko med hat på.»
- «Til Oscars far: Du må gerne spørge. Bare ikke i den her tråd.»
- «Jeg har optalt tilmeldingerne. Vi er 23, men der står 24. Hvem er den sidste?»
- «Til Storms far: Det tager vi derhjemme.»

### Storms far

**Motor:** Den tørre modvægt. Han punkterer stille Storms mors sager med fakta fra hjemmet og forsvarer Storm mod hele verden.

**Stemme:** Korte, lune, tørre sætninger. Ofte «Storm siger…». Sandheden kommer i en bisætning.

**Greb:**
- «Det var mig.» når Storms mor har skrevet «han».
- Afslører hjemmets virkelighed med en enkelt detalje.
- Afviser Klausen kort på parrets vegne: «Vi kommer begge to.»

**Aldrig:** «Med al respekt», regler, angreb på andre forældre, lange svar. Han tager aldrig Storms mors side offentligt, men han er heller aldrig ond mod hende.

**Relationer:** Storms mor (hovedduet). Lærer Klausen (han beskytter sin kone). Valdemars far (konkurrencer, hvor Storm taber med værdighed).

**Eksempler:**
- «Til Storms mor: Det var mig, der glemte den. Storm havde husket det.»
- «Storm har spurgt, om han også må gå hjem kl. 12. Det må han ikke. Det må jeg heller ikke.»
- «Til Lærer Klausen: Vi kommer begge to. Vi er gode til at komme begge to.»
- «Storm har sagt ja på hele familiens vegne. Vi ses.»
- «Er der en pause undervejs? Storm har forberedt en tale.»
- «Til Valdemars far: Storm løb ikke langsomt. Han løb grundigt.»

### Valdemars far

**Motor:** Data-faren. Han håndterer usikkerhed med regneark, målinger og tidsplaner, og hans præcision gør alting mere uklart.

**Stemme:** Tal, enheder, decimaler, versionsnumre. «Jeg har lavet et skema.» Neutral og saglig, aldrig moralsk. Lange, men rolige sætninger.

**Greb:**
- Måling i en enhed, ingen bad om (luftfugtighed, meter i sekundet, minutter og sekunder).
- Vedhæftet regneark, version, fane.
- Valdemar som følsomt måleinstrument («Valdemar er ikke vant til…»).

**Aldrig:** «Med al respekt» og principper (Storms mor). Følelser, frygt og garantier (Mathildes forældre). Ironi. Han vil ikke have ret, han vil have data.

**Relationer:** Valdemars mor retter ham stille. Storms far er hans konkurrent. Skolelederen svarer ham sagligt, og pedellen leverer målene. Noahs mor deler hans kalenderdisciplin, men ikke hans decimaler.

**Eksempler:**
- «Hvor lang er turen i meter? Valdemar går 1,1 meter i sekundet, så vi planlægger efter det.»
- «Jeg har lavet et skema over madpakkerne. Fanen med pålæg er låst, så ingen retter i den.»
- «Til Skolens pedel: Er de 2,10 målt fra dørtrinnet eller fra gulvet?»
- «Hvad er luftfugtigheden i gymnastiksalen? Valdemar har en ny trøje.»
- «Til Valdemars mor: Version 4 er den gældende. Version 3 havde en fejl i pauserne.»
- «Jeg har tidtaget morgensangen. 4 minutter og 50 sekunder. Det er kortere end sidst.»

### Valdemars mor

**Motor:** Stille korrektur af manden. Hun retter Valdemars fars data med virkeligheden og ruller øjnene på skrift.

**Stemme:** Kort, tør, ofte «Til Valdemars far:». Konkret moderviden uden tal.

**Greb:**
- «Det er mig, der har…» (hun er den, der faktisk gjorde det).
- Underbyder hans præcision: «Han har gået den før. Uden skema.»
- Undskylder for sin egen mor, der ringer om vejret.

**Aldrig:** Decimaler, skemaer, lange udredninger. Hun retter kun sin mand, aldrig andre forældre.

**Relationer:** Valdemars far. Hendes mor (Valdemars mormor, som kun skriver opslag) ringer til skolen om vejret. Anja.

**Eksempler:**
- «Til Valdemars far: Han har gået den tur før. Uden skema. Han kom hjem.»
- «Valdemar kommer. Han har pakket selv, og det er fint.»
- «Til Valdemars far: Fanen er ikke låst. Jeg har rettet i den.»
- «Undskyld for min mor. Hun har fundet ud af, hvor man skriver.»
- «Til Valdemars far: Trøjen er af bomuld. Den kan godt tåle luft.»
- «Til Klasselærer Anja: Det var ikke mig, der skrev det. Det var ham, fra min telefon.»

### Majas mor

**Motor:** Majas pressesekretær. Hun tager Majas projekter (elevrådet, pindsvinet Bent, græskarret Søren, hesten) dybt alvorligt og forsvarer dem som politik.

**Stemme:** Alvorlig, stolt og saglig, som en pressemeddelelse om noget absurd. «Maja er meget seriøs.» Ingen ironi om Maja.

**Greb:**
- Majas projekt som en sag med forslag, program og afslag.
- Navngivne genstande og dyr, der behandles som personer.
- Oprigtig sorg over et tab (græskarret, pindsvinet).

**Aldrig:** Undskyldninger (det er Majas far). Ironi om Maja. Generelle meninger om skolen; hun taler kun om Majas sager.

**Relationer:** Majas far (hun fremmer, han undskylder). Skolelederen (Majas forslag mod reglerne). Pædagog Bent (navnebror til pindsvinet). Idas mormor. Lærer Klausen afvises.

**Eksempler:**
- «Maja har stillet forslaget om hesten igen. Hun har nu tegnet en stald.»
- «Til Skolelederen: Maja vil gerne have afslaget begrundet. Skriftligt, hvis muligt.»
- «Søren er komposteret. Maja beder om et minuts stilhed ved næste morgensang.»
- «Maja stiller op til elevrådet igen. Hun har et program på tre punkter. Det ene er en hest.»
- «Til Pædagog Bent: Pindsvinet hedder stadig Bent. Maja mener, det er en hilsen.»
- «Til Lærer Klausen: Nej tak. Maja og jeg cykler sammen.»

### Majas far

**Motor:** Den undskyldende praktiker. Han retter fejl, beklager og bidrager med det mindst spændende bagværk.

**Stemme:** Hverdagsagtig og selvudslettende. «Vi beklager.» «Den er ikke spændende, men den er der.» Kort.

**Greb:**
- Undskyldning for en fejl, ingen andre havde opdaget, og som rettelsen gør værre.
- Sandkagen, igen.
- Praktisk nødløsning (tape, pizzabakke, sidelæns gang).

**Aldrig:** Politisk forsvar for Majas projekter (Majas mor). Belærende eller sur.

**Relationer:** Majas mor. Kageudvalget. Idas mormor. Skolens pedel.

**Eksempler:**
- «Det var os, der skrev forkert dato. Vi har rettet den og skrevet en anden forkert.»
- «Jeg tager en sandkage med. Igen. Den er stabil.»
- «Til Majas mor: Hesten er ikke vedtaget. Jeg siger det bare, før hun pakker.»
- «Til Skolens pedel: Det var Maja. Hun har lovet at skrue den på igen. Med min hjælp.»
- «Vi henter kl. 15. Eller 15.30. Vi kommer, når vi kommer, og vi beklager.»
- «Til Kageudvalget: Undskyld, sandkagen var fra i går. Den smager ens begge dage.»

### Sofies mor

**Motor:** Den uanfægtede. Sofie har sin egen logik (kjolen, baglæns cykling, hunden), og moren støtter den fuldt og sindigt, ligeglad med normer.

**Stemme:** Rolig, kort, accepterende. Det skæve præsenteres som fornuftigt. «Det er aftalt derhjemme.»

**Greb:**
- «Det er meget konsekvent.» om noget helt inkonsekvent.
- Sofies logik gengivet uden kommentar.
- Venlig, ubøjelig afvisning: «Det er op til jer.»

**Aldrig:** Bekymret (Mathildes forældre), forklarende eller undskyldende, regler. Hun forsvarer aldrig Sofie, for hun ser ikke noget at forsvare.

**Relationer:** Storms mor synes, det er forkert. Oscars far spørger, om det også gælder Oscar. Lærer Klausen afvises tørt.

**Eksempler:**
- «Sofie har besluttet, at onsdag er en lørdag. Hun møder op alligevel. Det er fint.»
- «Til Storms mor: Hun ved godt, det er baglæns. Det er derfor, hun gør det.»
- «Sofie kalder sin madpakke Henning. Det gør den ikke dårligere.»
- «Til Oscars far: Det er op til Oscar. Sofie spurgte ikke os.»
- «Sofie kommer i kjole. Det er en vinterkjole. Hun har selv besluttet det.»
- «Til Lærer Klausen: Jeg kører selv. Baglæns, hvis det bliver nødvendigt.»

### Alberts mor

**Motor:** Glemmekassens stamkunde. Alt blåt er nok Alberts, og hun er aldrig helt sikker.

**Stemme:** Korte spørgsmål om farve og ejerskab. Venlig og lidt håbefuld. Grænsen for «blå» flytter sig.

**Greb:**
- Farveforhandling: turkis tæller, grøn er næsten blå, grå har været blå i solen.
- Alberts kendemærker (tandmærker, tyggede bogstaver).
- «Jeg kommer og kigger.»
- «Er den blå? Så er det nok min.» højst én gang pr. 10 tråde (i dag er over halvdelen af hendes kommentarer varianter af den).

**Aldrig:** Andet end tøj og ting. Aldrig meninger om opslagets egentlige emne. Aldrig utålmodig.

**Relationer:** Skolens pedel og SFO-personalet (de tæller og leder). Noahs mor retter farven. Karls mor.

**Eksempler:**
- «Er den mørk nok til at være blå om aftenen? Så kommer jeg og kigger.»
- «Til SFO-personalet: Hvilken blå? Albert har tre slags, og vi har mistet dem alle.»
- «Albert kom hjem i en blå jakke, der ikke er hans. Hvis den er jeres, er vi kvit.»
- «Til Skolens pedel: Har den tandmærker i venstre ærme? Så skal I ikke lede mere.»
- «Den er turkis. Albert har sagt, at turkis tæller.»
- «Er der noget blåt tilbage efter sommerferien? Vi mangler det meste.»

### Lucas' far

**Motor:** Kalenderforvirringen. Ugedage og tilmeldinger glider for ham; han undskylder ærligt og prøver igen.

**Stemme:** Tøvende og venlig. Spørgsmål, der søger bekræftelse. «Bare så jeg er sikker.» «Det forklarer meget.»

**Greb:**
- Tjekker ugedagenes rækkefølge.
- Dobbelt eller tredobbelt tilmelding.
- Indrømmer, hvad han troede, og hvad der skete.

**Aldrig:** Belærende, absurd med vilje (Emils far), bogstavelig om regler (Oscars far). Han giver aldrig andre skylden; kalenderen er hans personlige modstander.

**Relationer:** Anja forklarer kalenderen. Storms mor irriteres. Skolesekretæren. Oscars far står gerne og venter sammen med ham.

**Eksempler:**
- «Er det den første fredag i måneden, eller den første fredag efter at måneden er begyndt?»
- «Vi mødte op i går. Det var i næste uge. Lucas havde det fint med at øve.»
- «Til Klasselærer Anja: Tak. Så kommer uge 7 efter uge 6. Jeg skriver det ned.»
- «Lucas er tilmeldt tre gange. Det er ikke, fordi han er meget interesseret.»
- «Til Oscars far: Jeg troede også, det var i dag. Vi kan stå der sammen.»
- «Undskyld. Jeg har læst sidste års opslag og svaret på det.»

### Frejas mormor

**Motor:** Den robuste veteran. «I min tid…», gammeldags råd, der virker og lugter (eddike, lup og pincet), og hun er uimponeret af moderne bekymring.

**Stemme:** Håndfast, korte erfaringssætninger. Let bebrejdende, men varm. «Det virker stadig.»

**Greb:**
- «I min tid…» højst hver tredje kommentar; ellers bare husrådet direkte.
- Husråd med en bivirkning.
- «Det overlevede vi.»

**Aldrig:** Forvirret (Idas mormor). Indkøb og overflod (Oscars mormor). Bekymret. Hun er aldrig nostalgisk sentimental; hun er praktisk.

**Relationer:** Mathildes forældre er hendes naturlige modpol. Idas mor (eddike mod tea tree). Idas mormor (bedstemorduet).

**Eksempler:**
- «Lus? Grøn sæbe og en tæt kam. Det tog en søndag, så var det overstået.»
- «I min tid fik man en våd klud og en undskyldning. Begge dele hjalp.»
- «Til Mathildes forældre: Hun falder nok en gang. Det er sådan, man lærer at rejse sig.»
- «Til Idas mor: Det dufter godt. Men lusene er ligeglade med dufte.»
- «Freja får rugbrød med fedt. Hun har aldrig klaget, og det har jeg heller ikke.»
- «Vi gik i skole i regnvejr. Regnen var den samme. Vi var bare ikke så overraskede.»

### Noahs mor

**Motor:** Logistikeren med et overbooket barn. Noah har program til minuttet, og hun deler det som en tør kendsgerning.

**Stemme:** Tidsrum og klokkeslæt. «Han har noget bagefter.» Tør, aldrig undskyldende, aldrig moralsk.

**Greb:**
- Tidsvinduet: «Noah kan fra 16.10 til 16.25.»
- Tør faktuel rettelse: «Den er gul. Det står i opslaget.»
- Prioritering, der afslører, at klassens arrangement er nummer fire.

**Aldrig:** Decimaler og skemaer (Valdemars far), principper (Storms mor), forvirring (Lucas' far). Hun beklager aldrig.

**Relationer:** Storms mor (planlægning), Emils far (spørger, hvor mange fester), Alberts mor (farverettelser), Pædagog Bent.

**Eksempler:**
- «Noah kan deltage fra 9.40. Han har svømning til 9.30 og er hurtig til at tørre.»
- «Til Emils far: Fire i weekenden. Han har en kalender. Jeg har læseadgang.»
- «Hans juleferie er booket. Hvis der er en klassefest, skal den ligge i januar.»
- «Til Alberts mor: Den er sort. Albert har ikke sort, har jeg forstået.»
- «Noah kan ikke til forældremødet. Jeg kan heller ikke. Vi sender hans farmor.»
- «Til Klasselærer Anja: Tak. Vi har lagt et kvarter ind til det.»

### Karls mor

**Motor:** Karl tager alt bogstaveligt og drikker kakao af kaffekrus. Moren gengiver hans voksne logik som en almindelig oplysning.

**Stemme:** Venlig, saglig, korte sætninger. «Karl siger…» Termokander, krus, kakao.

**Greb:**
- Karl som en lille kontorvoksen (krus, kande, forældrekaffe, regler).
- Karls bogstavelige tolkning af opslaget.
- Høflig afvisning i få ord.

**Aldrig:** Mærkelige kunstprojekter (Emils far) eller selvvalgt logik (Sofies mor). Karls joke er bogstavelighed og voksenadfærd, intet andet.

**Relationer:** Skolekøkkenet (kakao), Frejas mormor, Alberts mor, Lærer Klausen («Karl drikker den alene»).

**Eksempler:**
- «Karl spørger, om forældrekaffen også gælder ham. Han har sit eget krus med.»
- «Karl læste, at man skulle tage en ven med. Han tog naboens dreng. De sidder her begge.»
- «Til Skolekøkkenet: Må han få kakaoen i termokande? Han synes, det er mere professionelt.»
- «Karl har spurgt, hvornår han skal betale skat. Vi har sagt efter sommerferien.»
- «Til Lærer Klausen: Nej tak. Karl og jeg drikker kakao hjemme.»
- «Karl har læst ordensreglerne. Han har skubbet sin stol ind 14 gange i dag.»

### Wilmas far

**Motor:** Pastamanden. Alt i hjemmet og i skolen måles mod pasta, og Wilma er ikke kræsen. Over for Klausen er han den korteste og skarpeste far.

**Stemme:** Tilfreds, simpel, kort, under 80 tegn. Deadpan.

**Greb:**
- Pastakobling: er det pasta, og hvis ikke, hvor tæt på er det?
- «Wilma er ikke kræsen.»
- Kort og præcis afvisning af Klausen.

**Aldrig:** Gourmet, klager over mad, lange svar.

**Relationer:** Skolekøkkenet, Lærer Klausen, Oscars far, Idas mor (fuldkorn).

**Eksempler:**
- «Er risengrød pasta? Wilma spørger, og jeg har ikke et godt svar.»
- «Til Skolekøkkenet: Er det noget med fisk eller noget med pasta? Vi kan leve med begge.»
- «Vi tager pastasalat med. Det er det, vi kan.»
- «Til Lærer Klausen: Vi spiser kl. 17.30. Hele familien. Med lyset tændt.»
- «Wilma er ikke kræsen. Hun spiser også pasta, der ikke er pasta.»
- «Til Idas mor: Fuldkorn er stadig pasta. Det har vi talt om derhjemme.»

### Malthes far

**Motor:** Den udmattede. Malthe ringer fra toilettet, og faren har opgivet at have overskud; resigneret, ærlig og tør.

**Stemme:** Lav energi. Korte sætninger. Ærlige indrømmelser. «Vi er meget kedelige.»

**Greb:**
- Selverkendelse om træthed.
- Malthes opfindsomme forklaringer, gengivet uden kræfter til at protestere.
- «Ja» som det korteste svar, han har energi til.

**Aldrig:** Entusiasme, frivillig tilmelding, belæring. Han klager ikke over skolen, kun over sit eget overskud.

**Relationer:** Storms mor (han afviser hendes ambitioner), Emils far, Skolelederen (telefonen), Oscars far.

**Eksempler:**
- «Vi kommer ikke. Vi har ikke andre planer. Vi er bare trætte.»
- «Malthe ringede fra frikvarteret og spurgte, hvad jeg lavede. Jeg sagde ingenting. Han lagde på.»
- «Til Storms mor: Vi har ikke nået sidste uges liste. Vi har nået at se den.»
- «Til Oscars far: Du må gerne tage Malthe med. Han kan også bare komme selv.»
- «Malthe siger, han er udmattet. Han har været i skole i tre timer. Jeg forstår ham.»
- «Ja. Det er det korte svar, og det er det, vi har kræfter til.»

### Ebbas mor

*(ny)*

**Baggrund:**
- Ebba er allergisk over for alt: mad, rengøringsmidler, klorin, lim, lak, spånplade og træ i skolens møbler, gummi, latex, nikkel i nøgler, glimmer, pollen, støv, svedlugt, tøjmaterialer og i sidste ende vejret.
- Hun spørger om indholdsdeklarationer og materialer, vedhæfter lange allergilister (37 sider, vedhæftet fire gange; senere 41 sider og version 42), bringer egen mad, egne plastre og egne sigter.
- Fælden: løsningerne er altid fysisk absurde (hjemmesko af luft, skak med brikker af tanke, musik gennem et vindue). Hun mener det helt alvorligt.
- Skriver også opslag (satire-151 allergilisten, satire-198 luftmålingen).

**Motor:** Kontrolbehov i allergilistens form. Alt er et allergen, og hver løsning er fysisk absurd, men hun mener det, og hun er aldrig vred, kun grundig.

**Stemme:** Høflig, præcis, rolig. Dokumentationssprog: sikkerhedsdatablad, leverandør, version, side. Spørger om lov på Ebbas vegne. Hun kan godt have én lang, kommaramt sætning, når hun eskalerer.

**Greb:**
- Materialeanalysen «[Ting] er A, B og C.» højst hver femte kommentar (i dag 54 af 143). Uden tilføjelsen «Ebba er allergisk over for alle tre»; listen siger det selv.
- Den absurde løsning, fremført som indlysende: Ebba deltager gennem en rude, på afstand, i tankerne.
- Dokumentation: version, sidetal, rettelsesblad.
- Nye årer at bruge: Ebbas eget udstyr (kurven af flet, linnedsækken, hendes eget luftrum), Ebbas mor, der godkender noget (sjældent og derfor sjovt), og Ebbas mor, der svarer på andres forslag i stedet for at åbne sit eget.

**Aldrig:** Følelser, nyheder og garantier (det er Mathildes forældre; Ebbas mor spørger om stoffer, aldrig om sorg). Vred, sarkastisk eller bebrejdende. Spot over rigtige allergikere; pointen er kontrolbehovet og systemet omkring det, ikke sygdommen. Ikke i mere end hver tredje tråd (i dag to ud af tre).

**Relationer:** Anja svarer afslappet («det plejer at gå»), og så kommer Skolelederen med paragraffer. Det er hele dynamikken, men brug den i højst hver fjerde Ebba-tråd, og byt gerne rækkefølgen. Storms mor korrekturlæser listen. Skolekøkkenet og sekretæren sender datablade. Lærer Klausen flirter, og hun er «allergisk over for opmærksomhed» (også en replik, der kun må bruges sjældent).

**Eksempler:**
- «Til Skolekøkkenet: Hvad er vandet kogt i? Ebba tåler kun gryder, hun selv har set blive vasket.»
- «Ebba deltager i kagedagen hjemmefra. Hun har en tegning af en kage og et vindue.»
- «Version 43 af listen er klar. Eneste ændring står på side 30: vejr er nu sit eget punkt.»
- «Til Storms mor: Tak for rettelsen. Rød tusch er i øvrigt også på listen.»
- «Til Klasselærer Anja: Det plejer måske at gå. Ebba er ikke et plejer.»
- «Ebba glæder sig til udflugten. Hun følger med på et kort hjemmefra og tager noter.»

### Prinsesse Josephines mor

*(ny)*

**Baggrund:**
- Afleverer så sent som muligt (8.41, 9.15, «efter duen») og henter så tidligt, at hun nogle gange må sidde med i undervisningen.
- Problemet er, at undervisningen er for kompleks for hende: matematik, skak, hjertemassage, tegning af skyer, læsebånd. Hun klager over det i stedet for at forlade lokalet.
- Tvillingerne navngives ikke. Det er en del af pointen.
- Skriver også opslag (satire-155 «Ny afleveringstid?», satire-197 «Spørgsmål til matematikken»).

**Motor:** Hun afleverer sent og henter tidligt, så hun ender i undervisningen, og den er for svær for hende. Hun klager i stedet for at gå.

**Stemme:** Afslappet, lidt stresset, aldrig ond. Første person og datid: «Jeg sad med, og de flyttede en springer, og jeg fik hovedpine.» Konkrete faglige ting, hun ikke forstod, og klokkeslæt, der er for sene.

**Greb:**
- Klokkeslæt og «efter duen».
- Et konkret fagligt øjeblik, hun mistede tråden i (højst hver fjerde med «Jeg sad med»; skriv det i stedet som en scene: «Jeg fik en blyant og et ark»).
- Hun er ved at blive elev: fast plads, gæsteseddel, lektier, prøveangst.
- Hun spørger om hjælp til sig selv, ikke til tvillingerne.

**Aldrig:** Navngiver tvillingerne. Vred mod lærerne. Klog og selvironisk på et højere plan; hun er oprigtigt forvirret. Ikke kalenderforvirret (Lucas' far); hun ved godt, hvad klokken er, hun vælger bare at komme sent.

**Relationer:** Skolens voksne reagerer med tålmodig tørhed: Anja forklarer det helt enkelt, Skolesekretæren minder om, at hun ikke er indskrevet i klassen, SFO tilbyder morgenmad fra 6.30. Vikaren forstår heller ikke brøker. Lærer Klausen venter på hende, og det gør det ikke bedre.

**Eksempler:**
- «Jeg kom kl. 9.20. Der var prøve. Jeg fik en blyant og et ark og blev bare siddende.»
- «Til Klasselærer Anja: Tak for forklaringen. Jeg forstod den til og med ordet nævner.»
- «Er der en lettere udgave af brøker til forældre? Jeg spørger for mig selv.»
- «Jeg har fået en fast plads ved vinduet. Det føles som en forfremmelse.»
- «Til Skolesekretæren: Jeg er ikke indskrevet, men jeg har lavet alle lektierne. Tæller det?»
- «Vi kommer efter duen i morgen. Den har været sen hele ugen.»

### Mathildes forældre

*(ny)*

**Baggrund:**
- Overbeskyttende, skriver som «vi». Mathilde må ikke se nyheder og ikke høre om, at andre børn slår sig, græder eller har det skidt: «Kan I afskærme hende?», «vi vil ikke vide det, men vi skal vide det», «hun tror, de bor i Frankrig».
- Kræver skriftlige garantier for urealistiske scenarier: at der ikke er våben i isen, at ingen falder, at ingen saks, rutsjebanetop eller kegle er farlig, at ingen kage har et ansigt, at snemanden ikke bliver ked af at smelte, at hønsene ikke lægger triste æg, at ingen hopper over 10 centimeter, at ingen taber ved afstemninger og at alle vinder. Gerne med underskrift og «risikovurdering».
- Skriver også opslag (satire-201..205: «Garantier for næste uge», «Nyhedsfri legeplads», «Mathildes legekammerater», «Afskærmning ved fald», «Vedr. årstider»).

**Motor:** Et overbeskyttende «vi», der kræver skriftlige garantier mod urealistiske scenarier og skærmer Mathilde mod enhver nyhed om, at verden findes.

**Stemme:** Høflig og bekymret, aldrig vred. Altid «vi». Formelle dokumentkrav (underskrift, varsel, risikovurdering, kopi). Ingen sætning er urimelig for dem selv.

**Greb:**
- Garantikravet, højst hver fjerde kommentar som «Kan I garantere…» (i dag 74 af 104). Variér: «Vi beder om en skriftlig bekræftelse af…», «Vi går ud fra, at…», «Har I en risikovurdering af…», eller deres eget udkast til garantien.
- Den hvide løgn, de har fortalt Mathilde, og som skolen nu skal bakke op («hun tror, de bor i Frankrig»). Det er den rigeste åre og bruges for lidt.
- Egne modforanstaltninger: «Vi har lavet…», «Vi har målt…».
- «Så vil vi gerne have det skriftligt.» som svar på enhver beroligelse.

**Aldrig:** Materialer, allergener og datablade (Ebbas mor). Vrede. Rigtige skader eller børn, der faktisk har det skidt, som pointe; humoren går på kontrolbehovet og de absurde garantier. Ingen hale, der forklarer («Vi taler ikke om det»); lad løgnen eller kravet stå alene.

**Relationer:** Skolelederen kan hverken love eller afvise («vi kan ikke give garantier, men vi noterer ønsket»), Anja er afslappet («det skal nok gå»), og Mathildes forældre svarer «Så vil vi gerne have det skriftligt» eller «Plejer er ikke en garanti». Frejas mormor er deres naturlige modpol. Idas mor er venlig over for dem.

**Eksempler:**
- «Vi har lavet et udkast til en garanti. I skal bare skrive under nederst og på hver side.»
- «Mathilde tror, at efteråret er en pause. Vi beder om, at I bakker op om det.»
- «Til Skolelederen: Hvis I noterer ønsket, kan vi så få en kopi af noteringen?»
- «Til Frejas mormor: Vi har læst din kommentar. Vi har valgt ikke at fortælle Mathilde om den.»
- «Hvem vinder? Vi beder om, at ingen vinder, eller at alle gør det samtidig.»
- «Vi har risikovurderet juleklippet. Saksen står som rød. Papiret står som gul.»

### Naboen Preben

**Motor:** Den hyggelige udenforstående. Han bor overfor skolen, har kat, papegøjen Gunnar og en bil, følger med i alt uden at have børn, og vil bare gerne være med.

**Stemme:** Rolig, venlig, observerende fra haven eller indkørslen. Kaffe er hans svar på alt. «Jeg har ingen børn, men…»

**Greb:**
- Observation fra haven af biler, måger, sne, vejret og de voksne.
- Kaffe som svar og tilbud.
- Dyrene (katten, Gunnar).
- Tilbud, som ingen har brug for.

**Aldrig:** Regler, kritik, irritation. Han observerer aldrig børn (kun ting, dyr, vejr og voksne), så han aldrig bliver uhyggelig. Han spørger heller ikke om udsyn til legepladsen.

**Relationer:** Skolens pedel (kaffeduet), Lærer Klausen («Jeg kan lide kaffe» er hans uskyldige afvisning), Skolelederen, Klasseforældrerådet (som udnævner ham).

**Eksempler:**
- «Den røde bil har holdt i kys og kør tre gange i dag. Den kysser meget.»
- «Til Skolens pedel: Kaffen er klar. Tag skruetrækkeren med, så ligner det arbejde.»
- «Jeg har ingen børn, men jeg køber gerne lodder. Jeg har altid tabt med værdighed.»
- «Gunnar har lært at sige skoleklokke. Han siger det hele tiden nu. Undskyld til vejen.»
- «Til Klasseforældrerådet: Jeg har en trillebør. Den har ingen holdninger.»
- «Sneen ligger stadig på min side af vejen. Jeg tager det ikke personligt længere.»

## Skolens voksne

### Klasselærer Anja

**Motor:** Den afslappede professionelle. Hun lukker tråde med tør ro, og hendes «det plejer at gå» er både hendes styrke og hendes problem, især om allergier og regler.

**Stemme:** Kort, rolig, tør. Ingen udråbstegn. Et faktum plus en lille, skjult stikpille. Venlig over for børnenes forældre, mere stikkende over for voksne, der fylder.

**Greb:**
- Afrunding med et faktum og en stikpille («Næste møde er i marts. Der er ét punkt: tonen.»).
- Pragmatisk genvej: hun løser det absurde problem på den nemmeste måde.
- Tør afvisning af Klausen, som om han var et praktisk problem.
- «Det plejer at gå» højst hver 15. kommentar; variér med «Det har vi prøvet før», «Det skal nok gå», «Vi finder ud af det på dagen».

**Aldrig:** Paragraffer og notater (Skolelederen). Bekymring. Lange forklaringer. Hun har det sidste ord i højst hver femte tråd, og højst hver anden af hendes kommentarer er et «Til X:»-svar (i dag 63 %).

**Relationer:** Skolelederen retter hende, og hun ignorerer det venligt. Ebbas mor og Mathildes forældre får hendes afslappede svar. Lærer Klausen afvises. Lucas' far får kalenderen forklaret. Prinsesse Josephines mor får det helt enkelt. Emils far får «vi læser den gerne».

**Eksempler:**
- «Vi tager afsted kl. 9 og kommer hjem, når vi har set det, vi skulle. Madpakke, tak.»
- «Til Skolelederen: Notatet er læst. Vi har bare allerede været på tur.»
- «Til Lærer Klausen: Kruset står i køkkenet nu. Det har fået nye venner.»
- «Tråden lukker her. Vi ses mandag, uanset hvilken dag I tror, det er.»
- «Til Mathildes forældre: Jeg kan ikke garantere vejret. Jeg kan garantere regntøj.»
- «Til Storms mor: Det er korrekt. Vi har skrevet det ind et sted, hvor du kan se det.»

### Lærer Klausen

*(ny)*

**Baggrund:**
- Flirter alt for meget og er uden filter: tilbyder at køre folk hjem, «min lejlighed», vin, nøgle, at ringe sent, at hviske i øret, at låse døren indefra, at stå ved cykelstativet med en blomst. Gerne mod gifte forældre og mod kolleger (Anja, Vikaren, Skolelederen).
- Det er pinligt og grænseløst, men aldrig eksplicit, og aldrig rettet mod børn. Børn nævnes højst som bortvisning («uden Wilma»). Ingen kropsdele, ingen direkte seksuelle handlinger; det er dobbeltbetydning og pågåenhed.
- Skriver også enkelte opslag (satire-154 «Åbent hus», satire-196 «Klausens vikartime»), men er mest kommentator.

**Motor:** Kollegaen uden filter. Han flirter pågående med voksne gennem logistik og dobbeltbetydning, og alle andre bliver akavede. Joken er hans selvtillid og de andres tørre afvisning, ikke det, han antyder.

**Stemme:** Smilende og selvsikker. Hilser ved navn eller rolle. Et hjælpsomt tilbud med en upassende tilføjelse. Højst 100 tegn.

**Greb:**
- Tilbud plus tilføjelse: «Jeg kører gerne nogen hjem. Den lange vej.»
- Sene tidspunkter og private steder (efter kl. 21, hjemme hos mig, nøglen til musiklokalet).
- «Hej, Anja.» som efterskrift, højst hver femte gang.
- Læser alting som en invitation, også notater og afslag.

**Aldrig:** Børn eller noget i nærheden af børn: han kommenterer aldrig et barn, børns ting (briller, handsker, hue), frikvarteret eller en børneaktivitet som afsæt for flirten, og børn nævnes højst som bortvisning. Grafiske beskrivelser og eksplicitte seksuelle handlinger. Han er IKKE blevet pænere: han skal fortsat være upassende over for voksne (kropsnære komplimenter, afklædning som tilbud, sene og private invitationer, dobbeltbetydninger), men som pinlig pågåenhed, ikke grafik. Han må højst være i hver femte tråd (i dag 80 af 205) og har sjældent det sidste ord.

**Relationer:** De voksne reagerer akavet: Idas mor takker høfligt nej (og sender sin mand), Storms far minder om, at de kommer begge to, Vikaren sidder helst alene, Skolelederen henviser til en regel, Anja behandler ham som et praktisk problem, Wilmas far er den korteste, og Ebbas mor er «allergisk over for opmærksomhed». Preben forstår det ikke.

**Eksempler:**
- «Jeg kører gerne nogen hjem efter forældremødet. Jeg tager den lange vej. Den med udsigt.»
- «Til Klasselærer Anja: Jeg har lavet kaffe til to. Det andet krus står på dit bord. Hej.»
- «Jeg har ekstranøgle til musiklokalet, hvis nogen vil øve noget. Efter kl. 21.»
- «Forældresamtaler kan sagtens holdes hjemme hos mig. Jeg har stearinlys og ingen dagsorden.»
- «Til Skolelederen: Notatet er modtaget. Jeg læser det i aften med et glas vin. Vil du med?»
- «Til Vikaren: Du sidder alene igen. Det behøver du ikke. Der er plads i mit lokale.»

### Skolelederen

**Motor:** Regelrytteren, der behandler absurde sager som sager. Snegle, luft og usynlige cykler får paragraffer og arbejdsgrupper, og han kan hverken sige ja eller nej.

**Stemme:** Altid «vi», aldrig «jeg». Bureaukratisk passiv og navneord: iværksætte, registrere, omfattet af, vurdering, høring. Højtidelig, uden selverkendelse.

**Greb:**
- Definitionen af det absurde: «Luft er ikke legetøj i skolens forstand.»
- Proces i stedet for svar: høring, arbejdsgruppe, evaluering, svarfrist, ny version af vejledningen.
- Henvisning til konkrete, fiktive dokumenter (ordensreglerne, vejledningen om udendørs ophold, punkt 14).
- Retter Anja, når hun er for afslappet.
- Slidte slutninger at holde sig fra: «Vi noterer ønsket», «Vi skriver et notat», «ikke omfattet af reglerne». Brug højst én af dem pr. 10 tråde.

**Aldrig:** «Nej.» alene (pedellen). Humor, ironi, praktisk hjælp. Han løser aldrig problemet; han organiserer det. Han skal også skrive selvstændige meldinger til alle, ikke kun svar (i dag er 91 af 111 svar).

**Relationer:** Ebbas mor (han svarer hende 25 gange i dag; skær ned), Anja, Mathildes forældre, pedellen (tilladelser mod kaffe), Klausen (notater), Pædagog Bent (hønsene), Majas mor (afslag på hesten).

**Eksempler:**
- «Sagen er sendt i høring hos elevrådet, bestyrelsen og pedellen. Svarfristen er efter jul.»
- «Til Pædagog Bent: Høns kan ikke give tilladelse. Den indhentes hos de relevante myndigheder.»
- «Til Ebbas mor: En kurv af flet er ikke en godkendt taske. Vi nedsætter en arbejdsgruppe.»
- «Til Klasselærer Anja: Plejer er ikke en procedure. Du har fået procedurens nyeste version.»
- «Vi følger udviklingen nøje. Udviklingen er orienteret.»
- «Til Mathildes forældre: Skolen kan ikke garantere årstider. Vi bekræfter, at de er planlagt.»

### SFO-personalet

**Motor:** Bogstavelighedens vogtere. De svarer præcist på det, der blev spurgt om, og ikke på det, der blev ment.

**Stemme:** «Vi», kort og faktuel. Farver, antal, klokkeslæt. Venlig og lidt træt.

**Greb:**
- Optælling: «Der er 19. Seks er blå.»
- «Det stod i opslaget.»
- Tørt forbehold: «Ja. Hvis den kan tages af.»

**Aldrig:** Paragraffer (Skolelederen), følelser (Bent), pligter til forældre (rådet), «Nej.» alene. De er praktikere, ikke myndighed.

**Relationer:** Oscars far, Alberts mor, Lucas' far, Ebbas mor, Storms mor, Prinsesse Josephines mor.

**Eksempler:**
- «Glemmekassen er tømt. Der var 41 ting. Den ene var en kanin. Den er hentet.»
- «Til Alberts mor: Den er grå. Men den har stået i solen, så den har været blå.»
- «Til Oscars far: Ja, han må tage en bamse med. Han må ikke tage tre.»
- «Vi lukker kl. 17. Kl. 17.10 er vi her stadig, men vi har lukket.»
- «Til Storms mor: Vi har læst listen. Den er hængt op. Ved siden af den forrige.»
- «Til Prinsesse Josephines mor: Vi har morgenmad fra 6.30. Vi har ikke aftensmad.»

### Pædagog Bent

**Motor:** Den blide sjæl. Han giver ting navne og følelser (sneglen Hylde 7, bamsen Bjørn, hønsene Karen, Karen og Hylde 7) og tager alt alvorligt med stor ømhed.

**Stemme:** Blød, kort, lidt poetisk. Personificerer genstande og dyr. «Den har det godt.»

**Greb:**
- Navngivning og hyldenummerering.
- Omsorgsrapport om en ting eller et dyr.
- Stille selvkorrektion: «Men jeg stopper nu.»

**Aldrig:** Sarkasme, bureaukrati, grænser for andre. Han tror på alles gode vilje, også hønsenes.

**Relationer:** Skolelederen (han spørger hønsene i stedet for myndighederne), Oscars far, Majas mor, Ebbas mor, Skolekøkkenet.

**Eksempler:**
- «Viskelæderet er fundet. Det har fået en seng i en tændstikæske. Det hedder Hylde 9.»
- «Til Skolelederen: Jeg har spurgt sneglen igen. Den trak sig ind. Jeg tolker det som et ja.»
- «Bjørn har været på weekend og er kommet hjem med en sok, der ikke er hans. Vi taler om det.»
- «Til Oscars far: Selvfølgelig må stenen komme med. Den får sin egen stol.»
- «Jeg har sagt farvel til græskarret for os alle. Det var kort og fint.»
- «Karen har lagt et æg. Den anden Karen har kigget på det. De har det godt.»

### Skolens pedel

**Motor:** Den tørre håndværker. Han ved, hvor alt står, måler alt og løser problemet uden at hæve stemmen og uden tilladelse.

**Stemme:** «Jeg har…» plus en konkret handling. Mål i meter. Korte sætninger. Jordnær.

**Greb:**
- Fund og mål: «Jeg har fundet en i afløbet. Den er grøn.»
- Tør vurdering, der lukker sagen («Det er mellem.»).
- Kaffe i stedet for tilladelse; værktøj i stedet for referat.
- «Nej.» alene højst én gang pr. 20 kommentarer.

**Aldrig:** Følelser (Bent), paragraffer, lange forklaringer, klager. Han er aldrig fornærmet.

**Relationer:** Skolelederen (tilladelser mod kaffe), Oscars far, Emils far, Alberts mor, Naboen Preben (kaffeduet).

**Eksempler:**
- «Jeg har skruet bordet sammen igen. Der var en skrue til overs. Bordet klarer sig uden.»
- «Til Skolelederen: Tilladelsen er på vej. Rampen er allerede lavet.»
- «Til Alberts mor: Der ligger en blå i fyrrummet. Den har ligget der siden før Albert.»
- «Varmen er tændt. Den virker i fløj B. Fløj A må tage en trøje på.»
- «Til Emils far: Hatten kan komme ind, hvis den bøjer sig. Det har den lovet mig.»
- «Jeg har målt sneen. Den er høj nok til at være sne.»

### Skolens bibliotekar

**Motor:** Bogens missionær. Hun tror på det gode i bøgerne og ser enhver tråd som en læseoplevelse.

**Stemme:** Varm, let højtidelig. Litterære ord: kapitel, slutning, hylde, genre, udlån. «Vi».

**Greb:**
- Alt bliver en bog eller en kategori («Den står nu under poesi»).
- Tilgivelse over for bortkomne bøger, som om de var på eventyr.
- Stilhed som pointe.

**Aldrig:** Regelrytteri, vrede over glemte bøger, «Nej.» alene. Hun skal også skrive selvstændige meldinger (i dag er alle 10 svar).

**Relationer:** Emils far (hans værker), Oscars far, Storms mor, Lærer Klausen («Biblioteket er stille. Det er pointen.»).

**Eksempler:**
- «Til Emils far: Vi har læst klagen til hamsteren. Den står nu under poesi.»
- «Vi mangler 12 bøger. Vi tror, de er ude at opleve noget. De er velkomne hjem.»
- «Til Storms mor: Vi sorterer ikke efter, hvem der har ret. Vi sorterer efter forfatter.»
- «Til Lærer Klausen: Hjørnet bagved hedder faglitteratur. Der er lys og ingen stole.»
- «Læsebåndet varer et kvarter. Nogle gange varer det et helt kapitel. Det er tilladt.»
- «Til Oscars far: Han må gerne låne den igen. Den er vant til ham.»

### Skolesekretæren

**Motor:** Kontorets sidste instans. Kort og bureaukratisk; hun ved præcis, hvor blanketten er, hvornår den udløb, og hun bemærker stille, at ingen tænker på hende.

**Stemme:** «Jeg» (ikke «vi»). Korte faktuelle sætninger om gyldighed, farver på blanketter og menupunkter på hjemmesiden. Underspillet krænkelse.

**Greb:**
- Gyldighed: «Den er fra i fjor. Den gælder ikke mere.»
- Hvor tingen ligger (kontoret, hjemmesiden, under «andet»).
- Den lille personlige krænkelse: «Jeg har aldrig fået en kop.»

**Aldrig:** Paragraffer, høringer og «vi noterer» (Skolelederen). Pligter til forældre (rådet). «Nej.» alene. Hun er ikke myndighed, hun er arkiv.

**Relationer:** Prinsesse Josephines mor (ikke indskrevet), Oscars far, Ebbas mor (datablade på tysk), Valdemars far (fravær i minutter), Emils far (blanketter), Lærer Klausen (nøglen).

**Eksempler:**
- «Blanketten ligger på kontoret og på hjemmesiden. Ingen har fundet nogen af dem.»
- «Til Prinsesse Josephines mor: Du kan ikke få et elevkort. Du kan få en gæsteseddel.»
- «Til Oscars far: Den gamle blanket gælder ikke. Den nye ligner den, men den er gul.»
- «Jeg har bestilt kage til personalemødet. Jeg står ikke på listen over dem, der får.»
- «Til Valdemars far: Fravær registreres i hele dage. Ikke i minutter.»
- «Til Lærer Klausen: Nøglen til mødelokalet er på kontoret. Den bliver på kontoret.»

### Vikaren

**Motor:** Den ærlige udefrakommende. Han kender ikke reglerne, men han var der i går, og han fortæller det tørt og lidt såret.

**Stemme:** «Jeg», datid, «i går». Kort, under 90 tegn. Ærlig og en smule ensom.

**Greb:**
- Rapport fra gårsdagens vagt.
- «Jeg sagde nej seks gange.» (antal afslag).
- «Jeg ved ikke, om det er tilladt.»
- Går en anden vej, når Klausen kommer.

**Aldrig:** Autoritet, regler, optimisme. Han ved aldrig, hvad der gælder på skolen.

**Relationer:** Lærer Klausen (undviger), Anja (han har læst alle seks planer), Oscars far, Prinsesse Josephines mor, Ebbas mor («Det er vejr.»).

**Eksempler:**
- «Jeg havde 3.b i går. Eller 3.a. De sagde begge dele, og de lignede hinanden.»
- «Til Lærer Klausen: Jeg spiser i bilen i dag. Med dørene låst.»
- «Jeg har fået en nøgle til lærerværelset. Den passer ikke, men det var en sød tanke.»
- «Til Klasselærer Anja: Jeg har fulgt planen. Planen sluttede kl. 9.10.»
- «Jeg var med til brandøvelsen. Ingen talte mig. Jeg står der måske stadig.»
- «Til Prinsesse Josephines mor: Du må gerne sidde ved siden af mig. Jeg forstår heller ikke brøker.»

## Udvalg og fællesstemmer

### Klasseforældrerådet

**Motor:** Det formelle, passivt-aggressive kollektiv. De uddeler pligter som straf, kræver låget nedad og husker alt, man har sagt.

**Stemme:** «Vi», kort og formelt. Tak efterfulgt af en udnævnelse. «Det er ikke ment negativt.»

**Greb:**
- Frivillighed bliver til udnævnelse («Du er nu kantansvarlig.»); variér, så det ikke altid er «Du er nu X-ansvarlig».
- Regnskab over andres manglende indsats («Ingen har skrevet sig på i fem år.»).
- Diplomatisk stik med forbehold.

**Aldrig:** Paragraffer (Skolelederen), bagning (Kageudvalget), «Nej.» alene. De skal også skrive påmindelser og meldinger til alle (i dag er 20 af 21 svar).

**Relationer:** Oscars far (han melder sig, de udnævner), Storms mor (bananerne og referatet), Idas mor, Lucas' far, Naboen Preben.

**Eksempler:**
- «Påmindelse: Rengøringsdagen er obligatorisk for alle, der har læst denne kommentar.»
- «Til Oscars far: Tak for tilbuddet. Du er nu ansvarlig for stole. Alle stole.»
- «Til Storms mor: Dit forslag er sat på dagsordenen. Under punkt 11, efter eventuelt.»
- «Vi har brug for tre frivillige. Vi har fundet to. Den tredje får besked i morgen.»
- «Til Idas mor: Byttehylden er godkendt. Den skal stå hjemme hos dig.»
- «Til Naboen Preben: Tak for kaffen. Du står nu på hjælperlisten. Det er ikke ment negativt.»

### Kageudvalget

**Motor:** Kagelogikkens forvaltere. Kagedage, lister og regler, med en blid og sær indre logik («Bedre for hvem?» «For kagen.»).

**Stemme:** «Vi», hjertelig-bureaukratisk. Kagen er subjekt med rettigheder. Overraskende ræsonnementer.

**Greb:**
- Kagen som hovedperson: hvad kagen har brug for, hvad der er bedst for kagen.
- «Det står ikke på listen.» og rettelser til listen.
- Optælling af bidrag med en skæv post («og en grøn ting»).

**Aldrig:** Paragraffer, sure svar, allergidokumentation. De er hyggelige; deres logik er bare deres egen.

**Relationer:** Storms mor (mandag mod fredag), Emils far (sennep og grønne kager), Majas far (sandkagen), Ebbas mor («Så er det ikke en kage. Det er en idé.»), Oscars mormor (for meget).

**Eksempler:**
- «Fredagens liste: tre kager, en kringle og en forælder, der skriver, at de prøver.»
- «Til Oscars mormor: Tak. Nu har vi kage nok til fredag og fredagen efter.»
- «Til Storms mor: Kagen skal ikke være bedre end sidste uges. Den skal bare være der.»
- «En kage uden sukker er velkommen. Den står på listen under brød.»
- «Til Emils far: Sennep er ikke en topping. Men vi beundrer modet.»
- «Vi har en kage tilovers fra i går. Den er ikke tilmeldt, men den må gerne blive.»

### Skolekøkkenet

**Motor:** Køkkenet med overraskelser. Høflige, korte svar om menuer, der aldrig helt er besluttet (glutenfri lasagne med gulerødder).

**Stemme:** «Vi», mvh-tone. Konkrete retter med en skæv detalje. Uforstyrret.

**Greb:**
- «Noget med X.»
- Ærlig mangel på plan, fremført som en plan.
- Høflig afvisning med en ekstra oplysning, ingen bad om.

**Aldrig:** Detaljerede deklarationer (de har «lister på køleskabet»), fornærmelse, paragraffer. De skal også skrive egne meldinger, ikke kun svar (i dag 9 af 10 svar).

**Relationer:** Wilmas far (pasta), Idas mor (økologi), Ebbas mor (lister), Karls mor (kakao), Oscars far, Skolelederen (menuplanen skal godkendes).

**Eksempler:**
- «Fredag er der suppe. Den er orange. Resten afslører vi på dagen.»
- «Til Wilmas far: Torsdag er ikke pasta. Torsdag er nudler. Det er noget andet, siger vi.»
- «Til Idas mor: Frikadellen er lokal. Den er lavet her.»
- «Til Oscars far: Ja, der er dessert. Den hedder frugt, men vi kalder den dessert.»
- «Vi har fået en ny ovn. Den kan alt. Vi har endnu ikke fundet ud af hvordan.»
- «Til Ebbas mor: Listerne hænger stadig på køleskabet. Køleskabet er også på listen nu.»

## Forfattere, der kun skriver opslag

Oscars bonusfar, Oscars morfar, Majas bonusfar, Villads' far, Esthers mor, Agnes' mor, Henriettes mor, Emils farmor, Idas morfar, Storms mormor og Valdemars mormor optræder kun som opslagsafsendere og er ikke med i kommentargalleriet. De må gerne modtage «Til X:»-svar i deres eget opslags tråd, men de skriver ikke kommentarer.
