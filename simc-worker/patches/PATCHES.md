# Aulas rettelser oven på simc-forever

simc-forever (SimulationCraft til WoW Forever) mangler endnu nogle klasser: modulet findes, men er en tom skal uden
spells og uden rotation, så simulationen giver 0 DPS (mage, paladin, rogue). For andre klasser har upstream en
grundmodel med fejl eller store huller (druid, priest, warlock, shaman; se `docs/superpowers/notes/2026-11-12-simc-audit-pr-klasse.md`).
Indtil upstream selv retter dem, lægger vi en rettelse (patch) pr. klasse oven på den fastlåste `SIMC_REF` i
`../Dockerfile`.

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
| `contains_re <fil> <ERE>` | en linje i filen matcher det udvidede regulære udtryk (`grep -E`, resten af linjen) |
| `not_contains_re <fil> <ERE>` | filen findes ikke, eller ingen linje matcher udtrykket |
| `has_action <fil> <navn>` | klassemodulet opretter handlingen `<navn>`: en linje med `name == "<navn>"` (simcs `create_action`); navnet er `a-z`, `0-9`, `_` |

Et ugyldigt regulært udtryk eller handlingsnavn giver exit 2 (aldrig «findes ikke»).

**Tomme klasser (mage, paladin, rogue):** heuristikken er bevidst simpel (`min_lines` + `contains add_action` +
`not_contains AULA-RETTELSE`). Har upstream kun delvist implementeret klassen (fx flere linjer, men ingen
rotation), holder betingelserne ikke, rettelsen passer heller ikke, og bygget stopper som en konflikt. Det er
meningen: så skal et menneske se på, om vores eller upstreams version skal bruges. Paladin og rogue tester
desuden på de spec-dele, rettelsen har (paladin: `holy_shock`, `holy_shield`; rogue: `backstab`, `hemorrhage`,
`ghostly_strike`), så en upstream-grundmodel uden Holy/Protection hhv. Combat/Subtlety ikke får vores rettelse
droppet (testet i `test/patches.test.mjs`).

**Klasser upstream allerede har en grundmodel af (druid, priest, warlock, shaman):** her holder
linjeantal og `add_action` fra dag ét, så den heuristik ville droppe rettelsen med det samme. `.check` skal i stedet
liste præcis det, rettelsen tilføjer, som konkrete spells/handlinger eller kodestumper, fx
`has_action engine/class_modules/sc_priest.cpp shoot`. Rettelsen droppes kun, når upstream har **alle** dele. Har
upstream kun nogle af dem, passer rettelsen typisk ikke længere (konflikt), og et menneske må flette. Alle
betingelser skal være falske på den rene upstream-kilde ved `SIMC_REF` (testet i `test/patches.test.mjs`).

En rettelse i ren upstream-stil (uden `AULA-RETTELSE`-markør, fx druid, der også er foreslået upstream) kan ikke
skelnes fra upstreams egen kode, når den er anvendt: kører man `apply.sh` igen på en arbejdskopi, hvor den allerede
er anvendt, melder den `DROP`. I Docker-bygget er kilden altid ren, så det sker ikke dér.

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
APL'en tom; med rettelsen er modulet 1092 linjer.

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
| Ice Lance (talent) | 1312002:20, 400640:28, 1240044:34, 1240045:42, 1240046:48, 1240047:56 | kun med talentet; spell power-koefficienten er en **antagelse** (Frostbolts); se «Frost-pakken» |
| Ice Barrier (talent) | 11426:40, 13031:46, 13032:52, 13033:58 | kun med talentet; se «Frost-pakken» |
| Scorch | 2948:22, 8444:28, 8445:34, 8446:40, 10205:46, 10206:52, 10207:58 | 1,5 s cast; se «Fire-pakken» |
| Pyroblast (talent) | 11366:20, 12505:24, 12522:30, 12523:36, 12524:42, 12525:48, 12526:54, 18809:60 | 6 s cast, direkte + DoT (4 ticks à 3 s); kun med talentet |
| Combustion (talent) | 11129:40 | ingen GCD, 180 s nedkøling; se «Fire-pakken» |
| Arcane Blast (talent) | 400574:20, 1239696:30, 1239697:40, 1239699:50, 1239700:60 | 1,5 s cast, 15 % basis-mana; se «Arcane-pakken» |
| Arcane Wrath (talent) | 1326079:25, 1326080:36, 1326081:48, 1326082:60 | 3,5 s cast, 6 s nedkøling; se «Arcane-pakken» |
| Presence of Mind (talent) | 12043 | ingen GCD, 180 s nedkøling |
| Arcane Power (talent) | 12042 | ingen GCD, 15 s, 180 s nedkøling |

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

**Med via håndskrevet kode (Fire):** Fire-pakken (Scorch, Pyroblast, Ignite, Improved Scorch, Heating Up,
Combustion, Master of Elements, Fire Power); se «Fire-pakken».

**Med via håndskrevet kode (Arcane):** Arcane-pakken (Arcane Blast, Arcane Wrath, Missile Barrage, Arcane
Concentration/Clearcasting, Presence of Mind, Arcane Power); se «Arcane-pakken».

**Mangler stadig:** Blast Wave (AoE), Winter's Chill (kun Cone of Cold), Cold Snap og Arcane Subtlety (aura 123,
modstand, som simc-forever ikke modellerer). «Mind Mastery» findes ikke som talent i Forevers `trait_data.inc`.

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
  på skadeeffekten (alle seks ranks). Effekt 3 og 4 (Dummy 20 og 5) er ubeskrevne og bruges ikke.
  **Antagelse efter brugerens ønske: Ice Lance bruger Frostbolts koefficient (spildata har ingen); bemærk at
  klassisk instant-spells normalt har lavere koefficient end en 3 s cast, så tallet er sandsynligvis optimistisk.**
  Koefficienten tages fra spildataens skadeeffekt (School Damage) på den Frostbolt-rank, spilleren har efter level
  (`rank.frostbolt.find_rank()`): 0,706 på level 20-25 (rank 4), 0,814 fra level 26 (rank 5+). Den lægges på Ice
  Lances egen basisskade, og +300 % ganges på summen: (basis + koefficient × spell power) × 4 mod frosset mål.
  Nedkøling og GCD er uændrede. **Ét sted at ændre:** linjen `spell_power_mod.direct = e.sp_coeff();` i
  `ice_lance_t`s konstruktør i `sc_mage.cpp` (slettes linjen, er Ice Lance igen uden koefficient; et andet tal
  sættes samme sted).
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
call_action_list,name=fire,if=<Fire-nøgle>&!<Frost-nøgle>   # se «Rotation (Fire)»; ellers videre herfra
call_action_list,name=arcane,if=<Arcane-nøgle>&!<Frost-nøgle>&!<Fire-nøgle>   # se «Rotation (Arcane)»
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

### Valg af rotation (talenter)

Rotationen vælges i APL'en med `talent.<navn>.enabled` (konstanter, så valget koster intet under simulationen):

- **Frost-nøgle:** Ice Lance, Fingers of Frost eller Ice Barrier → Frost-listen ovenfor (uændret). Frost vinder,
  hvis en hybrid har nøgletalenter fra flere træer, så en Frost-mage aldrig får en anden rotation.
- **Fire-nøgle:** Ignite, Pyroblast, Improved Scorch, Heating Up eller Combustion (og ingen Frost-nøgle) → `fire`.
- **Arcane-nøgle:** Arcane Blast, Arcane Wrath, Missile Barrage, Presence of Mind eller Arcane Power (og hverken
  Frost- eller Fire-nøgle) → `arcane`. Arcane Concentration er ikke en nøgle (det er et almindeligt Frost-hybridvalg);
  en «Arcane Fire»-hybrid med fx Pyroblast får Fire-rotationen.
- **Ingen nøgle:** grundrotationen (`fire_blast`, `frostbolt`, `fireball`, `shoot`), præcis som før. Rene passive
  talenter (fx Accelerant, Incineration, Critical Mass) skifter ikke rotation.

### Fire-pakken (håndskrevet; alle tal fra spildata, antagelser markeret)

- **Scorch** (trænerens, fra level 22): direkte skade efter rank, 1,5 s cast.
- **Pyroblast** (talent; højere ranks kræver det): direkte skade + DoT fra spildata.
- **Ignite** (11119; 8/16/24/32/40 %): hvert ikke-periodisk **Fire-crit** lægger rankens procent af crittets skade
  på målet som rullende DoT 412538 (4 s, tick hver 2 s; rest + ny skade fordeles på de nye ticks, simcs
  `residual_action`). **Antagelse:** Ignite-tickene får ingen multiplikatorer igen (heller ikke Fire Vulnerability/Fire
  Power), da de allerede er med i crittets skade.
- **Improved Scorch** (11095; 33/67/100 %): hvert landet Scorch giver med rankens chance en stak **Fire
  Vulnerability** (22959) på målet: +3 % Fire-skade fra magen pr. stak, op til 5, 30 s (fornyes ved ny stak).
- **Heating Up** (400624): ikke-periodiske crits med Fireball, Fire Blast og Scorch giver en stak 400625 (20 s,
  op til 3, −25 % cast-tid på Pyroblast pr. stak; via `parse_effects`). «Fire Blast grants an additional stack
  every time it deals damage»: Fire Blast giver derfor en stak pr. hit og en ekstra ved crit. Pyroblast bruger
  alle stakkene.
- **Combustion** (11129): aktiv, ingen GCD. Hvert landet direkte Fire-hit giver en stak 28682 (+10 % crit på
  Fire-spells, op til 10; via `parse_effects`); efter 3 ikke-periodiske Fire-crits forsvinder begge. Spildataen har
  «Cooldown On Event», så de 180 s nedkøling starter først, når effekten er brugt op.
- **Master of Elements** (29074; 10/20/30 %): Fire- og Frost-crits giver den procentdel af spellens basis-mana
  tilbage.
