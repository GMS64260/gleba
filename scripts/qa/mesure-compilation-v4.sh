#!/usr/bin/env bash
# dev-10 (v4, reprise de dev-12/dev-74/dev-11/dev-278) — Compilation next dev de /api/elevage/animaux et /elevage/animaux/<id> sur le banc,
# avec verdict par étape : PANIQUE (Turbopack) / LENTEUR (pas de réponse en DELAI s, sans panique) / SUCCES / ECHEC_HTTP.
#
# À lancer par le QA (seul pilote du banc), sur la branche du lot (elle contient GLEBA_TURBOPACK_CACHE_DEV) :
#   banc session equipe/lots-20261117/banc-fiche-animal -- bash scripts/qa/mesure-compilation-v4.sh debug
# Variables facultatives :
#   DELAI (défaut 360)            : attente maximale d'une requête, en secondes
#   VARIANTES (défaut « existant sans-cache purge ») : essais successifs, banc redémarré à chaque fois
#       existant   : cache disque Turbopack tel qu'il est (.next/dev/cache/turbopack) — reproduit l'état du banc
#       sans-cache : GLEBA_TURBOPACK_CACHE_DEV=0 (cache disque désactivé) ; NON_APPLICABLE si le HEAD du banc n'a pas la variable
#       purge      : cache disque supprimé avant démarrage, puis cache actif (démarrage à froid)
#   ANIMAL_ID : cible (sinon premier animal renvoyé par l'API)
# Le compte debug possède ses propres objets de recette ; le QA prépare un animal par l’interface.
# Pour un autre compte : libellé de la ligne « compte : email / mot-de-passe » de banc comptes.
# Une variante s'arrête à la première étape qui n'est pas SUCCES (une panique Turbopack est terminale pour le serveur).
# v4 : suit le 307 de /elevage/animaux avec le cookie authentifié et contrôle l'URL finale.
# Un renvoi vers la connexion reste ECHEC_SESSION, y compris après suivi d'un 302/307.
# Mesure les deux accès fiche, le PATCH du nom et sa relecture ; restaure le nom initial.
# Le nom utilise PATCH collection avec {id, nom}, comme AnimauxTab ; relecture par GET id.
# SOURCABLE : importer ce script définit les fonctions sans toucher au banc (test HTTP local).
# Rien de secret n'est écrit : identifiants lus de `banc comptes`, passés à curl par stdin, cookies dans un dossier
# temporaire supprimé à la sortie.
set -euo pipefail
TACHE="${TACHE:-/srv/gleba-equipe/journees/20261117/taches/dev-10}"
export PREUVES="${PREUVES:-$TACHE/preuves/mesure-$(date -u +%Y%m%dT%H%M%SZ)}"
export COMPTE="${COMPTE:-${1:-debug}}"
export DELAI="${DELAI:-360}"
export VARIANTES="${VARIANTES:-existant sans-cache purge}"
BASE="${BASE:-http://127.0.0.1:3900}"
BANC_ARBRE=/srv/gleba-equipe/gleba
NEXT_LOG="${NEXT_LOG:-/srv/gleba-equipe/banc/journaux/next.log}"
MOTIF_PANIQUE="panicked at|FATAL: An unexpected Turbopack error|turbo-tasks.*panic"
JOURNAL="$PREUVES/journal.log"
VERDICT="$PREUVES/verdict.txt"
# Les preuves ne conservent que les durées de compilation/requête et signatures de panique.
# Les corps, cookies, identifiants, requêtes SQL et messages métier restent hors des preuves.
compiler_journal() {
  sed -E 's/\x1B\[[0-9;]*[mK]//g' | awk '
    /panicked at|FATAL: An unexpected Turbopack error|turbo-tasks.*panic/ {
      signature="PANIQUE Turbopack : signature interne détectée"
      if (match($0, /aggregation_update\.rs:[0-9]+(:[0-9]+)?/)) signature=signature " " substr($0,RSTART,RLENGTH)
      print signature; next
    }
    {
      if (match($0, /(GET|PATCH) \/(api\/)?elevage[^ ]* [0-9][0-9][0-9] in [0-9.]+[a-z]+/)) {
        s=substr($0,RSTART,RLENGTH); suite=substr($0,RSTART+RLENGTH)
        sub(/\?[^ ]*/, "", s); gsub(/\/[0-9]+/, "/<id>", s)
        while (match(suite, /(compile|render|proxy\.ts): [0-9.]+[a-z]+/)) {
          s=s " " substr(suite,RSTART,RLENGTH); suite=substr(suite,RSTART+RLENGTH)
        }
        print s
      } else if (match($0, /(Compiled|Compiling) \/(api\/)?elevage[^ ]*( in [0-9.]+[a-z]+)?/)) {
        s=substr($0,RSTART,RLENGTH); sub(/\?[^ ]*/, "", s); gsub(/\/[0-9]+/, "/<id>", s); print s
      }
    }'
}
anonymiser_routes() { sed -E 's@(/animaux)/[0-9]+@\1/<id>@g; s@\?[^ ]*@?<paramètres>@g'; }
log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | anonymiser_routes | tee -a "$JOURNAL"; }
calme() {
  echo "== $(date -u +%FT%TZ) $1"; uptime; free -m
  echo "LOURD_HORS_BANC $(ps -eo args | grep -cE '^[^ ]*node [^ ]*(tsc|vitest[^ ]*|eslint|prisma)( |$)' || true) (0 attendu : banc calme)"
  ps -eo pid,user,etime,rss,comm --sort=-rss | grep -E 'node|next|chrom' || echo "(aucun)"
}

