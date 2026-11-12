# Udkast: upstream-issue/PR til simc-forever (druid i caster form)

Udkast til en issue og/eller PR mod `simulationcraft/simc-forever`. **Ikke sendt.** Koden ligger på forken
`RasmusAaenDev/simc-forever`, branch `aula/druid` (én commit oven på `3c1d319`); `druid.patch` i denne mappe er samme
diff. Brugeren beslutter, om og hvornår den sendes.

---

## Title

[Druid] Balance spells never become ready in caster form (spell attribute 83 is ignored)

## Body

**Problem**

`druid_action_t` sets `form_mask = data().stance_mask()` and `ready()` requires `( form_mask & p()->form ) == p()->form`.
In the Forever spell data, Wrath, Moonfire, Starfire, Insect Swarm, Hurricane, Faerie Fire and Innervate list only
Moonkin Form in their stance mask (`0x40000000`; Faerie Fire `0x40000091`, Innervate `0x40000002`), but they also carry
spell attribute 83, *Allow While Not Shapeshifted (caster form)*:

```
$ simc spell_query=spell.id=5176
Name             : Wrath (desc=Rank 1) (id=5176) [Spell Family (7)]
Stance Mask      : 0x40000000
Attributes       : Not Shapeshifted (16), Allow While Not Shapeshifted (caster form) (83), ...
```

The attribute is not read, so in caster form (`CASTER_FORM`, `0x2`) none of these actions is ever ready. A druid
without the Moonkin Form talent (every druid below level 40, and Feral/Restoration builds) casts nothing and only
melees with its weapon: the default APL ends up with ~100 % *Waiting* and 0 Wrath casts.

**Fix**

Add the attribute to `spell_attribute` and allow caster form when it is set:

```cpp
// engine/dbc/data_enums.hh
  SX_DONT_DISPLAY_IN_AURA_BAR       = 60u,
+ SX_ALLOW_WHILE_NOT_SHAPESHIFTED   = 83u,
  SX_CANNOT_CRIT                    = 93u,

// engine/class_modules/sc_druid.cpp, druid_action_t constructor
  form_mask = this->data().stance_mask();

+ // Spells such as Wrath and Moonfire list only Moonkin Form in their stance mask, but are flagged as castable
+ // without a shapeshift (attribute 83), i.e. in caster form.
+ if ( form_mask && this->data().flags( spell_attribute::SX_ALLOW_WHILE_NOT_SHAPESHIFTED ) )
+   form_mask |= CASTER_FORM;
```

Spells without a stance mask are unaffected (`form_mask` stays 0, i.e. any form), and Moonkin Form behaves exactly
as before. Cat abilities (`CAT_FORM` masks) do not have the attribute and are unaffected.

**Tested** (default APL, Patchwerk, 1000 iterations, seed 42, synthetic level 20/40 profiles with all points in one
tree):

| Profile | `3c1d319` | `3c1d319` + fix | `main` `1b8e01d` | `main` + fix |
|---|---|---|---|---|
| Balance 20 (no Moonkin Form) | 5.1 DPS, 100 % waiting, 0 Wrath | 12.9 DPS, 61 % waiting, 63 Wrath | 7.0 DPS, 100 % waiting | 14.1 DPS |
| Balance 40 (Moonkin Form) | 46.4 DPS | 46.4 DPS (unchanged) | 48.0 DPS | 48.0 DPS (unchanged) |
| Restoration 40 | 11.7 DPS, 100 % waiting | 27.6 DPS, 50 % waiting | 14.9 DPS | 29.3 DPS |

The remaining waiting time below 40 is mana (the druid runs out and melees); that is a separate topic.

The patch applies cleanly to `main` (`1b8e01d`). Happy to open it as a PR against `main` if that is preferred.

---

## Hvis det skal være en PR i stedet

- Base: `simulationcraft/simc-forever` `main`; head: `RasmusAaenDev/simc-forever:aula/druid` (eller en ny branch rebaset
  på `main`, da `aula/druid` er lavet på `3c1d319`).
- Titel: `[Druid] Allow caster form for spells flagged 'Allow While Not Shapeshifted'` (samme som commit-beskeden).
- Brødtekst: afsnittene **Problem**, **Fix** og **Tested** ovenfor.
- Commit-beskeden på `aula/druid` har `Co-Authored-By`/`Claude-Session`-linjer; fjern dem eller lav en ny commit, hvis
  upstream ikke ønsker dem.