- **Fire Power** (11124; 1/2/3 %): +% pr. af magens Fire-effekter på målet (højst 4). Talt med: Fireball-DoT,
  Pyroblast-DoT, Ignite og Fire Vulnerability. Gælder direkte og periodisk Fire-skade (ikke Ignite, se ovenfor).

**Udeladt:** Flamestrike, Blast Wave og Improved Flamestrike (AoE), Impact (stun), Flame Throwing, Burning Soul,
Improved Fire Ward (utility). **Frostfire Bolt**, som wowtbc.gg bruger som filler, er ikke en trænerspell i
modellen og er ikke med; Fireball er filler.

### Rotation (Fire)

```
pyroblast,if=time=0                     # åbner (kun med talentet)
scorch,if=talent.improved_scorch.enabled&(debuff.fire_vulnerability.stack<5|debuff.fire_vulnerability.remains<5)
combustion                              # på nedkøling (ingen GCD)
pyroblast,if=buff.heating_up.stack>=3   # 1,5 s cast med 3 stak
fire_blast                              # på nedkøling
arcane_missiles,if=buff.missile_barrage.up   # kun med Missile Barrage (Warcraft Tavern, Fire trin 8)
fireball                                # filler
shoot                                   # wand, når der ikke er mana til Fireball
```

Kilder (læst 12.11.2026): **Warcraft Tavern** «Fire Mage Guide» (Forever): «Pre-cast Pyroblast for any boss fight»,
«spam Scorch until you get 5 x Improved Scorch stacks», «Use Combustion to burst down your target», «Use Fire Blast
on cooldown», «Cast Fireball once you have the 5 x Improved Scorch stacks and reuse Scorch if the debuff is about
to expire», «Cast Pyroblast whenever Heating Up reaches 3x stacks». **wowtbc.gg** (Warcraft Forever Fire Mage):
«Maintain 5 stacks of Improved Scorch», «Cast Pyroblast with 3 stacks of Heating Up», «Cast Fire Blast», «Cast
Frostfire Bolt». **Icy Veins** og **Mobalytics** (Forever Fire) gav HTTP 403; kun søgeuddrag (Icy Veins: Fire Blast
giver altid en Heating Up-stak og to ved crit; åbn med Pyroblast og Scorch til 5 stak).

Forenklinger: den forhåndskastede Pyroblast er ikke gratis i simc (den koster 6 s kamptid fra t = 0 i stedet for at
blive kastet før kampen). Guidernes leveling-trick «Fireball i luften, så Scorch + Fire Blast» til at gøre mobben
færdig kan ikke modelleres (én lang kamp; simc kaster én spell ad gangen); Fire Blast på nedkøling dækker det.
Scorch-tærsklen 5 s før udløb er vores valg (guiderne siger kun «about to expire»). I DungeonSlice stables
Scorch op på hvert nyt mål, som guiderne beskriver for bosser; på trash ville en spiller nok springe det over.

### Fire-pakken: målt og håndregnet (SIMC_REF 3c1d319 + alle tre rettelser, native bygning, 1000 iterationer, seed 42, threads=1)

Ingen guild-mage har Fire-talenter (ezzek, magi-far, flareon-dk og apzel er alle Frost, armory 12.11.2026). Profilen
er derfor konstrueret: level 45, ezzeks udstyr (fiktivt navn), 36 point lavet med appens talentkoder
(`buildSimProfile`): Accelerant 5, Ignite 5, Incineration 5, Flame Throwing 2, Pyroblast, Improved Fire Blast 2,
Improved Scorch 3, Heating Up, Master of Elements 3, Critical Mass 3, Fire Power 3, Combustion, Blast Wave,
Improved Flamestrike 1. Før = forrige mage.patch (grundrotation + passiver), efter = denne.

| Profil | Patchwerk før → efter | DungeonSlice før → efter |
|---|---|---|
| Fire 45 | 47,29 → **58,51** (+24 %) | 40,70 → **48,25** (+19 %) |
| Fire 45, kun passive Fire-talenter | 47,29 → 47,29 | 40,70 → 40,70 |

Håndregning (simc-log, Patchwerk, seed 42):

- **Scorch** rank 4 (8446, level 40, skalerer til max level 44): 93 + 1,2 × (44 − 40) = 97,8 → **98** (log `base=98`)
  + 0,429 × 11 fire-spellpower = **102,72**; første Scorch med Fire Power × 1 (Pyroblast-DoT) = **105,80** (log
  105,8006), crit × 1,5 = **158,70** (log). Med 2 stak Fire Vulnerability og 3 Fire-effekter: × 1,06 × 1,09 =
  **118,68** (log 118,6815).
- **Pyroblast** rank 5 (12524, level 42): 311 + 2,7 × 3 = 319 + 1,0 × 11 = **330** (log); DoT-tick 31 + 0,15 × 11 =
  32,65 × 1,1554 = **37,72** (log). Cast-tid 6 s uden Heating Up, **1,5 s** med 3 stak (6 × (1 − 0,75)).
- **Ignite** rank 5: 40 % af Scorch-crittet 158,70 = **63,48** (log 63,4803) → 2 ticks à 31,74 (log).
- **Master of Elements** rank 3: Scorch 100 mana × 30 % = **30** pr. crit (log).
- **Proc-tal** (pr. kamp, 1000 iterationer): Ignite udløst 11,30 gange = alle Fire-crits (Fire Blast 3,52 + Fireball
  1,82 + Pyroblast 0,77 + Scorch 5,19 = 11,30). Heating Up-stakke 21,19 (start 8,20 + fornyelser 12,98) = forventet
  crits fra Fireball/Fire Blast/Scorch 10,53 + Fire Blast-hits 10,65 = **21,18**. Fire Vulnerability 18,05 stakke =
  landede Scorch 18,06 (rank 3 = 100 %); oppetid 93,8 %, gennemsnit 4,0 stak. Master of Elements 595 mana =
  0,3 × (3,52 × 220 + 1,82 × 260 + 0,77 × 285 + 5,19 × 100) = **596**.
- **Combustion:** 2 gange pr. kamp (nedkølingen starter, når de 3 crits er brugt, ca. 40 s inde); log: stakkene
  stiger ved hvert hit og forsvinder ved 3. crit, hvorefter nedkølingen på 180 s starter.

Rimelighed: Fire 45 (58,5) ligger under Frost 45 (68,2), fordi Fire-spells er dyre: manaen er brugt efter ca. 33 s,
og wanden står for 29 % af skaden (Frost har Frost Channeling og billigere Frostbolts). Ingen drik/manasten.

Regression (binær med forrige mod ny mage.patch, samme indstillinger): hunter-11, warrior-11, shaman-20, warlock-10,
warlock-25, paladin-39 (holy og ret), rogue-33, mage-20, mage-35, ezzek (Frost, med og uden talenter), Frost 45,
level 45 med kun passive Frost-, Fire- eller Arcane-talenter giver bit-for-bit samme DPS i Patchwerk og DungeonSlice.
`check-upstream.sh` giver OK mod 3c1d319 og main (1b8e01d); de tre rettelser kan anvendes i alle seks rækkefølger.

### Arcane-pakken (håndskrevet; alle tal fra spildata, antagelser markeret)

- **Arcane Blast** (talent; højere ranks kræver det): 1,5 s cast, 15 % af basis-manaen. Efter hver cast en stak
  400573 (op til 4): +12 % af Intellect som spell damage (effekt 1, aura 174 «spell damage of stat %», som simc
  ikke parser; håndskrevet i `composite_spell_power`) og +100 % mana-pris på Arcane Blast pr. stak (effekt 2, via
  `parse_effects`). «Lasts 18 sec from time of initial application»: varigheden fornyes ikke af nye stakke.
  **Antagelse:** stakken lægges efter castet, så castets egen skade og pris bruger de forrige stakke.
- **Arcane Wrath** (talent): 3,5 s cast (−Accelerant), 6 s nedkøling, projektil. Effekt 2: ekstra spell damage =
  5 % af max mana, med koefficient 1 som effekt 1.
- **Missile Barrage** (400588; 20/40 %): hvert landet Arcane Blast med rankens chance, Arcane Wrath, Fireball og
  Frostbolt med den halve. Buffen 400589 (15 s): næste Arcane Missiles −50 % varighed og −100 % mana (`parse_effects`)
  og et missil hver 0,5 s (effekt 2: −500 ms), altså samme fem missiler på halv tid og gratis.
- **Arcane Concentration** (11213; 2-10 %): efter ethvert landet skadeshit (også wand og hvert enkelt Arcane
  Missile: proc-flagene omfatter «White Ranged»), højst én gang pr. sekund (spildataens ICD). Clearcasting
  (12536, 15 s) gør næste skadesspell, som spildataen lister, gratis (−1000 er tiendedele: −100 %) og bruges af den.
- **Presence of Mind** (12043): ingen GCD; næste spell med cast-tid i spildataens liste bliver instant
  (`parse_effects`) og bruger buffen. «Cooldown On Event»: de 180 s starter, når effekten er brugt.
- **Arcane Power** (12042): ingen GCD, 15 s +30 % skade (direkte og periodisk) og +30 % mana-pris (`parse_effects`).
- **Gratis via spildata:** Arcane Impact, Arcane Mind, Arcane Instability, Arcane Meditation (fra før).

### Rotation (Arcane)

```
variable,name=arcane_blast_max_stacks,value=2   # parameter: højst 2 stak af mana-hensyn (Mobalytics)
variable,name=missiles_need_barrage,value=1     # parameter: Arcane Missiles kun på Missile Barrage
arcane_power                                    # på nedkøling (ingen GCD)
arcane_blast,if=buff.clearcasting.up            # Clearcasting bruges på Arcane Blast
arcane_missiles,if=buff.missile_barrage.up|!variable.missiles_need_barrage
presence_of_mind,if=!buff.clearcasting.up&(!talent.arcane_wrath.enabled|cooldown.arcane_wrath.ready&mana>=action.arcane_wrath.cost)
arcane_wrath                                    # på nedkøling (med Presence of Mind når den er klar)
fire_blast                                      # på nedkøling
arcane_blast,if=buff.arcane_blast.stack<variable.arcane_blast_max_stacks
# derefter grundrotationen: frostbolt (fisker efter Missile Barrage), fireball, shoot
```