fin() {
  code=$?
  trap - EXIT
  [ -n "$ECHANT_PID" ] && kill "$ECHANT_PID" 2>/dev/null || true
  [ -n "$CURL_PID" ] && kill "$CURL_PID" 2>/dev/null || true
  if [ -n "${RESTAURER_ROUTE:-}" ]; then restaurer_nom || true; fi
  rm -rf "$JAR"
  banc arreter >/dev/null 2>&1 || true
  banc etat > "$PREUVES/banc-etat-final.txt" 2>&1 || true
  printf '%s\n' "$code" > "$PREUVES/code-sortie-phase.txt"
  exit "$code"
}

MOTIF_NEXT='^ *[0-9]+ next-server|/srv/gleba-equipe/gleba/node_modules/\.bin/next|/srv/gleba-equipe/gleba/\.next/dev/'
echantillonner() {
  local etiquette="$1" sortie="$2"
  while :; do
    {
      echo "### $(date -u +%FT%TZ) $etiquette"
      ps -u "$(id -un)" -o rss,args | grep -E "$MOTIF_NEXT" | grep -v grep | awk '{s+=$1} END {printf "RSS_TOTAL_NEXT_Mo %d\n", s/1024}'
      ps -u "$(id -un)" -o rss,args | grep -E '^ *[0-9]+ next-server' | awk '{printf "RSS_NEXT_SERVER_Mo %d\n", $1/1024}'
      echo "LOURD_HORS_BANC $(ps -eo args | grep -cE '^[^ ]*node [^ ]*(tsc|vitest[^ ]*|eslint|prisma)( |$)' || true)"
      free -m | sed -n '2,3p'
    } | anonymiser_routes >> "$sortie"
    sleep 5
  done
}

