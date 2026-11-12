#!/usr/bin/env node
// Genererer lib/simc-talents.generated.ts ud fra simc-forevers spildata (talenttræerne), så appen kan kode
// armory-talenter som simcs `talents=`-streng (se lib/simc-talents.ts).
//
// Brug:  node scripts/gen-simc-talents.mjs <simc-mappe> [udfil]
//   <simc-mappe>  en klon af simc-forever, tjekket ud på SIMC_REF fra simc-worker/Dockerfile
//   [udfil]       standard: lib/simc-talents.generated.ts i dette repo
//
// Læser engine/dbc/generated/trait_data.inc (talentrækkerne), sc_specialization_data.inc (spec-id'ernes værdier) og
// sc_spec_list.inc (hvilke specs hver klasse har). Commit-hashen tages fra `git rev-parse HEAD` i simc-mappen (eller miljøvariablen SIMC_REF,
// hvis mappen ikke er et git-repo). Ingen afhængigheder ud over Node.
//
// Scriptet stopper med en fejl, hvis dataen bryder de antagelser, koderen bygger på (ét entry pr. node, ingen
// valg-/tier-noder, ingen spec-filtre, én spec pr. klasse): så skal koderen udvides, før tabellen kan bruges.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');

function die(msg) {
  console.error(`FEJL: ${msg}`);
  process.exit(1);
}

const [simcArg, outArg] = process.argv.slice(2);
if (!simcArg) die('brug: node scripts/gen-simc-talents.mjs <simc-mappe> [udfil]');
const simc = path.resolve(simcArg);
const out = path.resolve(outArg ?? path.join(repo, 'lib/simc-talents.generated.ts'));
const TRAITS = path.join(simc, 'engine/dbc/generated/trait_data.inc');
const SPECS = path.join(simc, 'engine/dbc/generated/sc_specialization_data.inc');
const SPEC_LIST = path.join(simc, 'engine/dbc/generated/sc_spec_list.inc');
for (const f of [TRAITS, SPECS, SPEC_LIST]) if (!existsSync(f)) die(`${f} findes ikke (er det en simc-forever-klon?)`);

let ref = process.env.SIMC_REF ?? '';
try {
  ref = execFileSync('git', ['-C', simc, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
  if (!ref) die('simc-mappen er ikke et git-repo; angiv commit-hashen i miljøvariablen SIMC_REF');
}
if (!/^[0-9a-f]{40}$/.test(ref)) die(`ugyldig commit-hash: '${ref}'`);
const dockerRef = /ARG SIMC_REF=([0-9a-f]{40})/.exec(readFileSync(path.join(repo, 'simc-worker/Dockerfile'), 'utf8'))?.[1];
if (dockerRef && dockerRef !== ref) {
  console.warn(`ADVARSEL: simc-mappen er på ${ref}, men simc-worker/Dockerfile pinner ${dockerRef}. Tabellen skal svare til workerens simc.`);
}

// --- trait_data.inc -------------------------------------------------------------------------------------------
// Rækkefølge i trait_data_t (engine/dbc/trait_data.hpp): tree_index, id_class, id_trait_node_entry, id_node, max_ranks,
// req_points, id_trait_definition, id_spell, id_replace_spell, id_override_spell, row, col, selection_index, name,
// id_spec[4], id_spec_starter[4], id_sub_tree, node_type.
const traitSrc = readFileSync(TRAITS, 'utf8');
const build = /Player trait definitions, wow build (\S+)/.exec(traitSrc)?.[1] ?? 'ukendt';
const block = /__trait_data_data\s*\{\s*\{([\s\S]*?)\n\}\s*\};/.exec(traitSrc);
if (!block) die('fandt ikke __trait_data_data i trait_data.inc');
const declared = Number(/std::array<trait_data_t,\s*(\d+)>\s*__trait_data_data/.exec(traitSrc)?.[1]);
const ROW = /\{\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*"((?:[^"\\]|\\.)*)",\s*\{([^}]*)\},\s*\{([^}]*)\},\s*(\d+),\s*(\d+)\s*\}/g;
const rows = [];
for (const m of block[1].matchAll(ROW)) {
  const n = (i) => Number(m[i]);
  rows.push({
    tree: n(1), cls: n(2), entry: n(3), node: n(4), maxRanks: n(5), def: n(7), name: m[14],
    spec: m[15].split(',').map(Number), starter: m[16].split(',').map(Number), subTree: n(17), nodeType: n(18),
  });
}
if (rows.length === 0 || rows.length !== declared) die(`læste ${rows.length} talentrækker, men filen erklærer ${declared}`);

// --- sc_specialization_data.inc + sc_spec_list.inc -------------------------------------------------------------
const specIds = new Map([...readFileSync(SPECS, 'utf8').matchAll(/^\s*(SPEC_[A-Z_]+)\s*=\s*(\d+),/gm)].map((m) => [m[1], Number(m[2])]));
const table = /__class_spec_id\[[^\]]*\]\[[^\]]*\]\s*=\s*\{([\s\S]*?)\n\};/.exec(readFileSync(SPEC_LIST, 'utf8'));
if (!table) die('fandt ikke __class_spec_id i sc_spec_list.inc');
const classSpecs = [...table[1].matchAll(/\{([^}]*)\}/g)].map((m) => m[1].split(',').map((s) => s.trim()).filter(Boolean));

