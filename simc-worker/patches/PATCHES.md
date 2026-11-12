# Aulas rettelser oven på simc-forever

simc-forever (SimulationCraft til WoW Forever) mangler endnu nogle klasser: modulet findes, men er en tom skal uden
spells og uden rotation, så simulationen giver 0 DPS. Indtil upstream selv implementerer dem, lægger vi en lille
rettelse (patch) pr. klasse oven på den fastlåste `SIMC_REF` i `../Dockerfile`.

- Én rettelse pr. klasse: `<klasse>.patch` (`git diff`-format mod simc-kilden) + `<klasse>.check` (er upstream færdig?).
- `apply.sh` kører i Docker-builder-stagen efter kloningen og før `make` (se `../Dockerfile`).
- `check-upstream.sh <SIMC_REF>` er opdateringsværktøjet (se «Opdatér simc» i `../README.md`).
- Workeren læser `/opt/simc/PATCHES_APPLIED` og markerer resultater for klasser med anvendt rettelse
  (`model: 'aula-rettelse'` + dansk advarsel).

**Licens:** SimulationCraft er GPL-3. Rettelserne er afledt af GPL-koden og er derfor selv GPL-3; de er en del af
denne offentlige repo og skal forblive det, så længe imaget med den rettede `simc` distribueres.

## Sådan fungerer apply.sh

For hver `<klasse>.patch`:

1. **Er upstream færdig?** Alle betingelser i `<klasse>.check` holder på den rene upstream-kilde →
   rettelsen springes over: `UPSTREAM HAR <klasse> — vores rettelse droppes` (exit 0).
2. **Ellers** `git apply --check`. Passer en rettelse ikke, fejler bygget med en dansk/engelsk besked der nævner
   klassen og hvad man skal gøre, og **ingen** rettelse anvendes (alle tjekkes før nogen anvendes).
   Er rettelsen allerede anvendt (lokal arbejdskopi), godtages det.
3. Resultatet skrives til `/opt/simc/PATCHES_APPLIED`, én linje pr. klasse: `<klasse> applied` eller
   `<klasse> dropped-upstream`. Filen kopieres til runtime-imaget.

Exit: 0 ok, 1 konflikt, 2 brugsfejl eller ugyldig `.check`-fil (så en tastefejl aldrig får en rettelse droppet i
stilhed).

### `.check`-format

Én betingelse pr. linje (`#` er kommentar); upstream regnes for færdig, når **alle** holder. Stier er relative til
simc-kildens rod.

| Betingelse | Holder når |
|---|---|
| `min_lines <fil> <N>` | filen findes og har flere end N linjer |
| `contains <fil> <tekst>` | filen indeholder teksten (fast streng, resten af linjen) |
| `not_contains <fil> <tekst>` | filen findes ikke eller indeholder ikke teksten |

Heuristikken er bevidst simpel. Har upstream kun delvist implementeret klassen (fx flere linjer, men ingen
rotation), holder betingelserne ikke, rettelsen passer heller ikke, og bygget stopper som en konflikt. Det er
meningen: så skal et menneske se på, om vores eller upstreams version skal bruges.

## mage

**Hvad:** Grov basismodel for Forever-mage efter warlock-modulets skabelon (`sc_warlock.cpp`, `apl/warlock.cpp`):
mana som primær ressource, `init_spells` med `spell_ranks_t` (rank vælges efter spillerens level med
`rank.<spell>.find_rank()`), `create_action`, `init_action_list` og `init_base_stats`. Talenternes passive effekter
læses med simcs egen `parse_all_passive_talents()` (se «Talenter» nedenfor). Magen arver fra
`parse_player_effects_t` (som druid og priest), så Evocations regen-effekter kan læses direkte fra spildataen.

**Filer:** `engine/class_modules/sc_mage.cpp` (modulet), `engine/class_modules/apl/mage.cpp` (rotationen mellem
`//mage_apl_start` og `//mage_apl_end`), `engine/class_modules/apl/mage.hpp` (erklæring af `mage_apl::mage`).
Filerne ligger allerede i simcs byggelister, så intet andet skal røres.

**Upstream-tjek (`mage.check`):** `sc_mage.cpp` har flere end 150 linjer, `apl/mage.cpp` indeholder `add_action`,
og `sc_mage.cpp` indeholder ikke vores markør `AULA-RETTELSE`. Ved `SIMC_REF` 3c1d319 er `sc_mage.cpp` 47 linjer og
APL'en tom; med rettelsen er modulet 549 linjer.

### Spells (alle tal fra spildata, intet opfundet)

Kun spells en mage lærer hos træneren; id'er og levels er slået op i `engine/dbc/generated/sc_spell_data.inc`
(class mask 0x80) og kontrolleret med `simc spell_query=spell.id=<id>`.

| Spell | Ranks (id: level) | Bemærkning |
|---|---|---|
| Frostbolt | 116:4, 205:8, 837:14, 7322:20, 8406:26, 8407:32, 8408:38, 10179:44, 10180:50, 10181:56, 25304:60 | direkte frostskade; slow-effekten modelleres ikke |
| Fireball | 133:1, 143:6, 145:12, 3140:18, 8400:24, 8401:30, 8402:36, 10148:42, 10149:48, 10150:54, 10151:60, 25306:60 | direkte skade + DoT fra spildata |
| Fire Blast | 2136:6, 2137:14, 2138:22, 8412:30, 8413:38, 10197:46, 10199:54 | instant, 8 s nedkøling og 1,5 s GCD fra spildata |
| Arcane Missiles | 5143/7268:8, 5144/7269:16, 5145/7270:24, 8416/8419:32, 8417/8418:40, 10211/10273:48, 10212/10274:56, 25345/25346:56-60 | kanaliseret driver; hvert tick udløser spildataens Arcane Missile. Ranken vælges efter missilets level |
| Shoot (wand) | 5019:1 | skud med wanden i ranged-pladsen; se nedenfor |
| Evocation | 12051:20 | kanaliseret 8 s på magen selv, 480 s nedkøling, 1,5 s GCD; se nedenfor |
| Ice Lance (talent) | 1312002:20, 400640:28, 1240044:34, 1240045:42, 1240046:48, 1240047:56 | kun med talentet; se «Frost-pakken» |
| Ice Barrier (talent) | 11426:40, 13031:46, 13032:52, 13033:58 | kun med talentet; se «Frost-pakken» |

**Shoot (5019)** ifølge spildataen: «Requires weapon: Wand», «Uses Ranged Slot», «Auto Repeat», Spell Type Magic,
effekt *Weapon Damage NoSchool* (17), 30 yards, 20 yards/s. Skaden er altså wandens våbenskade, som simc allerede
regner ud fra item-dataen (`item_damage_wand[ilvl][kvalitet]` × hastighed × (1 ± dmg_range/2), samme kode som
for andre våben). Modellen:

- Handlingen bruger `equipped_weapons[SLOT_RANGED]` og er **kun klar, når ranged-pladsen har en wand** med skade.
  Uden ranged-genstand eller med fx en bue/gevær er `shoot` aldrig klar; rotationen venter så som før (testet:
  ingen fejl, `Waiting` som uden wand).
- Hvert skud er én «cast» med wandens hastighed (uhastet); i spillet stopper auto-repeat, når magen kaster en
  anden spell, så APL'en vælger igen efter hvert skud og vender tilbage til Frostbolt, så snart manaen rækker.
  Shoot koster ikke mana, så femsekundsreglen (spirit-regen stopper i 5 s efter brugt mana) løber ud under skud.
- Spell-tabellen (hit/crit/crit-bonus) som de andre spells, fordi spildataen siger Spell Type Magic.
- **Skole:** «NoSchool» betyder, at skolen kommer fra wanden, men simcs item-data har ikke wandens skadesskole.
  Rapporten viser derfor spildataens skole (Physical). Rustning ignoreres for Shoot (wand-skade er magisk); en
  profil kan selv angive skolen med `weapon=wand_…_shadow` o.l. Det påvirker kun rapportens farve/skole, da
  simc-forever ikke modellerer modstand (resistance) pr. skole.

**Evocation (12051)** ifølge spildataen: effekt 1 *Modify Power Regen%* +1500 % (mana), effekt 2 *Allow Mana Regen
While Casting* 100 %, effekt 3 periodisk dummy hvert sekund; varighed 8 s, nedkøling 480 s, GCD 1,5 s, spell
level 20. Modellen kanaliserer 8 s på magen selv og lægger en buff med effekt 1 og 2 i samme periode; simcs
`parse_player_effects_t` (samme mekanisme som druidens Innervate) ganger spirit-regenerationen med 1 + 15 = 16 og
slår femsekundsreglen fra. Manaen kommer altså fra spillerens egen spirit-regen (simcs formel
`0,25 × min(spirit, 50) + 0,125 × (spirit − 50)`, som upstream selv markerer «verify»), ikke fra et opfundet tal.
Under level 20 findes Evocation ikke (ranken er ikke lært), og handlingen er aldrig klar.

