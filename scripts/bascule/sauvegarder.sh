#!/usr/bin/env bash
# Préalables d'une bascule en production (procédure de la note d'exploitation) :
#   1. dump de la base (scripts/backup.sh, dans /var/backups/gleba, rotation 14 j) ;
#   2. archive des quatre volumes de fichiers au même horodatage, chacun monté
#      en lecture seule dans un conteneur jetable, puis `gzip -t` ;
#   3. tag de rollback de l'image EN SERVICE (lue sur le conteneur, jamais `latest`).
# Ne démarre rien, ne supprime rien. À lancer juste avant `compose up -d --no-deps app`.
#
# Usage : sudo -n bash scripts/bascule/sauvegarder.sh <lot>   (ex. accueil-v2)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
LOT="${1:?usage: sauvegarder.sh <lot>}"
DEST="${BACKUP_DIR:-/var/backups/gleba}"
H="$(date +%Y%m%d-%H%M%S)"
VOLUMES=(gleba_uploads_data gleba_justificatifs_data gleba_plan_fonds_data gleba_registres_elevage_data)

echo "1/3 dump de la base"
BACKUP_DIR="$DEST" ./scripts/backup.sh
DUMP="$(ls -t "$DEST"/gleba-*.dump | head -1)"
echo "    $DUMP ($(du -h "$DUMP" | cut -f1))"

echo "2/3 archive des volumes → $DEST/volumes-$H"
mkdir -p "$DEST/volumes-$H"
for v in "${VOLUMES[@]}"; do
  docker run --rm -v "$v:/v:ro" -v "$DEST/volumes-$H:/out" alpine:3.22 tar czf "/out/$v.tar.gz" -C /v .
  gzip -t "$DEST/volumes-$H/$v.tar.gz"
  echo "    $v.tar.gz ($(du -h "$DEST/volumes-$H/$v.tar.gz" | cut -f1))"
done

echo "3/3 tag de rollback de l'image en service"
IMG="$(docker inspect -f '{{.Image}}' gleba_app)"
TAG="gleba-app:rollback-$(date +%Y%m%d)-pre-$LOT"
docker tag "$IMG" "$TAG"
echo "    $TAG → ${IMG#sha256:}"
echo "prêt : dump $DUMP, volumes-$H, $TAG"
