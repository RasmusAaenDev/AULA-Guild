// Hvad SimulationCraft til WoW Forever mangler pr. klasse og spec, så resultatkortet kan sige det ærligt.
// Kilde: docs/superpowers/notes/2026-11-12-simc-audit-pr-klasse.md (målt mod SIMC_REF 3c1d319).
//
// To slags huller:
// - `upstream`: klassen kører på SimulationCraft's egen grundmodel (ingen Aula-rettelse). Teksten vises kun, når
//   resultatet IKKE er markeret «Grov model» (workerens advarsel for vores rettelser). Får klassen en rettelse
//   (druid, priest, warlock, shaman), falder advarslen væk af sig selv, så snart workeren melder «Grov model».
// - `withFix`: vores egen rettelse dækker ikke denne spec (fx paladin Holy, rogue Subtlety, warlock-pets,
//   shaman-totems). Vises kun sammen med «Grov model», fordi det er vores model, der mangler noget.
// Uden kendt spec bruges klassens fælles tekst (`*`), hvis der er en.

export type ModelGapKind = 'upstream' | 'partial';
export type ModelGap = { kind: ModelGapKind; title: string; text: string; missing: string };

type Gap = { upstream?: string; withFix?: string };

/** Klasse → spec (normaliseret, se specKey) eller `*` (alle/ukendt spec) → hvad der mangler. */
export const MODEL_GAPS: Readonly<Record<string, Readonly<Record<string, Gap>>>> = {
  warrior: {
    '*': { upstream: 'Mortal Strike, Bloodthirst, Whirlwind, Execute, Overpower og dual wield. Kun Heroic Strike, Rend og auto-attack er med' },
    arms: { upstream: 'Mortal Strike, Overpower, Execute, Slam og Deep Wounds. Kun Heroic Strike, Rend og auto-attack er med' },
    fury: { upstream: 'dual wield, Bloodthirst, Whirlwind, Flurry og Execute. Kun Heroic Strike, Rend og auto-attack er med' },
    protection: { upstream: 'Shield Slam, Revenge og Sunder Armor. Kun Heroic Strike, Rend og auto-attack er med' },
  },
  hunter: {
    '*': { upstream: 'pet, nærkamp (Raptor Strike), Multi-Shot, Aimed Shot og Hunter\'s Mark. Kun Auto Shot, Serpent Sting og Arcane Shot er med' },
    'beast mastery': { upstream: 'pet (og dermed Bestial Wrath og Frenzy), Raptor Strike, Multi-Shot og Hunter\'s Mark. Kun Auto Shot, Serpent Sting og Arcane Shot er med' },
    marksmanship: { upstream: 'pet, Aimed Shot, Rapid Fire og Trueshot Aura. Kun Auto Shot, Serpent Sting og Arcane Shot er med' },
    survival: { upstream: 'al nærkamp (Raptor Strike, Mongoose Bite) og pet. Kun Auto Shot, Serpent Sting og Arcane Shot er med' },
  },
  shaman: {
    '*': { upstream: 'Lightning Bolt og Chain Lightning. Shamanen simuleres som nærkæmper med Flame Shock og Earth Shock' },
    elemental: {
      upstream: 'Lightning Bolt og Chain Lightning. Shamanen simuleres som nærkæmper med Flame Shock og Earth Shock',
      withFix: 'Magma- og Fire Nova Totem, mana-drikke og Call of Flame. Under level 26 (før Mana Spring Totem) og i lange kampe løber manaen tør, og shamanen venter på den (ingen wand)',
    },
    enhancement: {
      upstream: 'Stormstrike, Windfury, Lightning Shield, Maelstrom Weapon og Flurry',
      withFix: 'Windfury Weapon, Lightning Shield og andre totems end Searing, Strength of Earth, Windfury og Mana Spring. Maelstrom Weapons proc-rate er et skøn',
    },
    restoration: {
      upstream: 'Lightning Bolt og Chain Lightning. Shamanen simuleres som nærkæmper med Flame Shock og Earth Shock',
      withFix: 'healing (kun skade simuleres), Healing Stream Totem og mana-drikke. Shamanen simuleres som en Elemental-caster med Mana Spring og Mana Tide Totem',
    },
  },
  druid: {
    '*': { upstream: 'Wrath og Moonfire uden Moonkin Form: under level 40 kaster druiden ingenting og slår kun med staven. Der er heller ingen kat-rotation' },
    balance: { upstream: 'Wrath og Moonfire uden Moonkin Form: under level 40 (og uden talentet) kaster druiden ingenting og slår kun med staven' },
    feral: {
      upstream: 'hele kat-rotationen (Shred, Rake, Rip, Ferocious Bite), og uden Moonkin Form kaster druiden ingenting: kun slag med staven',
      withFix: 'hele kat- og bjørne-rotationen (Shred, Rake, Rip, Ferocious Bite). Druiden simuleres som caster med Wrath og Moonfire',
    },
    restoration: { upstream: 'Wrath og Moonfire uden Moonkin Form: druiden kaster ingenting og slår kun med staven' },
  },
  priest: {
    '*': { upstream: 'wand (Shoot) og mana-styring: priesten er tom for mana efter ca. 30 sekunder og står derefter stille' },
    discipline: { upstream: 'wand (Shoot) og mana-styring: priesten er tom for mana efter ca. 30 sekunder og står derefter stille. Holy Fire bruges ikke' },
    holy: { upstream: 'wand (Shoot) og mana-styring: priesten er tom for mana efter ca. 30 sekunder og står derefter stille. Holy Fire bruges ikke' },
    shadow: { upstream: 'wand (Shoot) og mana-styring. Uden Shadowform på lavt level går priesten tom for mana og står stille' },
  },
  warlock: {
    '*': { upstream: 'Life Tap og wand, så warlocken går tom for mana og står stille. Heller ingen Bane of Agony, Drain Life eller Siphon Life' },
    affliction: {
      upstream: 'Life Tap og wand, så warlocken går tom for mana og står stille. Heller ingen Bane of Agony, Drain Life eller Siphon Life',
      withFix: 'Drain Life, Drain Soul, Nightfall og Amplify Curse, og Life Tap koster ikke liv (simuleringen antager en healer)',
    },
    demonology: {
      upstream: 'Life Tap og wand, og kun Imp (ingen Voidwalker, Felhunter, Succubus eller Demonic Sacrifice)',
      withFix: 'Voidwalker, Felhunter, Succubus og Demonic Sacrifice: kun Imp, med stats tilpasset level 3-10. Life Tap koster ikke liv (simuleringen antager en healer)',
    },
    destruction: {
      upstream: 'Life Tap og wand, og ingen Conflagrate, Shadowburn, Searing Pain eller Incinerate',
      withFix: 'Searing Pain, Soul Fire og Curse of the Elements, og Life Tap koster ikke liv (simuleringen antager en healer)',
    },
  },
  paladin: {
    holy: { withFix: 'healing (kun skade simuleres), Exorcism og Consecrated Ground. Holy Shock bruges kun over halv mana, og under level 30 er rotationen Retributions med Seal of Righteousness' },
    protection: { withFix: 'Reckoning og Holy Shields skade ved blok: målet slår ikke i simuleringen, så Holy Shield giver kun skade via Shieldsworn på Holy Strike. Holy Shield og Consecration på ét mål koster mana' },
  },
  rogue: {
    combat: { withFix: 'Riposte (målet slår ikke i simuleringen), Expose Armor og Kidney Shot. Backstab antager, at du står bag målet' },
    subtlety: { withFix: 'Death Mark, Setup og Vanish med ny åbning. Backstab og Ambush antager, at du står bag målet' },
  },
};

