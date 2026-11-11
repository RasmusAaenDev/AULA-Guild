#!/bin/sh
# Falsk simc til tests: --version, ellers skriv kendt json2 til stien fra json2=-linjen.
# Understøtter fight_style og profilesets:
#   basis-DPS: Patchwerk 1234.5, DungeonSlice 900
#   profileset.NAVN+=slot=,id=N giver mean = basis + (N mod 100); id 666 udelades i resultatet;
#   id 999 får simc til at fejle som ved ukendt item ("Error: Profileset 'NAVN': ...", exit 82)
#   race=fail: altid fejl; race=dsfail: fejler kun for DungeonSlice; race=zero: DPS 0; race=slow: sover 5 s.
if [ "$1" = "--version" ]; then echo "SimulationCraft FAKE-1"; exit 0; fi
out=$(grep '^json2=' "$1" | cut -d= -f2-)
style=$(grep '^fight_style=' "$1" | cut -d= -f2-)
echo "$style $(grep -c '^profileset\.' "$1")" >> "${FAKE_SIMC_LOG:-/dev/null}"
# race=logs: skriver stdout/stderr inkl. \r-fremdrift, kontroltegn og stier; race=flood: >64 KB output;
# race=slowlog: skriver løbende over ca. 3 s og lever 20 s (til afbrydelsestest; skriver pid til $FAKE_SIMC_PID).
if grep -q '^race=logs' "$1" || grep -q '^race=flood' "$1" || grep -q '^race=slowlog' "$1"; then
  if grep -q '^race=flood' "$1"; then
    i=0; while [ $i -lt 2000 ]; do echo "linje $i xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"; i=$((i+1)); done
  elif grep -q '^race=slowlog' "$1"; then
    echo "$$" > "${FAKE_SIMC_PID:-/dev/null}"
    i=0; while [ $i -lt 6 ]; do echo "tik $i"; sleep 0.5; i=$((i+1)); done
    exec sleep 20
  else
    echo "SimulationCraft FAKE-1 starter"
    echo "Læser $1 og skriver til $out" >&2
    sleep 0.2
    printf 'Generating Baseline: 10/100\rGenerating Baseline: 50/100\rGenerating Baseline: 100/100\n'
    printf 'farlig \033[31mrød\033[0m\001tekst\ttab /opt/simc/data/x.json\n'
    printf '%0400d\n' 7
    printf 'slutlinje uden linjeskift'
  fi
fi
if grep -q '^race=fail' "$1"; then echo "hemmelig fejl" >&2; exit 1; fi
if grep -q '^race=dsfail' "$1" && [ "$style" = "DungeonSlice" ]; then echo "hemmelig fejl" >&2; exit 1; fi
if grep -q '^race=slow' "$1"; then exec sleep 5; fi
if grep -q '^race=zero' "$1"; then
  echo '{"sim":{"players":[{"name":"Test","specialization":"X","level":11,"race":"zero","collected_data":{"dps":{"mean":0}}}]}}' > "$out"; exit 0
fi
base=1234.5
[ "$style" = "DungeonSlice" ] && base=900
bad=$(grep '^profileset\..*+=.*id=999$' "$1" | head -1 | sed 's/^profileset\.\([^+]*\)+=.*/\1/')
if [ -n "$bad" ]; then echo "Error: Profileset '$bad': Item 'inactive': hemmelig item-fejl" >&2; exit 82; fi
sets=""
for name in $(grep '^profileset\..*+=.*id=' "$1" | sed 's/^profileset\.\([^+]*\)+=.*/\1/' | sort -u); do
  id=$(grep "^profileset\.$name+=.*id=" "$1" | sed 's/.*id=\([0-9]*\).*/\1/' | head -1)
  [ "$id" = "666" ] && continue
  mean=$(awk -v b="$base" -v i="$id" 'BEGIN{printf "%.1f", b + (i % 100)}')
  sets="$sets{\"name\":\"$name\",\"mean\":$mean,\"stddev\":9,\"mean_stddev\":1,\"iterations\":100},"
done
sets="${sets%,}"
echo "{\"sim\":{\"players\":[{\"name\":\"Test\",\"specialization\":\"Beast Mastery\",\"level\":11,\"race\":\"Dwarf\",\"collected_data\":{\"dps\":{\"mean\":$base,\"std_dev\":10,\"mean_std_dev\":0.5}}}],\"profilesets\":{\"metric\":\"dps\",\"results\":[$sets]}}}" > "$out"
