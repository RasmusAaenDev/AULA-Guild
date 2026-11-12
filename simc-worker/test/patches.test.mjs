// Tests af rettelses-mekanismen (patches/apply.sh og check-upstream.sh) mod en lille falsk simc-mappe,
// uden at bygge simc. fixtures/simc-upstream/ er de rene upstream-filer ved SIMC_REF, som rettelserne (druid.patch,
// mage.patch, paladin.patch, rogue.patch …) er lavet mod. Rettelserne rører forskellige filer og afhænger ikke af hinanden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeProfile } from '../sanitize.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const patchDir = path.join(here, '../patches');
const upstream = path.join(here, 'fixtures/simc-upstream');
const APPLY = path.join(patchDir, 'apply.sh');
const CHECK_UPSTREAM = path.join(patchDir, 'check-upstream.sh');
const MAGE = 'engine/class_modules/sc_mage.cpp';
const MAGE_APL = 'engine/class_modules/apl/mage.cpp';
const MAGE_HPP = 'engine/class_modules/apl/mage.hpp';
const PALADIN = 'engine/class_modules/sc_paladin.cpp';
const PALADIN_APL = 'engine/class_modules/apl/paladin.cpp';
const PALADIN_HPP = 'engine/class_modules/apl/paladin.hpp';
const ROGUE = 'engine/class_modules/sc_rogue.cpp';
const ROGUE_APL = 'engine/class_modules/apl/rogue.cpp';
const ROGUE_HPP = 'engine/class_modules/apl/rogue.hpp';
const DRUID = 'engine/class_modules/sc_druid.cpp';
const ENUMS = 'engine/dbc/data_enums.hh';
const PRIEST = 'engine/class_modules/sc_priest.cpp';
const PRIEST_APL = 'engine/class_modules/apl/priest.cpp';
const WARLOCK = 'engine/class_modules/sc_warlock.cpp';
const WARLOCK_APL = 'engine/class_modules/apl/warlock.cpp';
const SHAMAN = 'engine/class_modules/sc_shaman.cpp';
const SHAMAN_APL = 'engine/class_modules/apl/shaman.cpp';
// apply.sh går rettelserne igennem via globben *.patch, dvs. alfabetisk efter klasse.
const CLASSES = ['druid', 'mage', 'paladin', 'priest', 'rogue', 'shaman', 'warlock'];
const ALL_APPLIED = 'druid applied\nmage applied\npaladin applied\npriest applied\nrogue applied\nshaman applied\nwarlock applied\n';

