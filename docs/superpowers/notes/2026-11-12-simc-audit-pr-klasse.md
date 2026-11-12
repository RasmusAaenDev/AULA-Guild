# SimC-audit pr. klasse og spec (2026-11-12)

**Spørgsmål:** «Kan vi ikke gøre det samme for alle de andre klasser og specs, som vi gjorde for mage?»

**Kort svar:** Jo, men ikke på samme måde for alle. Upstream (`simulationcraft/simc-forever`) har kun en
*grundmodel* for warrior, hunter, shaman, druid, priest og warlock: få spells på lavt level og én rotation for hele
klassen. Ingen af dem modellerer spec-talenterne (Mortal Strike, Stormstrike, pet, Life Tap osv.). Tre af dem er i
praksis forkerte for flertallet af spillerne:

- Druid uden Moonkin Form kaster ingenting. Det gælder **alle druider under level 40**.
- Elemental- og Restoration-shamaner har ingen Lightning Bolt.
- Warlocks og priester løber tør for mana uden Life Tap/wand.

Druid, warrior og hunter bliver aktivt udviklet upstream lige nu. Shaman, warlock og priest gør ikke.

Alt herunder er målt mod SIMC_REF `3c1d319` (den, vi kører) og sammenlignet med upstream `main` `1b8e01d`
(2026-11-12). Der er ingen kodeændringer i appen eller workeren.

---

## 1. Overblik

DPS: Patchwerk, 1000 iterationer, dev-workeren `dev-aula-simc` (SIMC_REF 3c1d319 + vores mage-, paladin- og
rogue-rettelser). Profilerne er syntetiske, se §8. «Venter» er simcs *Waiting*: den andel af kampen, hvor ingen handling
var klar (typisk tom for mana eller rage, eller ingen spells at bruge).

Til sammenligning giver mage (vores rettelse) på samme udstyrsniveau **20-23 DPS på level 20** og **41-48 DPS på
level 40**.

| Klasse | Spec (Forever-navn) | Status | Kort begrundelse | DPS L20 | DPS L40 | Venter L40 |
|---|---|---|---|---|---|---|
| Warrior | Arms | **mangler spells** | kun Heroic Strike, Rend og auto-attack; ingen Mortal Strike, Overpower, Execute, Slam eller Deep Wounds | 16,5 | 57,6 | 91 % |
| Warrior | Fury | **mangler spells** | ingen dual wield, Bloodthirst, Whirlwind, Flurry, Execute eller Death Wish | 15,9 | 57,0 | 91 % |
| Warrior | Protection | mangler spells | samme rotation; Shield Slam, Revenge og Sunder mangler (DPS er sjældent målet) | 15,4 | 51,4 | 91 % |
| Hunter | Beast Mastery | **mangler spells** | **ingen pet**, ingen Raptor Strike/melee, Multi-Shot, Hunter's Mark eller Bestial Wrath | 16,5 | 36,6 | 80 % |
| Hunter | Marksmanship | mangler spells | kun Auto Shot, Serpent Sting og Arcane Shot; ingen pet, Aimed Shot, Rapid Fire eller Trueshot | 19,8 | 49,6 | 78 % |
| Hunter | Survival | **mangler spells** | ingen melee overhovedet (Raptor Strike, Mongoose Bite, Strider Kick) og ingen pet | 16,5 | 36,7 | 80 % |
| Shaman | Elemental Combat | **ingen rotation (forkert rolle)** | **ingen Lightning Bolt/Chain Lightning**; simuleres som nærkæmper med shocks | 22,6 | 55,7 | 87 % |
| Shaman | Enhancement | **mangler spells** | ingen Stormstrike, Lightning Shield, Maelstrom Weapon, Flurry, Windfury eller Rage of the Farseer | 21,6 | 86,8 | 81 % |
| Shaman | Restoration | ingen rotation | som Elemental (healer; DPS er sekundært) | 23,9 | 56,7 | 87 % |
| Druid | Balance | **ingen rotation under 40** / mangler spells | uden Moonkin Form-talentet (31 point) bliver Wrath og Moonfire aldrig klar, så kun melee; med Moonkin går den tom for mana | **5,1** | 46,4 | 44 % |
| Druid | Feral Combat | **ingen rotation** | balance-APL'en for alle; ingen kat-rotation i APL'en (cat form, Shred og Rip findes først på upstream `main`) | **2,4** | **25,6** | 100 % |
| Druid | Restoration | ingen rotation | samme fejl som Balance uden Moonkin: kun melee | **5,1** | **11,7** | 100 % |
| Priest | Shadow Magic | mangler spells | rotationen findes og bruger Shadowform; ingen wand, mana-styring eller Holy Fire, Shadow Weaving kun som passiv | 9,9 | 42,8 | 49 % |
| Priest | Discipline | **mangler spells** | Smite/Penance-loop uden wand, går tom for mana tidligt | 7,2 | 15,0 | 76 % |
| Priest | Holy | **mangler spells** | som Discipline; Holy Fire er implementeret, men står ikke i APL'en | 7,1 | 12,1 | 81 % |
| Warlock | Affliction | **mangler spells** | kun Shadow Bolt, Immolate, Corruption og Imp; **ingen Life Tap, wand, Bane of Agony, drains eller Siphon Life** | 9,9 | 16,8 | 78 % |
| Warlock | Demonology | **mangler spells** | kun Imp; ingen Voidwalker/Felhunter/Succubus, Demonic Sacrifice eller Life Tap | 9,4 | 14,8 | 75 % |
| Warlock | Destruction | **mangler spells** | ingen Conflagrate, Shadowburn, Searing Pain, Incinerate, Improved Shadow Bolt eller Life Tap | 9,2 | 15,3 | 77 % |
| Paladin | Retribution (vores) | ok (grov) | vores rettelse (referencetal) | 17,8 | 83,6 | 76 % |
| Paladin | Holy | mangler spells | vores Ret-rotation med Seal of Righteousness; Holy Shock er ikke med | 16,9 | 72,5 | 77 % |
| Paladin | Protection | mangler spells | samme; Holy Shield og Swift Judgement er ikke med | 16,5 | 68,7 | 68 % |
| Rogue | Assassination (vores) | ok (grov) | vores rettelse (referencetal) | 60,5 | 103,2 | 59 % |
| Rogue | Combat | ok-ish / mangler spells | Assassination-rotationen med Blade Flurry og Adrenaline Rush; ingen Backstab, Hack and Slash-ekstraslag eller Riposte | 59,2 | 86,0 | 53 % |
| Rogue | Subtlety | mangler spells | ingen Hemorrhage, Ghostly Strike, Backstab, Premeditation/Initiative, Boot Knife eller Death Mark; falder tilbage til Sinister Strike | 57,9 | 80,0 | 58 % |