**Manadrikke/manasten: ikke med.** simcs eneste mana-drik (`mana_potion` i `player/consumable.cpp`) bruger
retail-faste tal (1800 mana under level 68) og ikke spildata, og en Forever-manasten/-drik kræver egne
item-opslag og en delt nedkøling. Det er ikke enkelt at gøre rigtigt, så `default_potion` forbliver `disabled`.

Udeladt med vilje:

- **Talent-spells og -procs** ud over Frost-pakken (se «Talenter» og «Frost-pakken» nedenfor).
- **Fire Blast 400616-400623** (15 s nedkøling, ingen GCD) findes også i spildataen, men ser ud til at stamme fra en
  rune-/sæsonvariant; vi bruger trænerens Fire Blast (2136-familien).
- **Kanal-afbrydelse ved skade** (Evocation, «Channel Interrupt: Damage») modelleres ikke; magen tager ingen
  skade i Patchwerk/DungeonSlice.
- Ingen basis-konstanter for crit o.l.: modsat warlock/shaman/priest bruger mage `player_t`'s værdier fra spildata.
- Bog-ranks på level 60 (Frostbolt 25304, Fireball 25306, Arcane Missiles 25345) tages med som i warlock-modulet
  (25307), selvom de i spillet kræver en bog.

### Talenter

Appen sender armory-talenterne som `talents=` (se `lib/simc-talents.ts` i appen). `init_spells` kalder
`parse_all_passive_talents()` efter `parse_all_class_passives()`, præcis som warlock, priest, shaman, warrior, hunter og
druid. Simc registrerer så hvert valgt passivt talents aura-effekter direkte fra spildataen, med rankens værdi fra
talentkurven (`trait_definition_effect`): *Add Flat/Percent Modifier* på de berørte spells og spillerstats.

**Med nu (gratis via spildata):** Improved Frostbolt (−0,1-0,5 s cast), Ice Shards (+20-100 % crit-bonus på Frost),
Precision (+2/4/6 % spell-hit), Frost Channeling (−5/10/15 % mana på Frost-spells), Arcane Impact, Arcane Mind
(+Int % og crit-bonus på Arcane), Arcane Instability (+skade og crit), Arcane Meditation (mana-regen under cast),
Incineration, Accelerant (−cast Fireball), Critical Mass, Improved Fire Blast (−nedkøling), Improved Flamestrike og
Improved Cone of Cold (spells der ikke er i rotationen endnu). Utility-talenter (rækkevidde, rustning, pushback) parses
også, men påvirker ikke DPS.

**Wand Specialization (6057)** er i spildataen *Modify Damage Done%* for alle magiske skoler med kravet «Requires
weapon: Wand», som simc ikke ser: registreret ville den give Frostbolt og alle andre spells +25 %. Den afregistreres
derfor (`deregister_passive_spell`, samme mønster som priest-modulet) og lægges i stedet kun på Shoot (+13/25 %).

**Med via håndskrevet kode:** Frost-pakken (Ice Lance, Frostbite/frossent mål, Fingers of Frost, Shatter, Ice
Barrier); se næste afsnit.

**Mangler stadig (kræver håndskrevet kode):** talent-spells **Arcane Blast**, **Arcane Wrath**, **Pyroblast** og
Blast Wave (ingen handlinger); procs og tilstande Winter's Chill, Arcane Concentration/Clearcasting, Missile Barrage,
Heating Up, Ignite, Improved Scorch, Master of Elements, Fire Power; aktive buffs Arcane Power, Presence of Mind,
Combustion og Cold Snap; Arcane Subtlety (aura 123, uden for simcs passivliste).

**Målt før Frost-pakken** (ezzek, level 35 Frost: Wand Spec 2, Improved Frostbolt 5, Precision 2, Ice Shards 5, Frostbite 3, Frost
Channeling 1, Ice Lance, Ice Block, Shatter 3, Cold Snap, Fingers of Frost 2; samme indstillinger og seed 42 som
ovenfor): Patchwerk **35,3 → 44,1** DPS (+25 %), DungeonSlice **30,9 → 38,3** (+24 %). Uden `talents=` er tallene
uændrede (35,3 / 30,9). Alle 53 mage-talenter på én gang (level 60) kører uden fejl.

**Håndregnet mod spildata** (simc-log, samme profil):

- *Improved Frostbolt* rank 5: kurven giver −500 ms (`setting talent Improved Frostbolt … rank 5 … new=-500`);
  Frostbolt 8407 har 3000 ms → **2,5 s** (log: `schedules execute` 1,504 → `performs` 4,004).
- *Ice Shards* rank 5: +100 % crit-bonus på Frost → crit = 1 + 0,5 × 2 = **2,0 ×** hit: Frostbolt hit 156,1, crit
  **312,2**. Fire Blast (Fire) er uændret 1,5 ×: 176,7 / 265,1.
- *Precision* rank 2: +4 % hit; target level 38 giver 17 % miss → **13 %** (målt 12,99 % på Frostbolt).
- *Frost Channeling* rank 1: −5 % mana: Frostbolt 130 → **123,5**.
- *Wand Specialization* rank 2: Shoot 43,5 × 1,25 = **54,4** (målt 54,4; crit 81,6 = 1,5 ×).

Regression: warrior, shaman, warlock, priest og hunter fra guildens armory (med og uden `talents=`) giver
bit-for-bit samme DPS med den nye og den forrige mage-rettelse.

### Frost-pakken (håndskrevet; alle tal fra spildata, antagelser markeret)

Kun DPS-relevante Frost-talenter. Talenternes rank-værdier læses som `talent->effectN( n )`, som simc allerede har
overskrevet med talentkurvens værdi for den valgte rank (`player.cpp`, «talent effect overrides»).

- **Frossent mål («frozen»)**: debuff på målet = Frostbite 12494 (Root, 5 s, tooltip «Frozen»). Udløses kun af
  **Frostbite** (11071: «Gives your Chill effects a 5/10/15 % chance to Freeze the target»). Eneste Chill i modellen er
  Frostbolts effekt 1 (Decrease Movement Speed), og den lander kun ved hit, så rullet sker i Frostbolts `impact` ved
  hit/crit (ikke miss).
- **Fingers of Frost** (400647): effekt 2 = 15 % chance pr. Chill (fast), effekt 1 = antal ladninger (rank 1/2 →
  1/2). Buffen 400669 varer 15 s og får fulde ladninger ved proc. «Treats your next N spells cast as if the target
  were Frozen»: hver kastet skadesspell (Frostbolt, Ice Lance, Fire Blast, Fireball, Arcane Missiles-kanalen)
  bruger én ladning, også når målet allerede er frosset.
- **Frossen-tjek pr. cast**: afgøres ved `execute`, hvor simc ruller crit og beregner skaden: målet har «frozen»,
  eller Fingers of Frost er oppe. **Antagelse:** Shoot (wand, auto-repeat) og spells på magen selv er ikke omfattet
  og bruger ingen ladning; Arcane Missiles' enkelte missiler ser kun ægte frys.
- **Shatter** (11170): +17/33/50 % crit-chance for alle spells mod frosne mål (talentkurven; effekt 1 er «Dummy»).
- **Ice Lance** (talent; rank 1 = talentet, højere ranks kræver det, som paladinens Seal of Command): instant, 8 s
  nedkøling, 1,5 s GCD, effekt 2: **+300 %** skade mod frosne mål. Spildataen har **ingen spell power-koefficient**
  på skadeeffekten (alle seks ranks), så skaden er kun rankens niveau-skalerede basisværdi; vi opfinder ingen
  koefficient. Effekt 3 og 4 (Dummy 20 og 5) er ubeskrevne og bruges ikke.
- **Ice Barrier** (talent): effekt 2 (+5 % direkte Frost-skade, mens skjoldet holder) og, ifølge beskrivelsen,
  **Frigid Power** 1326891 (+15 % Frost-skade i 60 s) lægges som buffs og læses med `parse_effects` pr. handling
  (multiplikativt: × 1,05 × 1,15 = 1,2075). **Antagelse:** Frigid Power udløses af Ice Barrier (står kun i
  beskrivelsen, ikke som trigger-effekt). Absorberingen modelleres ikke; magen tager ingen skade, så skjoldet
  holder de 60 s.

