#!/usr/bin/env bash
# Banc d'essai local de Gleba : lance une image de test sur 127.0.0.1:3400
# contre la base `gleba_essai_accueil` (copie de la prod, réglages neutralisés),
# notifications coupées, sans SMTP ni push. Le conteneur n'a pas de politique
# de redémarrage : il ne revient pas seul après un reboot.
#
# Usage : bash scripts/banc/lancer-essai.sh [sans-demo|demo-v2] [image]
#   sans-demo : le compte démo garde l'ancien accueil (défaut)
#   demo-v2   : ACCUEIL_DEMO=v2, le compte démo voit l'accueil v2 et le rail
#
# `sudo` ne transmet pas l'environnement : les variables passent par un
# fichier temporaire en 600, supprimé aussitôt (rien n'apparaît dans `ps`).
# Aucun secret n'est écrit ici : ils sont lus dans /var/www/gleba/.env.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
set -a; . ./.env; set +a
MODE="${1:-sans-demo}"
IMAGE="${2:-gleba-app:essai-20261010b}"
umask 077
ENVF="$(mktemp /tmp/gleba-essai.XXXXXX.env)"
{
  printf '%s\n' "DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@gleba_db:5432/gleba_essai_accueil?schema=public"
  printf '%s\n' "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}"
  printf '%s\n' "NEXTAUTH_URL=http://127.0.0.1:3400"
  printf '%s\n' "AUTH_TRUST_HOST=true"
  printf '%s\n' "ADMIN_EMAIL=${ADMIN_EMAIL:-}" "ADMIN_PASSWORD=${ADMIN_PASSWORD:-}" "ADMIN_NAME=${ADMIN_NAME:-}"
  printf '%s\n' "NOTIF_ENABLED=false" "TZ=Europe/Paris" "NODE_ENV=production" "PORT=3400"
  printf '%s\n' "SMTP_HOST=" "SMTP_USER=" "SMTP_PASS=" "SMTP_FROM=" "VAPID_PUBLIC_KEY=" "VAPID_PRIVATE_KEY=" "VAPID_SUBJECT="
  printf '%s\n' "GLEBA_PAPERCLIP_API_URL=" "AUTH_GOOGLE_ID=" "AUTH_GOOGLE_SECRET="
  if [ "$MODE" = "demo-v2" ]; then printf '%s\n' "ACCUEIL_DEMO=v2"; fi
} > "$ENVF"
sudo -n docker rm -f gleba_essai >/dev/null 2>&1 || true
sudo -n docker run -d --name gleba_essai --network gleba_default -p 127.0.0.1:3400:3400 \
  --env-file "$ENVF" \
  --memory 1g --pids-limit 300 --security-opt no-new-privileges:true --cap-drop ALL \
  "$IMAGE" >/dev/null
rm -f "$ENVF"
echo "conteneur gleba_essai lancé ($MODE, $IMAGE)"
