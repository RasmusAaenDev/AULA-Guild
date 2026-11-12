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


## 13. Opfølgning: warlock og shaman (trin 3 og 5 i rækkefølgen)

Brugeren bad om «de næste»: warlock, derefter shaman.

1. **Warlock** (`warlock.patch`, fork-branch `aula/warlock`): Life Tap, wand (Shoot), Bane of Agony med opbygning,
   Siphon Life, Shadowburn, Conflagrate, Incinerate, Wrack og Improved Shadow Bolt; rotationen vælger efter talenter,
   så de tre specs nu kan skelnes. Pets ud over Imp er ikke med (for stort).
2. **Shaman** (`shaman.patch`, fork-branch `aula/shaman`): Elemental/Restoration bliver casters (Lightning Bolt, Chain
   Lightning, Flame Shock, Searing Totem, Elemental Focus, Lightning Overload, Lightning Mastery, Water Shield) med en
   mana-fase i stedet for wand; Enhancement får Stormstrike, Flurry, Windfury Totem, Maelstrom Weapon, Rage of the
   Farseer og Searing Totem.
3. **Advarslen i appen:** warlock og shaman får «Grov model: SimulationCraft's grundmodel med Aulas rettelser»; den
   røde advarsel falder væk og erstattes af en gul pr. spec med det, der stadig mangler (warlock: pets, Drain Life,
   Life Tap uden livsomkostning; shaman: totems, mana-hjælp, healing).

**Før/efter** (samme profiler og indstillinger som §1 og §12; «efter» målt natively med alle syv rettelser, 1000
iterationer, seed 42, Patchwerk; kontrolleret i et lokalt bygget worker-image, se PATCHES.md):

| Klasse | Spec | DPS L20 før → efter | DPS L40 før → efter | Venter L20 før → efter | Venter L40 før → efter |
|---|---|---|---|---|---|
| Warlock | Affliction | 9,9 → **25,1** | 16,8 → **62,5** | 77 % → 0 % | 78 % → 0 % |
| Warlock | Demonology | 9,4 → **22,7** | 14,8 → **47,3** | 74 % → 0 % | 75 % → 0 % |
| Warlock | Destruction | 9,2 → **24,7** | 15,3 → **60,4** | 76 % → 0 % | 77 % → 0 % |
| Shaman | Elemental Combat | 22,6 → **16,2** | 55,7 → **40,0** | 84 % → 69 % | 87 % → 79 % |
| Shaman | Enhancement | 21,6 → **26,0** | 86,8 → **113,8** | 80 % → 81 % | 81 % → 76 % |
| Shaman | Restoration | 23,9 → **15,1** | 56,7 → **36,1** | 85 % → 73 % | 87 % → 74 % |

- **Warlock:** 2,5-3,7× højere og 0 % venter, fordi Life Tap giver mana uden at koste liv (simc's spillerliv er
  uendeligt, dvs. en healer er antaget). Det er den største antagelse; solo uden healer er tallet for højt.
  Affliction 40 og Destruction 40 (62,5/60,4) ligger nu mellem Frost-mage (51) og Shadow-priest (64); Demonology
  (47,3) er lavest, fordi den kun har Imp.
- **Shaman Elemental/Restoration** falder, fordi «før» var den forkerte spillestil (nærkamp med en 2H-mace). «Efter»
  er en caster på afstand, og den er mana-begrænset: 70-80 % venter er tid uden mana (ingen wand, drikke, Mana Spring
  eller Mana Tide). Searing Totem er 35-45 % af skaden.
- **Shaman Enhancement** stiger 20-31 % (auditens skøn var 20-40 %).
- Mage, paladin, rogue, druid og priest er uændrede (Frost 40: 51,2, Ret 40: 83,6, Assassination 40: 103,2, Shadow
  40: 64,3, Balance 20: 12,9).

**Næste trin** (fra §10, uændret rækkefølge): rogue Combat/Subtlety og paladin Holy i vores egne filer (lille-mellem),
derefter warrior og hunter, når PR #59 og hunter-aktiviteten upstream har afklaret sig. For warlock og shaman er de
oplagte udvidelser pets (Voidwalker/Succubus/Felhunter og en imp-tabel over level 10), Drain Life som alternativ til
Life Tap uden healer, og Mana Spring/Magma Totem.