connecter() {
  case "$COMPTE" in demo) LIBELLE="démo" ;; *) LIBELLE="$COMPTE" ;; esac
  local ligne email mdp csrf session
  # Sélection littérale ; une ligne sans séparateur de mot de passe ne convient pas.
  ligne=$(banc comptes | awk -v compte="$LIBELLE" '
    {libelle=$0; sub(/[[:space:]]*:.*$/, "", libelle)}
    libelle == compte && / :|[[:space:]]:/ {if ($0 ~ / \/ /) {print; exit}}')
  email=$(printf '%s' "$ligne" | sed -E 's/^[^:]+:[[:space:]]*([^ ]+)[[:space:]]*\/[[:space:]]*([^ ]+).*/\1/')
  mdp=$(printf '%s' "$ligne" | sed -E 's/^[^:]+:[[:space:]]*([^ ]+)[[:space:]]*\/[[:space:]]*([^ ]+).*/\2/')
  [ -n "$email" ] && [ -n "$mdp" ] || { log "ECHEC compte absent ou sans identifiants exploitables dans banc comptes"; return 3; }
  rm -f "$JAR/c"
  csrf=$(curl -s --noproxy 127.0.0.1 --max-time "$DELAI" -c "$JAR/c" -b "$JAR/c" "$BASE/api/auth/csrf" | jq -r .csrfToken)
  printf 'csrfToken=%s&email=%s&password=%s&json=true&callbackUrl=%s' "$csrf" \
    "$(jq -rn --arg v "$email" '$v|@uri')" "$(jq -rn --arg v "$mdp" '$v|@uri')" "$(jq -rn --arg v "$BASE/" '$v|@uri')" \
    | curl -s --noproxy 127.0.0.1 --max-time "$DELAI" -o /dev/null -w '%{http_code}\n' -c "$JAR/c" -b "$JAR/c" \
        -H 'Content-Type: application/x-www-form-urlencoded' --data-binary @- "$BASE/api/auth/callback/credentials" > "$JAR/login" || true
  session=$(curl -s --noproxy 127.0.0.1 --max-time "$DELAI" -b "$JAR/c" "$BASE/api/auth/session" | jq -r '.user.email // empty' || true)
  log "connexion callback=$(cat "$JAR/login") session=$([ "$session" = "$email" ] && echo ok || echo ABSENTE)"
  [ "$session" = "$email" ]
}