Kilder (læst 12.11.2026): **Warcraft Tavern** «Arcane Mage Guide» (Forever): «Cast Arcane Blast to build up stacks
… starting an 18-second rotation», «Always use Arcane Concentration procs on Arcane Blast», «Cast Arcane Missiles
instantly when Missile Barrage procs. Ideally, start casting it once AB reaches 2 stacks», «Cast Arcane Wrath at 3
or 4 Arcane Blast stacks depending on your current mana pool», Arcane Power og Presence of Mind (på Arcane Wrath) ved
4 stak. **wowtbc.gg** (Warcraft Forever Arcane): «Cast Arcane Power with any on-use effects», «Cast Arcane Missiles
with Missile Barrage procs», «Cast Arcane Wrath. Cast with Presence of Mind if available», «Cast Arcane Blast if below
4 stacks (adjust based on your mana/gear)». **Icy Veins** (Forever Arcane Leveling) og **Mobalytics** (Forever
Arcane) gav HTTP 403; kun søgeuddrag og opgavens resumé: Icy Veins «Frostbolt, Arcane Wrath, Arcane Blast 1–3 gange
til en Missile Barrage-proc, så Arcane Missiles, Frost Nova/Fire Blast»; Mobalytics: aldrig over 2 stak (mana).

Valg og forenklinger: stakgrænsen 2 følger leveling-guiderne (Icy Veins/Mobalytics), ikke Warcraft Tavern/wowtbc.gg's
max-niveau-råd om 3-4 stak; derfor bindes Arcane Power og Presence of Mind ikke til 4 stak (Arcane Power på
nedkøling, Presence of Mind på Arcane Wrath). Workeren tillader ikke `actions=`, så parametrene kan kun ændres i
koden. Clearcasting-Arcane Blast kan give 3-4 stak (målt: kun med Clearcasting). Frost Nova er ikke med (se Frost).
Pyroblast/Heating Up i wowtbc.gg's liste gælder en Arcane/Fire-hybrid, som her får Fire-rotationen.

### Arcane-pakken: målt og håndregnet (SIMC_REF 3c1d319 + alle tre rettelser, native bygning, 1000 iterationer, seed 42, threads=1)

Ingen guild-mage har Arcane-talenter; profilen er konstrueret som Fire 45 (ezzeks udstyr, appens talentkoder): level
45, Wand Specialization 2, Improved Channeling 2, Arcane Subtlety 2, Arcane Concentration 5, Missile Barrage 2,
Arcane Impact 3, Arcane Blast, Arcane Meditation 3, Arcane Wrath, Presence of Mind, Arcane Mind 5, Arcane
Instability 3, Arcane Power, Arcane Geometry 2, Magic Absorption 2, Arcane Resilience 1 (36 point).

| Profil | Patchwerk før → efter | DungeonSlice før → efter |
|---|---|---|
| Arcane 45 | 54,59 → **84,54** (+55 %) | 47,61 → **73,18** (+54 %) |
| Arcane 45, kun passive Arcane-talenter | 54,59 → 54,59 | 47,61 → 47,61 |

Håndregning (simc-log, Patchwerk, seed 42; Intellect i kamp 153 = 150 × 1,02 Arcane Intellect, max mana 3020):

- **Arcane Blast** rank 3 (1239697, level 40, max 48): 101 + 1 × 5 = **106** (log) + 0,429 × 11 = 110,72 × 1,03
  (Arcane Instability) × 1,3 (Arcane Power) = **148,25** (log 148,2527). Med 1 stak: spellpower 11 + 0,12 × 153 =
  29,4 → simc runder total-spellpower til **29**: (106 + 0,429 × 29) × 1,339 = **158,59** (log). Crit × 2,0 (Arcane
  Mind 5). Pris: 143 × (1 + 1 stak) × 1,3 = **371,8** (log), med 2 stak × 3 × 1,3 = **557,7** (log).
- **Arcane Wrath** rank 2 (1326080, level 36, max 47): 187 + 2,3 × 9 = 207,7 → **208**; spellpower 11 + 0,05 × 3020 =
  **162** (log); (208 + 162) × 1,339 = **495,43** (log, Arcane Power + Presence of Mind ved t = 0).
- **Arcane Missiles** rank 5 (8417/8418, level 40, max 44): missil 95 + 0,7 × 4 = 97,8 → 98 + 0,286 × 48 (2 stak) =
  111,73 × 1,339 = **149,60** (log). Med Missile Barrage: 0 mana, 5 missiler med 0,5 s mellemrum (log).
- **Missile Barrage** (rank 2: 40 % / 20 %): forventet 0,4 × 21,56 landede Arcane Blast + 0,2 × (11,02 Arcane Wrath +
  11,44 Frostbolt) = **13,11** pr. kamp; observeret 13,03 (start 12,53 + fornyelser 0,50). Alle Arcane Missiles-casts
  havde Missile Barrage (12,50 casts; log-tjek af 40 kampe: 486/486).
- **Arcane Concentration** rank 5 (10 %, ICD 1 s): i 40 log-kampe (seed 1-40) gav 627 af 6603 skadeshit uden aktiv
  ICD Clearcasting = **9,5 %** (forventet 10 %; standardfejl ca. 0,4 %-point).
- **Stakke og buffs (40 log-kampe):** hver Arcane Blast-stak varede præcis 18,0 s fra første stak (491 af 491);
  Arcane Blast ved 2+ stak kun med Clearcasting (161 af 161); Presence of Mind brugt på Arcane Wrath 78 af 78
  gange; Arcane Power 2 gange pr. kamp (180 s).

Rimelighed: Arcane 45 (84,5) ligger over Frost 45 (68,2), fordi Missile Barrage gør 12,5 Arcane Missiles pr. kamp
gratis (7010 skade, 28 %), og Arcane Wrath får 151 ekstra spellpower fra max mana. Begge dele er spildata for Forever,
men tallene er ikke sammenlignet med spillet. Wanden står for 15 % af skaden (Fire 29 %).

Regression (binær med Fire-pakken mod denne): alle profiler fra Fire-afsnittet og Fire 45 giver bit-for-bit samme DPS
(Fire 45 har ikke Missile Barrage). `check-upstream.sh` OK mod 3c1d319 og main (1b8e01d); alle seks rækkefølger.

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

- **Ice Lance** (før koefficient-antagelsen, se næste afsnit) rank 3 (1240044, level 34): 45 + 0,5 × (35 − 34) =
  45,5 → simc 46 (log: `base=46 s_power=0`);
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

### Ice Lance med Frostbolts koefficient (antagelse): målt og håndregnet (SIMC_REF 3c1d319 + alle tre rettelser, native bygning, 1000 iterationer, seed 42, threads=1)

Før = mage.patch uden koefficient på Ice Lance, efter = med Frostbolts. Ezzek hentet igen fra armory 12.11.2026
(`getSimProfile` + `buildSimInput`, uændret profil); Frost L<n> = den konstruerede Frost 45 med `level=<n>`.

| Profil | Patchwerk før → efter | DungeonSlice før → efter |
|---|---|---|
| ezzek 35 | 49,42 → **51,77** (+4,8 %) | 42,71 → **44,64** (+4,5 %) |
| Frost 45 | 68,19 → **70,15** (+2,9 %) | 58,71 → **60,37** (+2,8 %) |
| Frost L20 (Ice Lance rank 1, Frostbolt rank 4) | 40,33 → 43,41 | 34,40 → 36,96 |
| Frost L60 (Ice Lance rank 6, Frostbolt rank 11) | 98,68 → 100,38 | 84,59 → 85,98 |

Håndregning (simc-log, Patchwerk, seed 42; spell power 21 Frost = 11 generel + 10 Frost fra udstyr):

| Level | Ice Lance-rank (id) | Frostbolt-rank (id) | Koefficient | Basis (log) | Frosset hit | Log |
|---|---|---|---|---|---|---|
| 20 | 1 (1312002) | 4 (7322) | 0,706 | 28 | (28 + 0,706 × 21) × 4 = **171,30** | 171,304 |
| 28 | 2 (400640) | 5 (8406) | 0,814 | 36 | (36 + 17,094) × 4 = **212,38** | 212,376 |
| 34 | 3 (1240044) | 6 (8407) | 0,814 | 45 | (45 + 17,094) × 4 = **248,38** | 248,376 |
| 35 (ezzek) | 3 (1240044) | 6 (8407) | 0,814 | 46 | (46 + 17,094) × 4 = **252,38**; crit × 2 = **504,75** | 252,376 / 504,752 |
| 42 | 4 (1240045) | 7 (8408) | 0,814 | 79 | (79 + 17,094) × 4 × 1,2075 = **464,13** | 464,134 |
| 48 | 5 (1240046) | 8 (10179) | 0,814 | 98 | (98 + 17,094) × 4,83 = **555,90** | 555,904 |
| 56 | 6 (1240047) | 10 (10181) | 0,814 | 145 | (145 + 17,094) × 4,83 = **782,91** | 782,914 |
| 60 | 6 (1240047) | 11 (25304) | 0,814 | 149 | (149 + 17,094) × 4,83 = **802,23** | 802,234 |

