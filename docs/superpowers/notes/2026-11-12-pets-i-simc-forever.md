# Pets i simc-forever: hunter og warlock (research, 2026-11-12)

Ren research. Der er ingen ændringer i app eller simc-worker. Kilder: upstream `simulationcraft/simc-forever` på
`main` `1b8e01d` (11-11, build 70888), lokal native simc (build 70862) til `spell_query`, wowsims/forever `origin/master`
`129fcd89e` (12-11) og en håndfuld Forever-guides. Arbejdskopierne ligger i `~/.cache/aula-simc-work/` (`upstream-head/`
er en git-worktree på upstream `main`, `wowsims/forever` er en sparse clone, og filerne er læst med `git show`).

## 1. Konklusion

- **Upstream har ingen hunter-pet, og der er ingen tegn på arbejde på den.** `sc_hunter.cpp` er 334 linjer uden
  pet-kode. Issue #41 har «Pets» som første, uafkrydsede punkt. Der er ingen pet-branch og ingen PR, og seneste
  hunter-commit er PR #57 (seriallos, 11-03). Warlock har kun Imp, og den er tilpasset level 3-10.
- **Det vigtigste tal findes allerede i simc.** Pettens basis-DPS pr. level er `creature_auto_attack_dps` i simcs
  `engine/dbc/generated/expected_stat.inc`, som dækker level 1-133. Level 60 giver 60,45292, præcis wikiens
  «60,45». wowsims bruger samme kolonne (`core.CreatureAutoAttackDpsMaxLevel = 60.4529…`), og dens pet-AP på målte
  pet-sheets (level 11/17/30: 36, 61 og 103) passer med `floor(4,2 × creature_dps(level))` for simcs tal på de tre
  level (8,600 → 36, 14,564 → 61, 24,694 → 103). Dermed er level 10-45 dækket for hunter-petten.
- **wowsims/forever er et godt facit, men kun for level 60.** Den har hunter-pet (alle 19 familier, Focus 10/s,
  happiness, Unleashed Fury, Ferocity, Frenzy, Bestial Wrath, Focused Fire, Intimidation) og alle fire dæmoner med
  Demonic Sacrifice, Soul Link, Master Demonologist og Demonic Knowledge. Formlerne er skrevet som andele af
  creature-værdierne, så de kan flyttes til andre level. Undtagelser: Felhunterens melee (fast 70-97) og dæmonernes
  Str/Agi/Int er level 60-konstanter.
- **Kill Command findes ikke for Forever-hunteren.** Spell 409379/409396/409418 ligger i spildataen (SoD-rester), men
  hverken i `class_spells.inc` eller `trait_data.inc`, og wowsims har den ikke. Den skal ikke bygges.
- **Effekten er stor.** Skøn (§5): en hunter-pet på level 20-40 gør omtrent lige så meget skade som hunteren selv i
  vores nuværende model (pet ≈ 0,8-1,3 × hunterens egen DPS), så hunter-tallene er ca. 1,8-2,3 gange for lave for alle
  specs, der har en pet. Undtagelsen er MM med Lone Wolf. For warlock giver Succubus i stedet for Imp et skønnet
  +40-55 % på Demonology 40, og Demonic Sacrifice (Imp → +15 % Shadow) ca. +10-15 % på Affliction og Demonology.
