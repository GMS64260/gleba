#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Restauration Gleba — restore d'un dump créé par scripts/backup.sh
#
# Usage :
#   ./scripts/restore.sh /var/backups/gleba/gleba-20260524-030000.dump
#
# ATTENTION : cette opération est destructive. Elle écrase la base existante
# (--clean --if-exists). Le container `app` est arrêté pendant la restauration
# pour éviter des écritures concurrentes, puis redémarré.
#
# Variables d'environnement :
#   POSTGRES_USER  Utilisateur DB (défaut: gleba)
#   POSTGRES_DB    Nom de la base (défaut: gleba)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <chemin-vers-dump>" >&2
  exit 2
fi

DUMP="$1"
PG_USER="${POSTGRES_USER:-gleba}"
PG_DB="${POSTGRES_DB:-gleba}"

if [ ! -f "$DUMP" ]; then
  echo "Erreur : fichier introuvable : $DUMP" >&2
  exit 1
fi

echo "==> Vous êtes sur le point d'ÉCRASER la base '$PG_DB' avec :"
echo "    $DUMP"
echo "    $(du -h "$DUMP" | cut -f1)"
read -r -p "Confirmer ? Tapez 'RESTORE' pour continuer : " confirm
if [ "$confirm" != "RESTORE" ]; then
  echo "Annulé."
  exit 1
fi

echo "==> Arrêt du container app (pour éviter les écritures concurrentes)..."
docker compose stop app

echo "==> Restauration du dump..."
docker compose exec -T db pg_restore \
  -U "$PG_USER" \
  -d "$PG_DB" \
  --clean --if-exists --no-owner --no-privileges \
  < "$DUMP"

echo "==> Redémarrage du container app..."
docker compose start app

echo "==> Restauration terminée."