/** Forever-navne og korte navne på samme spec («Feral Combat» = «Feral», «Shadow Magic» = «Shadow»). */
const SPEC_ALIASES: Record<string, string> = {
  'feral combat': 'feral',
  'elemental combat': 'elemental',
  'shadow magic': 'shadow',
  'beastmastery': 'beast mastery',
};

export function specKey(spec: string | null | undefined): string | null {
  if (!spec) return null;
  const k = spec.trim().toLowerCase().replace(/\s+/g, ' ');
  return k === '' ? null : (SPEC_ALIASES[k] ?? k);
}

/** Workerens advarsel for Aulas egne rettelser (patchinfo.mjs: MODEL_WARNING). */
export const isAulaModel = (warnings: readonly string[]): boolean => warnings.some((w) => /^Grov model\b/.test(w));

const capitalize = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Advarslen til resultatkortet, eller null når modellen ikke har et kendt hul for klassen/specen.
 * `warnings` er resultatets advarsler fra workeren (afgør om vores rettelse er brugt).
 */
export function modelGap(subject: { className: string | null; spec: string | null }, warnings: readonly string[]): ModelGap | null {
  const cls = subject.className?.trim().toLowerCase() ?? '';
  const table = MODEL_GAPS[cls];
  if (!table) return null;
  const key = specKey(subject.spec);
  const specGap = key !== null && key !== cls ? table[key] : undefined;
  const aula = isAulaModel(warnings);
  const who = specGap && subject.spec ? `${capitalize(cls)} (${subject.spec.trim()})` : capitalize(cls);
  if (aula) {
    const missing = specGap?.withFix;
    if (!missing) return null;
    return {
      kind: 'partial',
      title: `Aulas model dækker ikke ${who} fuldt ud`,
      text: 'Tallet er sandsynligvis lavere end i spillet. Brug det til at sammenligne dit eget udstyr, ikke til at sammenligne med andre specs eller klasser.',
      missing: `${missing}.`,
    };
  }
  const missing = specGap?.upstream ?? table['*']?.upstream;
  if (!missing) return null;
  return {
    kind: 'upstream',
    title: `Simulatoren mangler vigtige evner for ${who}`,
    text: 'Tallet er meget lavere eller helt anderledes end i spillet og bør ikke bruges til at sammenligne med andre klasser.',
    missing: `${missing}.`,
  };
}
