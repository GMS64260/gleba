#!/usr/bin/env bash
# Validation externe des échantillons Factur-X et UBL de Gleba avec Mustang
# (ZUGFeRD/mustangproject : veraPDF pour le PDF/A-3b, XSD CII/UBL, schematron
# EN 16931 et règles françaises XP Z12-012 « BR-FR » embarquées depuis la 2.26).
#
# Usage :
#   MUSTANG_JAR=/chemin/Mustang-CLI-2.26.0.jar scripts/qa/valider-facturx.sh [dossier]
# Sans dossier, les échantillons sont régénérés par le test
# src/lib/__tests__/facturx-echantillons.test.ts dans un dossier temporaire.
# Le jar (59 Mo) se télécharge depuis les releases GitHub de mustangproject ;
# il n'est pas versionné ici. Java 17+ requis.
set -euo pipefail
cd "$(dirname "$0")/../.."
JAR="${MUSTANG_JAR:-}"
if [ -z "$JAR" ] || [ ! -f "$JAR" ]; then
  echo "MUSTANG_JAR doit pointer vers Mustang-CLI-x.y.z.jar (https://github.com/ZUGFeRD/mustangproject/releases)" >&2
  exit 2
fi
DOSSIER="${1:-}"
if [ -z "$DOSSIER" ]; then
  DOSSIER="$(mktemp -d)"
  FACTURX_OUT="$DOSSIER" npx vitest run src/lib/__tests__/facturx-echantillons.test.ts >/dev/null
  echo "Échantillons générés dans $DOSSIER"
fi
code=0
for f in "$DOSSIER"/*.pdf "$DOSSIER"/*.ubl.xml; do
  [ -f "$f" ] || continue
  echo "=== $(basename "$f")"
  sortie="$(java -jar "$JAR" --action validate --source "$f" --disable-file-logging 2>&1 || true)"
  # Résumé Mustang : statut PDF et XML, identifiants des règles en défaut.
  # (`|| true` : sous pipefail, un grep sans résultat arrêterait le script.)
  echo "$sortie" | grep -o 'Parsed PDF:[a-z]* XML:[a-z]*.*ErrorIDs: \[[^]]*\]' | sed 's/Signature:null Checksum:[0-9A-F]* //' || true
  echo "$sortie" | grep -E '^\s*(BR-|\[BR-|\[PEPPOL)' | grep -v 'BR-DE' | sed 's/^\s*/    /' | sort -u | head -40 || true
  if echo "$sortie" | grep -q 'XML:invalid\|PDF:invalid'; then code=1; fi
done
exit $code