(× 1,2075 = Ice Barrier + Frigid Power fra level 40.) Log-linjen viser `s_mod` = Frostbolt-rankens koefficient og
`mult=4` (4,83 med Ice Barrier). Regression (binær uden mod med koefficienten): hunter-11, warrior-11, shaman-20,
warlock-10, warlock-25, paladin-39 (holy og ret), rogue-33, mage-20, mage-35, ezzek uden talenter, Frost 45 uden Ice
Lance, kun passive Frost/Fire/Arcane 45, Fire 45 og Arcane 45 giver bit-for-bit samme DPS i Patchwerk og
DungeonSlice. `check-upstream.sh` OK mod 3c1d319 og main (1b8e01d); alle seks rækkefølger.

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
`add_action`, upstream opretter selv `holy_shock` og `holy_shield` (`has_action`), APL'en bruger en af
`holy_shock`/`holy_shield`/`righteous_fury`, og `sc_paladin.cpp` indeholder ikke vores markør `AULA-RETTELSE`. Ved
`SIMC_REF` 3c1d319 er `sc_paladin.cpp` 52 linjer og APL'en tom (0 DPS); med rettelsen er modulet 847 linjer.
Kilde: forken `RasmusAaenDev/simc-forever`, branch `aula/paladin` (to commits oven på `SIMC_REF`); patchen er
`git diff 3c1d319..aula/paladin`. Den passer også uændret på upstream `main` `1b8e01d`.

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
Retribution-sætbonusser (Holy Shock er siden tilføjet, se «Holy og Protection» nedenfor). **Benediction på Judgement:** Judgements pris er en procent af base mana, og simcs passiv-parser
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

### Holy og Protection (tilføjet 2026-11-12)

Auditten fandt, at Holy og Protection kørte Ret-rotationen med Seal of Righteousness (Holy 72,6, Prot 68,9 mod Ret
83,6 på level 40). Rettelsen giver dem deres egne evner; spec'en afgøres af talenterne (`variable.prot` =
Templar's Bulwark, Redoubt, Holy Shield, Swift Judgement eller Shieldsworn; Holy Shock og Divine Favor er kun klar
med talentet). Alle tal fra spildata (`simc spell_query`):

| Spell | Ranks (id: level) | Spildata og model |
|---|---|---|
| Holy Shock (Holy-talent) | 1311606: 30, 20473: 40, 20929: 48, 20930: 56 | driveren giver pris (160/225/275/325 mana), GCD 1,5 s og 10 s nedkøling; skaden er skade-spellen (1311604, 25912, 25911, 25902): School Damage, Holy, SP 0,429 (r2: 182). Kan crit'e og misse (spell-tabellen) |
| Divine Favor (Holy-talent 20216) | – | 4 % base mana, 120 s; næste Holy Shock +100 % crit (effekt 1) |
| Righteous Fury | 25780: 10 | kun trussel og forsvar, ingen skade. Spildataens pris (30 % base mana) bliver 0 i simc (set i loggen) |
| Holy Shield (Protection-talent) | 20925: 30, 20927: 40, 20928: 50, 1239570: 60 | 10 s, 10 s nedkøling, kræver skjold (`has_shield_equipped`); skade pr. blok = effekt 2 (75/110/153/221) + 0,08 × SP, Holy |
| Swift Judgement (Protection-talent 1310994) | – | 60 s, ingen pris, deler ikke nedkøling med Judgement; skaden er den aktive seals judgement som ved Judgement |
| Shieldsworn (31-point-talent 1328544) | – | Holy Strike −4 s nedkøling (spildata via passiv-parseren) og «strikes with your shield, triggering your active Holy Shield … without consuming their charges» |

Rotation (fælles liste; nyt markeret med `+`):

```
precombat: variable,name=prot,…
+          righteous_fury,if=variable.prot
           auto_attack, seal_of_command / seal_of_righteousness (som før)
+          holy_shield,if=variable.prot&mana.pct>50
           judgement
+          swift_judgement
           hammer_of_wrath,if=target.health.pct<20
+          divine_favor,if=cooldown.holy_shock.ready&mana.pct>50
+          holy_shock,if=mana.pct>50
           holy_strike
           consecration,if=active_enemies>1&mana.pct>50
+          consecration,if=variable.prot&mana.pct>80
```

Antagelser:

- **Mana-grænserne** (Holy Shock og Holy Shield over 50 %, Consecration på ét mål over 80 %) er vores valg. Målt
  (500 iterationer): uden grænse giver Holy 40 med Holy Shock 70,4 mod 72,5 uden Holy Shock, fordi den tager manaen
  fra Seal of Righteousness og Judgement; over 50 % giver 74,4 (70 %: 73,9, 90 %: 73,2). Protection 40 med
  Consecration på ét mål over 50 % mana: 65,3, over 80 %: 68,5, aldrig: 70,1. Den bruges alligevel over 80 %, fordi en
  tank gør det (trussel); prisen er 2 % på level 40. Holy Shield over 50 % mana giver 51,1 mod altid 49,9 og aldrig
  51,4 (profil med skjold).
- **Holy Shields skade kommer kun via Shieldsworn**: Patchwerk-målet slår ikke, så der blokeres aldrig. Holy
  Strikes egen skade er uændret (vi ved ikke, om «strikes with your shield» ændrer den).
- **Swift Judgement** er et server-script i spildataen; vi antager samme skade som Judgement. Sanctified Judgement
  gælder kun Judgement.
- **Ikke med:** healing, Exorcism (kun Undead/Demon), Consecrated Ground, Reckoning og Redoubt (kræver at målet slår),
  Light's Vigil (Holy Shock på allierede), Seal of Wisdom/Light og Blessings.

#### Målt (SIMC_REF 3c1d319 + alle rettelser, native bygning, 1000 iterationer, seed 42)

Auditens syntetiske profiler (§11 i auditten; level 40 bruger Mograine's Might, et tohåndsvåben, også for Prot) og en
Prot-variant med enhåndssværd og skjold (Sword of Serenity 6829 + Aegis of the Scarlet Commander 7726), så Holy
Shield kan bruges.

| Profil | Stil | Før | Efter | Venter efter | Nyt i skadesfordelingen |
|---|---|---|---|---|---|
| Holy 20 | Patchwerk | 16,9 | **16,8** | 78 % | intet (Holy Shock kommer på level 30) |
| Holy 40 | Patchwerk | 72,6 | **74,8** | 74 % | Holy Shock 3 % (4 kast; med Divine Favor crit for 273) |
| Holy 40 | DungeonSlice | – | **65,0** | 76 % | Holy Shock 3 % |
| Protection 20 | Patchwerk | 16,5 | **15,8** | 79 % | Consecration (1 kast) koster Judgements |
| Protection 40 (2H) | Patchwerk | 68,9 | **68,5** | 68 % | Swift Judgement, Consecration; intet skjold, så ingen Holy Shield |
| Protection 40 (2H) | DungeonSlice | – | **60,3** | 71 % | |
| Protection 40 (skjold) | Patchwerk | 52,2 | **52,0** | 68 % | Holy Shield-skade 2 % (110 pr. ramt Holy Strike) |
| Retribution 40 | Patchwerk | 83,6 | **83,6** | 76 % | uændret |

Håndtjek: Holy Shock r2 rammer for 182 (effekt 1; profilen har ingen spell power) og crit'er for 273 (× 1,5); Holy
Shield-skaden r2 er 110 (effekt 2). Holy og Protection er nu adskilt fra Ret i loggen, men DPS ændrer sig kun lidt:
begge er mana-begrænsede (Prot-profilen får ca. 770 mana i regen på 300 s), og Holy Shock/Holy Shield er dyre i
forhold til deres skade. Prot med skjold ligger under Prot med tohåndsvåben, fordi våbnet er svagere.

Guildens Holy 39 (`test/fixtures/paladin-39-holy.simc`, Holy 22 / Protection 8): 73,3 → **75,9** (Holy Shock 6 kast).
Kontrolleret i et lokalt bygget worker-image (Dockerfile, alle syv rettelser, via `/run`, 1000 iterationer): Holy 40
74,9 / DungeonSlice 65,1, Protection 40 68,5 / 60,3, Protection 20 15,9 / 14,1, Ret 40 83,6 / 77,5; resultatet har
«Grov model …».

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
upstream opretter selv `backstab`, `hemorrhage` og `ghostly_strike` (`has_action`), APL'en bruger `backstab` eller
`hemorrhage`, og `sc_rogue.cpp` indeholder ikke `AULA-RETTELSE`. Ved `SIMC_REF` 3c1d319 (og simc-forever `main`
1b8e01d, 2026-11-12) er `sc_rogue.cpp` 42 linjer og APL'en tom; med rettelsen er modulet 1201 linjer. Kilde: forken
`RasmusAaenDev/simc-forever`, branch `aula/rogue` (to commits oven på `SIMC_REF`); patchen er
`git diff 3c1d319..aula/rogue`.

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
- **Expose Armor, Kidney Shot, Riposte, Death Mark:** ikke modelleret (Backstab, Hemorrhage og Ghostly Strike er
  siden tilføjet, se «Combat og Subtlety» nedenfor).
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

**Mangler:** Setup, Remorseless Attacks, Improved Kidney Shot, Death Mark og Riposte. (Ruthlessness, Hack and Slash'
økse/sværd- og kølle-del, Puncturing Wounds, Initiative, Premeditation, Preparation, Boot Knife, Hemorrhage og
Ghostly Strike er siden tilføjet; Opportunity, Improved Ambush og Serrated Blades virker via spildata. Se «Combat og
Subtlety».)

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

### Combat og Subtlety (tilføjet 2026-11-12)

Auditten fandt Combat 85,9 og Subtlety 79,9 mod Assassination 103,2 (level 40, dolke): Combat havde ingen Backstab,
Subtlety ingen af sine kerneevner. Alle tal fra spildata (`simc spell_query`; id: spell level):

| Spell/talent | Spildata og model |
|---|---|
| Backstab (53: 4, 2589: 12, 2590: 20, 2591: 28, 8721: 36, 11279: 44, 11280: 52, 11281/25300: 60) | 60 energi, 150 % normaliseret våbenskade + fast bonus, 1 CP; kræver dolk i hovedhånden |
| Puncturing Wounds (Combat, 1224716) | +10-30 % crit på Backstab (spildata via passiv-parseren); effekt 2: 15/30/45 % chance for 1 ekstra CP (Improved Backstab) |
| Hemorrhage (Subtlety-talent 16511) | 35 energi, 100 % våbenskade (145 % med dolk, effekt 4/5), normaliseret, 1 CP; målet tager +15 % Rupture- og Garrote-skade i 15 s (effekt 3) |
| Ghostly Strike (Subtlety-talent 14278) | 40 energi, 125 % våbenskade (180 % med dolk), normaliseret, 1 CP, 20 s; næste Ambush eller Garrote inden for 7 s kræver ikke Stealth (1329326). Dodge-delen påvirker ikke skaden |
| Premeditation (Subtlety-talent 14183) | +2 CP, 120 s. I Forever kun «Allow While Stealthed», ikke «Only Stealthed»: bruges i kampen |
| Preparation (Subtlety-talent 14185) | 600 s; nulstiller Premeditation, Ghostly Strike, Cold Blood, Adrenaline Rush, Blade Flurry og Shank |
| Initiative (Subtlety-talent 13976) | Ambush/Garrote: 33/67/100 % chance for 1 ekstra CP (13977) |
| Boot Knife (Subtlety-talent 1329286) | Shank: 20-100 % chance for 2 CP (1329285) |
| Ruthlessness (Assassination-talent 14156) | finishers: 20/40/60 % chance for 1 CP, 0,5 s ICD |
| Hack and Slash (Combat-talent 13960) | økse/sværd: 1-5 % chance pr. ramt våbenslag for et ekstra slag med samme våben (0,2 s ICD); kølle: angreb ignorerer 3-15 % af rustningen. Dolk/næve-delen var der i forvejen |
| Opportunity, Improved Ambush, Serrated Blades | virker via spildata (passiv-parseren: skade, crit, rustningsgennembrud og Rupture-skade) |

Rotation (fælles liste; nyt markeret med `+`):

```
+ ambush,if=!buff.ghostly_strike.up|dot.garrote.ticking   # åbning, eller efter Ghostly Strike når Garrote tikker
+ garrote,if=!ticking                                      # åbning uden dolk, eller efter Ghostly Strike
  auto_attack
  slice_and_dice,if=buff.slice_and_dice.remains<1&combo_points>=2
  adrenaline_rush, blade_flurry
+ premeditation,if=combo_points<=3
+ preparation,if=cooldown.premeditation.remains>30
  rupture,if=!ticking&combo_points>=5
  cold_blood / eviscerate,if=combo_points>=5&…
+ ghostly_strike,if=combo_points<=2
  shank,if=energy<70
  mutilate,if=combo_points<=3
+ hemorrhage,if=combo_points<5&!buff.ghostly_strike.up
+ backstab,if=combo_points<5&(talent.puncturing_wounds.enabled|talent.opportunity.enabled)
  sinister_strike,if=combo_points<5&!(action.backstab.enabled&(talent.puncturing_wounds.enabled|talent.opportunity.enabled))
```

Antagelser og valg:

- **Backstab og Ambush antager, at rogue'en står bag målet** (en gruppe med en tank). Simc har ingen position.
- **Backstab i stedet for Sinister Strike** kun for Combat med Puncturing Wounds og Subtlety med Opportunity, og
  så spares energien op til Backstab (60). Uden de talenter bruges Sinister Strike (40 med Efficient Strikes) som
  før. Målt: når Sinister Strike fik lov at gå først, så snart energien nåede 40, blev der næsten ingen Backstabs
  (Combat 40: 86,9 mod 95,2).
- **Garrote før Ambush efter Ghostly Strike:** målt bedre (Subtlety 40: 101,2 mod 92,3 med Ambush): Garrote er en
  bleed uden rustning, får Opportunity og Hemorrhage-debuffen og koster 30 med Dirty Deeds. Garrote har ingen
  AP-skalering i spildataen (som før).
- **Hack and Slash' ekstra slag** er et almindeligt hvidt slag med samme våben (kan crit'e, glance og udløse gift).
- **Ruthlessness** er et Assassination-talent; det løfter Assassination 40 med 1 % (103,2 → 104,5).
- **Ikke med:** Death Mark (lagrer skade pr. CP; for stort), Riposte og Setup (kræver at målet slår), Vanish med
  ny åbning, Expose Armor og Kidney Shot.

