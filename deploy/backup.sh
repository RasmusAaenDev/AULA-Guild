#!/usr/bin/env bash
# Natligt dump af AULA-databasen. Brug: BACKUP_DIR=/srv/backups/aula deploy/backup.sh
set -euo pipefail

CONTAINER="${CONTAINER:-prod-aula-guild-db}"
BACKUP_DIR="${BACKUP_DIR:?Sæt BACKUP_DIR}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/aula-$(date +%Y%m%d-%H%M%S).sql.gz"
docker exec "$CONTAINER" pg_dump -U aula -d aula | gzip > "$file.tmp"
gzip -t "$file.tmp"
mv "$file.tmp" "$file"
find "$BACKUP_DIR" -name 'aula-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "Backup gemt: $file"