**Udeladt med begrundelse:** Frost Nova (nærkamps-AoE på 10 yards, «damage may interrupt», bosser var klassisk immune;
ikke ligetil at gøre rigtigt), Winter's Chill og Improved Cone of Cold (gavner kun Cone of Cold, som ikke er i
rotationen), Cold Snap (600 s nedkøling; nulstiller kun Ice Lance/Ice Barrier, højst én gang pr. kamp), Arctic
Reach/Permafrost/Frost Warding/Ice Block (utility). **Icy Veins og Piercing Ice findes ikke** som talenter i
Forevers `trait_data.inc` (Piercing Ice 11151 findes kun som spell), så der er intet at modellere.
**Uafklaret:** om Forever-bosser kan fryses. Modellen lader Frostbite fryse alle fjender (også Patchwerk-målet);
Fingers of Frost virker uanset.

### Rotation (Frost, standard)

```
evocation,if=mana.pct<10   # lav mana og Evocation klar (480 s nedkøling: højst én gang i en kamp på 5 min.)
ice_barrier,if=!buff.ice_barrier.up                     # kun med talentet
ice_lance,if=buff.fingers_of_frost.up|debuff.frozen.up  # kun med talentet
fire_blast                 # på nedkøling, når manaen rækker
frostbolt                  # spam
fireball                   # kun før Frostbolt er lært (level 1-3)
shoot                      # wand, når der ikke er mana til nogen spell
```

