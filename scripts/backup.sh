#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Sauvegarde Gleba — dump PostgreSQL avec rotation
#
# Usage :
#   ./scripts/backup.sh                      # backup vers /var/backups/gleba
#   BACKUP_DIR=/data/backups ./scripts/backup.sh
#
# Variables d'environnement :
#   BACKUP_DIR        Dossier de destination (défaut: /var/backups/gleba)
#   RETENTION_DAYS    Nombre de jours à conserver (défaut: 14)
#   POSTGRES_USER     Utilisateur DB (défaut: gleba)
#   POSTGRES_DB       Nom de la base (défaut: gleba)
#   COMPOSE_PROJECT   Nom du projet docker compose si différent du dossier
#
# Pour automatiser (cron quotidien à 3h du matin) :
#   sudo crontab -e
#   0 3 * * * cd /var/www/gleba && ./scripts/backup.sh >> /var/log/gleba-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/gleba}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
PG_USER="${POSTGRES_USER:-gleba}"
PG_DB="${POSTGRES_DB:-gleba}"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/gleba-$STAMP.dump"

mkdir -p "$BACKUP_DIR"

echo "==> Dump PostgreSQL → $OUT"
docker compose exec -T db pg_dump -U "$PG_USER" -d "$PG_DB" -Fc > "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "    OK ($SIZE)"

echo "==> Rotation : suppression des dumps de plus de $RETENTION_DAYS jours"
find "$BACKUP_DIR" -name 'gleba-*.dump' -type f -mtime +"$RETENTION_DAYS" -print -delete

echo "==> Sauvegarde terminée."