Ingen kørsel gav fejl eller «Unknown»-advarsler fra simc. APL-linjer for spells, der ikke er lært eller ikke findes,
bliver bare aldrig klar, så **mangler fejler tavst**. En mage-lignende `.check`-advarsel findes heller ikke for disse
klasser: brugeren ser intet om, at tallet er en grundmodel. Én kørsel fejlede på grund af testudstyret (druid-feral-40
med et mail-hoved, «Invalid type») og er kørt igen med læderudstyr.

---

## 2. Upstream-status (pinned vs. `main`)

- **Pinned `3c1d319`** (2026-11-10) → **`main` `1b8e01d`** (2026-11-11): 5 commits. Den eneste klassekode er
  `sc_druid.cpp` (+219/−9 linjer: Prowl, Poised, kat-melee, base-crit, Rip og combo points, alle af Khazak). Resten er
  spildata (build 70888). APL'erne er uændrede. **At opdatere SIMC_REF ændrer intet for brugerne af de seks klasser.**
- **Upstreams moduler** (linjer ved pin): warrior 545, hunter 334, shaman 469, druid 974 (1190 på main), priest 946,
  warlock 354. Til sammenligning: vores mage-rettelse giver 1092 linjer, paladin 656 og rogue 906.
- **Hvem arbejder på hvad (sidste 4 uger):**
  - **Druid:** Khazak, dagligt fra 11-03 til 11-11: først balance, nu kat. Det er den mest aktive klasse.
  - **Warrior:** PR #59 «[Warrior] Initial support» (Armadk, åben siden 11-03, +1050 linjer, ingen reviews). Den
    tilføjer stances, Overpower, Revenge, Slam, Sunder, Cleave, Demoralizing Shout, Victory Rush m.fl., men stadig
    **ikke** Mortal Strike, Bloodthirst, Whirlwind, Execute eller dual wield.
  - **Hunter:** PR #57 «Initial low level support» (seriallos, merget 11-03). Siden da intet.
  - **Priest:** PR #33 «Baseline implementation» (Lucas Kern, merget 10-26). Siden da intet ud over rank-rettelser.
  - **Shaman og warlock:** sidste reelle klasseændring var 10-13/10-23 (seriallos, refaktorering). Ingen åbne PR'er.
  - Tracking-issues #41-#49 («<Klasse> Module», oprettet 10-30) har tjeklister. Afkrydset: priest næsten alt for
    Shadow/Smite, shaman 4 punkter, warlock 3, hunter 4, druid balance-delen. #43 (mage), #44 (paladin) og #46 (rogue)
    har intet afkrydset, så **ingen arbejder upstream på de tre klasser, vi har rettet.**
- **Åbne fællesrettelser, der påvirker alle klasser:** #72 «Implement Classic glancing blows» (i dag gives glancing kun
  mod mål 4+ level over, så al auto-attack er for optimistisk) og #73 «Use the ranged slot stat budget for ranged
  weapons» (våben i ranged-pladsen fik ca. 3,3× for mange stats på random-suffix-items; rammer især hunter). Begge er
  fra 2026-11-12 og ikke merget.

---

## 3. Warrior (Arms, Fury, Protection)

**Upstream (`sc_warrior.cpp`, `apl/warrior.cpp`):**

- **Implementeret:** auto-attack (kun main hand, rage pr. sving med en observeret konstant 3,45/4,5 × swing time),
  Battle Shout (stat-buff), Bloodrage (+rage-tick), Charge (kun før kampen), Rend (`attack_power_mod.tick = 0.016`,
  «TODO: Verify at higher levels»), Heroic Strike (on-next-swing via en kø-buff), Thunder Clap (AP-mod 0,05 gættet,
  slow mangler).
