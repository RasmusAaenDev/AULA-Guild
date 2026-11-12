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
APL'en tom; med rettelsen er modulet 343 linjer.

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

- **Talent-spells og -procs** (se «Talenter» nedenfor): kun de passive talenter virker.
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

**Mangler stadig (kræver håndskrevet kode):** talent-spells **Ice Lance**, **Arcane Blast**, **Arcane Wrath**,
**Pyroblast** og Blast Wave (ingen handlinger); procs og tilstande **Fingers of Frost**, **Shatter**, **Frostbite**
(frossent mål), Winter's Chill, Arcane Concentration/Clearcasting, Missile Barrage, Heating Up, Ignite, Improved
Scorch, Master of Elements, Fire Power; aktive buffs Arcane Power, Presence of Mind, Combustion, Ice Barrier og Cold
Snap; Arcane Subtlety (aura 123, uden for simcs passivliste). Rotationen vælger stadig ikke efter talenter.

**Målt** (ezzek, level 35 Frost: Wand Spec 2, Improved Frostbolt 5, Precision 2, Ice Shards 5, Frostbite 3, Frost
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

### Rotation (Frost, standard)

```
evocation,if=mana.pct<10   # lav mana og Evocation klar (480 s nedkøling: højst én gang i en kamp på 5 min.)
fire_blast                 # på nedkøling, når manaen rækker
frostbolt                  # spam
fireball                   # kun før Frostbolt er lært (level 1-3)
shoot                      # wand, når der ikke er mana til nogen spell
```

Begrundelse og kilder (brugerens guides: Icy Veins «WoW Forever Mage/Frost Mage Leveling», Mobalytics' Frost-,
Fire- og Arcane Mage-guides, Skycoach' Mage-guide):

- **Frostbolt-spam med Fire Blast på nedkøling** er den simple Frost-leveling-rotation fra guiderne; Ice Lance og
  Fingers of Frost er talenter, der kræver egen kode, og udelades (se «Talenter»).
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