# mesurer <variante> <nom> <route> [seuil_s] [destination_finale] [méthode] [fichier_json]
# Redirections suivies uniquement pour la liste ; les mutations ne suivent jamais de 3xx.
mesurer() {
  local var="$1" nom="$2" route="$3" seuil="${4:-$DELAI}" attendue="${5:-}" methode="${6:-GET}" corps="${7:-}"
  local options=()
  if [ -n "$attendue" ]; then options+=(--location --max-redirs 3 --proto-redir =http); fi
  if [ -n "$corps" ]; then options+=(-H "Content-Type: application/json" --data-binary "@$corps"); fi
  local pfx="$PREUVES/$var" rss="$PREUVES/$var/rss-free-$nom.log"
  local avant; avant=$(wc -l < "$NEXT_LOG")
  echantillonner "$route" "$rss" & ECHANT_PID=$!
  log "[$var] DEBUT $methode $route (délai ${DELAI}s, seuil ${seuil}s)"
  curl -s --noproxy 127.0.0.1 --max-time "$DELAI" -b "$JAR/c" -c "$JAR/c" -o "$JAR/corps-$nom" \
    -X "$methode" "${options[@]}" -w '%{http_code} total=%{time_total}s premier_octet=%{time_starttransfer}s octets=%{size_download} redirection=%{redirect_url} finale=%{url_effective} sauts=%{num_redirects}\n' \
    "$BASE$route" > "$JAR/metriques-$nom.txt" 2>/dev/null & CURL_PID=$!
  # Une panique est terminale : 30 s de grâce après la première ligne de panique, puis abandon de la requête.
  local panique_vue="" t=0
  while kill -0 "$CURL_PID" 2>/dev/null; do
    sleep "${INTERVALLE:-5}"; t=$((t + ${INTERVALLE:-5}))
    # grep sans -q : lit tout le flux (avec pipefail, -q ferait échouer tail par SIGPIPE et masquerait la panique).
    if [ -z "$panique_vue" ] && tail -n +"$((avant + 1))" "$NEXT_LOG" | grep -E "$MOTIF_PANIQUE" >/dev/null; then
      panique_vue=$t; log "[$var] panique Turbopack détectée à ${t}s pendant $route"
    fi
    if [ -n "$panique_vue" ] && [ $((t - panique_vue)) -ge 30 ]; then kill "$CURL_PID" 2>/dev/null || true; fi
  done
  local code=0; wait "$CURL_PID" || code=$?; CURL_PID=""
  kill "$ECHANT_PID" 2>/dev/null || true; wait "$ECHANT_PID" 2>/dev/null || true; ECHANT_PID=""
  echo "code_curl=$code" >> "$JAR/metriques-$nom.txt"
  tail -n +"$((avant + 1))" "$NEXT_LOG" | compiler_journal > "$pfx/next-$nom.log" || true
  anonymiser_routes < "$JAR/metriques-$nom.txt" > "$pfx/curl-$nom.txt"
  local http total rssmax verdict cible finale
  http=$(head -1 "$JAR/metriques-$nom.txt" | awk '$1 ~ /^[0-9][0-9][0-9]$/ {print $1}'); http=${http:-000}
  total=$(head -1 "$JAR/metriques-$nom.txt" | sed -nE 's/.*total=([0-9.]+)s.*/\1/p'); total=${total:-?}
  cible=$(head -1 "$JAR/metriques-$nom.txt" | sed -nE 's/.* redirection=([^ ]*).*/\1/p'); cible="${cible#$BASE}"
  finale=$(head -1 "$JAR/metriques-$nom.txt" | sed -nE 's/.* finale=([^ ]*).*/\1/p'); finale="${finale#$BASE}"
  rssmax=$(grep RSS_TOTAL_NEXT_Mo "$rss" 2>/dev/null | awk '{if($2>m)m=$2} END {print m+0}')
  verdict=""
  if grep -q "PANIQUE Turbopack" "$pfx/next-$nom.log"; then verdict=PANIQUE
  elif [ "$code" = 28 ]; then verdict=LENTEUR
  elif [[ "$finale" =~ ^/(login|connexion|api/session-terminee)([?/]|$) ]] || [[ "$cible" =~ ^/(login|connexion|api/session-terminee)([?/]|$) ]]; then verdict=ECHEC_SESSION
  elif [ "$code" != 0 ]; then verdict=ECHEC_CURL
  elif [[ "$http" =~ ^2 ]] && { [ -z "$attendue" ] || [ "$finale" = "$attendue" ]; }; then
    verdict=SUCCES
    awk -v t="$total" -v s="$seuil" 'BEGIN{exit !(t+0 > s+0)}' && verdict=SUCCES_HORS_SEUIL
  else verdict=ECHEC_HTTP
  fi
  printf '%s %-12s %-28s %-18s http=%s total=%ss code_curl=%s rss_next_max=%sMo route=%s%s\n' \
    "$(date -u +%FT%TZ)" "$var" "$nom" "$verdict" "$http" "$total" "$code" "$rssmax" "$route" " finale=$finale${cible:+ redirection=$cible}" | anonymiser_routes | tee -a "$VERDICT" >> "$JOURNAL"
  log "[$var] FIN $nom : $verdict"
  [ "$verdict" = SUCCES ] || [ "$verdict" = SUCCES_HORS_SEUIL ]
}