Begrundelse og kilder (brugerens guides: Icy Veins «WoW Forever Mage/Frost Mage Leveling», Mobalytics' Frost-,
Fire- og Arcane Mage-guides, Skycoach' Mage-guide):

- **Frostbolt-spam med Fire Blast på nedkøling** er den simple Frost-leveling-rotation fra guiderne.
- **Ice Lance på Fingers of Frost eller frossent mål, Ice Barrier oppe hele tiden**: Warcraft Tavern (Forever Frost
  Mage, læst 12.11.2026: «Maintain … Ice Barrier at all times», «Use Ice Lance when Fingers of Frost procs», «Cast
  Frostbolt + Ice Lance when Frostbite triggers») og wowtbc.gg (Warcraft Forever Frost Mage: «Maintain Ice Barrier»,
  «Cast Ice Lance with Fingers of Frost procs», «Cast Frostbolt»). Icy Veins' og Mobalytics' Forever-sider gav 403;
  kun søgeuddrag (Icy Veins: Ice Lance sammen med næste Frostbolt ved sidste Fingers of Frost-ladning). Uden
  talenterne er de to linjer aldrig klar, så rotationen er uændret for andre opbygninger.
- **Begrænsning:** ved lav mana kaster magen Frostbolt (billigere), så snart manaen rækker, og når sjældent de 259+
  mana til at genkaste Ice Barrier (målt oppetid ca. 40 % i Patchwerk). Pooling af mana er ikke modelleret.
- **Evocation ved lav mana:** Icy Veins' Forever-guide beskriver Evocation som en 8 s kanal, der giver det meste af
  manaen tilbage. Tærsklen 10 % er **vores antagelse** (ikke et tal fra guiderne): lav nok til at Evocation næsten
  ikke spilder mana (mage 35: 228 + 2160 ≈ puljen på 2289), og høj nok til at den bruges, før magen står tør.
- **Wand når manaen er væk:** at skyde med wand i stedet for at stå stille (og lade spirit-regenerationen løbe,
  fordi Shoot ikke koster mana) er klassisk mage-leveling-praksis. Selve reglen «skyd kun, når der ikke er mana
  til en spell» er **vores forenkling**: en spiller ville typisk skyde, til manaen er et stykke oppe, og så kaste
  flere Frostbolts i træk (det spilder færre femsekundsvinduer). Den er ikke modelleret.
- Kilderne kunne ikke hentes maskinelt herfra (Icy Veins og Mobalytics svarer 403); rækkefølgen bygger derfor på
  søgeresuméer og almindelig classic-praksis. Arcane Missiles er implementeret som handling, men er ikke i
  standardrotationen (den kan ikke vælges via workeren, som ikke tillader `actions=`).

### Frost-pakken: målt og håndregnet (SIMC_REF 3c1d319 + alle tre rettelser, native bygning, 1000 iterationer, seed 42, threads=1)

Ezzek (armory 12.11.2026 via `getSimProfile` + `buildSimProfile`, level 35, samme 11 talenter som ovenfor) og en
konstrueret level 45-Frost (36 point: Imp. Frostbolt 5, Precision 3, Ice Shards 5, Frostbite 3, Frost Channeling 3,
Ice Lance, Shatter 3, Cold Snap, Fingers of Frost 2, Ice Barrier, Wand Spec 2, Ice Block, Imp. Frost Nova 2, Arctic
Reach 2, Permafrost 2). DPS før = forrige mage.patch, efter = denne.

| Profil | Patchwerk før → efter | DungeonSlice før → efter |
|---|---|---|
| ezzek 35 | 44,07 → **49,42** (+12 %) | 38,31 → **42,71** (+11 %) |
| ezzek uden `talents=` | 35,30 → 35,30 | 30,94 → 30,94 |
| Frost 45 | 58,62 → **68,19** | 50,92 → **58,71** |
| Frost 45 uden Ice Lance og Fingers of Frost | 58,62 → 61,80 | 50,92 → 53,19 |

Håndregning (ezzek, Patchwerk):

- **Ice Lance** rank 3 (1240044, level 34): 45 + 0,5 × (35 − 34) = 45,5 → simc 46 (log: `base=46 s_power=0`);
  frossen × (1 + 3,00) = **184**; crit × 2,0 (Ice Shards 5) = **368**; mana 70 × 0,95 = **66,5**. Alle Ice Lance-hits
  i 1000 iterationer er 184/368, dvs. altid frosne.
- **Shatter 3**: crit mod frosne = 8,79 % + 50 % = **58,8 %**; observeret Ice Lance 3,82 / 6,45 landede = **59,2 %**.
  Frostbolt-crit stiger fra 8,6 % til 14,3 % (de Frostbolts, der bruger en ladning eller rammer frossent mål).
- **Proc-rater** (forventet 15 % pr. landet Frostbolt for både Frostbite 3 og Fingers of Frost): 31,57 landede
  Frostbolts pr. kamp; Fingers of Frost 4,76 udløsninger = **15,1 %**, frozen 4,76 = **15,1 %** (DungeonSlice:
  15,1 % / 15,1 %). Fingers of Frost udløber ubrugt 0,56 gange pr. kamp (Ice Lance på nedkøling).
- **Ice Lance-skade**: 6,45 landede × (184 × 0,41 + 368 × 0,59) ≈ **1890** pr. kamp (simc 1889).
- **Ice Barrier** (Frost 45): Frostbolt 10179 263,09 → × 1,2075 = **317,69** (log), Ice Lance 81 × 4 × 1,2075 =
  **391,2** (log 391,23).
- **Log-tjek** (8 enkeltkørsler, Patchwerk/DungeonSlice, seed 42/1/2/3): 68 Ice Lance-casts, ingen uden Fingers of
  Frost eller frossent mål; alle 51 med Fingers of Frost brugte en ladning.

Regression (samme indstillinger, binær med forrige mod ny mage.patch): hunter-11, warrior-11, shaman-20, warlock-10,
warlock-25, paladin-39 (holy og ret), rogue-33, mage-20, mage-35, ezzek uden talenter og en level 45-mage med kun
passive Frost-talenter giver bit-for-bit samme DPS i Patchwerk og DungeonSlice. `check-upstream.sh` giver OK mod
3c1d319 og main (1b8e01d); de tre rettelser kan anvendes i alle seks rækkefølger.

### Målt og håndregnet (SIMC_REF 3c1d319, 1000 iterationer, seed 42)

Profiler fra guildens armory (fixtures med fiktive navne: `test/fixtures/mage-35.simc` med wand Gravestone Scepter
7001, `mage-20.simc` med wand Deepblaze 279896). Workerens indstillinger (threads=1, max_time=300 for Patchwerk,
vary_combat_length=0,2), imaget `aula-simc:patchtest`. Andele er tid af kampen; Evocation = kanalens 8 s.

| Profil | Stil | DPS før → efter | Venter | Skyder (wand) | Kaster (Frostbolt / Fire Blast / Evocation) |
|---|---|---|---|---|---|
| mage 35 | Patchwerk | 16,4 → **35,3** | 66 % → 0 % | 54 % | 39 % / 4 % / 2,7 % |
| mage 35 | DungeonSlice | 15,3 → **30,9** | 69 % → 12 % | 45 % | 33 % / 5 % / 2,3 % |
| mage 20 | Patchwerk | 8,9 → **20,4** | 66 % → 0 % | 59 % | 29 % / 9 % / 2,7 % |
| mage 20 | DungeonSlice | 8,3 → **17,6** | 68 % → 12 % | 48 % | 27 % / 9 % / 2,3 % |

I DungeonSlice er de 12 % «venter» bevægelse: Shoot og Frostbolt har cast-tid og kan ikke bruges i bevægelse.
Uden wand (ranged-linjen fjernet eller en bue/et gevær i stedet) giver mage 35 21,8 DPS og venter 54 % i Patchwerk:
Evocation alene løfter fra 16,4. Under level 20 (mage 14) er Evocation ikke lært, og kun wanden hjælper.

Håndregning for mage 35, Patchwerk (target level 38 → 17 % miss; crit 8,79 % × 1,5):

- **Frostbolt** rank 6 (8407, level 32): 134 + 1,7 × (35 − 32) = 139,1 (simc runder ned til 139) + 0,814 × 21
  frost-spellpower (11 generel + 10 frost fra udstyr) = **156,09** → simc-log: 156,094. Pr. cast: 156,09 × 0,83 ×
  (1 + 0,0879 × 0,5) = **135,3** (simc DPE 135); 3,0 s cast → **45,1 DPS** mens der er mana (simc DPET 45). 130 mana.
- **Fire Blast** rank 4 (8412, level 30): 163 + 1,8 × 5 + 0,429 × 11 = **176,72** → simc-log: 176,719. 165 mana, 8 s.
- **Shoot** (Gravestone Scepter: ilvl 29, kvalitet 3, 1,5 s, dmg_range 0,6): `item_damage_wand[29][3]` = 29,16832
  DPS × 1,5 = 43,75; min = ⌊43,75 × 0,7⌋ = 30, max = ⌊43,75 × 1,3 + 0,5⌋ = 57 → gennemsnit **43,5** (simc-log:
  «base=(30 to 57) total=43.5»; crit 65,25 = 43,5 × 1,5). Pr. skud: 43,5 × 0,83 × 1,044 = **37,7** (simc DPE 38);
  ÷ 1,5 s = **25,1 DPS** (simc DPET 25). Mage 20 (Deepblaze: ilvl 18, kvalitet 3, 1,7 s): 18,73638 × 1,7 = 31,85 →
  22-41 → **31,5** (simc 31,5).
- **Evocation:** spirit 85 → spirit-regen 0,25 × 50 + 0,125 × 35 = 16,875/s; × (1 + 15) = **270/s** (simc-log: +67,50
  mana pr. regen-tick på 0,25 s); 8 s → **2160 mana**, næsten hele puljen (2289).
- **Mana og skade:** 2289 i pulje + «Mana Regen» 4218 (inkl. Evocation) = 6507; brugt 39,1 × 130 + 8,0 × 165 = 6403.
  Skade: 39,1 × 135,3 + 8,0 × 153 + 107,5 × 37,7 = 5290 + 1224 + 4053 = 10567 over ca. 300 s → **35,2 DPS**
  (simc 35,3). Wanden står for 38 % af skaden; Frostbolt for 50 %.

Rimelighed: Shoot giver 25 DPS mod Frostbolts 45, så tallet afhænger nu meget af wanden. Wand-skaden er simcs
egen item-tabel for Forever (ikke kontrolleret mod spillet), og skolen er ukendt (se Shoot ovenfor). Magen drikker
ikke og bruger hverken manadrik eller manasten; i spillet ville de give mere mana og dermed flere Frostbolts.

Regression (samme seed og indstillinger, gammelt image `aula-simc:main` med den forrige mage.patch mod det nye):
hunter-11, warrior-11, shaman-20, warlock-10 og warlock-25 giver bit-for-bit samme DPS i Patchwerk og
DungeonSlice. Rettelsen rører kun de tre mage-filer.

## paladin

**Hvad:** Grov basismodel for Forever-paladin, Retribution, efter warrior-modulets nærkampsskabelon
(`warrior_melee_t`/`warrior_auto_attack_t`) og mage-rettelsens opbygning (`parse_player_effects_t`, `spell_ranks_t`,
`parse_all_passive_talents()`). Mana som primær ressource, auto-attack med våbnet i main hand, seals som buffs (én ad
gangen), Judgement, Holy Strike, Hammer of Wrath og Consecration. Holy og Protection er ikke modelleret: en Holy- eller
Prot-paladin (fx guildens level 39) kører samme rotation med Seal of Righteousness, fordi Seal of Command er et talent.

**Filer:** `engine/class_modules/sc_paladin.cpp` (modulet), `engine/class_modules/apl/paladin.cpp` (rotationen mellem
`//paladin_apl_start` og `//paladin_apl_end`), `engine/class_modules/apl/paladin.hpp` (erklæring af
`paladin_apl::paladin`). Rettelsen rører ingen af mage-rettelsens filer, så de to kan anvendes uafhængigt og i vilkårlig
rækkefølge (testet i `test/patches.test.mjs`).

**Upstream-tjek (`paladin.check`):** `sc_paladin.cpp` har flere end 150 linjer, `apl/paladin.cpp` indeholder
`add_action`, og `sc_paladin.cpp` indeholder ikke vores markør `AULA-RETTELSE`. Ved `SIMC_REF` 3c1d319 er
`sc_paladin.cpp` 52 linjer og APL'en tom (0 DPS); med rettelsen er modulet 656 linjer.

### Spells (fra spildata; afvigelser står under «Antagelser»)

Id'er og levels er slået op i `engine/dbc/generated/sc_spell_data.inc` og `SpellDataDump/paladin.txt` og kontrolleret med
`simc spell_query=spell.id=<id>`. Ranken vælges efter spillerens level med `find_rank()`.

| Spell | Ranks (id: level) | Spildata |
|---|---|---|
| Seal of Righteousness | 21084:1, 20287:10, 20288:18, 20289:26, 20290:34, 20291:42, 20292:50, 20293:58 | 30 s, mana og GCD 1,5 s; Judgement-spell 20187, 20280-20286 |
| Seal of Command (talent) | 20375:20, 20915:30, 20918:40, 20919:50, 20920:60 | proc 20424: *Weapon Damage%* 70 %, SP-koefficient 0,29, Holy; ICD 1 s; Judgement-spell 20467, 20963-20966 |
| Judgement | 20271:4 | 6 % base mana, 10 s nedkøling; «Unleash the energy of a Seal … **Does not consume the Seal**» |
| Holy Strike | 679:6, 678:12, 1866:20, 680:28, 2495:36, 5569:44, 10332:52, 10333:60 | *Normalized Weapon Damage* (flad værdi, SP 0,429) + *Weapon Damage%* 25-39 %, Holy, 10 s |
| Hammer of Wrath | 24275:44, 24274:52, 24239:60 | School Damage, SP 0,429, 1 s cast, 6 s nedkøling, kun mål med ≤ 20 % liv |
| Consecration | 26573:20, 20116:30, 20922:40, 20923:50, 20924:60 | 8 s, et tick pr. sekund; tick-skaden er 1280345-1280349 (effekt 1 til alle, effekt 2 til de første 4) |

Mekanik i modellen:

- **Én seal ad gangen:** at kaste en seal fjerner den anden. Seals reagerer kun på hvide slag (spildata: «Proc Flags:
  White Melee»), ikke på Holy Strike.
- **Judgement** koster sin egen mana, forbruger ikke seglet og giver skaden fra den aktive seals judgement-spell. Uden en
  seal er Judgement aldrig klar.
- **Seal of Command-proc** er et gult nærkampsslag (spildata: Spell Type Melee) med 70 % af våbenslaget (våben + AP) plus
  0,29 × spell power, Holy-skade (rustning gælder ikke). Højst ét proc pr. sekund (ICD fra spildata).
- **Judgement of Command** er *School Damage* med «Always Hit» og den halve skade (se nedenfor). **Judgement of
  Righteousness** er spildataens *School Damage* (s1 + 0,429 × SP).
- **Holy Strike** regnes af simcs fælles kode som (flad værdi + normaliseret våbenslag) × Weapon Damage% + 0,429 × SP. Den
  flade værdi ganges altså med procenten; beskrivelsen («$m2% weapon damage plus an additional $s1») kan også læses, så
  den lægges til bagefter (det giver ca. 12 skade mere pr. Holy Strike på level 39).
- **Hammer of Wrath** og **Consecration** som spildataen siger; Consecration-ticks antages at ramme alle mål med begge
  effekter (simulationerne har aldrig over 4 mål).
- **Angrebskraft:** classic-formlen for paladin (samme som warrior-modulet): 3 × level − 20 + 2 × styrke. Crit, hit og
  regen kommer fra simcs egne Forever-værdier; ingen egne basiskonstanter.

### Antagelser (står ikke entydigt i spildata)

- **Seal of Command: 7 procs pr. minut.** Spildataen siger «Proc Chance 100 %» og 1 s ICD, men beskrivelsen siger «a
  chance», og simc eksporterer ikke Blizzards PPM-tabel (`_rppm` er 0 for alle paladin-spells; Seal of Wisdom, Seal of
  Light og Omen of Clarity står også til 100 %). 100 % ville give 70 % ekstra våbenskade på hvert slag. Vi bruger 7 PPM
  (chance = 7 × våbnets hastighed ÷ 60, dvs. 39,7 % med et 3,4 s-våben), som er classic-værdien, og som Icy Veins'
  Forever-guide også angiver («you can expect about 7»). Druid-modulet gør det samme for Omen of Clarity (2 PPM).
  Konstanten `SEAL_OF_COMMAND_PPM` i `sc_paladin.cpp`.
- **Judgement of Command: halv skade.** Seal of Commands beskrivelse: «instantly causing $/2;20467s1 Holy damage, $20467s1
  if the target is stunned or incapacitated». Bosser er ikke bedøvede, så skaden halveres. Vi halverer hele beløbet
  (også spell power-delen); beskrivelsen siger kun noget om grundværdien.
- **Seal of Righteousness pr. slag.** Beskrivelsen: «an additional ${($s3/87+$<1h>)*$<mult>} to
  ${($s3/25+$<2h>)*$<mult>} Holy damage. Slower weapons cause more Holy damage per swing», med $1h = 0,0765 × SP,
  $2h = 0,12 × SP og $mult = 1 + Improved Seals. Vi bruger den nedre grænse for enhåndsvåben og den øvre for
  tohåndsvåben; afhængigheden af våbnets hastighed inden for hver gruppe kendes ikke og er ikke med. Kan ikke crit'e og
  kan ikke misse (ekstra skade på et slag, der allerede har ramt).
- **Hammer of Wrath** (Spell Type Ranged) bruger angrebstabellen uden dodge/parry.

### Talenter

`init_spells` kalder `parse_all_passive_talents()` efter `parse_all_class_passives()` som mage, warrior og de andre.

**Med nu (gratis via spildata):** Improved Seals (+3-15 % på Seal of Command-proc og Judgements), Conviction (+2-6 %
crit), Precision (+1-3 % hit), Benediction (−2-10 % mana på instant-spells), Improved Judgement (−1/2 s nedkøling på
Judgement), Divine Strength (+2-10 % styrke), Sacred Arbiter (+20 % Holy Strike), Champion of the Light (spell power af
Intellect, −cast på Hammer of Wrath), Holy Conduit, Divine Intellect, Divine Precision og de defensive/heal-talenter (de
parses, men påvirker ikke DPS).

**Håndskrevet:**
- **Two-Handed Weapon Specialization** (20111) er *Modify Damage Done%* med kravet «Requires weapon: Two-handed …», som
  simc ikke ser. Den afregistreres (som mage-rettelsens Wand Specialization) og lægges kun på Physical og Holy, når main
  hand er et tohåndsvåben (+2/4/6 %).
- **Vengeance** (20049 → buff 20050): efter et ikke-periodisk kritisk slag +1/2/3 % Physical og Holy pr. stak (talentets
  kurve), op til 5 stakke, 30 s (spildata). Consecration-ticks og Seal of Righteousness tæller ikke.
- **Sanctified Judgement** (1311074): ved Judgement 33/66/100 % chance for at få 20/40/60 % af den dømte seals
  manapris igen.
- **Seal of Command** (talent) låser Seal of Command-ranks op (`spell_ranks_t` med talentet som betingelse).

**Mangler:** **Unsealed Wrath** (31-point-talenten: gemmer seglet som stakke og udløser dem ved seal-skift; spildataen har
stakbuffen «Echo of …», men mekanikken er server-side og ikke beskrevet nok til at modellere), seal-twisting generelt
(Method skifter til Seal of Righteousness ved 3 stakke), **Seal of the Crusader** og **Judgement of the Crusader**
(åbningen), **Exorcism** (kun Undead/Demon), **Holy Shock** (Holy-talent, Methods alternative opbygning), Reckoning,
Vindication (debuff på målet), Repentance, auraer og blessings, Libram/Twist of Light, Improved Hammer of Wrath og
Retribution-sætbonusser. **Benediction på Judgement:** Judgements pris er en procent af base mana, og simcs passiv-parser
ændrer kun den faste pris; Judgement koster derfor de fulde 6 % (51 i stedet for 46 mana på level 39).

### Rotation (Retribution, standard)

```
auto_attack
seal_of_command,if=buff.seal_of_command.remains<1.5        # hold Seal of Command oppe (forny i sidste GCD)
seal_of_righteousness,if=!buff.seal_of_command.up&buff.seal_of_righteousness.remains<1.5
                                                           # kun når Seal of Command ikke er lært / ikke er råd til den
judgement                                                  # på nedkøling (forbruger ikke seglet)
hammer_of_wrath,if=target.health.pct<20                    # level 44+
holy_strike                                                # på nedkøling
consecration,if=active_enemies>1&mana.pct>50               # aldrig på ét mål
```

Kilder, læst 2026-11-12:

- **Method** (method.gg/wow-forever/class-guides/retribution-paladin/rotation-and-playstyle): **læst.** «Apply Seal Of
  Command and keep your seals active», «Judgement off cooldown», «Hammer Of Wrath when 20% and below», «Holy Strike off
  cooldown», Exorcism på Undead/Demon, seal-skift med Unsealed Wrath, «Consecration unless Mana is an issue». Vores
  rækkefølge er Methods.
- **Warcraft Tavern** (warcrafttavern.com/forever/guides/retribution-paladin): **læst** (beta, level 30-opbygning).
  Åbning med Seal of the Crusader + Judgement of the Crusader, derefter Seal of Command, Judgement og Holy Strike på
  nedkøling og Consecration opretholdt. Ingen PPM.
- **Mobalytics** (mobalytics.gg/wow-forever/classes/retribution-paladin-guide): **ikke læst** (HTTP 403).
- **Icy Veins** (Forever Retribution-rotation og stat-prioritet): **ikke læst** (403); kun søgeresuméet, som er kilden til
  «about 7» procs pr. minut for Seal of Command.
- **wowtbc.gg** (404) og **wowforever.be** (forsiden har kun nyhedsoverskrifter, ingen Ret-guide): **ikke brugt.**

Uenigheder og valg: Warcraft Tavern opretholder Consecration og åbner med Seal of the Crusader; Method bruger
Consecration «unless Mana is an issue» og nævner ikke Crusader. Opgaven og Method udelader Consecration på ét mål, så
den bruges kun mod flere fjender, og kun med over halv mana (**vores tærskel**, ingen kilde nævner et tal; i
DungeonSlice løb manaen ellers næsten tør). Åbningen med Seal of the Crusader er en **kendt udeladelse**. Der er ingen
egen mana-grænse på Judgement og Holy Strike: målt rækker manaen hele kampen (se nedenfor), og er den væk, sker der kun
auto-attack, indtil der er mana igen.

### Målt og håndregnet (SIMC_REF 3c1d319, 1000 iterationer, seed 42)

Profiler: `test/fixtures/paladin-39-holy.simc` (guildens level 39-paladin med fiktivt navn: Holy 22 / Protection 8,
Mograine's Might 7723 i main hand, ingen Seal of Command) og `paladin-39-ret.simc` (samme udstyr og level med en
konstrueret Ret-opbygning på 30 point, kodet med appens `encodeTalents`: Benediction 5, Improved Judgement 2, Conviction 3,
Seal of Command, Sacred Arbiter, Two-Handed Weapon Specialization 3, Vengeance 3, Sanctified Judgement 3, Improved Seals
5, Divine Strength 4). Workerens indstillinger (threads=1, max_time=300 for Patchwerk, vary_combat_length=0,2), lokalt
bygget simc (`make -C engine release`).

| Profil | Stil | DPS før → efter | Auto-attack | Seal-proc | Judgement | Holy Strike | Consecration |
|---|---|---|---|---|---|---|---|
| Ret 39 | Patchwerk | 0 → **104,3** | 48,9 | 20,9 (Command) | 19,6 | 14,2 | – |
| Ret 39 | DungeonSlice | 0 → **93,5** | 39,7 | 18,1 | 17,7 | 12,9 | 4,0 |
| Ret 39 uden `talents=` | Patchwerk | 0 → **68,1** | 38,4 | 9,7 (Righteousness) | 10,1 | 9,4 | – |
| Ret 39 uden `talents=` | DungeonSlice | 0 → **60,5** | 31,2 | 8,7 | 9,7 | 8,5 | 1,6 |
| Holy 39 (guildens) | Patchwerk | 0 → **73,3** | 39,6 | 11,6 (Righteousness) | 11,9 | 9,7 | – |
| Holy 39 (guildens) | DungeonSlice | 0 → **69,0** | 32,3 | 10,4 | 11,6 | 8,8 | 5,2 |

(Resten op til totalen er et trinket-proc.) Levels 1, 3, 12, 20, 50 og 60 med samme udstyr kører også uden fejl og med
de forventede ranks: kun Seal of Righteousness under level 4, Judgement fra 4, Holy Strike fra 6, Seal of Command fra
20 og Hammer of Wrath fra 44 (7 gange pr. kamp på level 50).

Håndregning for Ret 39, Patchwerk (simc-loggen i parentes; AP 335 = 307 egen + raid-buffs, AP-multiplikator 1,09 fra
raid-buffs, melee-crit 15,9 %, mål level 42):

- **Våben:** Mograine's Might (ilvl 44, kvalitet 3, tohånds-mace, 3,4 s): simc giver 105-159, gennemsnit 132.
- **Auto-attack:** 1,09 × 132 + 3,4 × 335 ÷ 14 = 143,88 + 81,36 = **225,24** (log: total=225.237) × 1,06 (2H-spec 3)
  = 238,75; rustning 2262 mod level 39: 2262 ÷ (2262 + 400 + 85 × 39) = 37,85 % → **148,4** (log: 148,396). Pr. slag
  med simcs udfald (69,8 % hit, 15,7 % crit, resten miss/dodge/parry): 148,4 × (0,698 + 2 × 0,157) = 150,2; ×
  gennemsnitlig Vengeance 1,115 (målt: gennemsnitligt hit 165,4 ÷ 148,4) × 87,7 slag ÷ 300 s = **49,0 DPS** (simc 48,9).
- **Seal of Command:** chance 7 × 3,4 ÷ 60 = **39,7 %** pr. ramt hvidt slag; 75,0 ramte slag → **29,8 procs** (simc
  29,8). Skade 225,24 × 0,70 × 1,15 (Improved Seals 5) × 1,06 = **192,19** (log: 192,195; crit 384,4). Pr. proc med
  udfald og Vengeance: 192,19 × (21,5 + 2 × 3,9) ÷ 29,8 × 1,115 = 210,7 → 29,8 × 210,7 ÷ 300 = **20,9 DPS** (simc 20,9).
- **Judgement of Command** rank 2 (20963, level 30-38): 153 + 6,1 × 8 = 201,8 → 202 × 0,5 × 1,15 × 1,06 = **123,12**
  (log: 123,119). Nedkøling 10 − 2 (Improved Judgement 2) = 8 s → højst 37,5 pr. 300 s (simc 36,9). Med crit og
  Vengeance: 123,12 × 1,165 × 1,115 × 36,9 ÷ 300 = **19,7 DPS** (simc 19,6).
- **Holy Strike** rank 5 (2495, level 36): flad 31 + 1 × 3 = 34; normaliseret våbenslag 143,88 + 3,3 × 335 ÷ 14 =
  222,84; (222,84 + 34) × 0,39 = 100,17 × 1,20 (Sacred Arbiter) × 1,06 = **127,42** (log: 127,415). 10 s → 30,4
  slag; med udfald og Vengeance 127,42 × 0,987 × 1,115 × 30,4 ÷ 300 = **14,2 DPS** (simc 14,2).
- **I alt** 49,0 + 20,9 + 19,7 + 14,2 + 0,7 (trinket) = 104,5 (simc 104,3).
- **Mana:** pulje 1895 + regen 924 + Sanctified Judgement 2193 = 5012; brugt 36,9 × 51 (Judgement, 6 % af base mana
  850) + 30,4 × 14,4 (Holy Strike 16 − 10 % Benediction) + 10,7 × 99 (Seal of Command 110 − 10 %) = 1882 + 438 + 1059 =
  **3379** (simc 3382) → 1630 tilbage ved kampens slut (simc 1629). Manaen er aldrig en begrænsning i Patchwerk; spirit-
  regen er 0,25 × 50 + 0,125 × 55 = 19,4/s (log: 4,84 pr. 0,25 s) uden for femsekundsreglen. I DungeonSlice ender den
  på 806 (Consecration med halv-mana-grænsen).
- **Seal of Righteousness** (Holy 39, rank 5 20290, level 34-40): s3 = 785 + 37 × 5 = 970 ÷ 25 = 38,8 → 39 × 1,15
  (Improved Seals) = **44,85** pr. ramt slag (log: 44,85; simc gennemsnit 44,9). Judgement of Righteousness 20283: 98 ×
  1,15 = **112,7** (log: 112,7).

Rimelighed: med samme udstyr giver Seal of Command 192 × 39,7 % ≈ 76 pr. slag mod Seal of Righteousness' 45, og
Ret-talenterne løfter fra 68 til 104 DPS (+53 %). Tallene afhænger meget af PPM-antagelsen (Seal of Command er 20 % af
skaden) og af simcs angrebstabel for Forever (der forekom ingen glancing blows i kørslerne; de 14,5 % miss/dodge/parry er
simcs egne værdier mod et mål tre levels over).

Regression (samme seed og indstillinger, binær med kun mage.patch mod binær med mage.patch + paladin.patch):
hunter-11, warrior-11, shaman-20, warlock-10, mage-20 og mage-35 giver bit-for-bit samme DPS i Patchwerk og
DungeonSlice. Rettelsen rører kun de tre paladin-filer.

## rogue

**Hvad:** Grov basismodel for Forever-rogue med en Assassination-rotation, efter samme skabelon som mage (warlock-
og warrior-modulerne for rank-valg og auto-attack): energi som primær ressource og combo points, `init_spells` med
`spell_ranks_t` (rank efter spillerens level), `create_action`, `init_action_list`, `init_base_stats`. Rogue arver fra
`parse_player_effects_t` (som mage), så Slice and Dice, Blade Flurry og Adrenaline Rush virker direkte fra spildataen.
Talenternes passive effekter læses med `parse_all_passive_talents()`; et udvalg af proc-/buff-talenter er håndkodet.

**Filer:** `engine/class_modules/sc_rogue.cpp` (modulet), `engine/class_modules/apl/rogue.cpp` (rotationen mellem
`//rogue_apl_start` og `//rogue_apl_end`), `engine/class_modules/apl/rogue.hpp` (erklæring af `rogue_apl::rogue`).
`rogue.patch` rører ingen af mage-filerne, så de to rettelser er uafhængige og kan anvendes i vilkårlig rækkefølge
(testet i `test/patches.test.mjs`).

**Upstream-tjek (`rogue.check`):** `sc_rogue.cpp` har flere end 150 linjer, `apl/rogue.cpp` indeholder `add_action`,
og `sc_rogue.cpp` indeholder ikke `AULA-RETTELSE`. Ved `SIMC_REF` 3c1d319 (og simc-forever `main` 1b8e01d,
2026-11-12) er `sc_rogue.cpp` 42 linjer og APL'en tom; med rettelsen er modulet 906 linjer.

### Ressourcer

- **Energi:** engine-generisk fra `power_type_data.inc` (Energy: maks. 100, regen 10/s, start 100); intet i modulet.
  Vigor (+10 pr. rank) virker via passiv-parseren (målt: 110 med rank 2).
- **Combo points:** `power_type_data` (maks. 5, aktiv for rogue). Builders får dem fra spildataens *Energize Power
  (combo_points)*-effekt, som simc selv giver ved hit. Finishers kræver mindst 1, bruger alle og trækker dem først ved
  hit (et miss/dodge beholder dem). Combo points ligger på spilleren, ikke på målet (ét mål).
- **«Discount Power On Miss»** (attribut 59 på næsten alle rogue-angreb): ved miss/dodge/parry betales 20 % af energien
  (samme 80 %-refusion som warrior-modulet bruger for rage).

### Spells (alle tal fra spildata; id: spell level)

| Spell | Ranks | Bemærkning |
|---|---|---|
| Auto-attack | – | hovedhånd + off-hand (to `repeating` slag; off-hand kun med våben i off-hand). Simcs egen OH-straf 0,5 |
| Sinister Strike | 1752:1, 1757:6, 1758:14, 1759:22, 1760:30, 8621:38, 11293:46, 11294:54 | builder: normaliseret våbenskade + fast bonus, 1 CP, 45 energi |
| Mutilate | 399956:40, 1241582:50, 1241584:60 | **talent** (Forever har ikke Mutilate hos træneren). Driveren giver 2 CP; effekt 2/3 udløser hovedhånds- og off-hand-slaget ((normaliseret våbenskade + 44) × 90 %); +20 % mod mål med Deadly Poison (effekt 4). Kræver dolk i hovedhånden, ellers aldrig klar. Ét hit-slag for hele angrebet, crit pr. hånd |
| Shank | 1329283:24, 1329549:44 | off-hand-slag 50 % våbenskade, +15/25 energi (Flash of Steel via spildata), 10 s nedkøling, «cannot miss» (kan dodges) |
| Ambush | 8676:18, 8724:26, 8725:34, 11267:42, 11268:50, 11269:58 | åbning fra Stealth (kun før kampen), kræver dolk |
| Garrote | 703:14, 8631:22, 8632:30, 8633:38, 11289:46, 11290:54 | åbning fra Stealth (kun før kampen) uden dolk; bleed 18 s, 1 CP |
| Eviscerate | 2098:1, 6760:8, 6761:16, 6762:24, 8623:32, 8624:40, 11299:48, 11300:56, 31016:60 | grundværdi + «Points Per Combo Point» × CP |
| Slice and Dice | 5171:10, 6774:42 | +20 % / +30 % auto-attack-hastighed (aura 319); varighed se nedenfor |
| Rupture | 1943:20, 8639:28, 8640:36, 11273:44, 11274:52, 11275:60 | bleed, tick hvert 2. s = grundværdi + «Points Per Combo Point» × CP; varighed se nedenfor |
| Instant Poison | 8679/8680:20, 8686/8685:28, 8688/8689:36, 11338/11335:44, 11339/11336:52, 11340/11337:60 | belægning (proc 20 %) / Nature-skade |
| Deadly Poison | 2823/2818:30, 2824/2819:38, 11355/11353:46, 11356/11354:54, 25351/25349:60 | belægning (proc 30 %) / Nature-DoT 12 s, tick hvert 3. s, op til 5 stakke |
| Cold Blood, Adrenaline Rush, Blade Flurry | talent-spells (14177, 13750, 13877) | kun klar med talentet |

**Varighed pr. combo point** står ikke som tal i spildataen, kun i spillets beskrivelse: Slice and Dice «1 point: 9 s …
5 points: 21 s» = spildataens 6 s + 3 s pr. CP, alt × (1 + Improved Slice and Dice); Rupture «8 … 16 secs» = 6 s + 2 s
pr. CP (+ Blood Splatter via spildata). Improved Slice and Dice er allerede lagt på grundvarigheden af passiv-parseren;
modulet ganger kun de 3 s pr. CP med samme faktor (målt: 5 CP, rank 3 → 21 × 1,45 = 30,45 s).

**Gifte:** spildataens belægninger har proc-chance (Instant 20 %, Deadly 30 %, Improved Poisons lægges på af
passiv-parseren). Modellen antager, at rogue'en altid har gift på: Instant Poison i hovedhånden og Deadly Poison i
off-hand, når den er lært (level 30; wowtbc.gg: «Instant Poison on main-hand and Deadly Poison on off-hand»), ellers
Instant i begge. Under level 20 (klassequesten) ingen gift. Gift udløses kun af våbenslag, der rammer (auto-attack,
Sinister Strike, Mutilate, Shank, Ambush), ikke af finishers. Giftene bruger spell-tabellen (Nature, Spell Type Magic)
og kan crit'e (×1,5; Malice nævner gift). **Ikke med:** antal ladninger (60-250 pr. belægning, rækker til en kamp på
5 min.), belægningens varighed, Crippling/Mind-numbing/Wound Poison, og armory-profilen kan ikke se, om spilleren
faktisk har gift på.