// WoWs faste klasse-id'er (ChrClasses) -> simcs klassenøgle.
const CLASS_TOKENS = { 1: 'warrior', 2: 'paladin', 3: 'hunter', 4: 'rogue', 5: 'priest', 6: 'deathknight', 7: 'shaman', 8: 'mage', 9: 'warlock', 10: 'monk', 11: 'druid', 12: 'demonhunter', 13: 'evoker' };

// --- antagelser, koderen bygger på -----------------------------------------------------------------------------
const problems = [];
const defs = new Map();
for (const r of rows) {
  if (defs.has(r.def)) problems.push(`id_trait_definition ${r.def} findes flere gange`);
  defs.set(r.def, r);
  if (r.nodeType !== 0) problems.push(`${r.name} (node ${r.node}) har node_type ${r.nodeType} (valg-/tier-node)`);
  if (r.spec.some((x) => x !== 0)) problems.push(`${r.name} (node ${r.node}) er begrænset til spec ${r.spec.join(',')}`);
  if (r.starter.some((x) => x !== 0)) problems.push(`${r.name} (node ${r.node}) er gratis (granted) for spec ${r.starter.join(',')}`);
  if (r.subTree !== 0) problems.push(`${r.name} (node ${r.node}) hører til hero-træ ${r.subTree}`);
  if (r.maxRanks < 1 || r.maxRanks > 63) problems.push(`${r.name} (node ${r.node}) har max_ranks ${r.maxRanks}`);
}
const nodeKeys = new Map();
for (const r of rows) {
  const k = `${r.cls}:${r.node}`;
  if (nodeKeys.has(k)) problems.push(`node ${r.node} (klasse ${r.cls}) har flere entries: ${nodeKeys.get(k)} og ${r.name}`);
  nodeKeys.set(k, r.name);
}

const classes = {};
for (const cls of [...new Set(rows.map((r) => r.cls))].sort((a, b) => a - b)) {
  const token = CLASS_TOKENS[cls];
  if (!token) { problems.push(`ukendt klasse-id ${cls}`); continue; }
  const specs = (classSpecs[cls] ?? []).filter((s) => s !== 'SPEC_NONE');
  if (specs.length !== 1) { problems.push(`${token} har ${specs.length} specs i __class_spec_id (${specs.join(', ') || 'ingen'}); koderen forventer præcis én`); continue; }
  const spec = specIds.get(specs[0]);
  if (!spec) { problems.push(`${token}: ukendt spec ${specs[0]}`); continue; }
  // simc (player.cpp generate_tree_nodes) ordner noderne i et std::map<id_node, …> over ALLE klassens rækker.
  const nodes = rows.filter((r) => r.cls === cls).sort((a, b) => a.node - b.node);
  classes[token] = { classId: cls, spec, nodes };
}
if (problems.length) die(`spildataen bryder koderens antagelser:\n  - ${problems.join('\n  - ')}`);

// --- skriv TypeScript ------------------------------------------------------------------------------------------
const lines = [
  '// GENERERET af scripts/gen-simc-talents.mjs. Ret ikke i hånden; kør i stedet:',
  '//   node scripts/gen-simc-talents.mjs <simc-forever-klon på SIMC_REF>',
  '// Pr. klasse: simcs spec-id og talentnoderne i stigende id_node (= rækkefølgen i `talents=`-strengen),',
  '// fladt som [id_node, id_trait_node_entry, id_trait_definition, max_ranks, …]. Blizzard-API\'ets talent.id = id_trait_definition.',
  '',
  'export type SimcTalentClass = { classId: number; spec: number; nodes: readonly number[] };',
  '',
  'export const SIMC_TALENTS: {',
  '  simcRef: string;',
  '  source: string;',
  '  build: string;',
  '  classes: Readonly<Record<string, SimcTalentClass>>;',
  '} = {',
  `  simcRef: '${ref}',`,
  `  source: 'simc-forever@${ref.slice(0, 8)} engine/dbc/generated/trait_data.inc + sc_spec_list.inc (wow build ${build})',`,
  `  build: '${build}',`,
  '  classes: {',
];
for (const [token, c] of Object.entries(classes)) {
  const flat = c.nodes.map((r) => `${r.node},${r.entry},${r.def},${r.maxRanks}`).join(', ');
  lines.push(`    ${token}: { classId: ${c.classId}, spec: ${c.spec}, nodes: [${flat}] },`);
}
lines.push('  },', '};', '');
writeFileSync(out, lines.join('\n'));
const summary = Object.entries(classes).map(([t, c]) => `${t} ${c.nodes.length}`).join(', ');
console.log(`skrev ${path.relative(process.cwd(), out)}: ${rows.length} talenter, build ${build}, simc ${ref.slice(0, 8)} (${summary})`);
