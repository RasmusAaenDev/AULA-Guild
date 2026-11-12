#!/bin/sh
# Aulas rettelser oven på simc-forever (se PATCHES.md).
#
# Brug:  apply.sh [--dry-run] <simc-kilde> [resultatfil]
#
# For hver <klasse>.patch i denne mappe (eller $PATCH_DIR):
#   1. <klasse>.check afgør om upstream selv har implementeret klassen -> rettelsen droppes.
#   2. Ellers skal rettelsen passe (git apply --check). Passer EN rettelse ikke, fejler hele
#      kørsel, og INGEN rettelse anvendes (bygget må ikke lykkes halvt).
#   3. Resultatet skrives til <resultatfil>: en linje pr. klasse, "<klasse> applied" eller
#      "<klasse> dropped-upstream".
# --dry-run: ændrer intet og skriver kun en rapport (OK / DROP / KONFLIKT) pr. klasse.
# Exit: 0 = alt ok, 1 = konflikt, 2 = brugsfejl eller ugyldig .check-fil.
set -eu

DRY=0
if [ "${1:-}" = "--dry-run" ]; then DRY=1; shift; fi
if [ $# -lt 1 ] || [ ! -d "$1" ]; then
  echo "brug: apply.sh [--dry-run] <simc-kilde> [resultatfil]" >&2
  exit 2
fi
SRC=$(cd "$1" && pwd)
OUT=${2:-}
PATCH_DIR=${PATCH_DIR:-$(cd "$(dirname "$0")" && pwd)}

fail_check() {
  echo "FEJL/ERROR: $1" >&2
  exit 2
}

# upstream_done <check-fil>: exit 0 når ALLE betingelser i filen holder paa $SRC.
# Betingelser (en pr. linje, # = kommentar):
#   min_lines <fil> <N>        filen findes og har flere end N linjer
#   contains <fil> <tekst>     filen indeholder teksten (fast streng, resten af linjen)
#   not_contains <fil> <tekst> filen findes ikke eller indeholder ikke teksten
upstream_done() {
  check=$1
  n=0
  done_all=0
  while IFS= read -r line || [ -n "$line" ]; do
    case $line in '' | '#'*) continue ;; esac
    op=${line%% *}
    rest=${line#* }
    file=${rest%% *}
    arg=${rest#* }
    if [ "$op" = "$line" ] || [ "$file" = "$rest" ] || [ -z "$arg" ]; then
      fail_check "ugyldig linje i $(basename "$check"): '$line'"
    fi
    n=$((n + 1))
    case $op in
      min_lines)
        case $arg in '' | *[!0-9]*) fail_check "min_lines kræver et tal i $(basename "$check"): '$line'" ;; esac
        if [ ! -f "$SRC/$file" ] || [ "$(wc -l < "$SRC/$file")" -le "$arg" ]; then done_all=1; fi
        ;;
      contains)
        if [ ! -f "$SRC/$file" ] || ! grep -qF -- "$arg" "$SRC/$file"; then done_all=1; fi
        ;;
      not_contains)
        if [ -f "$SRC/$file" ] && grep -qF -- "$arg" "$SRC/$file"; then done_all=1; fi
        ;;
      *) fail_check "ukendt betingelse '$op' i $(basename "$check")" ;;
    esac
  done < "$check"
  [ "$n" -gt 0 ] || fail_check "$(basename "$check") har ingen betingelser"
  return $done_all
}

TMP=$(mktemp -d "${TMPDIR:-/tmp}/simc-patches.XXXXXX")
trap 'rm -rf "$TMP"' EXIT INT TERM
: > "$TMP/plan"
conflicts=0

for patch in "$PATCH_DIR"/*.patch; do
  [ -e "$patch" ] || continue
  cls=$(basename "$patch" .patch)
  check="$PATCH_DIR/$cls.check"
  [ -f "$check" ] || fail_check "$cls.patch mangler $cls.check (se PATCHES.md)"
  if upstream_done "$check"; then
    echo "$cls dropped-upstream" >> "$TMP/plan"
    if [ $DRY -eq 1 ]; then
      echo "$cls: DROP (upstream har den nu)"
    else
      echo "UPSTREAM HAR $cls — vores rettelse droppes"
    fi
  elif (cd "$SRC" && git apply --check "$patch") 2> "$TMP/err"; then
    echo "$cls apply" >> "$TMP/plan"
    [ $DRY -eq 1 ] && echo "$cls: OK (kan anvendes)"
  elif (cd "$SRC" && git apply --reverse --check "$patch") 2> /dev/null; then
    # Allerede anvendt i denne mappe (fx lokal arbejdskopi): intet at gøre.
    echo "$cls applied" >> "$TMP/plan"
    if [ $DRY -eq 1 ]; then echo "$cls: OK (allerede anvendt)"; else echo "$cls: allerede anvendt"; fi
  else
    conflicts=$((conflicts + 1))
    why=$(grep -m 3 -E 'error|patch failed|does not apply|No such file' "$TMP/err" | sed 's/^error: //' | tr '\n' ';' | sed 's/;$//')
    if [ $DRY -eq 1 ]; then
      echo "$cls: KONFLIKT (skal flettes: ${why:-git apply --check fejlede})"
    else
      {
        echo "=================================================================="
        echo "FEJL: Aulas rettelse for klassen '$cls' passer ikke på denne simc-kilde."
        echo "ERROR: Aula's patch for class '$cls' does not apply to this simc source."
        echo "Upstream har ændret filer som $cls.patch rører, men har (efter $cls.check)"
        echo "ikke selv implementeret klassen. Bygget stoppes; ingen rettelse er anvendt."
        echo "Gør sådan / What to do:"
        echo "  1. Kør: sh simc-worker/patches/check-upstream.sh <SIMC_REF>"
        echo "  2. Flet rettelsen ind i den nye kilde og lav $cls.patch igen"
        echo "     (se 'Opdatér simc' i simc-worker/README.md), eller"
        echo "  3. har upstream nu klassen: ret $cls.check, eller slet $cls.patch + $cls.check."
        echo "git apply sagde / said:"
        sed 's/^/  /' "$TMP/err"
        echo "=================================================================="
      } >&2
    fi
  fi
done

if [ $conflicts -gt 0 ]; then
  exit 1
fi

if [ $DRY -eq 0 ]; then
  while read -r cls what; do
    [ "$what" = "apply" ] || continue
    (cd "$SRC" && git apply "$PATCH_DIR/$cls.patch")
    echo "$cls: rettelse anvendt"
  done < "$TMP/plan"
  if [ -n "$OUT" ]; then
    mkdir -p "$(dirname "$OUT")"
    sed 's/ apply$/ applied/' "$TMP/plan" > "$OUT.tmp"
    mv "$OUT.tmp" "$OUT"
  fi
fi
exit 0
