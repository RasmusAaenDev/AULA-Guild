#!/bin/sh
# Falsk simc til tests: --version, ellers skriv kendt json2 til stien fra json2=-linjen.
if [ "$1" = "--version" ]; then echo "SimulationCraft FAKE-1"; exit 0; fi
out=$(grep '^json2=' "$1" | cut -d= -f2-)
if grep -q '^race=fail' "$1"; then echo "hemmelig fejl" >&2; exit 1; fi
if grep -q '^race=zero' "$1"; then
  echo '{"sim":{"players":[{"name":"Test","specialization":"X","level":11,"race":"zero","collected_data":{"dps":{"mean":0}}}]}}' > "$out"; exit 0
fi
echo '{"sim":{"players":[{"name":"Test","specialization":"Beast Mastery","level":11,"race":"Dwarf","collected_data":{"dps":{"mean":1234.5,"std_dev":10,"mean_std_dev":0.5}}}]}}' > "$out"