const tmp = (p) => mkdtempSync(path.join(tmpdir(), p));
function fakeSimc() {
  const dir = tmp('fake-simc-');
  cpSync(upstream, dir, { recursive: true });
  return dir;
}
function run(script, args, env = {}) {
  const r = spawnSync('sh', [script, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const read = (dir, f) => readFileSync(path.join(dir, f), 'utf8');

// Navne, rettelserne tilføjer for Combat/Subtlety (rogue) og Holy/Protection (paladin): upstream regnes kun for
// færdig med klassen, når den også selv opretter dem (se rogue.check / paladin.check).
const ROGUE_UPSTREAM_ACTIONS = '  if ( name == "backstab" ) return a;\n  if ( name == "hemorrhage" ) return b;\n  if ( name == "ghostly_strike" ) return c;\n';

test('fixturen er præcis den upstream-version hver rettelse er lavet mod (ellers: opdatér fixtures/simc-upstream)', () => {
  const patches = readdirSync(patchDir).filter((f) => f.endsWith('.patch'));
  for (const cls of CLASSES) assert.ok(patches.includes(`${cls}.patch`), cls);
  for (const name of patches) {
    const patch = readFileSync(path.join(patchDir, name), 'utf8');
    const files = [...patch.matchAll(/^diff --git a\/(\S+) b\/\S+\nindex ([0-9a-f]+)\.\./gm)];
    assert.ok(files.length >= 1, name);
    for (const [, file, blob] of files) {
      const actual = execFileSync('git', ['hash-object', path.join(upstream, file)], { encoding: 'utf8' }).trim();
      assert.ok(actual.startsWith(blob), `${name} ${file}: fixture ${actual.slice(0, 7)} ≠ patchens ${blob}`);
    }
  }
});

test('alle rettelser rører hver sine filer (ingen afhængighed mellem rettelserne)', () => {
  const touched = (name) => new Set([...readFileSync(path.join(patchDir, name), 'utf8').matchAll(/^\+\+\+ b\/(\S+)$/gm)].map((m) => m[1]));
  const patches = readdirSync(patchDir).filter((f) => f.endsWith('.patch'));
  const sets = patches.map((p) => [p, touched(p)]);
  for (const [a, fa] of sets) {
    for (const [b, fb] of sets) {
      if (a >= b) continue;
      for (const f of fa) assert.equal(fb.has(f), false, `${a} og ${b} rører begge ${f}`);
    }
  }
  assert.deepEqual([...touched('mage.patch')].sort(), [MAGE_HPP, MAGE_APL, MAGE].sort());
  assert.deepEqual([...touched('paladin.patch')].sort(), [PALADIN_HPP, PALADIN_APL, PALADIN].sort());
  assert.deepEqual([...touched('rogue.patch')].sort(), [ROGUE_HPP, ROGUE_APL, ROGUE].sort());
  assert.deepEqual([...touched('druid.patch')].sort(), [DRUID, ENUMS].sort());
  assert.deepEqual([...touched('priest.patch')].sort(), [PRIEST_APL, PRIEST].sort());
  assert.deepEqual([...touched('warlock.patch')].sort(), [WARLOCK_APL, WARLOCK].sort());
  assert.deepEqual([...touched('shaman.patch')].sort(), [SHAMAN_APL, SHAMAN].sort());
});

test('(a) rettelsen anvendes på ren upstream og skriver PATCHES_APPLIED', () => {
  const src = fakeSimc();
  const out = path.join(src, 'opt/PATCHES_APPLIED');
  try {
    const r = run(APPLY, [src, out]);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /mage: rettelse anvendt/);
    assert.match(read(src, MAGE), /AULA-RETTELSE/);
    assert.match(read(src, MAGE_APL), /add_action\( "frostbolt" \)/);
    // Mana-styring: Evocation ved lav mana og wand (Shoot) som sidste udvej.
    assert.match(read(src, MAGE_APL), /add_action\( "evocation,if=mana\.pct<10" \)[\s\S]*add_action\( "shoot" \)/);
    assert.match(read(src, MAGE), /find_spell\( 5019 \)/);
    assert.match(read(src, MAGE), /set_spell\( 12051 \)/);
    // Talenternes passive effekter fra spildata; Wand Specialization kun på Shoot.
    assert.match(read(src, MAGE), /parse_all_class_passives\(\);\s*\n[\s\S]*parse_all_passive_talents\(\);/);
    assert.match(read(src, MAGE), /deregister_passive_spell\( talent\.wand_specialization \)/);
    assert.match(r.out, /paladin: rettelse anvendt/);
    assert.match(read(src, PALADIN), /AULA-RETTELSE/);
    // rogue: energi, combo points, builders/finishers, gifte og passive talenter
    assert.match(r.out, /rogue: rettelse anvendt/);
    assert.match(read(src, ROGUE), /AULA-RETTELSE/);
    assert.match(read(src, ROGUE), /RESOURCE_ENERGY/);
    assert.match(read(src, ROGUE), /RESOURCE_COMBO_POINT/);
    assert.match(read(src, ROGUE), /parse_all_class_passives\(\);\s*\n[\s\S]*parse_all_passive_talents\(\);/);
    assert.match(read(src, ROGUE_APL),
      /add_action\( "slice_and_dice,[^"]*" \)[\s\S]*add_action\( "rupture,[^"]*" \)[\s\S]*add_action\( "eviscerate,[^"]*" \)[\s\S]*add_action\( "mutilate,[^"]*" \)[\s\S]*add_action\( "sinister_strike,[^"]*" \)/);
    // rogue Combat/Subtlety: Backstab, Hemorrhage, Ghostly Strike, Premeditation, Preparation
    for (const a of ['backstab', 'hemorrhage', 'ghostly_strike', 'premeditation', 'preparation']) {
      assert.match(read(src, ROGUE), new RegExp(`if \\( name == "${a}" \\)`), a);
    }
    assert.match(read(src, ROGUE_APL), /add_action\( "ghostly_strike,[^"]*" \)[\s\S]*add_action\( "hemorrhage,[^"]*" \)[\s\S]*add_action\( "backstab,[^"]*" \)[\s\S]*add_action\( "sinister_strike,[^"]*" \)/);
    // druid: caster form tilladt for spells med attribut 83
    assert.match(r.out, /druid: rettelse anvendt/);
    assert.match(read(src, ENUMS), /SX_ALLOW_WHILE_NOT_SHAPESHIFTED\s+= 83u,/);
    assert.match(read(src, DRUID), /flags\( spell_attribute::SX_ALLOW_WHILE_NOT_SHAPESHIFTED \) \)\s*\n\s*form_mask \|= CASTER_FORM;/);
    // priest: wand (Shoot) og wand-fase ved lav mana, Holy Fire uden Mind Flay
    assert.match(r.out, /priest: rettelse anvendt/);
    assert.match(read(src, PRIEST), /AULA-RETTELSE/);
    assert.match(read(src, PRIEST), /if \( name == "shoot" \)\s*\n\s*return new shoot_t/);
    assert.match(read(src, PRIEST), /player->find_spell\( 5019 \)/);
    assert.match(read(src, PRIEST_APL), /wand_phase,op=set,value=1,if=mana\.pct<10[\s\S]*wand_phase,op=set,value=0,if=mana\.pct>40[\s\S]*add_action\( "shoot,if=variable\.wand_phase" \)[\s\S]*add_action\( "holy_fire,if=!ticking&!talent\.mind_flay\.enabled" \)[\s\S]*add_action\( "smite" \)\s*;\s*\n\s*default_->add_action\( "shoot" \);/);
    // warlock: Life Tap, wand, Bane of Agony og spec-talenter efter talenter
    assert.match(r.out, /warlock: rettelse anvendt/);
    assert.match(read(src, WARLOCK), /AULA-RETTELSE/);
    for (const a of ['shoot', 'life_tap', 'bane_of_agony', 'siphon_life', 'shadowburn', 'conflagrate', 'incinerate', 'wrack']) {
      assert.match(read(src, WARLOCK), new RegExp(`if \\( name == "${a}" \\)`), a);
    }
    assert.match(read(src, WARLOCK_APL), /add_action\( "life_tap,if=mana\.pct<20" \)[\s\S]*add_action\( "bane_of_agony,if=!ticking" \)[\s\S]*add_action\( "shadow_bolt" \);\s*\n\s*default_->add_action\( "shoot" \);/);
    // shaman: caster-liste for Elemental/Restoration, Stormstrike m.m. for Enhancement
    assert.match(r.out, /shaman: rettelse anvendt/);
    assert.match(read(src, SHAMAN), /AULA-RETTELSE/);
    for (const a of ['lightning_bolt', 'chain_lightning', 'stormstrike', 'searing_totem', 'windfury_totem', 'water_shield']) {
      assert.match(read(src, SHAMAN), new RegExp(`if \\( name == "${a}" \\)`), a);
    }
    assert.match(read(src, SHAMAN_APL), /run_action_list,name=caster,if=variable\.caster[\s\S]*add_action\( "stormstrike" \)[\s\S]*caster->add_action\( "lightning_bolt,[^"]*" \)/);
    // shaman: mana fra Mana Spring Totem (alle) og Mana Tide Totem (Restoration)
    for (const a of ['mana_spring_totem', 'mana_tide_totem']) assert.match(read(src, SHAMAN), new RegExp(`if \\( name == "${a}" \\)`), a);
    assert.match(read(src, SHAMAN_APL), /precombat->add_action\( "mana_spring_totem" \)[\s\S]*caster->add_action\( "mana_tide_totem,if=mana\.pct<50" \)/);
    assert.equal(readFileSync(out, 'utf8'), ALL_APPLIED);
    // Igen på samme mappe: genkendes som allerede anvendt, ingen fejl. Druid-rettelsen er i upstream-stil uden
    // markør og kan ikke skelnes fra upstreams egen rettelse: den melder DROP (se PATCHES.md).
    const again = run(APPLY, [src, out]);
    assert.equal(again.code, 0, again.err);
    assert.match(again.out, /UPSTREAM HAR druid/);
    assert.match(again.out, /mage: allerede anvendt/);
    assert.match(again.out, /paladin: allerede anvendt/);
    assert.match(again.out, /rogue: allerede anvendt/);
    assert.match(again.out, /priest: allerede anvendt/);
    assert.match(again.out, /warlock: allerede anvendt/);
    assert.match(again.out, /shaman: allerede anvendt/);
    assert.equal(readFileSync(out, 'utf8'), ALL_APPLIED.replace('druid applied', 'druid dropped-upstream'));
  } finally { rmSync(src, { recursive: true, force: true }); }
});

test('(b) upstream har selv implementeret mage: rettelsen droppes uden fejl', () => {
  const src = fakeSimc();
  const out = path.join(src, 'PATCHES_APPLIED');
  try {
    const impl = `// upstream mage\n${'// linje\n'.repeat(200)}`;
    writeFileSync(path.join(src, MAGE), impl);
    writeFileSync(path.join(src, MAGE_APL), 'void mage( player_t* p ) { p->get_action_priority_list( "default" )->add_action( "frostbolt" ); }\n');
    const r = run(APPLY, [src, out]);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /UPSTREAM HAR mage — vores rettelse droppes/);
    assert.equal(readFileSync(out, 'utf8'), 'druid applied\nmage dropped-upstream\npaladin applied\npriest applied\nrogue applied\nshaman applied\nwarlock applied\n');
    assert.equal(read(src, MAGE), impl); // upstreams fil er urørt
    assert.match(read(src, PALADIN), /AULA-RETTELSE/); // paladin-rettelsen påvirkes ikke
    assert.match(read(src, ROGUE), /AULA-RETTELSE/); // rogue anvendes uafhængigt af mage
    assert.match(run(APPLY, ['--dry-run', src]).out, /^mage: DROP \(upstream har den nu\)$/m);
  } finally { rmSync(src, { recursive: true, force: true }); }
});

test('(b2) kun en større fil uden APL er ikke «færdig»: så er det en konflikt', () => {
  const src = fakeSimc();
  try {
    writeFileSync(path.join(src, MAGE), `${'// linje\n'.repeat(200)}`);
    const r = run(APPLY, ['--dry-run', src]);
    assert.equal(r.code, 1);
    assert.match(r.out, /^mage: KONFLIKT \(skal flettes: /m);
  } finally { rmSync(src, { recursive: true, force: true }); }
});

test('(c) konflikt: bygget fejler tydeligt, intet anvendes og ingen resultatfil skrives', () => {
  const src = fakeSimc();
  const out = path.join(src, 'PATCHES_APPLIED');
  try {
    const orig = read(src, MAGE);
    const changed = orig.replace('struct mage_t final : public player_t', 'struct mage_t final : public player_t // upstream-ændring');
    assert.notEqual(changed, orig);
    writeFileSync(path.join(src, MAGE), changed);
    const r = run(APPLY, [src, out]);
    assert.equal(r.code, 1);
    assert.match(r.err, /FEJL: Aulas rettelse for klassen 'mage' passer ikke/);
    assert.match(r.err, /ERROR: Aula's patch for class 'mage' does not apply/);
    assert.match(r.err, /check-upstream\.sh/);
    assert.equal(existsSync(out), false);
    assert.equal(read(src, MAGE), changed);
    assert.doesNotMatch(read(src, MAGE_APL), /add_action/);
    assert.doesNotMatch(read(src, PALADIN), /AULA-RETTELSE/); // heller ikke paladin (alt eller intet)
    assert.doesNotMatch(read(src, ROGUE), /AULA-RETTELSE/); // eller rogue
    const dry = run(APPLY, ['--dry-run', src]);
    assert.equal(dry.code, 1);
    assert.match(dry.out, /^mage: KONFLIKT \(skal flettes: .*sc_mage\.cpp/m);
  } finally { rmSync(src, { recursive: true, force: true }); }
});

test('(b-rogue) upstream har selv implementeret rogue: rogue.patch droppes, mage og paladin anvendes stadig', () => {
  const src = fakeSimc();
  const out = path.join(src, 'PATCHES_APPLIED');
  try {
    const impl = `// upstream rogue\n${'// linje\n'.repeat(200)}${ROGUE_UPSTREAM_ACTIONS}`;
    writeFileSync(path.join(src, ROGUE), impl);
    writeFileSync(path.join(src, ROGUE_APL), 'void rogue( player_t* p ) { p->get_action_priority_list( "default" )->add_action( "backstab" ); }\n');
    const r = run(APPLY, [src, out]);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /UPSTREAM HAR rogue — vores rettelse droppes/);
    assert.equal(readFileSync(out, 'utf8'), 'druid applied\nmage applied\npaladin applied\npriest applied\nrogue dropped-upstream\nshaman applied\nwarlock applied\n');
    assert.equal(read(src, ROGUE), impl);
    assert.match(read(src, MAGE), /AULA-RETTELSE/);
    assert.match(read(src, PALADIN), /AULA-RETTELSE/);
    assert.match(run(APPLY, ['--dry-run', src]).out, /^rogue: DROP \(upstream har den nu\)$/m);
  } finally { rmSync(src, { recursive: true, force: true }); }
});

test('(c-rogue) konflikt i rogue: bygget fejler, og hverken rogue, mage eller paladin anvendes', () => {
  const src = fakeSimc();
  const out = path.join(src, 'PATCHES_APPLIED');
  try {
    const orig = read(src, ROGUE);
    const changed = orig.replace('struct rogue_t final : public player_t', 'struct rogue_t final : public player_t // upstream-ændring');
    assert.notEqual(changed, orig);
    writeFileSync(path.join(src, ROGUE), changed);
    const r = run(APPLY, [src, out]);
    assert.equal(r.code, 1);
    assert.match(r.err, /FEJL: Aulas rettelse for klassen 'rogue' passer ikke/);
    assert.doesNotMatch(r.err, /klassen 'mage'/);
    assert.doesNotMatch(r.err, /klassen 'paladin'/);
    assert.equal(existsSync(out), false);
    assert.equal(read(src, ROGUE), changed);
    assert.doesNotMatch(read(src, ROGUE_APL), /add_action/);
    assert.doesNotMatch(read(src, MAGE), /AULA-RETTELSE/);
    assert.doesNotMatch(read(src, PALADIN), /AULA-RETTELSE/);
    const dry = run(APPLY, ['--dry-run', src]);
    assert.equal(dry.code, 1);
    assert.match(dry.out, /^mage: OK \(kan anvendes\)$/m);
    assert.match(dry.out, /^paladin: OK \(kan anvendes\)$/m);
    assert.match(dry.out, /^rogue: KONFLIKT \(skal flettes: .*sc_rogue\.cpp/m);
  } finally { rmSync(src, { recursive: true, force: true }); }
});

test('alt-eller-intet: konflikt i én rettelse forhindrer at de andre anvendes', () => {
  const src = fakeSimc();
  const pdir = tmp('patches-');
  try {
    cpSync(path.join(patchDir, 'mage.patch'), path.join(pdir, 'mage.patch'));
    cpSync(path.join(patchDir, 'mage.check'), path.join(pdir, 'mage.check'));
    // «warrior»-rettelse mod en fil der ikke findes i kilden -> konflikt
    writeFileSync(path.join(pdir, 'warrior.patch'), [
      'diff --git a/engine/x.cpp b/engine/x.cpp', '--- a/engine/x.cpp', '+++ b/engine/x.cpp',
      '@@ -1 +1 @@', '-a', '+b', '',
    ].join('\n'));
    writeFileSync(path.join(pdir, 'warrior.check'), 'min_lines engine/x.cpp 999\n');
    const r = run(APPLY, [src, path.join(src, 'P')], { PATCH_DIR: pdir });
    assert.equal(r.code, 1);
    assert.match(r.err, /klassen 'warrior'/);
    assert.doesNotMatch(read(src, MAGE), /AULA-RETTELSE/);
    assert.equal(existsSync(path.join(src, 'P')), false);
  } finally { rmSync(src, { recursive: true, force: true }); rmSync(pdir, { recursive: true, force: true }); }
});

test('ugyldig eller manglende .check-fil afviser kørslen (exit 2), så en tastefejl aldrig dropper en rettelse', () => {
  const src = fakeSimc();
  const pdir = tmp('patches-');
  try {
    cpSync(path.join(patchDir, 'mage.patch'), path.join(pdir, 'mage.patch'));
    assert.equal(run(APPLY, [src], { PATCH_DIR: pdir }).code, 2); // mangler mage.check
    for (const bad of ['# kun kommentar\n', 'min_line engine/class_modules/sc_mage.cpp 1\n', 'min_lines engine/class_modules/sc_mage.cpp x\n', 'contains\n']) {
      writeFileSync(path.join(pdir, 'mage.check'), bad);
      const r = run(APPLY, [src], { PATCH_DIR: pdir });
      assert.equal(r.code, 2, `${JSON.stringify(bad)}: ${r.err}`);
    }
    assert.doesNotMatch(read(src, MAGE), /AULA-RETTELSE/);
    assert.equal(run(APPLY, ['/findes/ikke']).code, 2);
  } finally { rmSync(src, { recursive: true, force: true }); rmSync(pdir, { recursive: true, force: true }); }
});

test('check-upstream.sh rapporterer OK / DROP / KONFLIKT mod et (lokalt) simc-repo', () => {
  const repo = tmp('simc-repo-');
  const git = (...a) => execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' });
  try {
    cpSync(upstream, repo, { recursive: true });
    git('init', '-q', '-b', 'main');
    git('add', '-A');
    git('commit', '-q', '-m', 'ren');
    const clean = git('rev-parse', 'HEAD').trim();
    const env = { SIMC_REPO: `file://${repo}` };
    let r = run(CHECK_UPSTREAM, [clean], env);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /^druid: OK \(kan anvendes\)$/m);
    assert.match(r.out, /^priest: OK \(kan anvendes\)$/m);
    assert.match(r.out, /^mage: OK \(kan anvendes\)$/m);
    assert.match(r.out, /^paladin: OK \(kan anvendes\)$/m);
    assert.match(r.out, /^rogue: OK \(kan anvendes\)$/m);
    assert.match(r.out, /^shaman: OK \(kan anvendes\)$/m);
    assert.match(r.out, /^warlock: OK \(kan anvendes\)$/m);

    writeFileSync(path.join(repo, MAGE), read(repo, MAGE).replace('namespace {', 'namespace { // ændret'));
    git('commit', '-q', '-am', 'konflikt');
    r = run(CHECK_UPSTREAM, ['main'], env);
    assert.equal(r.code, 1);
    assert.match(r.out, /^mage: KONFLIKT \(skal flettes: /m);
    assert.match(r.out, /^paladin: OK \(kan anvendes\)$/m);
    assert.match(r.out, /^rogue: OK \(kan anvendes\)$/m);

    writeFileSync(path.join(repo, MAGE), `${'// upstream\n'.repeat(300)}`);
    writeFileSync(path.join(repo, MAGE_APL), 'x->add_action( "frostbolt" );\n');
    git('commit', '-q', '-am', 'upstream har mage');
    r = run(CHECK_UPSTREAM, ['main'], env);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /^mage: DROP \(upstream har den nu\)$/m);
    assert.match(r.out, /^paladin: OK \(kan anvendes\)$/m);
    assert.match(r.out, /^rogue: OK \(kan anvendes\)$/m);

    writeFileSync(path.join(repo, PALADIN), read(repo, PALADIN).replace('namespace paladin', 'namespace paladin // ændret'));
    git('commit', '-q', '-am', 'paladin-konflikt');
    r = run(CHECK_UPSTREAM, ['main'], env);
    assert.equal(r.code, 1);
    assert.match(r.out, /^paladin: KONFLIKT \(skal flettes: /m);
    assert.match(r.out, /^rogue: OK \(kan anvendes\)$/m);

    writeFileSync(path.join(repo, PALADIN), `${'// upstream\n'.repeat(300)}`);
    writeFileSync(path.join(repo, PALADIN_APL), 'x->add_action( "judgement" );\n');
    git('commit', '-q', '-am', 'upstream har paladin');
    r = run(CHECK_UPSTREAM, ['main'], env);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /^paladin: DROP \(upstream har den nu\)$/m);
    assert.match(r.out, /^rogue: OK \(kan anvendes\)$/m);

    writeFileSync(path.join(repo, ROGUE), read(repo, ROGUE).replace('struct rogue_t final : public player_t', 'struct rogue_t final : public player_t // ændret'));
    git('commit', '-q', '-am', 'rogue-konflikt');
    r = run(CHECK_UPSTREAM, ['main'], env);
    assert.equal(r.code, 1);
    assert.match(r.out, /^rogue: KONFLIKT \(skal flettes: /m);

    writeFileSync(path.join(repo, ROGUE), `${'// upstream\n'.repeat(300)}${ROGUE_UPSTREAM_ACTIONS}`);
    writeFileSync(path.join(repo, ROGUE_APL), 'x->add_action( "hemorrhage" );\n');
    git('commit', '-q', '-am', 'upstream har rogue');
    r = run(CHECK_UPSTREAM, ['main'], env);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /^mage: DROP \(upstream har den nu\)$/m);
    assert.match(r.out, /^paladin: DROP \(upstream har den nu\)$/m);
    assert.match(r.out, /^rogue: DROP \(upstream har den nu\)$/m);

    // Upstream merger druid-rettelsen (eller en med samme navn): druid droppes.
    execFileSync('git', ['-C', repo, 'apply', path.join(patchDir, 'druid.patch')]);
    git('commit', '-q', '-am', 'upstream har druid-rettelsen');
    r = run(CHECK_UPSTREAM, ['main'], env);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /^druid: DROP \(upstream har den nu\)$/m);

    // Upstream får selv wand og Holy Fire i priest (uden vores markør): priest droppes.
    writeFileSync(path.join(repo, PRIEST), read(repo, PRIEST).replace('  if ( name == "smite" )', '  if ( name == "shoot" )\n    return new wand_t( this, options_str );\n  if ( name == "smite" )'));
    writeFileSync(path.join(repo, PRIEST_APL), read(repo, PRIEST_APL).replace('  default_->add_action( "smite" );', '  default_->add_action( "holy_fire" );\n  default_->add_action( "smite" );\n  default_->add_action( "shoot" );'));
    git('commit', '-q', '-am', 'upstream har priest-wand');
    r = run(CHECK_UPSTREAM, ['main'], env);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /^priest: DROP \(upstream har den nu\)$/m);

    assert.equal(run(CHECK_UPSTREAM, ['findes-ikke'], env).code, 2);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('mage-, paladin- og rogue-profilerne i fixtures (fiktive navne) godkendes af saneringen', () => {
  for (const [f, cls] of [['mage-35.simc', 'mage'], ['mage-20.simc', 'mage'], ['paladin-39-holy.simc', 'paladin'], ['paladin-39-ret.simc', 'paladin'], ['rogue-33.simc', 'rogue']]) {
    const r = sanitizeProfile(readFileSync(path.join(here, 'fixtures', f), 'utf8'));
    assert.equal(r.ok, true, r.error);
    assert.equal(r.className, cls);
  }
});

// --- paladin ---------------------------------------------------------------------------------------------------

/** Kun de navngivne rettelser i en midlertidig PATCH_DIR. */
function patchDirWith(...classes) {
  const pdir = tmp('patches-');
  for (const c of classes) {
    cpSync(path.join(patchDir, `${c}.patch`), path.join(pdir, `${c}.patch`));
    cpSync(path.join(patchDir, `${c}.check`), path.join(pdir, `${c}.check`));
  }
  return pdir;
}

test('(a) paladin.patch anvendes på ren upstream: Ret-model med seals, Judgement og APL', () => {
  const src = fakeSimc();
  const pdir = patchDirWith('paladin');
  try {
    const r = run(APPLY, [src, path.join(src, 'P')], { PATCH_DIR: pdir });
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /paladin: rettelse anvendt/);
    assert.equal(readFileSync(path.join(src, 'P'), 'utf8'), 'paladin applied\n');
    const mod = read(src, PALADIN);
    assert.match(mod, /AULA-RETTELSE/);
    assert.match(mod, /parse_all_class_passives\(\);\s*\n[\s\S]*parse_all_passive_talents\(\);/);
    assert.match(mod, /deregister_passive_spell\( talent\.two_handed_weapon_specialization \)/);
    assert.match(mod, /set_spell\( 20375 \)\.set_attack\( 20467 \)/); // Seal of Command -> Judgement of Command
    assert.match(mod, /set_spell\( 20271 \)/); // Judgement
    const apl = read(src, PALADIN_APL);
    assert.match(apl, /add_action\( "auto_attack" \)[\s\S]*add_action\( "seal_of_command,if=buff\.seal_of_command\.remains<1\.5" \)[\s\S]*add_action\( "judgement" \)[\s\S]*add_action\( "hammer_of_wrath,if=target\.health\.pct<20" \)[\s\S]*add_action\( "holy_strike" \)/);
    assert.match(apl, /add_action\( "consecration,if=active_enemies>1&mana\.pct>50" \)/);
    assert.match(read(src, PALADIN_HPP), /void paladin\( player_t\* \);/);
    assert.doesNotMatch(read(src, MAGE), /AULA-RETTELSE/); // mage-filerne er urørte
    assert.doesNotMatch(read(src, ROGUE), /AULA-RETTELSE/); // rogue-filerne er urørte
  } finally { rmSync(src, { recursive: true, force: true }); rmSync(pdir, { recursive: true, force: true }); }
});

test('alle rettelser kan anvendes i vilkårlig rækkefølge med samme resultat (rotationer frem og tilbage)', () => {
  const files = [MAGE, MAGE_APL, MAGE_HPP, PALADIN, PALADIN_APL, PALADIN_HPP, ROGUE, ROGUE_APL, ROGUE_HPP, DRUID, ENUMS, PRIEST, PRIEST_APL,
    WARLOCK, WARLOCK_APL, SHAMAN, SHAMAN_APL];
  // Alle rotationer frem og tilbage (hver klasse først og sidst mindst én gang); alle 7! = 5040 tager for lang tid.
  const rot = CLASSES.map((_, i) => [...CLASSES.slice(i), ...CLASSES.slice(0, i)]);
  const orders = [...rot, ...rot.map((o) => [...o].reverse())];
  assert.equal(orders.length, 14);
  const results = [];
  for (const order of orders) {
    const src = fakeSimc();
    try {
      for (const cls of order) {
        const pdir = patchDirWith(cls);
        try {
          const r = run(APPLY, [src], { PATCH_DIR: pdir });
          assert.equal(r.code, 0, `${order}: ${r.err}`);
          assert.match(r.out, new RegExp(`${cls}: rettelse anvendt`));
        } finally { rmSync(pdir, { recursive: true, force: true }); }
      }
      results.push(files.map((f) => read(src, f)));
    } finally { rmSync(src, { recursive: true, force: true }); }
  }
  for (let k = 1; k < results.length; k++) assert.deepEqual(results[k], results[0], orders[k].join(','));
  assert.match(results[0][0], /AULA-RETTELSE/);
  assert.match(results[0][3], /AULA-RETTELSE/);
  assert.match(results[0][6], /AULA-RETTELSE/);
});

test('(b) upstream har selv implementeret paladin: paladin droppes, mage og rogue anvendes stadig', () => {
  const src = fakeSimc();
  const out = path.join(src, 'PATCHES_APPLIED');
  try {
    const impl = `// upstream paladin\n${'// linje\n'.repeat(200)}`;
    writeFileSync(path.join(src, PALADIN), impl);
    writeFileSync(path.join(src, PALADIN_APL), 'void paladin( player_t* p ) { p->get_action_priority_list( "default" )->add_action( "judgement" ); }\n');
    const r = run(APPLY, [src, out]);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /UPSTREAM HAR paladin — vores rettelse droppes/);
    assert.match(r.out, /mage: rettelse anvendt/);
    assert.match(r.out, /rogue: rettelse anvendt/);
    assert.equal(readFileSync(out, 'utf8'), 'druid applied\nmage applied\npaladin dropped-upstream\npriest applied\nrogue applied\nshaman applied\nwarlock applied\n');
    assert.equal(read(src, PALADIN), impl);
    assert.match(read(src, ROGUE), /AULA-RETTELSE/);
    assert.match(run(APPLY, ['--dry-run', src]).out, /^paladin: DROP \(upstream har den nu\)$/m);
  } finally { rmSync(src, { recursive: true, force: true }); }
});

test('(c) konflikt i paladin.patch: bygget fejler, og heller ikke mage eller rogue anvendes', () => {
  const src = fakeSimc();
  const out = path.join(src, 'PATCHES_APPLIED');
  try {
    const orig = read(src, PALADIN);
    const changed = orig.replace('struct paladin_t final : public player_t', 'struct paladin_t final : public player_t // upstream-ændring');
    assert.notEqual(changed, orig);
    writeFileSync(path.join(src, PALADIN), changed);
    const r = run(APPLY, [src, out]);
    assert.equal(r.code, 1);
    assert.match(r.err, /FEJL: Aulas rettelse for klassen 'paladin' passer ikke/);
    assert.doesNotMatch(r.err, /klassen 'mage'/);
    assert.doesNotMatch(r.err, /klassen 'rogue'/);
    assert.equal(existsSync(out), false);
    assert.equal(read(src, PALADIN), changed);
    assert.doesNotMatch(read(src, MAGE), /AULA-RETTELSE/);
    assert.doesNotMatch(read(src, ROGUE), /AULA-RETTELSE/);
    const dry = run(APPLY, ['--dry-run', src]);
    assert.equal(dry.code, 1);
    assert.match(dry.out, /^mage: OK \(kan anvendes\)$/m);
    assert.match(dry.out, /^rogue: OK \(kan anvendes\)$/m);
    assert.match(dry.out, /^paladin: KONFLIKT \(skal flettes: .*sc_paladin\.cpp/m);
  } finally { rmSync(src, { recursive: true, force: true }); }
});

// --- .check: konkrete spells/handlinger (til klasser, upstream allerede har en grundmodel af) -----------------------

/** En falsk «priest»-rettelse mod engine/fake/sc_x.cpp, så .check-betingelserne kan prøves isoleret. */
function fakeClassSetup(upstreamText, checkText) {
  const src = tmp('fake-src-');
  const pdir = tmp('patches-');
  const F = 'engine/fake/sc_x.cpp';
  execFileSync('mkdir', ['-p', path.join(src, 'engine/fake')]);
  writeFileSync(path.join(src, F), upstreamText);
  // Rettelsen tilføjer en linje sidst i filen.
  const lines = upstreamText.split('\n');
  const n = lines.length - 1;
  writeFileSync(path.join(pdir, 'priest.patch'), [
    `diff --git a/${F} b/${F}`, `--- a/${F}`, `+++ b/${F}`,
    `@@ -${n},1 +${n},2 @@`, ` ${lines[n - 1]}`, '+// rettelse: shoot', '',
  ].join('\n'));
  writeFileSync(path.join(pdir, 'priest.check'), checkText);
  return { src, pdir, F, cleanup: () => { rmSync(src, { recursive: true, force: true }); rmSync(pdir, { recursive: true, force: true }); } };
}
const UP = (body) => `struct priest_t {\n${body}\n};\n`;

test('.check has_action: droppes kun når upstream selv opretter handlingen (name == "shoot")', () => {
  const check = '# upstream har wand + Holy Fire i APL\nhas_action engine/fake/sc_x.cpp shoot\nhas_action engine/fake/sc_x.cpp holy_fire\n';
  // Upstream-grundmodel: mange linjer og en APL, men ingen shoot -> anvendes (den gamle heuristik ville droppe).
  let s = fakeClassSetup(UP(`${'  // linje\n'.repeat(200)}  if ( name == "holy_fire" ) return x;`), check);
  try {
    const r = run(APPLY, ['--dry-run', s.src], { PATCH_DIR: s.pdir });
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /^priest: OK \(kan anvendes\)$/m);
  } finally { s.cleanup(); }
  // «shoot» kun i en kommentar eller en anden streng tæller ikke.
  s = fakeClassSetup(UP('  // TODO: shoot (wand)\n  add_action( "shoot" );\n  if ( name == "holy_fire" ) return x;'), check);
  try {
    assert.match(run(APPLY, ['--dry-run', s.src], { PATCH_DIR: s.pdir }).out, /^priest: OK/m);
  } finally { s.cleanup(); }
  // Upstream har begge handlinger -> droppes.
  s = fakeClassSetup(UP('  if ( name == "holy_fire" ) return x;\n  if (name=="shoot") return y;'), check);
  try {
    const out = path.join(s.src, 'P');
    const r = run(APPLY, [s.src, out], { PATCH_DIR: s.pdir });
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /UPSTREAM HAR priest — vores rettelse droppes/);
    assert.equal(readFileSync(out, 'utf8'), 'priest dropped-upstream\n');
  } finally { s.cleanup(); }
});

test('.check contains_re / not_contains_re: udvidede regulære udtryk på linjeniveau', () => {
  const check = 'contains_re engine/fake/sc_x.cpp flags\\( *spell_attribute::SX_ALLOW_WHILE_NOT_SHAPESHIFTED *\\)\nnot_contains_re engine/fake/sc_x.cpp AULA-RETTELSE|aula_fix\n';
  let s = fakeClassSetup(UP('  if ( data().flags( spell_attribute::SX_ALLOW_WHILE_NOT_SHAPESHIFTED ) ) mask |= CASTER;'), check);
  try {
    assert.match(run(APPLY, ['--dry-run', s.src], { PATCH_DIR: s.pdir }).out, /^priest: DROP/m);
  } finally { s.cleanup(); }
  s = fakeClassSetup(UP('  if ( data().flags( spell_attribute::SX_ALLOW_WHILE_NOT_SHAPESHIFTED ) ) mask |= CASTER; // aula_fix'), check);
  try {
    assert.match(run(APPLY, ['--dry-run', s.src], { PATCH_DIR: s.pdir }).out, /^priest: OK/m);
  } finally { s.cleanup(); }
  s = fakeClassSetup(UP('  mask = stance_mask();'), check);
  try {
    assert.match(run(APPLY, ['--dry-run', s.src], { PATCH_DIR: s.pdir }).out, /^priest: OK/m);
  } finally { s.cleanup(); }
});

test('.check: ugyldigt regulært udtryk eller handlingsnavn afviser kørslen (exit 2)', () => {
  for (const bad of ['contains_re engine/fake/sc_x.cpp (ufærdig\n', 'not_contains_re engine/fake/sc_x.cpp a{2,1}\n', 'has_action engine/fake/sc_x.cpp Shoot\n', 'has_action engine/fake/sc_x.cpp shoot"; x\n']) {
    const s = fakeClassSetup(UP('  if ( name == "shoot" ) return y;'), bad);
    try {
      const r = run(APPLY, ['--dry-run', s.src], { PATCH_DIR: s.pdir });
      assert.equal(r.code, 2, `${JSON.stringify(bad)}: ${r.out} ${r.err}`);
      assert.match(r.err, /FEJL\/ERROR/);
    } finally { s.cleanup(); }
  }
});


// --- druid -----------------------------------------------------------------------------------------------------

test('druid.check holder IKKE på ren upstream (grundmodel med 974 linjer og APL): rettelsen anvendes', () => {
  const src = fakeSimc();
  const pdir = patchDirWith('druid');
  try {
    assert.ok(read(src, DRUID).split('\n').length > 900);
    assert.match(read(src, 'engine/class_modules/sc_druid.cpp'), /if \( !form_mask \|\| \( form_mask & p\(\)->form \) == p\(\)->form \)/);
    const r = run(APPLY, [src, path.join(src, 'P')], { PATCH_DIR: pdir });
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /druid: rettelse anvendt/);
    assert.equal(readFileSync(path.join(src, 'P'), 'utf8'), 'druid applied\n');
    assert.doesNotMatch(read(src, DRUID), /AULA-RETTELSE/); // upstream-stil: ingen markør
  } finally { rmSync(src, { recursive: true, force: true }); rmSync(pdir, { recursive: true, force: true }); }
});

test('druid: kun enum-værdien upstream (uden brug i druid_action_t) er ikke «færdig» -> konflikt', () => {
  const src = fakeSimc();
  const pdir = patchDirWith('druid');
  try {
    writeFileSync(path.join(src, ENUMS), read(src, ENUMS).replace('  SX_DONT_DISPLAY_IN_AURA_BAR       = 60u,\n',
      '  SX_DONT_DISPLAY_IN_AURA_BAR       = 60u,\n  SX_ALLOW_WHILE_NOT_SHAPESHIFTED   = 83u,\n'));
    const r = run(APPLY, ['--dry-run', src], { PATCH_DIR: pdir });
    assert.equal(r.code, 1);
    assert.match(r.out, /^druid: KONFLIKT \(skal flettes: .*data_enums\.hh/m);
  } finally { rmSync(src, { recursive: true, force: true }); rmSync(pdir, { recursive: true, force: true }); }
});

// --- priest ----------------------------------------------------------------------------------------------------

test('priest.check holder IKKE på ren upstream (grundmodel med 946 linjer og APL): rettelsen anvendes', () => {
  const src = fakeSimc();
  const pdir = patchDirWith('priest');
  try {
    assert.ok(read(src, PRIEST).split('\n').length > 900);
    assert.match(read(src, PRIEST_APL), /add_action\( "smite" \)/); // upstream har en APL
    assert.doesNotMatch(read(src, PRIEST), /name == "shoot"/);
    const r = run(APPLY, [src, path.join(src, 'P')], { PATCH_DIR: pdir });
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /priest: rettelse anvendt/);
    assert.equal(readFileSync(path.join(src, 'P'), 'utf8'), 'priest applied\n');
  } finally { rmSync(src, { recursive: true, force: true }); rmSync(pdir, { recursive: true, force: true }); }
});

test('priest: upstream med Shoot, men uden Holy Fire i APL\'en, er ikke «færdig» -> rettelsen skal flettes', () => {
  const src = fakeSimc();
  const pdir = patchDirWith('priest');
  try {
    // Upstream lægger Shoot sidst i create_action (hvor vores rettelse også gør).
    writeFileSync(path.join(src, PRIEST), read(src, PRIEST).replace('    return new shadowform_t( this, options_str );\n', '    return new shadowform_t( this, options_str );\n  if ( name == "shoot" )\n    return new wand_t( this, options_str );\n'));
    const r = run(APPLY, ['--dry-run', src], { PATCH_DIR: pdir });
    assert.equal(r.code, 1);
    assert.match(r.out, /^priest: KONFLIKT \(skal flettes: .*sc_priest\.cpp/m);
  } finally { rmSync(src, { recursive: true, force: true }); rmSync(pdir, { recursive: true, force: true }); }
});

// --- warlock og shaman -------------------------------------------------------------------------------------------

test('warlock.check og shaman.check holder IKKE på ren upstream (grundmodeller med APL): rettelserne anvendes', () => {
  const src = fakeSimc();
  const pdir = patchDirWith('shaman', 'warlock');
  try {
    assert.match(read(src, WARLOCK_APL), /add_action\( "shadow_bolt" \)/); // upstream har en APL
    assert.match(read(src, SHAMAN_APL), /add_action\( "earth_shock,[^"]*" \)/);
    assert.doesNotMatch(read(src, WARLOCK), /name == "life_tap"/);
    assert.doesNotMatch(read(src, SHAMAN), /name == "lightning_bolt"/);
    const r = run(APPLY, [src, path.join(src, 'P')], { PATCH_DIR: pdir });
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /warlock: rettelse anvendt/);
    assert.match(r.out, /shaman: rettelse anvendt/);
    assert.equal(readFileSync(path.join(src, 'P'), 'utf8'), 'shaman applied\nwarlock applied\n');
  } finally { rmSync(src, { recursive: true, force: true }); rmSync(pdir, { recursive: true, force: true }); }
});

test('warlock: upstream med Life Tap, men uden wand og Bane of Agony, er ikke «færdig» -> rettelsen skal flettes', () => {
  const src = fakeSimc();
  const pdir = patchDirWith('warlock');
  try {
    // Upstream lægger Life Tap efter Summon Imp i create_action (hvor vores rettelse også tilføjer handlinger).
    writeFileSync(path.join(src, WARLOCK), read(src, WARLOCK).replace('    return new summon_imp_t( this, options_str );\n', '    return new summon_imp_t( this, options_str );\n  if ( name == "life_tap" )\n    return new life_tap_t( this, options_str );\n'));
    const r = run(APPLY, ['--dry-run', src], { PATCH_DIR: pdir });
    assert.equal(r.code, 1);
    assert.match(r.out, /^warlock: KONFLIKT \(skal flettes: .*sc_warlock\.cpp/m);
  } finally { rmSync(src, { recursive: true, force: true }); rmSync(pdir, { recursive: true, force: true }); }
});

test('warlock og shaman droppes, når upstream selv har alle dele (uden vores markør)', () => {
  const src = fakeSimc();
  const pdir = patchDirWith('shaman', 'warlock');
  try {
    writeFileSync(path.join(src, WARLOCK), read(src, WARLOCK).replace('  if ( name == "summon_imp" )',
      '  if ( name == "life_tap" ) return new a_t();\n  if ( name == "shoot" ) return new b_t();\n  if ( name == "bane_of_agony" ) return new c_t();\n  if ( name == "summon_imp" )'));
    writeFileSync(path.join(src, WARLOCK_APL), read(src, WARLOCK_APL).replace('  default_->add_action( "shadow_bolt" );',
      '  default_->add_action( "life_tap,if=mana.pct<10" );\n  default_->add_action( "bane_of_agony" );\n  default_->add_action( "shadow_bolt" );'));
    writeFileSync(path.join(src, SHAMAN), read(src, SHAMAN).replace('  if ( name == "earth_shock" )',
      '  if ( name == "lightning_bolt" ) return new a_t();\n  if ( name == "stormstrike" ) return new b_t();\n  if ( name == "mana_spring_totem" ) return new c_t();\n  if ( name == "earth_shock" )'));
    writeFileSync(path.join(src, SHAMAN_APL), read(src, SHAMAN_APL).replace('  default_->add_action( "auto_attack" );',
      '  default_->add_action( "auto_attack" );\n  default_->add_action( "mana_spring_totem" );\n  default_->add_action( "stormstrike" );\n  default_->add_action( "lightning_bolt" );'));
    const r = run(APPLY, [src, path.join(src, 'P')], { PATCH_DIR: pdir });
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /UPSTREAM HAR shaman/);
    assert.match(r.out, /UPSTREAM HAR warlock/);
    assert.equal(readFileSync(path.join(src, 'P'), 'utf8'), 'shaman dropped-upstream\nwarlock dropped-upstream\n');
  } finally { rmSync(src, { recursive: true, force: true }); rmSync(pdir, { recursive: true, force: true }); }
});