- **Anbefaling:**
  1. Byg warlock-dæmonerne selv, som en udvidelse af vores `warlock.patch`. Upstream er stille, og risikoen for
     kollision er lav.
  2. Hunter-petten skal kunne gå upstream. Spørg først på #41, om nogen arbejder på pets. Hører vi intet inden for ca.
     2 uger, bygges den som en upstream-klar PR (egen fil eller sektion i `sc_hunter.cpp`). Indtil den er merget,
     ligger den som privat patch.
  3. Send to små ting upstream allerede nu: fundet om `expected_stat`, og at familie-passiverne mangler i den
     genererede data (issue #5).

## 2. Upstream-status

### Generel pet-model (`engine/player/pet.hpp/.cpp`, 156 + 515 linjer)

`pet_t` er retail-simcs pet. Den har `owner_coeff` (`ap_from_ap`, `ap_from_sp`, `sp_from_ap`, `sp_from_sp`, `armor`,
`health`), og `update_stats()` opdaterer pettens værdier fra ejeren på hvert heartbeat. **Som standard arver den
ejerens crit, haste, auto-attack-speed og hit** (`pet_crit()`, `composite_melee_haste()`, `hit_exp()`). Det er
retail-adfærd. For en Forever-hunter-pet er det delvist rigtigt:

- Ejerens crit (100 %) og 10 % af AP passer med Warcraft Tavern og wowsims.
- Haste passer kun delvist: wowsims lader kun Rapid Fires melee-haste nå petten, ikke quiver-/ranged-haste.
- `owner_coeff.ap_from_ap = 0.1` virker kun, hvis `default_ap_type()` giver hunterens RAP. wowsims tager
  `max(AP, RAP)` og fastfryser AP og liv ved summon.

Konklusion: `pet_t` kan genbruges, men en `hunter_pet_t` skal override `composite_melee_haste` og
`composite_melee_auto_attack_speed` (ingen quiver-haste) og selv sætte basis-AP og våben.

### `sc_hunter.cpp` (upstream HEAD, 334 linjer)

Modulet har Auto Shot, Aspect of the Hawk, Serpent Sting og Arcane Shot. Der er ingen `hunter_pet_t`, intet `pet`
og ingen focus. TODO'erne er de samme som i auditten («Default to max distance», «ItemDamageRanged», «Does plain +AP
contribute to RAP?», «Set melee distance for survival hunter», «Dodge, parry chance»). Hunter-koden er skrevet af
seriallos (PR #24 Auto Shot/RAP, #37/#38 ammo/quiver, #57 low level). Dave Hendler har branches `ammo`,
`quiver-haste` og `rogue` (rogue: Backstab og combo points, 11-01). **Ingen branch eller commit nævner pets.**

### `sc_warlock.cpp` (upstream HEAD, 354 linjer)

Modulet har `warlock_pet_t : pet_t` og en skabelon `warlock_pet_action_t<Base>` (`parse_action_effects_t`), og
dermed et rigtigt fundament for flere dæmoner. Kun `imp_pet_t` med Firebolt (ranks 3110 … 11763) findes:
`owner_coeff.armor = 0.35`, `ap_from_sp = 0.17`, `health = 1.5`, `intellect_per_owner = 0.3`. Manaen er
`29 + 9,5 × level` («fit to observations level 3-8 but starts to break down at level 9»), og regen er fast
`1,65/2,73` mana/s («this is at level 7, probably need a table»). Derfor går Imp'en tør for mana over level 10, og
den står kun for 2-5 % af warlockens skade i vores målinger (PATCHES.md, warlock). **Imp-modellen er altså også for
lav over level 10.** wowsims' tal på andre punkter matcher upstream (AP = 0,17 × spell damage, armor = 0,35 ×
ejerens).

### PR'er og issues (kun læst)

- **#41 Hunter Module** (åben): «Pets (melee, abilities, talent builds) - need to build out this list», uafkrydset.
  Bestial Wrath, Intimidation og Summon Hawk er heller ikke afkrydset.
- **#48 Warlock Module** (åben): Imp «Summon / melee» og Firebolt er afkrydset. Voidwalker, Succubus (Lash of Pain,
  Soothing Kiss), Felhunter, Infernal, Demonic Sacrifice og Soul Link er ikke.
- **#5 «[generator] Pet Spell Lookups»** (åben, 10-17): «Pet spells are not hooked up … likely not included in the
  generated data.» Bekræftet delvist: Bite, Claw, Lash of Pain, Torment, Spell Lock, Firebolt, Frenzy (19615) og
  Bestial Wrath findes i `spell_query`, men **familie-passiverne (Cat 17210, Bear 17208 osv.), Faster/Slower Attack
  og Cobra Reflexes gør ikke**. Dem bruger wowsims til familiernes skade, rustning og angrebshastighed.
- **#6 «Review constants»** (åben): relevant, hvis pet-konstanter ender i generatoren.
- Ingen PR'er om pets. Åbne PR'er: #59 warrior, #72 glancing blows og #73 ranged-stat-budget. #73 rammer hunterens
  ranged-våben og dermed hunter-tallene uafhængigt af petten.

### Hvad kan genbruges direkte?