## 14. Opfølgning: shaman-mana, rogue Combat/Subtlety og paladin Holy/Protection

Brugeren bad om «resten» af rækkefølgen i §10 (efter warlock og shaman): mana til Elemental/Restoration-shamanen,
derefter rogue Combat/Subtlety og paladin Holy/Protection i vores egne rettelser.

1. **Shaman** (`shaman.patch`, fork-branch `aula/shaman`, ny commit): Mana Spring Totem for alle specs (level 26+;
   wowsims/forever's Elemental og Enhancement sætter det før kampen) og Mana Tide Totem for Restoration, som
   selv-auraer med aura-spellens mana pr. tick fra spildataen; Restorative Totems øger Mana Spring. Wand findes ikke,
   og drikke mellem grupper er ikke en del af én kamp. Elemental Focus/Clearcasting, Convection og Water Shield var
   der i forvejen.
2. **Rogue** (`rogue.patch`, `aula/rogue`, ny commit): Backstab (dolk, bag målet) med Puncturing Wounds' ekstra combo
   point, Hemorrhage (+15 % Rupture/Garrote), Ghostly Strike (Ambush/Garrote i kampen), Premeditation, Preparation,
   Initiative, Boot Knife, Ruthlessness og Hack and Slash' økse/sværd- og kølle-del. Rotationen vælger Hemorrhage og
   Backstab efter talenter; Sinister Strike som før uden dem.
3. **Paladin** (`paladin.patch`, `aula/paladin`, ny commit): Holy Shock (skade) og Divine Favor for Holy; Righteous
   Fury, Holy Shield (skade via Shieldsworn på Holy Strike), Swift Judgement og Consecration på ét mål for
   Protection. Spec'en afgøres af talenterne, og Holy Shock/Holy Shield/Consecration har mana-grænser (målt).
4. **`.check`:** shaman kræver nu også `mana_spring_totem`; rogue og paladin kræver de nye spec-handlinger, så en
   upstream-grundmodel uden dem ikke får rettelsen droppet (testet). `check-upstream.sh` giver OK for alle syv
   rettelser på både `3c1d319` og `main` `1b8e01d`.
5. **Advarslen i appen** (`lib/sim-model-gaps.ts`): de tre klasser har allerede «Grov model»; de gule tekster siger
   nu, hvad der stadig mangler (se nedenfor).

**Før/efter** (samme profiler og indstillinger som §1, §12 og §13: native bygning, 1000 iterationer, seed 42,
Patchwerk; kontrolleret i et lokalt bygget worker-image, se PATCHES.md):

| Klasse | Spec | DPS L20 før → efter | DPS L40 før → efter | Venter L40 før → efter | DungeonSlice L40 (efter) |
|---|---|---|---|---|---|
| Shaman | Elemental Combat | 16,2 → **16,2** | 40,0 → **44,3** | 79 % → 76 % | 31,4 |
| Shaman | Restoration | 15,1 → **15,1** | 36,1 → **41,9** | 74 % → 67 % | 32,9 |
| Shaman | Enhancement | 26,0 → **26,0** | 113,8 → **118,1** | 76 % → 73 % | 103,8 |
| Rogue | Combat | 59,2 → **59,2** | 85,9 → **95,2** | 53 % → 62 % | 78,2 |
| Rogue | Subtlety | 57,8 → **64,2** | 79,9 → **101,2** | 58 % → 51 % | 83,5 |
| Rogue | Assassination | 60,4 → **60,4** | 103,2 → **104,5** | 59 % → 58 % | 85,7 |
| Paladin | Holy | 16,9 → **16,8** | 72,6 → **74,8** | 78 % → 74 % | 65,1 |
| Paladin | Protection | 16,5 → **15,8** | 68,9 → **68,5** | 68 % → 68 % | 60,3 |

- **Shaman:** Mana Spring giver ca. 900 mana på 300 s fra level 36 (3 mana/s), Mana Tide 530-700 (Restoration).
  Elemental 40 +11 %, Restoration 40 +16 %, Enhancement 40 +4 %. Under level 26 er der intet totem, så level 20 er
  uændret. **Elemental ligger stadig langt under Enhancement**, og det er ikke en fejl i modellen men manaen: en
  Lightning Bolt koster 121 mana, regen og totem giver i snit ca. 14 mana/s, og der er ingen wand eller drikke i én kamp på
  300 s. I en dungeon starter hver gruppe typisk med fuld mana, så Patchwerk er hårdere for casters end spillet.
- **Rogue:** Subtlety 40 stiger 27 % og ligger nu på niveau med Assassination (101 mod 105); Combat 40 stiger 11 %
  (Backstab er 27 % af skaden). Combat 20 er uændret: uden Puncturing Wounds bruges Sinister Strike som før, og
  Riposte kræver, at målet slår. Guildens basil (Combat uden Puncturing Wounds) er uændret (92,7). «Venter» stiger
  for Combat, fordi rogue'en nu sparer energi op til Backstab (60).
- **Paladin:** Holy og Protection er nu adskilt fra Ret i loggen (Holy Shock; Righteous Fury, Swift Judgement, Holy
  Shield og Consecration), men DPS ændrer sig kun lidt. Begge er mana-begrænsede, og de nye evner er dyre: uden
  mana-grænse *sænkede* Holy Shock Holy 40 fra 72,5 til 70,4. Protection 20 falder 4 %, fordi Consecration på ét mål
  (en tank-vane) koster Judgements. Holy Shield giver kun skade via Shieldsworn, fordi Patchwerk-målet ikke slår, og
  kræver et skjold (auditens Prot-profil har et tohåndsvåben; en variant med skjold giver 52,2 → 52,0). Guildens
  Holy 39 stiger fra 73,3 til 75,9.
- Mage, warlock, priest, druid og paladin Ret er bit-for-bit uændrede.

**Advarslen nu** (gul, «Aulas model dækker ikke … fuldt ud», sammen med «Grov model»):

- Shaman Elemental: «Magma- og Fire Nova Totem, mana-drikke og Call of Flame. Under level 26 (før Mana Spring
  Totem) og i lange kampe løber manaen tør, og shamanen venter på den (ingen wand).»
- Shaman Restoration: «healing (kun skade simuleres), Healing Stream Totem og mana-drikke. Shamanen simuleres som
  en Elemental-caster med Mana Spring og Mana Tide Totem.»
- Shaman Enhancement: «Windfury Weapon, Lightning Shield og andre totems end Searing, Strength of Earth, Windfury og
  Mana Spring. Maelstrom Weapons proc-rate er et skøn.»
- Rogue Combat: «Riposte (målet slår ikke i simuleringen), Expose Armor og Kidney Shot. Backstab antager, at du står
  bag målet.»
- Rogue Subtlety: «Death Mark, Setup og Vanish med ny åbning. Backstab og Ambush antager, at du står bag målet.»
- Paladin Holy: «healing (kun skade simuleres), Exorcism og Consecrated Ground. Holy Shock bruges kun over halv
  mana, og under level 30 er rotationen Retributions med Seal of Righteousness.»
- Paladin Protection: «Reckoning og Holy Shields skade ved blok: målet slår ikke i simuleringen, så Holy Shield giver
  kun skade via Shieldsworn på Holy Strike. Holy Shield og Consecration på ét mål koster mana.»

**Antagelser og forbehold** (detaljer i PATCHES.md): rogue står bag målet (Backstab/Ambush); Garrote før Ambush efter
Ghostly Strike er valgt ud fra simuleringen; Swift Judgement er et server-script (antaget = Judgement); Shieldsworn
ændrer ikke Holy Strikes egen skade; mana-grænserne for paladin er vores valg (målt); Righteous Fury koster ingen
mana i simc. Ingen af tallene er sammenlignet med Forever-logs.

**Tilbage fra §10:** warrior (vent på PR #59 eller byg oven på den) og hunter (pet-modellen; seriallos ejer hunter
upstream). For de rettede klasser er de oplagte udvidelser: Death Mark (Subtlety), Seal of Wisdom og Blessings
(paladin-mana), Magma/Fire Nova Totem (shaman) og pets ud over Imp (warlock).

## 15. Opfølgning: warlock-dæmonerne og Demonic Sacrifice

Første punkt i anbefalingen fra pet-researchen (`2026-11-12-pets-i-simc-forever.md`): dæmonerne i vores egen
`warlock.patch` (fork-branch `aula/warlock`, ny commit `9e218c5` oven på `d036ae9`).

1. **Dæmonerne:** Imp (nu for alle level: mana-regen = 0,30 × warlockens Intellect som MP5, manapuljen skønnet op til
   wowsims' level 60-værdi), Voidwalker (nærkamp × 0,5; Torment er threat og simuleres ikke), Succubus (nærkamp +
   Lash of Pain) og Felhunter (nærkamp som skøn). Nærkamp-skaden er wowsims/forever's andele af simcs
   `creature_auto_attack_dps` for hvert level; AP = 3 × level + 6 + 0,17 × warlockens spell damage.
2. **Dæmonvalg** (efter talenter og level, da armory-profilerne har `spec=unknown`): Succubus fra level 20,
   Voidwalker på level 10-19, Imp under 10, for alle specs. Profilen kan overstyre med `default_pet=` og
   `demonic_sacrifice=` (appens hvidliste tillader dem ikke endnu).
3. **Demonic Sacrifice** (Forever: ofret Imp = Burning Shadow +15 % Shadow, ofret Succubus = Touch of Fire +15 % Fire;
   bekræftet i spildataen 18789/18791): kun med Demonic Pact, hvor Imp'en ofres før kampen og Succubus tilkaldes
   bagefter. Uden Pact beholdes dæmonen, fordi den giver mere (målt: Demonology 20 32,5 med Succubus mod 23,9 med ofret
   Imp).
4. **Talenter:** Soul Link, Master Demonologist, Demonic Knowledge, Unholy Power, Improved Imp, Improved Sayaad og
   Demonic Energies. Fel Domination modelleres ikke (dæmonen dør aldrig og tilkaldes før kampen).
5. **`.check`:** kræver nu også `summon_voidwalker`, `summon_succubus`, `summon_felhunter`, `lash_of_pain` og
   `demonic_sacrifice`, så en upstream med Life Tap og wand men kun Imp ikke får rettelsen droppet (testet).
   `check-upstream.sh` giver OK for alle syv rettelser på både `3c1d319` og `main` `c4c9b16`.

**Før/efter** (samme profiler og indstillinger som §13: native bygning, 1000 iterationer, seed 42, Patchwerk;
«før» genskabt bit for bit med den forrige kode; kontrolleret i et lokalt bygget worker-image):

| Spec | DPS L20 før → efter | DPS L40 før → efter | Dæmon (L20 / L40) | Dæmonens andel L40 | DungeonSlice L40 (efter) |
|---|---|---|---|---|---|
| Affliction | 25,1 → **35,4** | 62,5 → **81,2** | Succubus / Succubus | 24 % | 63,5 |
| Demonology | 22,7 → **32,5** | 47,3 → **76,1** | Succubus / ofret Imp + Succubus (Pact) | 31 % | 60,6 |
| Destruction | 24,7 → **34,8** | 60,4 → **78,5** | Succubus / Succubus | 25 % | 63,1 |

- Stigningen er +29-61 %, næsten al fra Succubus' nærkamp (10-20 DPS). Researchens skøn for Demonology 40 var
  +40-55 %; målt +61 %, fordi Demonic Pact giver både dæmonen og +15 % Shadow (Shadow Bolt 15,0 → 17,7).
- Demonology er ikke længere lavest: alle tre specs ligger nu på 76-81 på level 40, over Frost-mage (51) og
  Shadow-priest (64) på samme udstyr. Det skyldes stadig også, at Life Tap ikke koster liv.
- Andre dæmoner på Demonology 40 uden ofring: Succubus 70,7, Imp 68,8 (Demonic Energies fodrer den), Felhunter
  63,1, Voidwalker 55,1. Level 15: Voidwalker 21,2, Imp 19,6, ingen dæmon 17,9.
- Øvrige klasser er uændrede (rettelsen rører kun warlock-filerne).

**Advarslen nu** (gul, sammen med «Grov model»; fælles for alle tre specs: «Dæmonen er Succubus fra level 20
(Voidwalker på level 10-19, Imp under 10), uanset hvilken du selv bruger, og dæmonernes mana er et skøn»):

- Affliction: «Drain Life, Drain Soul, Nightfall og Amplify Curse, og Life Tap koster ikke liv …» + fællesteksten.
- Demonology: «Fel Domination, Demonic Brand og Felhunterens evner (Felhunterens skade er et skøn).» + fællesteksten
  + «Med Demonic Sacrifice og Demonic Pact ofres Imp'en før kampen (+15 % Shadow); uden Pact beholdes dæmonen. Life
  Tap koster ikke liv …».
- Destruction: «Searing Pain, Soul Fire og Curse of the Elements, og Life Tap koster ikke liv …» + fællesteksten.

**Antagelser og forbehold:** dæmonernes manapulje mellem level 9 og 59 er et skøn (interpoleret; i spillet viser
pet-arket på level 60 ca. 10.870 mana mere), og derfor er Lash of Pain og Imp'ens Firebolt usikre; Felhunterens
nærkamp er wowsims' level 60-konstant omregnet til en andel; Voidwalkerens AP antages som Succubus'; tilkaldelser før
kampen koster ingen mana; dæmonen dør aldrig; at alle specs har Succubus ude fra level 20, er et valg for en
skade-simulering (leveling-guider bruger ofte Voidwalker solo). Ingen tal er sammenlignet med Forever-logs.

**Næste trin:** hunter-petten (punkt 2 i pet-researchens anbefaling): spørg på upstream #41, om nogen arbejder på
pets, og byg den ellers som upstream-klar `hunter_pet_t` på `aula/hunter-pet` med samme `expected_stat`-grundlag.
For warlock: Drain Life som alternativ til gratis Life Tap, Searing Pain/Demonic Brand og evt. `default_pet=` i
appens hvidliste, hvis addonet en dag kan sende den aktive dæmon.

## 16. Opfølgning: hunter-petten, nærkamp og flere skud

Punkt 2 i pet-researchens anbefaling (`2026-11-12-pets-i-simc-forever.md`): en ny rettelse `hunter.patch`
(fork-branch `aula/hunter`, commits `4663e42` og `0b72e8c` oven på `3c1d319`). Den er skrevet i upstream-stil og
tænkt som en upstream-PR (udkast i `simc-worker/patches/upstream-hunter-pet.md`, ikke sendt; issue #41 er ikke
spurgt). Detaljer og alle tal: PATCHES.md, afsnit «hunter».

1. **Petten** (`hunter_pet_t`): nærkamp ud fra simcs `creature_auto_attack_dps` for pettens level, egen AP = 4,2 ×
   creature-dps (passer med wowsims' målte pet-ark på level 11/17/30: 36/61/103), 10 % af jægerens højeste AP,
   jægerens crit og hit, Focus 10/s med Bite og Claw efter level, altid glad (× 1,25) og familiens skade. Standard er
   en kat; med Lone Wolf ingen pet. Talenterne Focused Fire, Unleashed Fury, Ferocity, Frenzy, Bestial Discipline,
   Bestial Wrath og orc-racialen Command.
2. **Jægeren:** Hunter's Mark, Rapid Fire, Multi-Shot, Aimed Shot, Sniper Shot, Trueshot Aura og nærkamp (auto-attack,
   Raptor Strike på næste slag, Strider Kick, Mongoose Bite via Expose Prey, Lacerating Strikes). En jæger med
   Survival-nærkamp-talenter står i nærkamp; alle andre skyder. Kill Command findes ikke i Forever og er ikke bygget.
3. **Mana:** jægeren er tom for mana efter ca. 40-110 s. Manaen går til Serpent Sting og Arcane Shot (mest skade pr.
   mana) og spares op til Bestial Wrath. Aimed Shot og Sniper Shot er bygget, men står ikke i standardrotationen:
   målt gav de mindre i alle profiler.
4. **`.check`:** kræver en pet-klasse og handlingerne `summon_pet`, `auto_attack`, `raptor_strike`, `multi_shot`,
   `hunters_mark` og `bestial_wrath` i både modul og APL, så en upstream med kun en pet ikke får rettelsen droppet
   (testet). `check-upstream.sh` giver OK for alle otte rettelser på `3c1d319` og `main` `c4c9b16`.

**Før/efter** (samme profiler og indstillinger som §1: native bygning, 1000 iterationer, seed 42; kontrolleret i et
lokalt bygget worker-image):

| Spec | DPS L20 før → efter | DPS L40 før → efter | Pettens andel L40 | DungeonSlice L20 / L40 (efter) |
|---|---|---|---|---|
| Beast Mastery | 16,5 → **38,2** | 36,6 → **89,1** | 55 % | 34,1 / 78,0 |
| Marksmanship | 19,8 → **21,3** | 49,6 → **58,9** | ingen pet (Lone Wolf) | 18,0 / 46,6 |
| Survival | 16,5 → **38,2** | 36,7 → **84,0** | 44 % | 34,1 / 72,9 |

- **BM og Survival stiger 2,3-2,4 gange.** Researchens skøn var × 1,8-2,3; petten er halvdelen af skaden, og BM 40's
  talenter (Unleashed Fury, Bestial Wrath) løfter den yderligere. BM 40 ligger nu over Frost-mage (51) og
  Shadow-priest (64) og på niveau med Ret-paladin (84) på samme udstyr.
- **Marksmanship stiger kun 7-19 %**, fordi auditens MM-profiler har Lone Wolf (ingen pet). Med en kat i stedet giver
  MM 40 88,8. Modellen siger altså, at Lone Wolf koster ca. en tredjedel af skaden; det er ikke målt i spillet.
- **Survival 20** har ingen nærkamp-talenter og skyder derfor præcis som BM 20. Survival 40 står i nærkamp: jægerens
  nærkamp, Strider Kick og Raptor Strike er 56 % af skaden.
- «Venter» er stadig ca. 80 %: det er tid, hvor Auto Shot (eller nærkampen) kører, og jægeren ikke har mana til andet.
- Øvrige klasser er uændrede (rettelsen rører kun hunter-filerne).

**Advarslen nu** (gul «Aulas model dækker ikke … fuldt ud» sammen med «Grov model: SimulationCraft's grundmodel med
Aulas rettelser»; den røde «mangler pet» falder væk):

- Beast Mastery: «Intimidation, Summon Hawk, fælder og melee-weaving (Raptor Strike mellem skuddene). Petten er en kat
  med Bite og Claw, altid glad og dør aldrig, og dens skade bygger på wowsims' målinger. Aimed Shot bruges ikke: med
  jægerens mana giver Arcane Shot mere.»
- Marksmanship: «Scatter Shot, Volley, fælder og melee-weaving. Med Lone Wolf simuleres ingen pet; uden Lone Wolf er
  petten en kat. Aimed Shot og Sniper Shot bruges ikke: med jægerens mana giver Arcane Shot mere.»
- Survival: «Counterattack, Wing Clip, fælder og Mongoose Bite efter en dodge (målet slår ikke i simuleringen, så kun
  via Expose Prey). Med nærkamp-talenter står jægeren i nærkamp hele kampen uden at skyde; uden dem skyder den som
  Beast Mastery. Petten er en kat …» (som BM).

**Antagelser og forbehold:** petten er altid glad, dør aldrig og står i nærkamp fra start; familien er en kat, uanset
hvad spilleren bruger (`summon_pet=` er ikke i appens hvidliste); familiens skade er håndkodet fra spildataen (mangler i
simc, issue #5); pettens liv, crit ved lav våbenskill og hit er ikke målt; Arcane Shot og Serpent Sting beholder
upstreams AP-andele (0,10/0,03; wowsims bruger 0,15/0,05); Multi-Shots 0,5 s cast og at et cast holder Auto Shot
tilbage er wowsims' observationer; ingen melee-weaving. Ingen tal er sammenlignet med Forever-logs.

**Næste trin:** spørg på upstream #41, før PR'en sendes (brugerens beslutning). For hunter selv: melee-weaving,
Summon Hawk og evt. `summon_pet=` i appens hvidliste, hvis addonet en dag kan sende pettens familie.
