// Tests af rettelses-mekanismen (patches/apply.sh og check-upstream.sh) mod en lille falsk simc-mappe,
// uden at bygge simc. fixtures/simc-upstream/ er de rene upstream-filer ved SIMC_REF, som mage.patch er lavet mod.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
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

test('fixturen er præcis den upstream-version mage.patch er lavet mod (ellers: opdatér fixtures/simc-upstream)', () => {
  const patch = readFileSync(path.join(patchDir, 'mage.patch'), 'utf8');
  const files = [...patch.matchAll(/^diff --git a\/(\S+) b\/\S+\nindex ([0-9a-f]+)\.\./gm)];
  assert.ok(files.length >= 3);
  for (const [, file, blob] of files) {
    const actual = execFileSync('git', ['hash-object', path.join(upstream, file)], { encoding: 'utf8' }).trim();
    assert.ok(actual.startsWith(blob), `${file}: fixture ${actual.slice(0, 7)} ≠ patchens ${blob}`);
  }
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
    assert.equal(readFileSync(out, 'utf8'), 'mage applied\n');
    // Igen på samme mappe: genkendes som allerede anvendt, ingen fejl.
    const again = run(APPLY, [src, out]);
    assert.equal(again.code, 0, again.err);
    assert.match(again.out, /mage: allerede anvendt/);
    assert.equal(readFileSync(out, 'utf8'), 'mage applied\n');
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
    assert.equal(readFileSync(out, 'utf8'), 'mage dropped-upstream\n');
    assert.equal(read(src, MAGE), impl); // upstreams fil er urørt
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
    const dry = run(APPLY, ['--dry-run', src]);
    assert.equal(dry.code, 1);
    assert.match(dry.out, /^mage: KONFLIKT \(skal flettes: .*sc_mage\.cpp/m);
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
    assert.match(r.out, /^mage: OK \(kan anvendes\)$/m);

    writeFileSync(path.join(repo, MAGE), read(repo, MAGE).replace('namespace {', 'namespace { // ændret'));
    git('commit', '-q', '-am', 'konflikt');
    r = run(CHECK_UPSTREAM, ['main'], env);
    assert.equal(r.code, 1);
    assert.match(r.out, /^mage: KONFLIKT \(skal flettes: /m);

    writeFileSync(path.join(repo, MAGE), `${'// upstream\n'.repeat(300)}`);
    writeFileSync(path.join(repo, MAGE_APL), 'x->add_action( "frostbolt" );\n');
    git('commit', '-q', '-am', 'upstream har mage');
    r = run(CHECK_UPSTREAM, ['main'], env);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /^mage: DROP \(upstream har den nu\)$/m);

    assert.equal(run(CHECK_UPSTREAM, ['findes-ikke'], env).code, 2);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('mage-profilerne i fixtures (fiktive navne) godkendes af saneringen', () => {
  for (const f of ['mage-35.simc', 'mage-20.simc']) {
    const r = sanitizeProfile(readFileSync(path.join(here, 'fixtures', f), 'utf8'));
    assert.equal(r.ok, true, r.error);
    assert.equal(r.className, 'mage');
  }
});
