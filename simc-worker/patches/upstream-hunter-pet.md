# Udkast: upstream-PR til simc-forever (hunter-pet, nærkamp og flere skud)

Udkast til en PR mod `simulationcraft/simc-forever`. **Ikke sendt.** Koden ligger på forken
`RasmusAaenDev/simc-forever`, branch `aula/hunter` (to commits oven på `3c1d319`: `4663e42` og `0b72e8c`);
`hunter.patch` i denne mappe er samme diff. Den passer uændret på upstream `main` `c4c9b16`. Brugeren beslutter, om og
hvornår den sendes. Pet-researchen anbefalede først at spørge på issue #41, om nogen arbejder på pets; det er ikke
gjort.

Før den sendes:

- Rebase på upstream `main` og byg der (ikke kun `git apply --check`).
- Overvej at dele den i to PR'er (pet + BM-talenter, derefter skud og nærkamp), hvis seriallos foretrækker mindre PR'er.
- `summon_pet=` og `pet_active` er nye navne; tjek, om upstream vil have retail-hunterens navne i stedet.

---

## Title

[Hunter] Pet, melee and the missing shots

## Body

Implements the first unchecked item of #41 ("Pets") plus the abilities most hunters press below level 60. Everything
else in the module is unchanged (Auto Shot, Aspect of the Hawk, Serpent Sting and Arcane Shot keep their current
coefficients).

**Pet (`hunter_pet_t`)**

- The pet's auto attack is built on `expected_stat_t::creature_auto_attack_dps` for its level (60.45 at level 60, the
  value the forever-hunter wiki gives). Its own attack power is `0.3 × 14 × creature dps` (4.2 × creature dps), which
  reproduces the attack power on pet sheets at level 11, 17 and 30 (36, 61, 103; wowsims/forever `sim/hunter/pets.go`
  measured those sheets). The 2.0 s swing before attack power is the rest, `(creature dps − own AP / 14) × 2`, ±20%.
- From the hunter: 10% of the higher of melee and ranged attack power (Hunter Pet Scaling 415429), crit and hit, 30%
  armor. Only Rapid Fire and Frenzy speed the pet up; the hunter's ranged/quiver haste does not reach it. Note that
  `pet_t` by default inherits the owner's melee haste and auto attack speed, which would be wrong here.
- Focus: 100, 10 per second, Bestial Discipline raises the regeneration. Bite and Claw at the rank the hunter's
  level teaches (flat damage). Autocast order: longest cooldown first, an ability short of focus passes to the next.
- Always Happy (+25% damage), as wowsims assumes.
- Families: `summon_pet=auto|none|<family>`; `auto` is a cat, or no pet with Lone Wolf. With a pet out anyway, Lone
  Wolf's +20% is deregistered. The family damage modifiers are copied from the Tamed Pet Passives because those spells
  are missing from the generated data (#5); the other family abilities are not modelled.
- Talents: Focused Fire, Unleashed Fury, Ferocity, Frenzy, Bestial Discipline, Bestial Wrath; Orc Command.

**Hunter**

- Hunter's Mark (target debuff, ranged attack power against the marked target), Rapid Fire (ranged and melee speed,
  also for the pet), Multi-Shot and Aimed Shot (shared cooldown), Sniper Shot, Trueshot Aura.
- Shots with a cast time keep Auto Shot from firing until the cast ends. Multi-Shot gets a 0.5 s cast, which the spell
  data leaves out (observed in game by wowsims/forever).
- Melee: auto attack, Raptor Strike on the next swing (the Heroic Strike queue pattern, as the TODO in
  `sc_warrior.cpp` suggests), Strider Kick, Mongoose Bite (only after a dodge or an Expose Prey proc), Lacerating
  Strikes.
- Range: melee abilities need melee range and shots their minimum range (8 yd). A hunter with Survival melee talents
  (Savage Strikes, Predator's Edge, Counterattack, Strider Kick, Lacerating Strikes) defaults to melee distance,
  everyone else to Auto Shot range (the two distance TODOs in `init_base_stats`). `distance=` still wins.

**APL**

`summon_pet`, Aspect of the Hawk, Trueshot Aura and Hunter's Mark before the fight; then Bestial Wrath, Rapid Fire,
the melee abilities in melee range, Serpent Sting, Multi-Shot on more than one target and Arcane Shot. Hunters run out
of mana after roughly 40-110 s in a 300 s Patchwerk, and Serpent Sting and Arcane Shot deal the most damage per mana
(about 2 and 1.5, against 0.7-0.8 for Aimed Shot and Sniper Shot), so Aimed Shot and Sniper Shot are implemented but
not in the default list: with a mana threshold they lost 0.2-4% in every profile tried. Mana is pooled for Bestial
Wrath (otherwise it is cast once per fight because Arcane Shot is cheaper).

**Numbers** (synthetic dwarf profiles, 1000 iterations, Patchwerk; before → after)

| Profile | Level 20 | Level 40 | Pet share at 40 |
|---|---|---|---|
| Beast Mastery (UF 5, FF 2, Ferocity 1, BW at 40) | 16.5 → 38.2 | 36.6 → 89.1 | 55% |
| Marksmanship (Lone Wolf, so no pet) | 19.8 → 21.3 | 49.6 → 58.9 | – |
| Survival (melee talents at 40 only) | 16.5 → 38.2 | 36.7 → 84.0 | 44% |

DungeonSlice runs without errors. Level 5, 9 and 60 (all talents) run without errors.

**Not verified / open questions**

- Pet health, the pet's crit at low weapon skill and its hit are not read on a pet sheet (also TODOs in wowsims).
- The family damage modifiers come from the game files, not from simc's data (#5).
- Arcane Shot and Serpent Sting keep the module's attack power shares (0.10 and 0.03 per tick, "only tested at low
  levels"); wowsims uses 0.15 and 0.05.
- No melee weaving, traps, Summon Hawk, Intimidation, Wing Clip, Counterattack (needs a parry), Volley or Scatter
  Shot. The pet never dies and starts in melee range.
- None of the numbers are compared with Forever combat logs.

Formulas and constants are translated from wowsims/forever (MIT), not copied.