**Åbning:** simc kan ikke modellere Stealth som tilstand; i stedet er Ambush (dolk) og Garrote kun klar, før
kampen er startet (som warriorens Charge). Det giver præcis én åbning pr. kamp. Vanish/genåbning, Cheap Shot og
Premeditation er ikke med.

Udeladt med vilje:

- **Envenom** (399968/399963) findes i spildataen, men kun som «Gain the Envenom ability»-override fra en
  rune-/sæsonvariant (samme slags som magens Fire Blast 400616); den er ikke et Forever-talent eller en trænerspell.
- **Expose Armor, Kidney Shot, Riposte, Ghostly Strike, Hemorrhage, Backstab, Death Mark:** ikke modelleret.
- **Ingen AP-skalering på finishers:** beskrivelserne siger «increased by Attack Power», men Eviscerate, Rupture og
  Garrote har ingen AP-koefficient i spildataen. Vi opfinder ingen; finishers kan derfor være undervurderet ved højt
  AP. (Spildataen har «SP Coefficient: 1» på flere fysiske effekter; det bruges som i warrior-modulet, men rogues
  har normalt 0 spell power.)
- **Basis-AP er klassiske konstanter** (ikke spildata), som i hunter-/shaman-modulet: AP = 2 × level − 20 + Str + Agi.
- **Dual wield-miss-straffen** (klassisk +19 % miss på hvide slag) findes ikke i simc-forevers engine for nogen
  klasse; ikke tilføjet. Glancing blows giver engine kun mod mål > 3 level over (Patchwerk er +3: ingen glancing).
  Begge dele gør auto-attack optimistisk.