variante() {
  local var="$1"
  mkdir -p "$PREUVES/$var"
  banc arreter >/dev/null 2>&1 || true
  unset GLEBA_TURBOPACK_CACHE_DEV
  case "$var" in
    existant) du -sh "$BANC_ARBRE/.next/dev/cache/turbopack" > "$PREUVES/$var/cache-avant.txt" 2>&1 || true ;;
    sans-cache)
      if ! grep -q GLEBA_TURBOPACK_CACHE_DEV "$BANC_ARBRE/next.config.mjs"; then
        printf '%s %-12s %-28s %s\n' "$(date -u +%FT%TZ)" "$var" "-" "NON_APPLICABLE (HEAD du banc sans GLEBA_TURBOPACK_CACHE_DEV)" | tee -a "$VERDICT" >> "$JOURNAL"
        return 0
      fi
      export GLEBA_TURBOPACK_CACHE_DEV=0 ;;
    purge)
      du -sh "$BANC_ARBRE/.next/dev/cache/turbopack" > "$PREUVES/$var/cache-avant.txt" 2>&1 || true
      rm -rf "$BANC_ARBRE/.next/dev/cache/turbopack"
      log "[$var] cache disque Turbopack supprimé ($(cat "$PREUVES/$var/cache-avant.txt" | awk '{print $1}'))" ;;
    *) log "variante inconnue $var"; return 1 ;;
  esac
  log "[$var] banc demarrer (GLEBA_TURBOPACK_CACHE_DEV=${GLEBA_TURBOPACK_CACHE_DEV:-défaut})"
  local t0=$SECONDS
  if ! timeout --foreground --signal=TERM --kill-after=10s 600s banc demarrer 7>&- 8>&- 9>&- > "$JAR/demarrer.txt" 2>&1; then
    compiler_journal < "$JAR/demarrer.txt" > "$PREUVES/$var/demarrer.txt"
    compiler_journal < "$NEXT_LOG" > "$PREUVES/$var/next.log" 2>/dev/null || true
    printf '%s %-12s %-28s %s\n' "$(date -u +%FT%TZ)" "$var" "demarrage" "ECHEC_DEMARRAGE (voir demarrer.txt)" | tee -a "$VERDICT" >> "$JOURNAL"
    return 1
  fi
  compiler_journal < "$JAR/demarrer.txt" > "$PREUVES/$var/demarrer.txt"
  log "[$var] démarrage en $((SECONDS - t0)) s"
  grep -q "(turbopack)" "$JAR/demarrer.txt" || log "[$var] ATTENTION : moteur autre que Turbopack, verdicts non comparables"
  if ! connecter; then
    compiler_journal < "$NEXT_LOG" > "$PREUVES/$var/next.log" 2>/dev/null || true
    printf '%s %-12s %-28s %s\n' "$(date -u +%FT%TZ)" "$var" "connexion" "ECHEC_CONNEXION" | tee -a "$VERDICT" >> "$JOURNAL"
    return 1
  fi
  local animal resultat=0
  # Ordre de l'essai 1 du 15/11 (panique pendant /api/elevage/animaux juste après /api/elevage/lots).
  mesurer "$var" api-lots "/api/elevage/lots" \
  && mesurer "$var" api-animaux "/api/elevage/animaux" \
  && mesurer "$var" page-liste-avec-redirection "/elevage/animaux" 30 "/elevage?tab=animaux" \
  && { animal="${ANIMAL_ID:-$(jq -r '.data[0].id // empty' "$JAR/corps-api-animaux" 2>/dev/null || true)}"
       log "[$var] cible animal sélectionnée"
       [ -n "$animal" ] || { printf '%s %-12s %-28s %s\n' "$(date -u +%FT%TZ)" "$var" "cibles" "ECHEC_CIBLE (aucun animal : préparer une fiche ou passer ANIMAL_ID)" | tee -a "$VERDICT" >> "$JOURNAL"; false; }; } \
  && mesurer "$var" api-fiche-animal "/api/elevage/animaux/$animal" \
  && mesurer "$var" fiche-animal-1er-acces "/elevage/animaux/$animal" 30 \
  && mesurer "$var" fiche-animal-2e-acces "/elevage/animaux/$animal" 10 \
  && mesurer "$var" page-liste-canonique-2e-acces "/elevage?tab=animaux" 10 \
  && mesurer_nom "$var" "$animal" \
  || { resultat=1; log "[$var] arrêt de la variante à la première étape non réussie"; }
  compiler_journal < "$NEXT_LOG" > "$PREUVES/$var/next.log" 2>/dev/null || true
  grep -n "PANIQUE Turbopack" "$PREUVES/$var/next.log" > "$PREUVES/$var/paniques.txt" 2>/dev/null || true
  log "[$var] paniques dans next.log : $(wc -l < "$PREUVES/$var/paniques.txt")"
  banc arreter >/dev/null 2>&1 || true
  return "$resultat"
}

# Restaurer même en cas d'interruption après le PATCH (JSON et cookie restent dans tmp/).
restaurer_nom() {
  mesurer "$RESTAURER_VAR" restauration-nom "$RESTAURER_ROUTE" "$DELAI" "" PATCH "$JAR/nom-initial.json" || return 1
  RESTAURER_ROUTE=""
}

