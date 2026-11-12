#!/bin/sh
# Opdateringsværktøj: passer Aulas rettelser (simc-worker/patches) på en given simc-forever-commit?
#
# Brug:  check-upstream.sh <SIMC_REF>      (commit-sha, tag eller branch, fx main)
#
# Henter kun de mapper rettelserne og .check-filerne rører (partial clone + sparse checkout; for .check er
# filen 2. felt i hver betingelse, så også has_action/contains_re er dækket),
# kører samme tjek som bygget (apply.sh --dry-run) og skriver en linje pr. klasse:
#   <klasse>: OK (kan anvendes) | DROP (upstream har den nu) | KONFLIKT (skal flettes: ...)
# Bygger ikke simc. Exit: 0 = ingen konflikter, 1 = mindst én konflikt, 2 = brugs-/hentefejl.
# SIMC_REPO kan pege på et andet repo (fx en lokal klon) end simc-forever på GitHub.
set -eu

if [ $# -ne 1 ] || [ -z "$1" ]; then
  echo "brug: check-upstream.sh <SIMC_REF>" >&2
  exit 2
fi
REF=$1
REPO=${SIMC_REPO:-https://github.com/simulationcraft/simc-forever.git}
HERE=$(cd "$(dirname "$0")" && pwd)
PATCH_DIR=${PATCH_DIR:-$HERE}
export PATCH_DIR

TMP=$(mktemp -d "${TMPDIR:-/tmp}/simc-upstream.XXXXXX")
trap 'rm -rf "$TMP"' EXIT INT TERM

# Mapper der skal tjekkes ud: alt rettelserne rører, og alt .check-filerne kigger på.
dirs=$( {
  cat "$PATCH_DIR"/*.patch 2>/dev/null | sed -n 's|^+++ b/||p; s|^--- a/||p'
  cat "$PATCH_DIR"/*.check 2>/dev/null | grep -v '^#' | awk 'NF >= 2 { print $2 }'
} | while read -r f; do dirname "$f"; done | sort -u)

if ! git clone -q --filter=blob:none --no-checkout "$REPO" "$TMP/src" 2> "$TMP/err"; then
  echo "FEJL: kunne ikke hente $REPO" >&2; cat "$TMP/err" >&2; exit 2
fi
if [ -n "$dirs" ]; then
  # shellcheck disable=SC2086
  git -C "$TMP/src" sparse-checkout set $dirs
fi
if ! git -C "$TMP/src" checkout -q "$REF" 2> "$TMP/err" \
  && ! git -C "$TMP/src" checkout -q "origin/$REF" 2>> "$TMP/err"; then
  echo "FEJL: ukendt SIMC_REF '$REF'" >&2; cat "$TMP/err" >&2; exit 2
fi

echo "simc-forever $(git -C "$TMP/src" rev-parse HEAD) ($REF)"
set +e
sh "$HERE/apply.sh" --dry-run "$TMP/src"
rc=$?
set -e
exit $rc