- **Off-hand-straffen 0,5** lægger engine på alle off-hand-angreb (også Shank og Mutilates off-hand-slag). Om Forever
  halverer «50 % weapon damage» på Shank én gang til, er ikke afklaret.

### Talenter

Appen sender armory-talenterne som `talents=`. `init_spells` kalder `parse_all_passive_talents()` efter
`parse_all_class_passives()`, som mage, warlock m.fl.

**Med via spildata (passiv-parseren):** Malice (crit), Precision (hit), Weapon Expertise (expertise), Lethality
(crit-bonus), Aggression og Coup de Grace (skade), Improved Slice and Dice (varighed), Efficient Strikes og Flawless
Execution (energipris), Vile Poisons (giftskade), Improved Poisons (gift-chance), Flash of Steel (Shank-energi og
-nedkøling), Blood Splatter, Vigor. Utility (Endurance, Improved Sprint, Lightning
Reflexes, Composure m.fl.) parses også, men påvirker ikke DPS.

**Håndkodet (spildata-værdier, egen mekanik):**

- **Seal Fate:** crit med en combo point-builder (Sinister Strike, Mutilate-slag, Ambush) giver +1 CP med
  rankens chance (33/66/100 %), 0,5 s intern nedkøling fra spildataen (så Mutilate højst giver én ekstra).
