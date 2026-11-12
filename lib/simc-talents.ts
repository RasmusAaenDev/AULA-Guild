// Armory-talenter -> simcs `talents=`-streng (Blizzards loadout-format, som simc-forever læser i player.cpp
// parse_traits_hash). Tabellen over noder kommer fra simcs egne spildata (lib/simc-talents.generated.ts), genereret for
// den simc-commit workeren er bygget af (SIMC_REF i simc-worker/Dockerfile).
//
// Format (LSB først, 6 bit pr. base64-tegn):
//   header: 8 bit version (2), 16 bit spec-id, 128 bit træ-hash (0; simc ignorerer den)
//   derefter én post pr. node i stigende id_node over ALLE klassens talenter:
//     ikke valgt: 0            fuld rank: 1 1 0 0            delvis rank: 1 1 1 <6 bit rank> 0
//   (bit 2 = «købt», altid 1, da Forever ikke har gratis noder; sidste bit = «valg-node», altid 0.)
//
// Spec-id: Forever har én spec pr. klasse, og generatoren tager klassens eneste spec fra simcs sc_spec_list.inc
// (fx mage 1482). Profilen skal have en `spec=`-linje, ellers er simcs spec SPEC_NONE og strengen afvises
// («Wrong specialization»); `spec=unknown` giver klassens eneste spec (dbc::translate_spec_str).
//
// Robusthed: et talent-id, som ikke findes i tabellen for klassen, udelades (en ukendt node i strengen ville
// forskyde alle efterfølgende). Rank over max klippes til max. To talenter på samme node: kun det første bruges.

import { SIMC_TALENTS, type SimcTalentClass } from '@/lib/simc-talents.generated';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VERSION = 2;

type Node = { node: number; entry: number; def: number; maxRank: number };

const cache = new Map<string, Node[]>();
function nodesOf(c: SimcTalentClass): Node[] {
  const key = String(c.classId);
  let nodes = cache.get(key);
  if (!nodes) {
    nodes = [];
    for (let i = 0; i + 3 < c.nodes.length; i += 4) {
      nodes.push({ node: c.nodes[i], entry: c.nodes[i + 1], def: c.nodes[i + 2], maxRank: c.nodes[i + 3] });
    }
    cache.set(key, nodes);
  }
  return nodes;
}

export type TalentPick = { id: number; rank: number };

export type EncodedTalents = {
  /** `talents=`-værdien; null hvis klassen ikke findes i tabellen. */
  talents: string | null;
  /** Talenter der kom med (id = id_trait_definition, rank efter evt. klipning). */
  used: TalentPick[];
  /** Talent-id'er der ikke kunne oversættes (ukendt for klassen, ugyldig rank eller dublet på samme node). */
  dropped: number[];
  /** Talenter hvis rank blev klippet til max. */
  clipped: number[];
};

/**
 * Koder talenterne for en klasse (simcs klassenøgle, fx «mage»). `treeHash` (16 bytes) bruges kun af tests til at
 * genskabe spillets egne strenge; appen sender altid 0.
 */
export function encodeTalents(classKey: string, picks: readonly TalentPick[], treeHash?: readonly number[]): EncodedTalents {
  const c = Object.prototype.hasOwnProperty.call(SIMC_TALENTS.classes, classKey) ? SIMC_TALENTS.classes[classKey] : undefined;
  if (!c) return { talents: null, used: [], dropped: picks.map((p) => p.id), clipped: [] };
  const nodes = nodesOf(c);
  const byDef = new Map(nodes.map((n) => [n.def, n]));
  const chosen = new Map<number, { def: number; rank: number }>(); // id_node -> valg
  const dropped: number[] = [];
  const clipped: number[] = [];
  for (const p of picks) {
    const n = byDef.get(p.id);
    if (!n || !Number.isInteger(p.rank) || p.rank < 1 || chosen.has(n.node)) {
      dropped.push(p.id);
      continue;
    }
    const rank = Math.min(p.rank, n.maxRank);
    if (rank < p.rank) clipped.push(p.id);
    chosen.set(n.node, { def: n.def, rank });
  }

  let s = '';
  let head = 0;
  let byte = 0;
  const put = (bits: number, value: number) => {
    for (let i = 0; i < bits; i++) {
      const bit = head % 6;
      head++;
      byte |= (Math.floor(value / 2 ** i) & 1) << bit;
      if (bit === 5) {
        s += B64[byte];
        byte = 0;
      }
    }
  };
  put(8, VERSION);
  put(16, c.spec);
  for (let i = 0; i < 16; i++) put(8, treeHash?.[i] ?? 0);
  const used: TalentPick[] = [];
  for (const n of nodes) {
    const pick = chosen.get(n.node);
    if (!pick) {
      put(1, 0);
      continue;
    }
    used.push({ id: pick.def, rank: pick.rank });
    put(1, 1); // valgt
    put(1, 1); // købt
    if (pick.rank === n.maxRank) {
      put(1, 0);
    } else {
      put(1, 1);
      put(6, pick.rank);
    }
    put(1, 0); // ikke en valg-node
  }
  if (head % 6) s += B64[byte];
  return { talents: s, used, dropped, clipped };
}

/** Dansk besked til brugeren, når talenter ikke kunne oversættes; null når alle kom med. */
export function talentWarning(dropped: number): string | null {
  if (dropped <= 0) return null;
  return dropped === 1
    ? '1 talent kunne ikke oversættes; simuleringen kører uden det.'
    : `${dropped} talenter kunne ikke oversættes; simuleringen kører uden dem.`;
}

/** Header-felterne i en `talents=`-streng (version, spec-id, træ-hash). Bruges af tests. */
export function decodeTalentHeader(str: string): { version: number; spec: number; treeHash: number[] } {
  let head = 0;
  const get = (bits: number) => {
    let v = 0;
    for (let i = 0; i < bits; i++) {
      const ch = str[Math.floor(head / 6)];
      const idx = ch === undefined ? 0 : B64.indexOf(ch);
      v += ((idx >> (head % 6)) & 1) * 2 ** i;
      head++;
    }
    return v;
  };
  const version = get(8);
  const spec = get(16);
  const treeHash = Array.from({ length: 16 }, () => get(8));
  return { version, spec, treeHash };
}

export const SIMC_TALENTS_REF = SIMC_TALENTS.simcRef;