- **Fra retail-simc:** reelt kun `pet_t`, `spawner` og `parse_action_effects_t`-skabelonen, som warlock allerede
  bruger. Retails `sc_hunter.cpp` (pet-specs, Kill Command, Barbed Shot, Focus på hunteren) er en helt anden spilmodel
  og ikke værd at flette ind.
- **Fra simc-forever selv:** `expected_stat_t::find(level).creature_auto_attack_dps`, `creature_health` og
  `creature_armor` (alle level), Bite- og Claw-ranks (spell level 1/8/16/24/32/40/48/56, Bite 35 Focus/10 s cd, Claw
  25 Focus), Lash of Pain (20/28/36/44/52/60, 12 s cd), Torment, Firebolt, Bestial Wrath og Demonic
  Sacrifice-effekterne.
- **Fra wowsims (MIT):** formlerne og konstanterne nedenfor kan oversættes linje for linje. Koden kan ikke kopieres,
  fordi den er Go.

## 3. Data: hunter-pet

| Hvad | Hvor | Dækker level 10-45? |
|---|---|---|
| Basis-DPS pr. level | simc `engine/dbc/generated/expected_stat.inc`, kolonne `creature_auto_attack_dps` (struct i `engine/dbc/expected_stat.hpp`). L10 7,62 · L20 17,10 · L30 24,69 · L40 32,59 · L60 60,45 | **ja** (1-133) |
| Pettens egen AP | wowsims `sim/hunter/pets.go`: `petAttackPower = 0.3 × 14 × creature_dps` (= 4,2 × dps), intet fra Strength; målt på level 11/17/30-sheets | ja, via tabellen |
| Swing før AP | `(creature_dps − ownAP/14) × 2,0 s`, ±20 % spredning, 2,0 s swing (pets.go `petSwingAverage`) | ja |
| Fra hunteren | 10 % af `max(AP, RAP)`, ejerens højeste crit (melee/ranged, minus 0,04 %/point våbenskill under max), ejerens ranged hit (spell hit × 17/8), 2 liv/Stamina, 30 % rustning. AP og liv fryses ved summon (pets.go `makeStatInheritance`, `keepSummonStats`). Warcraft Tavern bekræfter 10 % AP og 100 % crit | ja |
| Happiness | ×1,25 / 1,00 / 0,75; wowsims antager altid Happy (1,25) | – |
| Focus | 100 max, 10/s i ticks på 0,1 s (wowsims `sim/core/focus.go`); Bestial Discipline +10 %/rank | – |
| Familier | wowsims `sim/hunter/pet_families_auto_gen.go`: 19 familier, hver med «Tamed Pet Passive» (fx Cat 17210) og evner. **Familiens skade-/rustnings-/livsmodifikatorer står i de passiver, som simc ikke har** (#5) | samme for alle level |
| Angrebshastighed | Faster Attack I-VII / Slower Attack II-III og Cobra Reflexes som option; normaliseret (hurtigere swing = mindre pr. swing, samme DPS) | – |
| Evner | Bite (17253: 8 … 17259: 54 ved level 40) og Claw (16827: 5 … 16830: 19 ved level 24) er faste skader uden AP. Autocast tager længste cooldown først og venter aldrig på focus | **ja** (simc-spildata) |
| Talenter (BM) | Focused Fire 1223755 (+2 %/rank på hunter og pet), Unleashed Fury 19616 (max +20 %), Ferocity 19598 (crit), Frenzy 19621 (chance for 19615: +30 % angrebshastighed i 8 s efter crit), Bestial Wrath 19574 (+50 % i 18 s, 120 s cd, række 7/30 point), Bestial Discipline, Intimidation | ja (spildata) |
| Lone Wolf | 409979/415370 i `trait_data.inc` (MM): +20 % skade uden aktiv pet | ja |
| Kill Command | **ikke lærbar** (kun SoD-rækker i spildataen) | – |

Forbehold, som wowsims selv skriver i sine TODO'er: pettens liv pr. Stamina er kun læst én gang. Crit ved lav
våbenskill og hit er ikke læst på et pet-sheet. Familie-skaden er taget fra passiverne, ikke målt.

## 4. Warlock-dæmoner

**Data (wowsims `sim/warlock/pets.go`, `talents_demonology.go`; andele læst på level 20 og 30):**

| Dæmon | Melee | Andet | Brugbar på level 10-45? |
|---|---|---|---|
| Imp | ingen | Firebolt (wowsims bruger kun rank 11763). Mana 576 + 5/Int ved level 60, MP5 = 0,30 × ejerens Int | Firebolt-ranks ja; **mana pr. level nej** (upstream-formlen holder kun til ca. level 9) |
| Voidwalker | `0,494 × creature_dps` pr. sekund før AP, ±26,4 %, **skade × 0,5**. AP 186 ved 60, «3 × level + 6» antaget | Torment/Suffering er threat, ikke skade | ja (andele) |
| Succubus | `0,698 × creature_dps` pr. sekund før AP, ±21,5 %. AP «3 × level + 6» (linje gennem level 20 og 30) | Lash of Pain: (basis + 0,429 × spell damage), 12 s cd; Unholy Power ganger | **ja**, bedst målt |
| Felhunter | fast 70-97 skade, × 0,8 (level 60) | Spell Lock, Devour Magic, Tainted Blood er utility | **nej**, melee er en level 60-konstant |
| Fra warlocken | AP = 0,17 × spell damage (som upstream), spell damage = 0,10 × warlockens, armor 0,35, liv 2/Stamina, warlockens spell crit som pettens crit (ikke live endnu ifølge wowsims' TODO), hit = warlockens spell hit (× 8/17 som melee hit) | | ja |

**Demonic Sacrifice i Forever (spildata, bekræftet):** 18788, Demonology række 3 (10 point, altså muligt fra ca.
level 19-20). Imp giver **Burning Shadow (18789: +15 % Shadow)**, Succubus **Touch of Fire (18791: +15 % Fire)**,
Voidwalker Fel Energy (18792: 2 % mana pr. 4 s) og Felhunter Fel Stamina (18790: 3 % liv pr. 4 s). Varigheden er
7200 s, og effekten forsvinder, når en dæmon tilkaldes. **Det er omvendt af original Classic**, hvor Imp gav Fire og
Succubus Shadow (Burning Wish/Touch of Shadow, 30 min). Icy Veins og wow.gg siger det samme for Forever.
**Demonic Pact** (425464, række 7) bevarer effekten, når en *anden* dæmon tilkaldes, så Icy Veins' Succubus-build
ofrer Imp'en og tilkalder Succubus. Guidernes level for Demonic Sacrifice er uenige (29 for Demonology, 41 for
Affliction og 55 for Destruction i Icy Veins' leveling-guides). Det afhænger af build-rækkefølgen; selve rækken er 3.

**Andre Demonology-talenter (Forever-træet, `trait_data.inc`):** Master Demonologist 23785 (række 6: Imp +Fire,
Succubus +Shadow, Voidwalker −Physical taget, Felhunter −magi taget, 10 % pr. effekt ved max; gælder både warlock og
dæmon), Soul Link 19028 (25228: mere skade for begge), Demonic Knowledge 412732 (spell damage op til 100 % af level
for begge), Unholy Power 18769 (+10 % dæmon-skade ved max), Improved Sayaad (Lash of Pain), Demonic Brand 1293695
(Searing Pain mærker målet, og dæmonens hits udløser ekstra skade), Fel Domination 18708 (næste summon −5,5 s og
−50 % mana; kun relevant, hvis dæmonen dør eller ofres midt i kampen), Master Summoner og Fel Vitality. wowsims
implementerer alle, der påvirker DPS.

**Spell-ID'er i simc:** Torment 3716 … (level 10/20/30/40, 5 s cd), Lash of Pain 7814/7815/7816/11778 (20/28/36/44),
Spell Lock 19244 (36) og Firebolt 3110 … 7802 (op til 38). Alle findes, så ranks kan slås op pr. level som Firebolt i dag.

## 5. Skøn og plan

### DPS-effekt (kvalitativt, regnet i hånden ud fra wowsims-formlerne; ikke simuleret)

**Hunter, level 20:** hvid skade 17,1 × 1,25 (happy) + lidt AP ≈ 22 DPS. Bite r3 (26/10 s) og Claw r3 (14 hver
ca. 3,9 s med den focus, der er tilbage) giver ca. 6 × 1,25 ≈ 8 DPS. Efter rustning og miss bliver det **ca. 15-22
DPS**. Vores model giver hunteren selv 16,5. **Samlet ca. ×1,9-2,3.**

**Hunter, level 40:** hvid skade 32,6 × 1,25 + 10 % af ca. 350 RAP ≈ 44 DPS. Bite r6 og Claw r5 giver ca. 14. Efter
rustning og miss bliver det ca. 35. BM-talenter (Unleashed Fury, Ferocity, Frenzy, Bestial Wrath 18/120 s) giver
×1,2-1,35, altså **ca. 30-45 DPS**. Vores model giver 36,6. MM/SV uden pet-talenter ligger lavere, og MM med Lone Wolf
får +20 % i stedet for petten.

Usikkerheden er ±30 %. Den største ukendte er målets rustning i vores kampe og hvor meget petten misser. Hunterens
egen rotation er også for tynd (auditten), så forholdet ændrer sig, når den bliver rettet.

**Warlock Demonology 40** (vores model 47,3 med Imp): Succubus ≈ 0,698 × 32,6 + (3 × 40 + 6)/14 ≈ 32 DPS før
rustning, ca. 20 efter, plus Lash of Pain ca. 4-5, plus Unholy Power. **Ca. +20-25 DPS (+40-55 %)**, mod Imp'ens
nuværende 1-2. Med Imp-sacrifice (+15 % Shadow) i stedet for en pet: ca. +5-7 DPS (Shadow er ca. 55-75 % af
skaden), og med Demonic Pact får man begge dele.

**Affliction 40** (62,5): Imp-sacrifice ca. +12-15 %, eller en Succubus-pet ca. +30 %. Hvad en Affliction-spiller
reelt har ude, er et spørgsmål om spillestil (guides bruger Voidwalker til solo-leveling).

**Level 20:** Succubus kan tilkaldes fra level 20. Voidwalkeren (level 10) giver kun ca. 3-5 DPS (halveret melee).

### Arbejde

| Del | Indhold | Skøn |
|---|---|---|
| (a) Enkel hunter-pet | `hunter_pet_t` med Focus-ressource, auto-attack fra `expected_stat`, Bite/Claw efter level, happiness- og familie-option (familiemodifikatorer håndkodet fra wowsims, indtil #5 er løst), arv fra owner (override haste), Focused Fire, Unleashed Fury, Ferocity, Frenzy, Bestial Wrath, Bestial Discipline, Lone Wolf; APL `summon_pet` + `bestial_wrath` | ca. 500-800 linjer, 3-5 dage inkl. regression og målinger. Lidt større end paladin-rettelsen |
| (b) Kill Command | findes ikke i Forever | 0 (byg ikke) |
| (b) Ranged-/melee-rotation | Multi-Shot, Aimed Shot, Rapid Fire, Hunter's Mark, Raptor Strike/Mongoose Bite-weaving, Summon Hawk, Sniper Shot | ca. 600-900 linjer, 4-7 dage. Mest kollisionsrisiko med seriallos |
| (c1) Warlock-dæmoner uden Demonic Sacrifice | Succubus (+ Lash of Pain), Voidwalker, Felhunter (melee som skøn), Imp-mana pr. level, `summon_*`-option eller APL-valg, Unholy Power, Soul Link, Master Demonologist, Demonic Knowledge | ca. 400-600 linjer, 2-3 dage. Skabelonen findes allerede |
| (c2) + Demonic Sacrifice/Pact | precombat-sacrifice; auraerne 18789/18791 ligger i spildataen | +½-1 dag |

### Anbefalet rækkefølge

1. **Warlock (c1 + c2) i vores `warlock.patch`.** Det er stort udbytte for lille indsats, upstream er stille (#48
   uden aktivitet siden 10-23), og vi ejer allerede filen. Ret Imp-manaen samtidig. Vis i appens gule advarsel, at
   Felhunter-skaden er et skøn.
2. **Hunter-pet (a) som upstream-bidrag.** Spørg på #41 (efter brugerens beslutning), om nogen arbejder på pets.
   Byg den derefter i en upstream-klar form på forken (`aula/hunter-pet`), og brug den som privat patch, til den er
   merget. Survival/BM-melee og ranged-rotationen (b) venter, til #59 (warrior) og #73 er afklaret, så vi ikke
   bygger to gange.
3. **Til upstream** (når brugeren vil):
   - **Issue/kommentar på #41/#48:** `expected_stat.creature_auto_attack_dps` er pettens basis-DPS pr. level
     (verificeret mod wowsims' målte pet-sheets på level 11/17/30 og wikiens 60,45).
   - **Kommentar på #5:** «Tamed Pet Passive»-familierne (17206-17223, 7000, 444831), Faster/Slower Attack og Cobra
     Reflexes mangler i den genererede spildata.
   - **Bemærkning:** `pet_t` arver ejerens haste, inklusive quiver-haste, hvilket ifølge wowsims ikke gælder for
     Forever-pets.
   - Senere selve hunter-pet-PR'en.

## 6. Kilder

- simc-forever: <https://github.com/simulationcraft/simc-forever>, `engine/player/pet.hpp`,
  `engine/class_modules/sc_hunter.cpp`, `sc_warlock.cpp`, `engine/dbc/generated/expected_stat.inc`, `trait_data.inc`;
  issues [#41](https://github.com/simulationcraft/simc-forever/issues/41),
  [#48](https://github.com/simulationcraft/simc-forever/issues/48),
  [#5](https://github.com/simulationcraft/simc-forever/issues/5),
  [#6](https://github.com/simulationcraft/simc-forever/issues/6); PR
  [#57](https://github.com/simulationcraft/simc-forever/pull/57).
- wowsims/forever (MIT): <https://github.com/wowsims/forever>, `sim/hunter/pets.go`,
  `sim/hunter/pet_families_auto_gen.go`, `sim/hunter/talents_beast_mastery.go`, `sim/core/focus.go`,
  `sim/core/base_stats_auto_gen.go`, `sim/warlock/pets.go`, `sim/warlock/talents_demonology.go`.
- Brugerens fund: [forever-hunter wiki – Pet Attack Formulas](https://github-wiki-see.page/m/classic-hunter/forever-hunter/wiki/Pet-Attack-Formulas)
  (bekræftet på basis-DPS 60,45 og happiness).
- [Warcraft Tavern – Hunter Pets (Forever)](https://www.warcrafttavern.com/forever/guides/hunter-pets/) (10 % AP,
  100 % crit, happiness 125/100/75 %, Focus regenererer løbende; happiness «bugged on the beta»).
- [Warcraft Tavern – Hunter (Forever)](https://warcrafttavern.com/forever/guides/hunter/) (Lone Wolf i MM).
- [Icy Veins – Demonology leveling (Forever)](https://www.icy-veins.com/wow-forever/demonology-warlock-leveling),
  [Destruction leveling](https://www.icy-veins.com/wow-forever/destruction-warlock-leveling),
  [Affliction leveling](https://www.icy-veins.com/wow-forever/affliction-warlock-leveling),
  [wow.gg – Demonology overview](https://wow.gg/guides/warlock-demonology-forever-overview),
  [Warcraft Tavern – Demonology](https://www.warcrafttavern.com/forever/guides/demonology-warlock/).
- Forever-bugtracker, citeret af wowsims for pet-hit og -crit:
  <https://github.com/ClassicWoWCommunity/forever-bugs/issues/394> og `/issues/331`.

## 7. Forbehold

- **Intet er simuleret.** DPS-skønnene i §5 er håndregnet ud fra wowsims-formlerne, med antaget rustning og miss.
  Behandl dem som størrelsesorden (±30 %).
- **wowsims er kun level 60.** At andelene af creature-værdierne gælder på level 10-45, bygger for hunter-petten på
  tre målte sheets (11/17/30), som passer præcist. For dæmonerne bygger det på målinger på level 20 og 30
  (Voidwalker kun 30). Felhunter-melee, Imp-mana og dæmonernes egne stats under level 60 er ukendte.
- Pettens liv, crit ved lav våbenskill, hit og familiemodifikatorerne er ikke målt i spillet (wowsims' egne TODO'er).
  Familiemodifikatorerne findes ikke i simcs data.
- At Kill Command ikke kan læres, bygger på, at den mangler i `class_spells.inc`/`trait_data.inc` og i wowsims, på
  data-build 70888. Den kan dukke op i en senere build.
- Guidernes level for Demonic Sacrifice er indbyrdes uenige. Spildataen siger række 3. Happiness er ifølge Warcraft
  Tavern buggy på beta.
- Lokal simc er build 70862; upstream `main` er 70888. Pet-spells er ikke sammenlignet mellem de to.
- Upstream-status er et øjebliksbillede fra 2026-11-12. Der kan være upubliceret arbejde.
