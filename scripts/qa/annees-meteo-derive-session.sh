#!/usr/bin/env bash
# À exécuter uniquement par le QA : PREUVES=... bash <ce fichier> <ref>.
# Réservation directe, sans le démarrage automatique de « banc session ».
# Le navigateur utilise le dépôt du banc ; ce script peut venir d'un autre arbre.
set -euo pipefail
: "${PREUVES:?Dossier de preuves local requis}"
case "$PREUVES" in /srv/gleba-equipe/*) ;; *) exit 2 ;; esac
if [ "$#" -ne 1 ]; then
  echo "Usage QA : PREUVES=... bash $0 <ref> (sans banc session)" >&2
  exit 2
fi
if [ "$(readlink "/proc/$$/fd/8" 2>/dev/null || true)" = /srv/gleba-equipe/banc/verrou-session ]; then
  echo "Lancez ce fichier directement : banc session démarre trop tôt le serveur." >&2
  exit 2
fi
mkdir -p "$PREUVES"
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
export PREUVES TMPDIR=/srv/gleba-equipe/banc/tmp PLAYWRIGHT_BROWSERS_PATH=/opt/gleba-equipe/ms-playwright
export BANC_CHEMIN_PRET=/api/auth/csrf NODE_DISABLE_COMPILE_CACHE=1
QA_BANC_COMMIT=$(git -C /srv/gleba-equipe/gleba rev-parse --verify "$1^{commit}")
export QA_BANC_COMMIT
git -C /srv/gleba-equipe/gleba merge-base --is-ancestor 659190b4 "$QA_BANC_COMMIT"
printf '%s\n' "$QA_BANC_COMMIT" > "$PREUVES/banc-head.txt"
# Chaque surface repart avec une session navigateur neuve. Conserver « annees »
# comme alias pour les anciennes commandes de rejeu.
phases=()
for phase in ${PHASES:-login fixture recoltes mobile export maraichage}; do
  case "$phase" in
    annees) phases+=(recoltes mobile export maraichage) ;;
    login|fixture|recoltes|mobile|export|maraichage|meteo) phases+=("$phase") ;;
    *) echo "Phase inconnue : $phase" >&2; exit 2 ;;
  esac
done
# Le fd 7 reste détenu par ce processus pendant toute la session ; lourd utilise
# les fd 8 et 9. Aucun basculement ni serveur avant cette réservation.
exec 7>/srv/gleba-equipe/banc/verrou-session
flock -w 3600 7 || { echo "Banc occupé par une autre session navigateur" >&2; exit 3; }
banc arreter
# basculer reprend lui-même lourd.lock si le schéma change : le refuser ici
# évite un verrou imbriqué. Le QA doit alors préparer le banc séparément.
if ! git -C /srv/gleba-equipe/gleba diff --quiet HEAD "$QA_BANC_COMMIT" -- prisma/; then
  echo "Schéma différent : préparer le banc sur cette référence avant de relancer." >&2
  exit 2
fi
statut=0
printf 'phase\tcode\n' > "$PREUVES/phases.tsv"
for phase in "${phases[@]}"; do
  echo "PHASE $phase $(date -u +%FT%TZ)"
  code=0
  # Une seule réservation mémoire : le trap arrête le démon AVANT que
  # lourd rende ses verrous, y compris si le démarrage ou le navigateur échoue.
  lourd bash -c '
    set -euo pipefail
    trap "banc arreter" EXIT
    trap "exit 130" INT
    trap "exit 143" TERM
    banc basculer "$QA_BANC_COMMIT"
    timeout --signal=TERM --kill-after=10s 240s banc demarrer
    timeout --signal=TERM --kill-after=10s 600s node "$1" "$2"
  ' qa-annees-meteo "$SCRIPT_DIR/annees-meteo-derive.mjs" "$phase" || code=$?
  cp /srv/gleba-equipe/banc/journaux/next.log "$PREUVES/next-$phase.log"
  echo "FIN $phase code=$code $(date -u +%FT%TZ)"
  printf '%s\t%s\n' "$phase" "$code" >> "$PREUVES/phases.tsv"
  # La panne native reste un échec explicite ; elle ne prive plus les surfaces
  # indépendantes de leurs preuves avec stabilisation JS déclarée.
  if [ "$code" -ne 0 ]; then statut=1; fi
done
exit "$statut"