#### Målt (SIMC_REF 3c1d319 + alle rettelser, native bygning, 1000 iterationer, seed 42)

Auditens syntetiske profiler (dolke i begge hænder: Bite of Serra'kis 6904 / Claw of the Shadowmancer 2912).

| Profil | Stil | Før | Efter | Venter efter | Største kilder (efter) |
|---|---|---|---|---|---|
| Combat 20 | Patchwerk | 59,2 | **59,2** | 69 % | uændret: ingen Puncturing Wounds på level 20, og Riposte kan ikke bruges |
| Combat 40 | Patchwerk | 85,9 | **95,2** | 62 % | hovedhånd 33 %, Backstab 27 % (53), off-hand 18 %, Deadly Poison 12 % |
| Combat 40 | DungeonSlice | – | **78,2** | 65 % | Backstab 27 %, Ambush 3 % (genåbning mellem grupperne) |
| Subtlety 20 | Patchwerk | 57,8 | **64,2** | 77 % | hovedhånd 44 %, Backstab 24 % (47) |
| Subtlety 40 | Patchwerk | 79,9 | **101,2** | 51 % | hovedhånd 30 %, off-hand 16 %, Garrote 13 % (8), Hemorrhage 12 % (67), Rupture 6 % |
| Subtlety 40 | DungeonSlice | – | **83,4** | 56 % | |
| Assassination 40 | Patchwerk | 103,2 | **104,5** | 58 % | Ruthlessness |

Håndtjek (Combat 40 og Subtlety 40, samme udstyr og AP): Sinister Strike r6 (flad 33) rammer for 59,05 og Backstab
r5 (flad 60, 150 %) for 113,34. (W + 60) × 1,5 / (W + 33) = 113,34 / 59,05 giver normaliseret dolkeslag W = 63,6 og
rustningsfaktor 0,6115. Subtlety ignorerer 6 % rustning (Serrated Blades 2): faktor 0,626; Hemorrhage 63,6 × 1,45 ×
0,626 = 57,7 (log 57,71) og Ghostly Strike 63,6 × 1,8 × 0,626 = 71,6 (log 71,64). Garrote r4 tikker for 59 × 1,20
(Opportunity 5) × 1,15 (Hemorrhage) = 81,42 (log 81,42). Med sværd (Cruel Barb 5191) og Hack and Slash 5 giver ca.
5 % af ca. 200 ramte slag 8,7 ekstra slag pr. kamp (målt, 300 iterationer).

Regression: mage, warlock, priest og paladin Ret giver bit-for-bit samme DPS før og efter. basil
(`test/fixtures/rogue-33.simc`, Combat uden Puncturing Wounds) er uændret (92,7): Sinister Strike som før.

Kontrolleret i et lokalt bygget worker-image (via `/run`, 1000 iterationer, Patchwerk / DungeonSlice): Combat 20
59,4 / 50,9, Combat 40 95,1 / 78,2, Subtlety 20 64,2 / 55,4, Subtlety 40 101,2 / 83,5, Assassination 40 104,6 / 85,7.

## druid

**Hvad:** Rettelse af én fejl i upstreams druid-grundmodel, i upstream-stil (foreslået upstream, se
`upstream-druid-moonkin.md`). `druid_action_t` sætter `form_mask = data().stance_mask()`, og `ready()` kræver
`(form_mask & form) == form`. Wrath, Moonfire, Starfire, Insect Swarm, Hurricane, Faerie Fire og Innervate har i
spildataen kun Moonkin Form i stance-masken (`0x40000000`; Faerie Fire `0x40000091`, Innervate `0x40000002`), men
attributten **83 «Allow While Not Shapeshifted (caster form)»** (kontrolleret med `simc spell_query`). Koden læste ikke
attributten, så en druid uden Moonkin Form (alle under level 40 og alle Feral/Restoration uden talentet) kastede
ingenting og slog kun med staven (100 % venter i auditten).

Rettelsen tilføjer `SX_ALLOW_WHILE_NOT_SHAPESHIFTED = 83u` til `spell_attribute` og lægger `CASTER_FORM` til
`form_mask`, når spellen har en stance-maske og attributten. Intet andet ændres: Moonkin Form virker som før (Balance
40 er uændret), og spells uden stance-maske (Entangling Roots) var allerede tilladt.

**Filer:** `engine/class_modules/sc_druid.cpp` (konstruktøren i `druid_action_t`), `engine/dbc/data_enums.hh` (én
enum-værdi). Kilde: forken `RasmusAaenDev/simc-forever`, branch `aula/druid` (én commit oven på `SIMC_REF`); patchen er
`git diff 3c1d319..aula/druid`. Den passer også uændret på upstream `main` `1b8e01d` (kat-ændringerne flytter kun
linjenumrene).

**Upstream-tjek (`druid.check`):** både `data_enums.hh` og `sc_druid.cpp` indeholder `SX_ALLOW_WHILE_NOT_SHAPESHIFTED`.
Det gør de kun, hvis upstream har taget rettelsen (eller en med samme navn). Linjeantal og `add_action` bruges ikke:
upstream har allerede 974 linjer og en APL. Lægger upstream kun enum-værdien ind (uden brug i druiden), holder
tjekket ikke, rettelsen passer ikke, og bygget stopper (konflikt; testet). Rettelsen har ingen `AULA-RETTELSE`-markør
(upstream-stil); se «`.check`-format» om hvad det betyder for en arbejdskopi.

**Model i workeren:** druid står i `FIX_ON_UPSTREAM` i `../patchinfo.mjs`, så resultatet markeres «Grov model:
SimulationCraft's grundmodel med Aulas rettelser». Appen viser ikke længere den røde «mangler vigtige evner»-advarsel
for Balance/Restoration, men stadig en gul for Feral (ingen kat-rotation; se `lib/sim-model-gaps.ts`).

**Antagelser og huller (ikke rettet her):**

- Feral har stadig ingen kat-rotation: en Feral-druid simuleres som caster med Wrath og Moonfire. Kat-delen bygges
  upstream (Khazak) og er ikke vores at lave.
- Druiden har ingen wand og ingen mana-styring: under 40 er manaen brugt efter ca. 1 minut, og derefter slår den med
  staven og kaster, når der er mana til én spell (ca. 60 % venter). Det er sandsynligvis tæt på spillet for en druid
  uden mana-drikke, men ikke målt mod spillet.
- Faerie Fire er stadig med i APL'en med `if=time<1`; masken tillader kat (`0x1`) og bjørn, uændret.

### Målt (SIMC_REF 3c1d319 + alle rettelser, native bygning, 1000 iterationer, seed 42, Patchwerk)

Profilerne er auditens syntetiske (level 20 og 40, alle point i ét træ; udstyr lånt fra fixtures og ikke
level-tilpasset, se auditten §11). Kun til sammenligning før/efter og mellem klasser på samme udstyr.

| Profil | Før: DPS | Før: venter | Efter: DPS | Efter: venter | Wrath / Moonfire / Starfire (efter) |
|---|---|---|---|---|---|
| Balance 20 | 5,1 | 100 % | **12,9** | 61 % | 63 / 9 / 2 |
| Balance 40 (Moonkin) | 46,4 | 44 % | **46,4** | 44 % | 71 / 13 / 4 (uændret) |
| Feral 20 | 2,4 | 100 % | **7,2** | 68 % | 40 / 8 / 1 |
| Feral 40 | 25,5 | 100 % | **31,3** | 62 % | 41 / 10 / 1 |
| Restoration 20 | 5,1 | 100 % | **10,5** | 63 % | 46 / 9 / 1 |
| Restoration 40 | 11,7 | 100 % | **27,6** | 50 % | 57 / 11 / 2 |

På upstream `main` `1b8e01d` (med kat-ændringerne): Balance 20 7,0 → 14,1, Feral 20 4,3 → 8,6, Restoration 40
14,9 → 29,3 (samme profiler, samme indstillinger).

Kontrolleret i et lokalt bygget worker-image (Dockerfile, alle fem rettelser, via `/run`, 1000 iterationer): samme tal
inden for støjen (Feral 40 31,1); `/health` melder `druid applied`, og resultatet har «Grov model: SimulationCraft's
grundmodel med Aulas rettelser». DungeonSlice kører uden fejl (Balance 20: 11,7).

## priest

**Hvad:** Tilføjelser til upstreams priest-grundmodel (PR #33): wand (Shoot) og mana-styring i rotationen. Auditten
fandt, at Discipline/Holy var tomme for mana efter ca. 30 s og derefter stod stille (76-81 % venter), og at Shadow på
lavt level heller ikke havde noget at lave uden mana. Årsagen er to ting:

1. **Ingen wand.** Upstream har ingen Shoot-handling (TODO i koden: «Apply to the wand auto attack once
   implemented»). Det er det, en priest laver det meste af kampen på lave level.
2. **Ingen mana-bevidsthed.** Rotationen kaster, så snart der er mana til én Smite. Hver spell nulstiller
   femsekundsreglen, så spirit-regenerationen næsten aldrig kommer i gang: priesten «drypper» én Smite hvert
   tiende sekund og venter resten af tiden (24 Smites på 300 s i auditten).

**Rettelsen:**

- `shoot_t` (Shoot, 5019) med samme model som mage-rettelsen (se «mage» ovenfor): wandens våbenskade fra
  ranged-pladsen, spell-tabellen (hit/crit), ingen rustning, wandens hastighed (uhastet), ingen mana. Kun klar med
  en wand i ranged-pladsen. **Wand Specialization** (som upstream allerede fjernede fra de passive effekter) lægges
  på Shoot, som i mage-rettelsen.
- Rotationen (fælles for alle specs, som upstream):
  - `variable,name=wand_phase,op=set,value=1,if=mana.pct<10` og `…value=0,if=mana.pct>40`, derefter
    `shoot,if=variable.wand_phase`. Under 10 % mana skydes der med wand, til manaen er over 40 % igen. Uden spells
    løber femsekundsreglen ud, og spirit-regenerationen kører fuldt (simcs formel; samme forbehold som for mage).
  - `holy_fire,if=!ticking&!talent.mind_flay.enabled` før Mind Flay/Smite: Holy Fire er implementeret upstream, men
    stod ikke i rotationen. Kun uden Mind Flay-talentet (Discipline/Holy), fordi Shadow har Mind Flay og Shadowform.
  - `shoot` sidst, når intet andet er klar.
- Markøren `AULA-RETTELSE` står i en kommentar øverst i `sc_priest.cpp` og i APL'en.

**Antagelser:**

- **Tærsklerne 10 % / 40 %** er vores valg. Målt (500 iterationer) giver alle varianter fra 5/30 til 30/90 mellem
  −10 % og +3 % i forhold til 10/40, og alle er 10-20 % bedre end kun at bruge Shoot som sidste udvej. 10/40 ligger i
  midten og svarer til det, leveling-guides beskriver (DoTs, derefter wand, og spells igen, når manaen er der).
- Shoot-skolen er spildataens (Physical) i rapporten, medmindre profilen angiver wandens skole; ingen rustning.
  Wand Specialization i spildataen gælder alle skoler.
- Ingen mana-drikke, Inner Fire, Power Infusion eller Spirit Tap (død-baseret).
- Holy Fire uden Mind Flay er en tommelfingerregel for «ikke Shadow»; en Discipline/Holy med Mind Flay-talentet
  bruger Mind Flay i stedet.

**Filer:** `engine/class_modules/sc_priest.cpp` (`shoot_t`, `create_action`, kommentar ved Wand Specialization),
`engine/class_modules/apl/priest.cpp` (rotationen mellem `//priest_apl_start` og `//priest_apl_end`). Kilde: forken
`RasmusAaenDev/simc-forever`, branch `aula/priest` (én commit oven på `SIMC_REF`); patchen er
`git diff 3c1d319..aula/priest`. Den passer også uændret på upstream `main` `1b8e01d`.

**Upstream-tjek (`priest.check`):** upstream opretter selv handlingen `shoot` (`has_action`), APL'en bruger `"shoot`
og `"holy_fire`, og `sc_priest.cpp` har ikke vores markør. Linjeantal og `add_action` bruges ikke: upstream har allerede
946 linjer og en APL. Har upstream kun Shoot (uden Holy Fire i APL'en), holder tjekket ikke, og rettelsen giver en
konflikt (testet), så et menneske må flette.

**Model i workeren:** priest står i `FIX_ON_UPSTREAM` i `../patchinfo.mjs`: «Grov model: SimulationCraft's grundmodel
med Aulas rettelser». Appen viser ikke længere den røde «mangler vigtige evner»-advarsel for priest.

### Målt (SIMC_REF 3c1d319 + alle rettelser, native bygning, 1000 iterationer, seed 42, Patchwerk)

Auditens syntetiske profiler (udstyr fra fixtures; level 20 bruger level 5-10-udstyr, wand 279896; level 40 bruger
level 30-40-udstyr, wand 7001). Til sammenligning: mage (Frost) på samme udstyr 48 DPS på level 40, hvor wanden er
32 % af skaden.

| Profil | Før: DPS | Før: venter | Efter: DPS | Efter: venter | Shoot (andel af skaden) | Smite / Holy Fire / Mind Flay |
|---|---|---|---|---|---|---|
| Discipline 20 | 7,2 | 68 % | **25,2** | 0 % | 144 skud | 4 / 2 / – |
| Discipline 40 | 15,0 | 76 % | **47,1** | 0 % | 171 skud (56 %) | 2 / 1 / – |
| Holy 20 | 7,1 | 68 % | **21,7** | 0 % | 144 skud | 4 / 2 / – |
| Holy 40 | 12,1 | 81 % | **39,5** | 0 % | 173 skud | 4 / 1 / – |
| Shadow Magic 20 | 9,9 | 56 % | **22,3** | 0 % | 141 skud | – / – / 6 |
| Shadow Magic 40 | 42,9 | 49 % | **64,3** | 0 % | 131 skud (25 %) | – / – / 18 |

Kontrolleret i et lokalt bygget worker-image (Dockerfile, alle fem rettelser, via `/run`, 1000 iterationer): Discipline
20/40 25,1/47,1, Holy 21,7/39,3, Shadow 22,3/64,0, 0 % venter; DungeonSlice kører uden fejl (Holy 40: 31,3).

Håndtjek af Shoot: Shadow 40 og mage Frost 40 (samme wand 7001, ingen Wand Specialization) rammer begge for 44;
Discipline 40 med Wand Specialization 2 (+25 % i spildataen) rammer for 54 (44 × 1,25 = 55 før afrunding af
gennemsnittet). Discipline 40 er nu på niveau med Frost-magen (47 mod 48); Shadow 40 ligger over (64), fordi Shadowform
og DoTs bærer, og wanden fylder hullerne.


## warlock

**Hvad:** Tilføjelser til upstreams warlock-grundmodel (Shadow Bolt, Immolate, Corruption og Imp). Auditten fandt
9-17 DPS og 75-78 % venter på alle tre specs: warlocken var tom for mana efter ca. 30 s (ingen Life Tap, ingen wand),
og specs kunne ikke skelnes (samme tre spells for alle).

**Rettelsen** (alle tal fra spildata via `simc spell_query`; kilde-id: spell level):

- **Life Tap** (1454: 6, 1455: 16, 1456: 26, 11687: 36, 11688: 46, 11689: 56): mana = effekt 1 (med «points per
  level» op til rankens max-level) + Spirit, × (1 + Improved Life Tap 10/20 %). Samme formel som
  wowsims/forever `lifetap.go`. Ingen mana-pris, så femsekundsreglen nulstilles ikke (simc nulstiller den kun ved
  mana-forbrug).
- **Shoot** (wand, 5019): samme model som mage- og priest-rettelsen (wandens våbenskade, spell-tabellen, ingen
  rustning, wandens hastighed). Står sidst i rotationen og bruges kun, når intet andet kan kastes (typisk under level
  6 uden Life Tap).
- **Bane of Agony** (980: 8, 1014: 18, 6217: 28, 11711: 38, 11712: 48, 11713: 58; Forevers navn for Curse of Agony,
  instant, 24 s): et tick i første tredjedel af varigheden giver halvdelen af grundværdien, i anden hele, i sidste
  halvanden gang; spell power-andelen stiger ikke (wowsims/forever `agony.go`, efter Forevers patch notes).
- **Siphon Life** (talent; 18265: 30, 18879: 38, 18880: 48, 18881: 58): Periodic Health Leech; kun skaden
  simuleres.
- **Shadowburn** (talent; 17877: 20 … 18871: 56): instant, 15 s nedkøling; kun effekt 2 (skaden).
- **Conflagrate** (talent; 1293817: 25, 1293818: 32, 17962: 40 … 18932: 60): kun klar, når warlockens Immolate
  tikker på målet, og fjerner den.
- **Incinerate** (talent; 412758: 40, 1293812: 50, 1293813: 60): +25 % (effekt 2), hvis målet har warlockens
  Immolate.
- **Wrack** (talent; 1316697: 40): kanaliseret i 6 s; mens den tikker, får warlockens andre Shadow-DoTs +10 %
  (effekt 2).
- **Improved Shadow Bolt** (talent 17793): et Shadow Bolt-crit giver Shadow Vulnerability (17794, 4-20 % efter rank,
  12 s) på warlockens Shadow-skade.
- Talenternes passive effekter (Improved Corruption, Bane, Ruin, Cataclysm, Suppression …) læses som hidtil af
  upstreams `parse_all_passive_talents()`.

**Rotation** (fælles; spec-delen styres af, hvilke talenter warlocken har):

```
precombat: summon_imp
life_tap,if=mana.pct<20
shadowburn                                   # Destruction
conflagrate,if=dot.immolate.ticking          # Destruction
bane_of_agony,if=!ticking
corruption,if=!ticking|remains<2
siphon_life,if=!ticking                      # Affliction
immolate,if=!ticking|remains<2
wrack,if=dot.corruption.ticking&dot.bane_of_agony.ticking   # Affliction 40
incinerate,if=dot.immolate.ticking           # Destruction 40
shadow_bolt
shoot
```

**Antagelser:**

- **Life Tap koster ikke liv.** Spillerens liv er uendeligt i simc (ingen indgående skade i en DPS-simulering; samme
  for alle klasser). Det svarer til en gruppe med en healer. Solo uden healer ville warlocken skulle bruge Drain
  Life, bandager eller pauser, og tallet er da for højt. Med 34-66 Life Taps på 300 s er det den største enkelte
  antagelse; den står i appens gule advarsel.
- Shadow Vulnerability og Wrack-forstærkningen ligger på warlocken (kun dens egen skade påvirkes); med flere mål
  gælder de for alle mål.
- Demonology har intet ud over Imp (upstreams, med stats tilpasset level 3-10) og passive talenter. Voidwalker,
  Felhunter, Succubus og Demonic Sacrifice er for store til denne rettelse.
- Ikke med: Drain Life/Soul, Searing Pain, Soul Fire, Curses (Elements, Recklessness), Nightfall, Amplify Curse,
  Bane of Doom og Demonic Pact.

**Filer:** `engine/class_modules/sc_warlock.cpp`, `engine/class_modules/apl/warlock.cpp` (mellem
`//warlock_apl_start` og `//warlock_apl_end`). Kilde: forken `RasmusAaenDev/simc-forever`, branch `aula/warlock` (én
commit oven på `SIMC_REF`); patchen er `git diff 3c1d319..aula/warlock`. Den passer også uændret på upstream `main`
`1b8e01d`.

**Upstream-tjek (`warlock.check`):** upstream opretter selv `life_tap`, `shoot` og `bane_of_agony` (`has_action`),
APL'en bruger `"life_tap` og `"bane_of_agony`, og `sc_warlock.cpp` har ikke vores markør. Har upstream kun en del
(fx Life Tap uden wand), holder tjekket ikke, rettelsen giver en konflikt (testet), og et menneske må flette.

**Model i workeren:** warlock står i `FIX_ON_UPSTREAM` i `../patchinfo.mjs`: «Grov model: SimulationCraft's
grundmodel med Aulas rettelser». Appen viser en gul advarsel pr. spec med det, rettelsen ikke dækker (pets, Life
Tap uden livsomkostning; `lib/sim-model-gaps.ts`).

### Målt (SIMC_REF 3c1d319 + alle rettelser, native bygning, 1000 iterationer, seed 42, Patchwerk)

Auditens syntetiske profiler (udstyr fra fixtures, ikke level-tilpasset; se auditten §11). Til sammenligning på samme
udstyr: Frost-mage 51, Shadow-priest 64, Ret-paladin 84 på level 40.

| Profil | Før: DPS | Før: venter | Efter: DPS | Efter: venter | Life Tap | Største kilder (efter) |
|---|---|---|---|---|---|---|
| Affliction 20 | 9,9 | 77 % | **25,1** | 0 % | 52 | Shadow Bolt 34 %, Immolate 23 %, Agony 21 % |
| Affliction 40 | 16,8 | 78 % | **62,5** | 0 % | 34 | Wrack 33 %, Agony 20 %, Corruption 18 %, Siphon Life 10 % |
| Demonology 20 | 9,4 | 74 % | **22,7** | 0 % | 57 | Shadow Bolt 31 %, Agony 24 %, Immolate 22 % |
| Demonology 40 | 14,8 | 75 % | **47,3** | 0 % | 51 | Shadow Bolt 32 %, Agony 23 %, Immolate 23 % |
| Destruction 20 | 9,2 | 76 % | **24,7** | 0 % | 66 | Shadow Bolt 22 %, Immolate 21 %, Shadowburn 15 % |
| Destruction 40 | 15,3 | 77 % | **60,4** | 0 % | 64 | Immolate 21 %, Conflagrate 17 %, Incinerate 14 %, Shadowburn 14 % |

Kontrolleret i et lokalt bygget worker-image (Dockerfile, alle syv rettelser, via `/run`, 1000 iterationer): samme tal
inden for støjen (Affliction 20/40 25,0/62,6, Demonology 22,7/47,2, Destruction 24,6/60,4); `/health` melder
`warlock applied`, og resultatet har «Grov model: SimulationCraft's grundmodel med Aulas rettelser». DungeonSlice kører
uden fejl (Affliction 40: 45,6, Destruction 20: 18,1).

Imp'ens andel er 2-5 % (upstreams model). Bane of Agony tikker 14-41 på Affliction 40 (opbygningen virker); Shadow
Vulnerability har ca. 6 % oppetid på Destruction 20 (5 % crit).

## shaman

**Hvad:** Tilføjelser til upstreams shaman-grundmodel (melee, Earth/Flame Shock, Flametongue/Rockbiter, Strength of
Earth). Auditten fandt, at Elemental og Restoration blev simuleret som nærkæmpere uden Lightning Bolt (forkert rolle),
og at Enhancement manglede Stormstrike, Windfury, Flurry og Maelstrom Weapon.

**Valg af rotation:** `variable.caster` = ingen Stormstrike og mindst ét af førsterække-talenterne i Elemental
(Convection, Concussion) eller Restoration (Improved Healing Wave, Tidal Focus). Casters bruger listen `caster` og
står på afstand (ingen auto-attack); alle andre, også shamaner uden talenter, er nærkæmpere som hos upstream.

**Rettelsen** (spildata via `simc spell_query`; kilde-id: spell level):

- **Lightning Bolt** (403: 1, 529: 8, 548: 14, 915: 20, 943: 26, 6041: 32, 10391: 38, 10392: 44, 15207: 50, 15208: 56)
  og **Chain Lightning** (421: 32, 930: 40, 2860: 48, 10605: 56; 6 s nedkøling).
- **Elemental Focus** (16164): 10 % chance pr. kast af en skade-spell (også et miss) for Clearcasting (16246): næste
  skade-spell er gratis (wowsims/forever).
- **Lightning Overload** (408438): 10/20/30 % chance for en kopi af Lightning Bolt/Chain Lightning med halv skade og
  uden pris. Antagelse: kopien bruger hovedspellens spildata (Forever har egne overload-rækker, fx 408439).
- **Lightning Mastery** (16166, 180 s): 15 s med −0,5 s på Lightning Bolt og ingen nedkøling på Chain Lightning; varer
  hele tiden (wowsims/forever).
- **Water Shield** (Restoration-talent 408510): 3 kugler; et spell-crit giver 2 % af max mana (408511), højst hver
  3,5 s. Mana ved at blive ramt er ikke med (Patchwerk slår ikke).
- **Searing Totem** (3599: 10 … 10438: 60): totemets «Attack» (3606, 6350, 6351, 6352, 10435, 10436) hvert 2,2 s i
  totemets levetid, modelleret som en DoT fra shamanen med angrebets skade og SP-koefficient (0,017) og shamanens
  hit/crit. Bruges af både casters og nærkæmpere.
- **Stormstrike** (talent 17364): 150 % normaliseret våbenskade (effekt 1 + 3) og +20 % på næste Lightning Bolt, Chain
  Lightning eller Earth Shock (effekt 2, én ladning, 12 s).
- **Flurry** (talent 16256/16257): et nærkamps-crit giver 3 ladninger med +6-30 % angrebshastighed (talentets rank);
  hvert hvidt slag bruger en.
- **Windfury Totem** (8512/8515/8516: 32, 10613/10609/10608: 42, 10614/10612/10610: 52): totemet som selv-aura (som
  upstreams Strength of Earth). Main hand-slag har 20 % chance (0,1 s ICD) for ét ekstra slag med +AP (95/179/246).
  Wowsims/forever's Enhancement bruger Flametongue Weapon + Windfury Totem; Windfury Weapon er ikke med.
- **Maelstrom Weapon** (talent 408498/408505): nærkampsslag giver stakke med 20 slag pr. minut-rate efter
  våbenhastigheden (wowsims/forever: målt 10, fordoblet i patch notes, «TODO»); hver stak −4 % pr. talentpoint på
  Lightning Bolts kastetid og pris; Lightning Bolt ved 5 stakke.
- **Rage of the Farseer** (talent 425336, 180 s): +30 % angrebshastighed i 25 s.
- **Mana Spring Totem** (5675: 26, 10495: 36, 10496: 46, 10497: 56; aura 5677/10491/10493/10494): totemet som
  selv-aura (som Strength of Earth), Periodic Energize hvert 2. s med 4/6/8/10 mana (effekt 1) i 300 s; Restorative
  Totems (16187, Restoration) +5-25 %. Bruges af alle specs (wowsims/forever's Elemental og Enhancement sætter det
  før kampen). Tilføjet 2026-11-12.
- **Mana Tide Totem** (Restoration-talent; 16190, 17354: 38, 17359: 48, 1325256: 58; aura 16191/17355/17360/1325257):
  88/133/197/290 mana hvert 3. s i 12 s («${$d-1} sec»), 300 s nedkøling. Kun ét vandtotem ad gangen: Mana Tide
  tager Mana Spring ned (som wowsims/forever), og Mana Spring sættes igen bagefter. Tilføjet 2026-11-12.

**Rotation:**

```
precombat: variable,name=caster,…; flametongue_weapon / strength_of_earth_totem / windfury_totem (kun nærkamp); water_shield;
           mana_spring_totem
default:   run_action_list,name=caster,if=variable.caster
           auto_attack, strength_of_earth_totem, windfury_totem, mana_spring_totem,if=!buff.mana_spring.up,
           rage_of_the_farseer, searing_totem,if=!ticking,
           flame_shock,if=!ticking|remains<1, stormstrike, lightning_bolt,if=buff.maelstrom_weapon.stack=5,
           earth_shock,if=dot.flame_shock.ticking|!action.flame_shock.enabled
caster:    water_shield, mana_tide_totem,if=mana.pct<50, mana_spring_totem,if=!buff.mana_spring.up&!buff.mana_tide.up,
           mana-fase (variable mana_phase: 1 under 10 % mana, 0 over 40 %), searing_totem,if=!ticking,
           lightning_mastery, flame_shock (ikke i mana-fasen), chain_lightning,if=mana.pct>80|buff.clearcasting.up,
           lightning_bolt,if=!variable.mana_phase|buff.clearcasting.up
```

**Antagelser:**

- **Mana-fasen** (10 %/40 %, som priest) erstatter wand: shamanen har ingen. Målt (500 iterationer, Elemental 20 og
  40): 5/30, 20/60 og 10/80 ligger inden for −7 % og +2 % af 10/40; uden mana-fase er det 6-8 % lavere. Chain
  Lightning kun over 80 % mana (eller gratis): ved 40 % (wowsims' level 60-grænse med mana-drikke) bruger den manaen
  dårligere (Elemental 40: 37,4 mod 40,0).
- **Elemental og Restoration er mana-begrænsede:** 67-80 % venter er tid, hvor shamanen venter på mana (ingen wand
  og ingen drikke i en kamp). En Elemental på level 40 med 2240 mana og ca. 11 mana/s i regen kan kaste ca. 5.600 mana
  på 300 s; Mana Spring Totem lægger ca. 900 til (3 mana/s fra level 36), og Mana Tide (Restoration) ca. 530-700.
  Under level 26 er der intet totem. Det er vores bedste bud på en shaman uden mana-drikke, ikke målt mod spillet.
  En kortere kamp (som i en dungeon mellem drikkepauser) starter med fuld mana; Patchwerks 300 s er hård for casters.
- Stormstrike-debuffen, Flurry og Maelstrom ligger på shamanen (ét mål).
- Ikke med: Magma-, Fire Nova-, Healing Stream- og Flametongue Totem, Totemic Recall, Windfury Weapon, Lightning
  Shield (skader kun den, der slår), Elemental Devastation, Call of Flame (rammer kun totemets egen spell), Improved
  Stormstrike, mana-drikke og healing. Nærkamp i mana-fasen (en shaman uden wand kunne slå med våbnet) er heller ikke
  med: casters står på afstand.

**Filer:** `engine/class_modules/sc_shaman.cpp`, `engine/class_modules/apl/shaman.cpp` (mellem `//shaman_apl_start`
og `//shaman_apl_end`). Kilde: forken `RasmusAaenDev/simc-forever`, branch `aula/shaman` (to commits oven på
`SIMC_REF`); patchen er `git diff 3c1d319..aula/shaman`. Den passer også uændret på upstream `main` `1b8e01d`.

**Upstream-tjek (`shaman.check`):** upstream opretter selv `lightning_bolt`, `stormstrike` og `mana_spring_totem`
(`has_action`), APL'en bruger `"lightning_bolt`, `"stormstrike"` og `"mana_spring_totem`, og `sc_shaman.cpp` har ikke
vores markør.

**Model i workeren:** shaman står i `FIX_ON_UPSTREAM` i `../patchinfo.mjs` («Grov model: SimulationCraft's grundmodel
med Aulas rettelser»). Appen viser en gul advarsel pr. spec (totems, mana, healing; `lib/sim-model-gaps.ts`).

### Målt (SIMC_REF 3c1d319 + alle rettelser, native bygning, 1000 iterationer, seed 42, Patchwerk)

| Profil | Før: DPS | Før: venter | Efter: DPS | Efter: venter | Største kilder (efter) |
|---|---|---|---|---|---|
| Elemental 20 | 22,6 (nærkamp) | 84 % | **16,2** | 69 % | Searing Totem 42 %, Lightning Bolt 40 %, Flame Shock 18 % |
| Elemental 40 | 55,7 (nærkamp) | 87 % | **40,0** | 79 % | Searing Totem 35 %, Lightning Bolt 34 %, Flame Shock 22 %, Chain Lightning 10 % |
| Enhancement 20 | 21,6 | 80 % | **26,0** | 81 % | melee 31 %, Searing Totem 25 %, Flame Shock 20 %, Flametongue 15 % |
| Enhancement 40 | 86,8 | 81 % | **113,8** | 76 % | melee 41 %, Stormstrike 24 %, Flametongue 14 %, Windfury 10 % |
| Restoration 20 | 23,9 (nærkamp) | 85 % | **15,1** | 73 % | Searing Totem 45 %, Lightning Bolt 36 % |
| Restoration 40 | 56,7 (nærkamp) | 87 % | **36,1** | 74 % | Searing Totem 38 %, Lightning Bolt 34 % |

Kontrolleret i et lokalt bygget worker-image (via `/run`, 1000 iterationer): Elemental 20/40 16,2/40,2, Enhancement
26,0/114,1, Restoration 15,1/36,0; `/health` melder `shaman applied`, og resultatet har «Grov model …». DungeonSlice
kører uden fejl (Elemental 40: 27,5, Enhancement 40: 100,1).

Elemental og Restoration falder, fordi «før» var en nærkæmper med en 2H-mace (en anden spillestil); «efter» er en
caster på afstand uden mana-hjælp. Tallet kan ikke sammenlignes med før, kun med andre casters på samme udstyr (mage
51, priest 64 på level 40). Enhancement 40 stiger 31 % (auditens skøn var 20-40 %).

#### Mana Spring og Mana Tide (tilføjet 2026-11-12; samme indstillinger)

| Profil | Før | Efter | Venter før → efter | Mana fra totems (efter) | Største kilder (efter) |
|---|---|---|---|---|---|
| Elemental 20 | 16,2 | **16,2** | 69 % → 69 % | ingen (Mana Spring fra level 26) | uændret |
| Elemental 40 | 40,0 | **44,3** | 79 % → 76 % | Mana Spring 897 | Lightning Bolt 36 %, Searing Totem 31 %, Flame Shock 23 %, Chain Lightning 10 % |
| Enhancement 20 | 26,0 | **26,0** | 81 % → 81 % | ingen | uændret |
| Enhancement 40 | 113,8 | **118,1** | 76 % → 73 % | Mana Spring 895 | melee 39 %, Stormstrike 26 % (41 mod 37) |
| Restoration 20 | 15,1 | **15,1** | 73 % → 73 % | ingen | uændret |
| Restoration 40 | 36,1 | **41,9** | 74 % → 67 % | Mana Spring 845, Mana Tide 699 | Lightning Bolt 42 %, Searing Totem 33 %, Flame Shock 23 % |

Kontrolleret i et lokalt bygget worker-image (via `/run`, 1000 iterationer, Patchwerk / DungeonSlice): Elemental 40
44,3 / 31,4, Restoration 40 42,0 / 32,9, Enhancement 40 118,1 / 103,8, level 20 uændret.

Elemental 40 ligger stadig langt under Enhancement 40 (44 mod 118). Det er manaen: Mana Spring giver ca. 3 mana/s,
mens en Lightning Bolt koster 121 (level 40, Convection 5), og spirit-regen kører kun uden for femsekundsreglen.
Uden mana-drikke og med 300 s Patchwerk er en caster-shaman uden wand mana-begrænset; i loggen er manaen brugt efter
ca. 25 s, og resten af kampen veksler mellem venten og korte kast-perioder.