- **Relentless Strikes:** finishers giver 25 energi (14181) med chancen rank-værdi × CP (rank 5: 20 % × 5 = 100 %).
- **Cold Blood:** +100 % crit på næste Sinister Strike/Mutilate/Ambush/Eviscerate (begge Mutilate-slag deler den).
- **Venom:** Shank giver 6 s buff (1310703): +30 % giftskade og +20 % gift-chance.
- **Dual Wield Specialization** (aura 122, uden for simcs passivliste): off-hand-skade +25/50 %.
- **Hack and Slash, dolk/næve-delen:** +1-5 % crit med angreb fra et sådant våben.
- **Adrenaline Rush** (+100 % energi-regen 15 s) og **Blade Flurry** (+20 % attack speed 15 s; ekstra mål ignoreres):
  aktive talent-spells, brugt på nedkøling. Mutilate (se Spells).

**Mangler:** Ruthlessness (CP fra finishers), Hack and Slash' økse/sværd- (ekstra slag) og stav-/kølle-del
(rustningsgennembrud), Puncturing Wounds, Opportunity, Initiative, Premeditation, Boot Knife, Setup, Remorseless
Attacks, Improved Kidney Shot, Death Mark, Riposte, Preparation, Hemorrhage og Ghostly Strike. Rotationen vælger ikke
efter talenter, ud over at talent-handlinger kun er klar med talentet.

### Rotation (Assassination)

```
ambush                      # åbning fra Stealth, kun før kampen, dolk i hovedhånden
garrote                     # åbning fra Stealth, kun før kampen (uden dolk)
auto_attack
slice_and_dice,if=buff.slice_and_dice.remains<1&combo_points>=2
adrenaline_rush             # talent, på nedkøling
blade_flurry                # talent, på nedkøling
rupture,if=!ticking&combo_points>=5
cold_blood,if=combo_points>=5&(buff.slice_and_dice.remains>2|!learned.slice_and_dice)
eviscerate,if=combo_points>=5&(buff.slice_and_dice.remains>2|!learned.slice_and_dice)
shank,if=energy<70
mutilate,if=combo_points<=3
sinister_strike,if=combo_points<5
```

`learned.<evne>` er et rogue-udtryk (er evnen lært på spillerens level), så Eviscerate også bruges før level 10.
Levelafhængigheden ligger i rank-valget: uden lært rank er handlingen aldrig klar.

Kilder, som faktisk kunne læses (2026-11-12): **Warcraft Tavern** «Forever Assassination Rogue Guide» og «Rogue
Leveling Guide», **wowtbc.gg** «Assassination Rogue PvE Guide – WoW Forever». **Icy Veins** og **Mobalytics** svarer 403
og er kun set som søgeresuméer. Uenigheder og vores antagelser:

- *Slice and Dice først* er fælles for alle kilder. Tærsklen «mindst 2 CP» er **vores antagelse** (Warcraft Tavern:
  «ASAP at 5 Combo Points» på bosser; wowtbc.gg: «keep it active at all times»). Målt på basil (Patchwerk,
  1000 iterationer) giver tærskler fra 1 til 5 CP det samme inden for ±0,2 %.
- *Rupture:* opgaven ønsker den oppe; Warcraft Tavern skriver «As Assassination, you won't bother with Rupture since you
  won't have enough Energy», og wowtbc.gg nævner den ikke. Den er med, men simuleringen giver tavernen ret på lave
  level (se målingerne): energien rækker kun til Slice and Dice. Med eller uden Rupture: samme DPS inden for 0,1 %.
- *Mutilate til 3 CP, Sinister Strike som sidste point* (Warcraft Tavern: «Don't use Mutilate at 4 Combo Points»).
- *Shank under 70 energi* (wowtbc.gg). Warcraft Tavern nævner Shank som energi og Venom-udløser.
- *Cold Blood med Eviscerate ved 5 CP* (wowtbc.gg); Warcraft Tavern foreslår Ambush/Mutilate.
- *Åbning:* Warcraft Tavern Ambush, wowtbc.gg Garrote i Stealth; vi bruger Ambush med dolk, ellers Garrote.
- *Expose Armor og Venom-finisher* (Warcraft Tavern, boss) er ikke med.

### Målt og håndregnet (SIMC_REF 3c1d319 + mage.patch + rogue.patch, native bygning, 1000 iterationer, seed 42)

Profil fra guildens armory hentet med appens egen kode (`getSimProfile` + `buildSimProfile`, sanering som workeren):
basil (level 33, gnome, **Combat** med 24 point, dolk i begge hænder: Bite of Serra'kis 6904 / Claw of the
Shadowmancer 2912); fixture med fiktivt navn: `test/fixtures/rogue-33.simc`. Workerens indstillinger (threads=1,
max_time=300 for Patchwerk, vary_combat_length=0,2). Før rettelsen: 0 DPS (tom stub).

| Profil | Stil | DPS | Venter | Slice and Dice oppe | Rupture oppe |
|---|---|---|---|---|---|
| basil 33 med talenter | Patchwerk | **92,7** | 56 % | 97,3 % | 0 % |
| basil 33 med talenter | DungeonSlice | **77,2** | 60 % | 95,8 % | 0 % |
| basil 33 uden `talents=` | Patchwerk | 73,7 | 58 % | 97,4 % | 0 % |
| basil 33 uden `talents=` | DungeonSlice | 61,9 | 62 % | 94,5 % | 0 % |
| syntetisk Assassination 45* | Patchwerk | 134,6 | 52 % | 93,9 % | 51,8 % |
| syntetisk Assassination 45* | DungeonSlice | 112,3 | 57 % | 93,3 % | 37,1 % |

\* basils udstyr på level 45 med `class_talents=` Malice 5, Ruthlessness 3, Improved Slice and Dice 3, Lethality 2,
Vile Poisons 5, Cold Blood, Improved Poisons 5, Relentless Strikes 5, Venom, Seal Fate 3, Mutilate, Vigor 2 (kun lokal
test af Mutilate/Seal Fate/Relentless/Venom-koden; ingen guild-rogue er Assassination). Venom oppe 59,5 %.

basil, Patchwerk, skadesfordeling: hovedhånd 36,7 %, off-hand 29,6 %, Sinister Strike 17,6 %, Deadly Poison 8,5 %,
Instant Poison 4,6 %, Shank 2,4 %, Ambush 0,7 %. Talenterne (Dual Wield Specialization 2, Aggression 3, Precision 3,
Coup de Grace 3, Blade Flurry, Hack and Slash 1, Efficient Strikes 2 m.fl.) giver +26 %.

Håndregning (basil, Patchwerk; mål level 36, rustning 1494):

- **AP:** 2 × 33 − 20 + Str 75 + Agi 123 + 10 fra udstyr = 254; × 1,09 (engine's Battle Shout) = **277** (simc-log 277).
  Rustning: 1494 / (1494 + 400 + 85 × 33) = 31,8 % → × 0,682.
- **Hit-tabel (hvide og gule):** miss 5 % + 3 × 1 % − 3 % Precision = **5 %** (målt 4,95 %); dodge 5 % + 3 × 0,5 % − 1 %
  Weapon Expertise = **5,5 %** (målt 5,4 %); crit 13,54 % + 1 % Hack and Slash (dolk) = **14,5 %** (målt 14,56 %).
- **Hovedhånd** (16-30, 1,3 s): 23 × 1,09 + 1,3 × 277 / 14 = 25,07 + 25,72 = **50,79** (simc-log 50,79) × 0,682 =
  **34,6** pr. hit (simc 35), × (0,75 + 0,145 × 2) = 36,0 pr. sving (simc DPE 36). Sving pr. s: 1 / 1,3 × (1 + 0,2 ×
  0,973 SnD) × (1 + 0,2 × 0,147 Blade Flurry) = 0,946 → **34,0 DPS** (simc 34).
- **Off-hand** (27-51, 1,9 s): 39 × 1,09 + 1,9 × 277 / 14 = 80,10 × 0,5 (OH) × 1,5 (Dual Wield Spec. 2) = 60,08 ×
  0,682 = **41,0** pr. hit (simc 41), 42,6 pr. sving (simc 43); 0,647 sving/s → **27,6 DPS** (simc 27). Auto-attack i alt
  ca. **61,6 DPS** af 92,7.
- **Sinister Strike** rank 5 (1760, level 30): normaliseret dolk 1,7 s: 25,07 + 1,7 × 277 / 14 = 58,71 + 22 = 80,71 ×
  1,15 (Aggression 3) × 0,682 = **63,3** (simc 63); crit × 2 = 126,6 (simc 127).
- **Eviscerate** rank 5 (8623) ved 5 CP: 30 + 45 × 5 = 255 × 1,15 (Aggression) × 1,20 (Coup de Grace 3) × 0,682 =
  **240** (simc 240 i en kørsel med SnD først ved 5 CP). Syntetisk level 45, rank 6 (8624): 44 + 71 × 5 = **399** før
  multiplikatorer (simc-log 399).
- **Mutilate** rank 1 (syntetisk level 45, AP 344): hovedhånd (66,84 + 44) × 0,9 = **99,76**, off-hand (84,28 + 44) ×
  0,9 × 0,5 = **57,73** før rustning og +20 % mod forgiftet mål (simc-log 99,757 / 57,727).
- **Rupture** rank 2 (8639) ved 5 CP: 7 + 1,78 × 5 = **15,9** pr. tick (simc 16, ingen rustning), 8 tick over 16 s.
- **Energiregnskab:** 10/s × 300 s = 3000 + Shank 30 × 0,944 (dodge) × 15 = 425 + start 100 = 3525. Brugt: Sinister
  Strike 40 (45 − 5 Efficient Strikes) og 8 ved miss/dodge → 36,6 i snit × 75,2 = 2752; Slice and Dice 18,6 × 25 = 465;
  Shank 150; Ambush 60 → 3427 (resten tabt ved fuld energi før kampen). Altså **ca. én builder pr. 4 s**, og
  **3,7 builders pr. finisher** (68,5 CP / 18,6 Slice and Dice). At bygge 5 CP tager ca. 5 / 0,895 × 36,6 / 11,4 ≈ 18 s,
  mens Slice and Dice ved 2-4 CP holder 12-18 s; derfor når basil aldrig 5 CP med Slice and Dice oppe, og Rupture og
  Eviscerate bruges ikke (målt: 0,0 pr. kamp). På level 45 med Relentless Strikes, Seal Fate og Mutilate holdes
  Rupture oppe 52 %.

Rimelighed: 56 % «venter» er energi-ventetid, som er normal for en classic-rogue. Auto-attack står for to tredjedele
af skaden, så tallet afhænger meget af engine-forhold, vi ikke har ændret (ingen dual wield-miss-straf, ingen
glancing ved +3 level, Battle Shout som +9 % AP-multiplikator).

Regression (samme seed og indstillinger, binær med kun mage.patch mod binær med mage.patch + rogue.patch):
hunter-11, warrior-11, shaman-20, warlock-10, warlock-25, mage-20 og mage-35 giver bit-for-bit samme DPS i Patchwerk
og DungeonSlice. Rettelsen rører kun de tre rogue-filer.

Docker: imaget bygget fra `../Dockerfile` (`aula-simc:roguetest`, PATCHES_APPLIED: `mage applied`, `rogue applied`) giver
for `test/fixtures/rogue-33.simc` samme DPS som den native bygning (92,73 / 77,22).