mesurer_nom() {
  local var="$1" animal="$2" route="/api/elevage/animaux/$2" mutation="/api/elevage/animaux" resultat=0
  jq '{id: .data.id, nom: .data.nom}' "$JAR/corps-api-fiche-animal" > "$JAR/nom-initial.json"
  jq -n --arg id "$animal" --arg nom "Mesure QA $(date -u +%s)" '{id:($id|tonumber), nom:$nom}' > "$JAR/nom-mesure.json"
  RESTAURER_VAR="$var"; RESTAURER_ROUTE="$mutation"
  mesurer "$var" patch-nom "$mutation" 30 "" PATCH "$JAR/nom-mesure.json" \
  && mesurer "$var" relecture-nom "$route" 10 \
  && jq -e --slurpfile attendu "$JAR/nom-mesure.json" '.data.nom == $attendu[0].nom' "$JAR/corps-relecture-nom" >/dev/null \
  || { log "[$var] ECHEC_METIER : nom non modifié ou relecture impossible"; printf '%s %s patch-nom-persistance ECHEC_METIER\n' "$(date -u +%FT%TZ)" "$var" >> "$VERDICT"; resultat=1; }
  restaurer_nom || resultat=1
  if mesurer "$var" relecture-restauration "$route" 10 \
    && jq -e --slurpfile attendu "$JAR/nom-initial.json" '.data.nom == $attendu[0].nom' "$JAR/corps-relecture-restauration" >/dev/null; then
    log "[$var] nom initial restauré et relu"
  else
    log "[$var] ECHEC_RESTAURATION : nom initial non relu"
    printf '%s %s restauration ECHEC_RESTAURATION\n' "$(date -u +%FT%TZ)" "$var" >> "$VERDICT"
    resultat=1
  fi
  return "$resultat"
}

main() {
  case "$PREUVES" in /srv/gleba-equipe/*) ;; *) echo "Preuves sous /srv/gleba-equipe requises" >&2; return 2 ;; esac
  mkdir -p "$PREUVES" "$TACHE/tmp"
  if [ "${2:-}" != sous-verrou ]; then
    # banc session réserve fd 8 ; lourd le réutilise, conserver la réservation sur fd 7.
    if { true >&8; } 2>/dev/null; then exec 7>&8; fi
    trap 'banc arreter >/dev/null 2>&1 || true' EXIT
    trap 'exit 143' TERM INT
    local n code=0; n=$(wc -w <<<"$VARIANTES")
    log "RESERVATION delai=${DELAI}s variantes=[$VARIANTES] preuves=$PREUVES"
    calme "avant verrou" > "$PREUVES/calme-avant-verrou.txt" 2>&1
    banc arreter >/dev/null 2>&1 || true
    # 14 requêtes par variante, connexion et démarrage compris (budget global majoré).
    lourd timeout --foreground --signal=TERM --kill-after=15s $(( n * (DELAI * 20 + 600) + 120 ))s bash "$0" "$COMPTE" sous-verrou || code=$?
    printf '%s\n' "$code" > "$PREUVES/code-sortie-pilote.txt"
    log "FIN PILOTE code=$code"
    cat "$VERDICT" 2>/dev/null || true
    return "$code"
  fi
  JAR="$(mktemp -d "$TACHE/tmp/mesure-session.XXXXXX")"
  ECHANT_PID=""; CURL_PID=""; RESTAURER_ROUTE=""
  trap fin EXIT
  trap 'exit 143' TERM INT
  log "LOURD ACQUIS (verrous équipe + VPS tenus)"
  calme "verrou acquis" > "$PREUVES/calme-verrou-acquis.txt" 2>&1
  git -C "$BANC_ARBRE" rev-parse HEAD > "$PREUVES/banc-head.txt"
  local v resultat=0
  for v in $VARIANTES; do variante "$v" || resultat=1; done
  if grep -q SUCCES_HORS_SEUIL "$VERDICT"; then resultat=1; fi
  unset GLEBA_TURBOPACK_CACHE_DEV
  log "MESURES TERMINEES code=$resultat"
  return "$resultat"
}

if [[ "${BASH_SOURCE[0]}" = "$0" ]]; then main "$@"; fi
