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
`rank.<spell>.find_rank()`), `create_action`, `init_action_list` og `init_base_stats`.

**Filer:** `engine/class_modules/sc_mage.cpp` (modulet), `engine/class_modules/apl/mage.cpp` (rotationen mellem
`//mage_apl_start` og `//mage_apl_end`), `engine/class_modules/apl/mage.hpp` (erklæring af `mage_apl::mage`).
Filerne ligger allerede i simcs byggelister, så intet andet skal røres.

**Upstream-tjek (`mage.check`):** `sc_mage.cpp` har flere end 150 linjer, `apl/mage.cpp` indeholder `add_action`,
og `sc_mage.cpp` indeholder ikke vores markør `AULA-RETTELSE`. Ved `SIMC_REF` 3c1d319 er `sc_mage.cpp` 47 linjer og
APL'en tom; med rettelsen er modulet 240 linjer.

### Spells (alle tal fra spildata, intet opfundet)

Kun spells en mage lærer hos træneren; id'er og levels er slået op i `engine/dbc/generated/sc_spell_data.inc`
(class mask 0x80) og kontrolleret med `simc spell_query=spell.id=<id>`.

| Spell | Ranks (id: level) | Bemærkning |
|---|---|---|
| Frostbolt | 116:4, 205:8, 837:14, 7322:20, 8406:26, 8407:32, 8408:38, 10179:44, 10180:50, 10181:56, 25304:60 | direkte frostskade; slow-effekten modelleres ikke |
| Fireball | 133:1, 143:6, 145:12, 3140:18, 8400:24, 8401:30, 8402:36, 10148:42, 10149:48, 10150:54, 10151:60, 25306:60 | direkte skade + DoT fra spildata |
| Fire Blast | 2136:6, 2137:14, 2138:22, 8412:30, 8413:38, 10197:46, 10199:54 | instant, 8 s nedkøling og 1,5 s GCD fra spildata |
| Arcane Missiles | 5143/7268:8, 5144/7269:16, 5145/7270:24, 8416/8419:32, 8417/8418:40, 10211/10273:48, 10212/10274:56, 25345/25346:56-60 | kanaliseret driver; hvert tick udløser spildataens Arcane Missile. Ranken vælges efter missilets level |

Udeladt med vilje:

- **Talenter**: kun `parse_all_class_passives()` (ikke `parse_all_passive_talents()` som warlock), fordi
  simulatoren endnu ikke kan læse talenter pålideligt fra armory. **Arcane Wrath** (1326079-82) og **Ice Lance**
  (1312002 m.fl.) er talenter i Forever (`trait_data.inc`) og er derfor ikke med; Fingers of Frost er en talent-proc.
- **Fire Blast 400616-400623** (15 s nedkøling, ingen GCD) findes også i spildataen, men ser ud til at stamme fra en
  rune-/sæsonvariant; vi bruger trænerens Fire Blast (2136-familien).
- **Evocation** (12051) er ikke implementeret: den er en kanaliseret buff (+1500 % mana-regeneration og regeneration
  under casting i 8 s, 8 min. nedkøling), som kræver en egen regen-model i simc. Med 8 min. nedkøling ville den højst
  blive brugt én gang i en kamp på 5 min., og den er ikke ligetil at gøre rigtigt. simc håndterer selv ressourcen:
  løber magen tør, venter den på regeneration (ses som `Waiting` i rapporten).
- Ingen basis-konstanter for crit o.l.: modsat warlock/shaman/priest bruger mage `player_t`'s værdier fra spildata.
- Bog-ranks på level 60 (Frostbolt 25304, Fireball 25306, Arcane Missiles 25345) tages med som i warlock-modulet
  (25307), selvom de i spillet kræver en bog.

### Rotation (Frost, standard)

```
fire_blast      # på nedkøling, når den er tilgængelig
frostbolt       # spam
fireball        # kun før Frostbolt er lært (level 1-3)
```

Frost er den sikreste og simpleste basisrotation til leveling: Frostbolt-spam med Fire Blast på nedkøling. Ice Lance
og Fingers of Frost er talent-afhængige og udelades. Kilder (brugerens søgning): Icy Veins «WoW Forever Arcane Mage
Leveling», Mobalytics' Fire- og Arcane Mage-guides og Skycoach' Mage-guide. Ingen mana-tærskel: Evocation er ikke
med (se ovenfor), så lav mana håndteres af simc selv. Arcane Missiles er implementeret som handling, men er ikke i
standardrotationen (den kan ikke vælges via workeren, som ikke tillader `actions=`).

### Målt og håndregnet (SIMC_REF 3c1d319, 1000 iterationer, seed 42)

Profiler fra guildens armory (fixtures med fiktive navne: `test/fixtures/mage-35.simc`, `mage-20.simc`).

| Profil | Patchwerk DPS | DungeonSlice DPS | Waiting |
|---|---|---|---|
| mage 35 (gnome, «Testmage») | 16,4 | 15,3 | 66 % / 69 % |
| mage 20 («Testmagi») | 8,9 | 8,3 | 66 % / 68 % |
| mage 20 (anden profil) | 12,0 | 11,3 | 66 % / 67 % |
| mage 14 | 5,5 | 5,2 | 72 % / 73 % |
| mage 2 (kun Fireball, syntetisk) | 2,0 | – | – |

Håndregning for mage 35, Patchwerk (target level 38 → 17 % miss; crit 8,79 % × 1,5):

- **Frostbolt** rank 6 (8407, level 32): 134 + 1,7 × (35 − 32) = 139,1 (simc runder ned til 139) + 0,814 × 21
  frost-spellpower (11 generel + 10 frost fra udstyr) = **156,09** → simc-log: 156,094. Pr. cast: 156,09 × 0,83 ×
  (1 + 0,0879 × 0,5) = **135,3** (simc DPE 135); 3,0 s cast → **45,1 DPS** mens der er mana (simc DPET 45). 130 mana.
- **Fire Blast** rank 4 (8412, level 30): 163 + 1,8 × 5 + 0,429 × 11 = **176,72** → simc-log: 176,719. 165 mana, 8 s.
- **Mana:** 2259 i pulje + 8,69/s regeneration × 300 s = 2607 (simc «Mana Regen 2607,8») = 4866 i alt.
  Brugt: 31,9 Frostbolt × 130 + 4,0 Fire Blast × 165 = 4807. Skade: 31,9 × 135,3 + 4,0 × 151 = 4920 → **16,4 DPS**
  (simc 16,4). Magen er tør for mana efter ca. 40 s og venter 66 % af kampen; DPS er derefter bestemt af
  regenerationen. Det er realistisk for en mage der kaster uafbrudt i 5 min. uden at drikke, men betyder at
  tallet i høj grad måler mana og ånd (spirit), ikke kun skade.

Regression: hunter-11, warrior-36, shaman-37 og warlock-27 giver bit-for-bit samme DPS med og uden rettelsen
(Patchwerk og DungeonSlice, samme seed).