- **Ranks:** alle seks spells har ranks til 60. Talenter kun via `parse_all_passive_talents()`, og ét talent er
  erklæret (Deflection).
- **APL:** `bloodrage, battle_shout, charge`, derefter `auto_attack, battle_shout, bloodrage<80, rend, thunder_clap (≥2
  mål), heroic_strike rage≥30`. Rotationen er den samme for alle tre specs.
- **Mangler:** stances, Overpower, Mortal Strike, Bloodthirst, Whirlwind, Execute, Slam (med nedkøling i Forever),
  Sunder Armor, Deep Wounds, Flurry, Enrage, Death Wish, Sweeping Strikes, dual wield og off-hand-rage, rage fra modtaget
  skade samt Forever-talenterne Spearing Strike, Bloodthrill (Rend → Overpower-procs), Gore Drinker og Reckless Swings.

**Målt:** 91 % venter på level 40 (rage-sult, intet at bruge rage på ud over HS og Rend). Arms 57,6 og Fury 57,0 mod
vores Ret-paladin 83,6 på samme udstyr.

**Vurdering:**

- (a) Rotationen er acceptabel til level ~10.
- (b) Fra level ~20 mangler hovedangrebene. Fejlen er stor: et skøn på 30-60 % for lav DPS for Arms/Fury med
  31-point-talent. Ingen dual wield gør Fury-tal meningsløse.
- (c) Simuleringen kører og giver ikke 0.

**Krydstjek:** wowsims/forever har fuld warrior (`sim/warrior/*.go`: execute, overpower, slam, whirlwind, Mortal Strike,
Bloodthirst, Deep Wounds, Flurry) og APL'er `ui/specs/warrior/dps/apls/arms.apl.json` og `fury.apl.json` (Mortal
Strike, Overpower, Slam, Whirlwind, Sunder, Bloodthirst, Execute, Death Wish, Bloodrage og Battle Shout).

---

## 4. Hunter (Beast Mastery, Marksmanship, Survival)

**Upstream (`sc_hunter.cpp`):**

- **Implementeret:** Auto Shot (ammo og quiver fra PR #37/#38, RAP 2 × Agi), Aspect of the Hawk, Serpent Sting
  (`attack_power_mod.tick = 0.03`, «Only tested at low levels»), Arcane Shot (`attack_power_mod.direct = 0.10`, samme
  forbehold).
- **TODO'er i koden:** «Default to max distance», «ItemDamageRanged», «Set melee distance for survival hunter»,
  «Dodge, parry chance».
- **APL:** `aspect_of_the_hawk`, derefter `auto_shot, serpent_sting if !ticking, arcane_shot`. Den er den samme for
  alle specs.
- **Mangler:** **pet** (ingen pet-klasse overhovedet), melee (Raptor Strike, Mongoose Bite, Strider Kick, Wing Clip),
  Hunter's Mark, Multi-Shot, Aimed Shot, Rapid Fire, Immolation/Explosive Trap, Summon Hawk, Sniper Shot, Bestial
  Wrath, Trueshot Aura og talent-procs (Deadly Aspects, Frenzy, Expose Prey, Lacerating Strikes).

**Målt:** 80 % venter. BM og Survival giver præcis samme DPS (36,6/36,7), fordi ingen af deres talenter påvirker noget,
der er modelleret. MM er højere på grund af passive crit-talenter (Lethal Attacks).

**Vurdering:**

- (a) Rotationen er for tynd selv på level 10-20, hvor guides melee-weaver med Raptor Strike og petten tanker.
- (b) **Den manglende pet er den største fejl.** På lave level er pet-skaden typisk en stor del af hunterens samlede
  skade, især for BM (Bestial Wrath, Frenzy og Ferocity virker kun på petten). Skøn: 30-50 % for lavt for BM. Ingen
  melee gør Survival misvisende.
- (c) Simuleringen kører.

**Krydstjek:** wowsims/forever `sim/hunter/` har pets (`pets.go` med stats målt på level 11/17/30-pets), Raptor Strike,
Mongoose Bite, Multi-Shot, Aimed Shot, Rapid Fire, Summon Hawk og Sniper Shot. Dens standard-APL
(`ui/specs/hunter/dps/apls/default.apl.siml`) melee-weaver: Rapid Fire, Hunter's Mark, Raptor Strike, Strider Kick,
Mongoose Bite, Serpent Sting, Arcane Shot, Multi-Shot.

---

## 5. Shaman (Elemental Combat, Enhancement, Restoration)

**Upstream (`sc_shaman.cpp`):**

- **Implementeret:** melee (kun main hand; Forever-shamaner kan ikke dual-wielde), Earth Shock, Flame Shock (fælles
  «shock»-nedkøling), Flametongue Weapon (proc pr. hit, værdi fra driver-spell × våbenhastighed), Rockbiter Weapon
  (stat-buff) og Strength of Earth Totem (som selv-buff, «TODO: element exclusivity»). Mental Dexterity (AP af Int) er
  håndkodet. Bloodlust-buffen er registreret.
- **APL:** `flametongue_weapon, strength_of_earth_totem`, derefter `auto_attack, soe, flame_shock, earth_shock`. Den er
  den samme for alle specs.
- **Mangler:** **Lightning Bolt, Chain Lightning**, Frost Shock, Lightning Shield, Searing/Magma Totem, Windfury Weapon og
  -totem, Stormstrike (+ Improved Stormstrike), Maelstrom Weapon (Forever-talent: melee giver hurtigere/billigere
  Lightning Bolt), Flurry, Elemental Focus/Clearcasting, Lightning Overload, Elemental Fury, Lightning Mastery, Rage
  of the Farseer og mana-regen (Water Shield, Mana Tide).

**Målt:** Elemental 55,7 på level 40 kommer fra en 2H-mace i nærkamp (36 % melee, 19 % Flametongue). En rigtig
Elemental-shaman står på afstand og kaster Lightning Bolt. Enhancement 86,8 er realistisk i niveau mod Ret 83,6, men
uden Stormstrike og Maelstrom.

**Vurdering:**

- (a) Rotationen er rimelig for Enhancement på level 1-15 (Flame/Earth Shock + Rockbiter/Flametongue).
- (b) For Elemental er modellen forkert i sin grundform: tallet beskriver en anden spillestil. For Enhancement er
  fejlen mellem til stor (Stormstrike, Windfury og Flurry har klassisk været en stor del af Enhancement-skaden; skøn
  20-40 %).
- (c) Elemental og Resto: «ingen rotation» for deres rolle.

**Krydstjek:** wowsims/forever har separate Elemental/Enhancement/Resto (`sim/shaman/lightning_bolt.go`,
`chain_lightning.go`, `stormstrike.go`, `totems.go`, `talents_*.go`). wow.gg's Forever-Enhancement-guide angiver
prioriteten Rage of the Farseer, Lightning Bolt ved 5 Maelstrom, Stormstrike, Flame Shock, Earth Shock. Windfury Totem
er en permanent aura (ingen totem-twisting).

---

## 6. Druid (Balance, Feral Combat, Restoration)

**Upstream (pinned):** Wrath, Moonfire, Starfire (Eclipse-reduktion), Insect Swarm (talent), Entangling Roots
(Overgrowth), Hurricane, Faerie Fire (kat-nedkøling), Innervate, Moonkin Form (talent, med Omen of Clarity-mods),
Nature's Grace, Eclipse, Omen of Clarity («speculative», 2 PPM gættet), cat form og Shred (påbegyndt). `main` tilføjer
Prowl, Poised, kat-melee, Rip og combo points.

**APL (uændret på `main`):** `moonkin_form, entangling_roots` før kampen, derefter `faerie_fire (t<1), hurricane (t<10),
innervate, starfire (clearcasting/eclipse), moonfire, insect_swarm, wrath, auto_attack`. Der er kun Balance; ingen
kat-, bjørne- eller resto-liste.

**Fejl fundet (verificeret i kode og spildata):** `druid_action_t::ready()` kræver `(form_mask & form) == form`, hvor
`form_mask = data().stance_mask()`. Wrath (5176-9912) har i spildataen `Stance Mask: 0x40000000` (kun Moonkin) plus
attributten «Allow While Not Shapeshifted (caster form) (83)». Koden læser ikke attributten. I caster form (`0x2`) er
Wrath derfor aldrig klar, og det samme gælder de øvrige balance-spells. Fejlen findes også på `main`.

**Konsekvens:** Alle druider uden Moonkin Form, dvs. **alle under level 40** og alle Feral/Resto, simuleres som en
stav-svinger i caster form: 2-12 DPS og 100 % venter.

**Målt:** Balance L20 5,1, Feral L20 2,4, Resto L40 11,7. Kun Balance L40 med Moonkin virker (46,4), og den venter 44 %
(manaen slipper op).

**Vurdering:**

- (a) Balance-APL'en er rimelig, når den virker. Feral har ingen rotation.
- (b) Formfejlen er den største enkeltfejl i hele auditten: ca. 10× for lavt for lave druider. Feral mangler hele
  kat-rotationen (Claw, Rake, Shred, Rip, Ferocious Bite, Tiger's Fury, energi).
- (c) Under 40 og for Feral/Resto: i praksis ingen rotation.

**Upstream:** Khazak bygger kat-delen lige nu (fire commits 11-10 til 11-11), så Feral kommer sandsynligvis upstream
inden for uger. Formfejlen er en ét-linjes-rettelse, som bør meldes upstream (issue eller PR) frem for at blive
patchet hos os.

**Krydstjek:** wowsims/forever `ui/specs/druid/feralcat/apls/adaptive.apl.json` (cat form, Shred, Rip, Rake, Claw, Ferocious
Bite, Faerie Fire, Innervate) og `balance/apls/default.apl.json` (Wrath, Starfire, Moonfire, Insect
Swarm, Hurricane, Innervate).

---

## 7. Priest (Discipline, Holy, Shadow Magic)

**Upstream (`sc_priest.cpp`, PR #33):** Smite, Shadow Word: Pain, Mind Blast, Devouring Plague (+ Devouring
Contagion), Mind Flay (talent), Shadow Word: Death, Holy Fire, Penance (talent), Holy Nova, Starshards, Dark Sacrifice,
Vampiric Embrace, Hex/Touch of Weakness, Inner Focus, Shadowform og Shadow Weaving. Talenter er håndkoblet til 13
navne.

**TODO'er:** «Apply [Wand Specialization] to the wand auto attack once implemented», «Heal the caster», «Backlash
damage», «Penance vs Inner Focus», «Health cost».

**APL:** `shadowform`, derefter `dark_sacrifice (mana<50 %), swp, devouring_plague, mind_blast, sw_death, penance,
starshards, mind_flay, smite`. Den er den samme for alle specs.

**Mangler:** **Shoot (wand)**. Det er det, priester (og warlocks) laver det meste af kampen på lave level, når manaen
er brugt. Desuden mana-styring, Holy Fire i APL'en for Holy/Disc, Power Infusion, Inner Fire og spirit-regen-talenter
(Spirit Tap er død-baseret og irrelevant).

**Målt:**

- Shadow L40 42,8 (49 % venter).
- Disc 15,0 og Holy 12,1 (76-81 % venter): 24 Smites og 2 Mind Blasts på 300 s. Priesten er tom for mana efter ca.
  30 s og står derefter stille.
- Mage på samme udstyr: 48 (Frost), hvor wand-skud er 36 % af skaden.

**Vurdering:**

- (a) Shadow-rotationen er rimelig.
- (b) Uden wand er Disc/Holy 2-3× for lave og Shadow på lave level (uden Shadowform) også meget lav (9,9 på L20).
  Rettelsen er lille: vi har allerede wand-koden i mage-rettelsen.
- (c) Simuleringen kører.

**Upstream:** Ingen aktivitet siden 11-05. Wand-punktet står åbent i issue #45. Det oplagte er at foreslå wand-koden
upstream som fælles kode for mage, priest og warlock.

---

## 8. Warlock (Affliction, Demonology, Destruction)

**Upstream (`sc_warlock.cpp`):** Shadow Bolt, Immolate, Corruption (alle med ranks fra spildata) og Summon Imp med
Firebolt. Imp-stats er tilpasset level 3-10 («TODO: Imp HP looks to come from a table», «this is at level 7, probably
need a table», «starts to break down at level 9»).

**APL:** `summon_imp`, derefter `immolate, corruption, shadow_bolt`. Den er den samme for alle specs.

**Mangler:** **Life Tap**, **Shoot (wand)**, Bane of Agony/Doom (i Forever er Agony en «Bane», instant), curses
(Elements, Recklessness, Weakness), Drain Life/Soul, Wrack (Forever-talent/-spell fra 40), Siphon Life, Searing Pain,
Shadowburn, Conflagrate, Incinerate, Soul Fire, Nightfall/Shadow Trance, Improved Shadow Bolt-debuff, Voidwalker,
Felhunter og Succubus, Demonic Sacrifice/Pact samt imp-stats over level 10.

**Målt:** 9-17 DPS og 75-78 % venter på alle tre specs og begge level. Affliction L40 har 15 Corruptions, 2 Immolates og
13 Shadow Bolts på 300 s: tom for mana. Mage på samme udstyr: 41-48.

**Vurdering:**

- (a) Rotationen er rimelig på level 1-6, derefter for tynd.
- (b) Uden Life Tap og wand er tallene ca. 2-3× for lave. Ingen Bane of Agony og intet spec-indhold gør, at de tre specs
  ikke kan skelnes (±10 %).
- (c) Simuleringen kører.

**Kilder til rotation:** Method, Warcraft Tavern, Icy Veins og Mobalytics (Kargoz) for Forever. De er enige om Bane of
Agony + Corruption (+ Siphon Life/Immolate) og derefter wand eller Drain Life/Wrack, og om Life Tap, når manaen er
lavere end livet. Warcraft Tavern siger, at wand slår Drain Life før level 30. wowsims/forever har
`sim/warlock/agony.go`, `life_tap`, `conflagrate.go`, `incinerate.go`, `drain_*.go` og testprofiler for alle tre specs.

**Upstream:** Ingen aktivitet siden 10-23 og ingen PR. Det er den klasse, hvor vi med størst sikkerhed ikke kolliderer
med upstream.

---

## 9. Paladin Holy/Protection og Rogue Combat/Subtlety (vores egne rettelser)

**Paladin** (se `simc-worker/patches/PATCHES.md`, afsnit paladin): Holy og Protection kører Ret-rotationen med Seal of
Righteousness, fordi Seal of Command er et Ret-talent.

- **Holy mangler:** Holy Shock (r5, instant, 209-223 Holy ifølge Blizzards tooltip, nedkøling), Divine Favor og Light's Vigil
  (Holy Shock uden nedkøling).
- **Prot mangler:** Holy Shield (blok-skade kræver, at målet slår; Patchwerk-målet slår ikke i vores opsætning), Swift
  Judgement og Reckoning (ekstra sving efter blok/crit).
- **Målt:** Holy 72,5 og Prot 68,7 mod Ret 83,6 (L40).
- **Vurdering:** Holy Shock giver anslået 5-10 % mere for en Holy-paladin, der DPS'er. Prot-delene afhænger af, at
  målet slår, hvilket kræver en tank-opsætning. **Arbejde: lille** (Holy Shock + talentvalg i APL'en). Prot kan vente.

**Rogue** (afsnit rogue): Combat får Blade Flurry og Adrenaline Rush og ellers Assassination-rotationen. Subtlety får
kun Sinister Strike-rotationen.

- **Mangler:** Backstab (Combat-talentet Puncturing Wounds peger på Backstab; dolk-Combat bruger Backstab bag målet i
  dungeons), Hack and Slash' ekstraslag for økse/sværd, Ruthlessness, Riposte, Hemorrhage, Ghostly Strike,
  Premeditation, Initiative, Boot Knife (Shank → 2 CP), Death Mark og Setup.
- **Målt:** Combat 86,0 og Sub 80,0 mod Assassination 103,2 (L40, dolke).
- **Vurdering:** Combat er tæt på (anslået 5-15 % for lav; mest Hack and Slash og Backstab). Subtlety er 15-30 % for
  lav og har ingen af sine kerneevner. **Arbejde: lille-mellem.** Wowsims/forever har `backstab.go`, `death_mark.go`,
  `talents_combat.go` og `talents_subtlety.go`.

---

## 10. Anbefaling

### Rangliste (værdi ÷ arbejde)

| # | Opgave | Gevinst | Arbejde | Kolliderer med upstream? |
|---|---|---|---|---|
| 1 | **Advarsel i workeren/appen for ufuldstændige upstream-klasser** (som `aula-rettelse`-advarslen; fx «Grundmodel fra SimulationCraft: spec-talenter og pet er ikke med») | Brugerne holder op med at stole på 5-DPS-druider og 15-DPS-warlocks i dag | **lille** (`patchinfo.mjs` + tekst) | nej |
| 2 | **Druid-formfejlen** (`ready()` skal acceptere caster form, når spillet har attribut 83 «Allow While Not Shapeshifted»). Meld den upstream med det samme (issue + PR); evt. midlertidig `druid.patch` | ~10× for alle druider under 40 og alle Resto/Feral | **lille** (få linjer) | ja, druid er aktivt upstream; derfor helst upstream-PR |
| 3 | **Warlock**: Life Tap, wand, Bane of Agony, Searing Pain, Drain Life/Wrack, Siphon Life, Conflagrate/Shadowburn/Incinerate, Nightfall, Improved Shadow Bolt; spec-valg i APL'en som hos mage | 2-3× (alle tre specs) | **mellem** (som rogue-rettelsen: ~600-900 linjer; imp-tabellen er en ekstra usikkerhed) | nej (ingen aktivitet siden 10-23) |
| 4 | **Priest**: wand (genbrug mage-koden), Holy Fire og Penance i APL'en for Holy/Disc, mana-styring og spec-valg | 2-3× for Disc/Holy og lave Shadow | **lille** | lav (ingen aktivitet siden 11-05); godt PR-emne upstream |
| 5 | **Shaman**: Lightning Bolt, Chain Lightning, Lightning Shield, Searing Totem, Stormstrike, Maelstrom Weapon, Flurry, Windfury Weapon, Elemental Focus, Lightning Overload, Rage of the Farseer; to rotationer (Elemental/Enhancement) | Elemental går fra «forkert rolle» til brugbar; Enhancement +20-40 % | **mellem-stor** | nej (ingen aktivitet siden 10-23) |
| 6 | **Rogue Combat/Subtlety** i vores rettelse: Backstab, Hack and Slash, Ruthlessness, Hemorrhage, Ghostly Strike, Premeditation/Initiative, Boot Knife + spec-valg | +5-30 % | **lille-mellem** | nej (vores egen fil) |
| 7 | **Paladin Holy**: Holy Shock + spec-valg i APL'en | +5-10 % for Holy | **lille** | nej (vores egen fil) |
| 8 | **Hunter**: pet (stats pr. level, Claw/Bite, focus, Ferocity/Frenzy/Bestial Wrath), Raptor Strike/Mongoose/Strider Kick, Multi-Shot, Aimed Shot, Hunter's Mark, Rapid Fire | 30-50 % for BM; Survival fra ingen melee til brugbar | **stor** (pet-modellen alene er større end hele mage-rettelsen) | **ja**, Dave Hendler ejer hunter upstream; vent eller bidrag |
| 9 | **Warrior**: Mortal Strike, Bloodthirst, Whirlwind, Execute, dual wield, Deep Wounds, Flurry, Death Wish | 30-60 % | **mellem-stor** | **ja**, PR #59 er åben; byg *oven på* den eller bidrag til den |
| 10 | **Druid Feral** (kat-APL) | fra ingen rotation til brugbar | mellem | **ja**, Khazak bygger den nu; vent |

### Hvad upstream sandsynligvis selv laver snart

- **Druid:** kat (Feral) er i gang dagligt, og formfejlen bliver muligvis opdaget i den forbindelse. Rør kun formfejlen
  (helst som upstream-PR).
- **Warrior:** PR #59 har 24 commits, er mergeable og har ingen review. Hovedangrebene mangler stadig der, og ingen
  har lovet dem.
- **Hunter:** pets står som første punkt i issue #41, og seriallos har lavet al hunter-kode. Der er ingen aktivitet
  siden 11-03, men det er sandsynligt, at det kommer.
- **Priest, shaman og warlock:** ingen tegn på arbejde. Det er vores bedste kandidater.

### Foreslået rækkefølge og trin

1. **Denne uge, lille:**
   - (1) Advarselstekst for upstream-grundmodeller.
   - (2) Druid-formfejlen som upstream-issue/PR og, hvis den ikke merges hurtigt, som `druid.patch` med en `.check`, der
     ser efter rettelsen i `ready()`.
   - Overvej samtidig at følge #72/#73 og hæve SIMC_REF, når de er merget (hæv ikke for druid-commits alene).
2. **Rettelses-infrastruktur:** Den nuværende `.check`-heuristik (`min_lines 150` + `contains add_action` +
   `not_contains AULA-RETTELSE`) passer ikke til klasser, hvor upstream allerede har over 150 linjer og en APL. Her
   holder betingelserne fra dag ét, så rettelsen ville blive droppet. For priest, warlock og shaman skal `.check` i
   stedet teste på konkrete spells (fx `contains sc_warlock.cpp life_tap`). Og fordi vores diff ændrer upstreams
   filer i stedet for at erstatte stubs, vil hver upstream-ændring i filen give en konflikt. Det er håndterbart for
   de stille klasser, men ikke for druid, warrior og hunter.
3. **Priest (lille) → Warlock (mellem):** Del wand-koden (`shoot_t` fra mage-rettelsen) som fælles kode, så de tre
   caster-klasser bruger samme implementering. Det er et oplagt upstream-bidrag. Mål før og efter på de samme profiler
   som i §1.
4. **Shaman (mellem-stor):** Elemental først (Lightning Bolt, Chain Lightning, Elemental Focus, Lightning Overload),
   derefter Enhancement (Stormstrike, Maelstrom, Windfury, Flurry, Lightning Shield). Rotationen vælges efter talenter
   som hos mage.
5. **Rogue Combat/Sub og paladin Holy** i vores egne filer (lille-mellem).
6. **Warrior og hunter:** Vent 2-4 uger på PR #59 og hunter-aktivitet. Er der intet sket, så byg oven på #59 og
   foreslå det upstream frem for at vedligeholde en stor privat warrior/hunter-rettelse.

### Alternativ værd at overveje

wowsims/forever (MIT-licens, meget aktiv: flere commits dagligt, senest 2026-11-12) har allerede alle klasser og specs
modelleret i Go med målte konstanter (fx pet-stats, imp, warrior-Whirlwind/Gore Drinker) og per-spec-APL'er. Brug den
mindst som facit for koefficienter og rotationer, når vi skriver rettelser; tallene og kommentarerne i Go-koden er
lettere at efterprøve end guides. At skifte simuleringsmotor for nogle klasser er en større beslutning (andet
inputformat end SimC-addon-profiler) og er ikke undersøgt her.

---

## 11. Metode, testprofiler og forbehold

- **Kilde:** `simc-forever` klonet blobless til scratchpad, `3c1d319` (pin) og `main` `1b8e01d` i separat worktree.
  Læst: `sc_<klasse>.cpp` og `apl/<klasse>.cpp` for de seks klasser, `git log`/diff pin..main, issues #41-#49 og PR
  #57/#59/#72/#73.
- **Talenttræer:** hentet fra Blizzards `static-forever-eu` (`/data/wow/talent-tree/{1082,1089,1091,1100,1111,1114,
  1116,1117}/playable-specialization/<id>`) med app-token. Spec-navnene er Forever's: Elemental Combat, Feral Combat,
  Shadow Magic osv.
- **Testprofiler (syntetiske):** level 20 og 40, alle talentpoint (level − 9) i ét træ, valgt grådigt: aktive talenter
  og 1-point-talenter inden for rækkevidde først, derefter rækkefølgen i træet. Talenterne er kodet som `talents=` med
  samme algoritme som `lib/simc-talents.ts`. (`legacy_talents=` kendes ikke af simc og ignoreres med en advarsel; de
  første kørsler med den blev kasseret.) Udstyret er lånt fra workerens fixtures (hunter-11, mage-20/35, paladin-39,
  rogue-33) og er ikke level-tilpasset: level 20 bruger level 5-10-udstyr, level 40 bruger level 30-40-udstyr. Tallene
  er derfor kun til sammenligning *mellem* klasser og specs på samme udstyrsniveau, ikke absolutte DPS-forventninger.
  Profiler og rå svar ligger i scratchpad (`simc-audit/profiles`, `simc-audit/runs`) og er ikke committet.
- **Ikke verificeret:**
  - De procentvise fejlskøn (§3-§9) er kvalitative skøn ud fra, hvad der mangler, og er ikke målt mod spillet eller
    wowsims.
  - Ingen Forever-logs er sammenlignet.
  - DungeonSlice er ikke kørt.
  - Druid-formfejlen er bevist ud fra kode + spildata + adfærd (100 % venter, 0 Wrath), men ikke med et simc-debug-log
    (workeren tillader ikke `debug=`).
  - Icy Veins og Mobalytics er kun set som søgeresuméer.
  - Upstreams fremtidsplaner er gætværk ud fra commit-aktivitet.

### Kilder

- simc-forever: <https://github.com/simulationcraft/simc-forever>. Issues #41 Hunter, #42 Druid, #45 Priest, #47
  Shaman, #48 Warlock, #49 Warrior; PR #59 (warrior), #57 (hunter), #33 (priest), #72 (glancing), #73 (ranged-budget).
- wowsims/forever (MIT): <https://github.com/wowsims/forever>: `sim/<klasse>/`,
  `ui/specs/warrior/dps/apls/{arms,fury}.apl.json`, `ui/specs/druid/{feralcat,balance}/apls/*.apl.json`,
  `ui/specs/hunter/dps/apls/default.apl.siml`, `sim/hunter/pets.go`.
- Blizzard Game Data API, namespace `static-forever-eu`: `playable-specialization/index`, `talent-tree/index` og de
  27 spec-træer.
- Enhancement: [wow.gg – WoW Forever Enhancement Shaman](https://wow.gg/guides/wow-forever-enhancement-shaman) (læst),
  [Warcraft Tavern – Enhancement](https://www.warcrafttavern.com/forever/guides/enhancement-shaman/) og
  [wowtbc.gg – Enhancement PvE](https://wowtbc.gg/warcraftforever/class-guides/enhancement-shaman/).
- Warlock: [Method – Forever Warlock leveling](https://www.method.gg/wow-forever/wow-forever-warlock-leveling-guide-and-talents),
  [Warcraft Tavern – Warlock leveling](https://www.warcrafttavern.com/forever/guides/warlock-leveling/),
  [Warcraft Tavern – Affliction](https://www.warcrafttavern.com/forever/guides/affliction-warlock/),
  [Icy Veins – Affliction rotation](https://www.icy-veins.com/wow-forever/affliction-warlock-ranged-dps-pve-rotation-cooldowns-abilities)
  og [Mobalytics – Kargoz Affliction 1-60](https://mobalytics.gg/wow-forever/profile/kargoz/classes/1-60-affliction-warlock-leveling-guide-wands-talents-rotation-macros-tips).
- Hunter: [Warcraft Tavern – Hunter leveling](https://www.warcrafttavern.com/forever/guides/hunter-leveling/),
  [Mobalytics – Survival 1-60](https://mobalytics.gg/wow-forever/classes/survival-hunter-guide-1-60-ludideo) og
  [Mobalytics – BM leveling](https://mobalytics.gg/wow-forever/classes/1-60-beast-mastery-hunter-leveling-guide).

---

## 12. Opfølgning (samme dag): trin 1-4 er udført

Brugeren valgte første trin af anbefalingen. Status:

1. **Advarsel på resultatkortet** (`lib/sim-model-gaps.ts`, `SimCard.tsx`): warrior, hunter, shaman, druid, priest og
   warlock uden Aula-rettelse får en rød advarsel «Simulatoren mangler vigtige evner for <klasse> (<spec>)» med en
   konkret liste fra denne audit. Med en Aula-rettelse («Grov model») forsvinder den. Paladin Holy/Prot, rogue
   Combat/Sub og druid Feral får en gul «Aulas model dækker ikke … fuldt ud». Forever-spec'en gemmes nu fra armory på
   jobbet, fordi simc kun kender klassens ene spec.
2. **`.check` på konkrete spells:** nye betingelser `has_action`, `contains_re` og `not_contains_re` (PATCHES.md).
3. **Druid-formfejlen** er rettet i upstream-stil (`druid.patch`, fork-branch `aula/druid`); udkast til upstream i
   `simc-worker/patches/upstream-druid-moonkin.md` (ikke sendt).
4. **Priest:** wand (Shoot) og en wand-fase ved lav mana, Holy Fire for Discipline/Holy (`priest.patch`, fork-branch
   `aula/priest`).

**Før/efter** (samme profiler og indstillinger som §1; «efter» målt i et lokalt bygget worker-image med alle fem
rettelser, 1000 iterationer, Patchwerk):

| Klasse | Spec | DPS L20 før → efter | DPS L40 før → efter | Venter L40 før → efter |
|---|---|---|---|---|
| Druid | Balance | 5,1 → **12,9** | 46,4 → **46,4** | 44 % → 44 % |
| Druid | Feral Combat | 2,4 → **7,2** | 25,6 → **31,1** | 100 % → 62 % |
| Druid | Restoration | 5,1 → **10,5** | 11,7 → **27,6** | 100 % → 50 % |
| Priest | Shadow Magic | 9,9 → **22,3** | 42,8 → **64,0** | 49 % → 0 % |
| Priest | Discipline | 7,2 → **25,1** | 15,0 → **47,1** | 76 % → 0 % |
| Priest | Holy | 7,1 → **21,7** | 12,1 → **39,3** | 81 % → 0 % |

Mage, paladin og rogue er uændrede (Frost 40: 51,2, Ret 40: 83,9, Assassination 40: 103,4 i samme image). Druiden
under 40 venter stadig ca. 60 %: den har ingen wand, går tom for mana og slår så med staven. Feral har stadig ingen
kat-rotation (upstream bygger den). Priest-tallene hviler på antagelsen om wand-fasen (10 %/40 %); se PATCHES.md.

