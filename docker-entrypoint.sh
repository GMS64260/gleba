#!/bin/sh
set -e

# ─────────────────────────────────────────────────────────────────────────────
# Secret de session obligatoire (revue du 2026-11-04).
#
# Les sessions sont des JWT chiffrés avec NEXTAUTH_SECRET (ou AUTH_SECRET), et
# le rôle ADMIN est lu dans le jeton. Avec une valeur publiée dans le dépôt
# (défaut de docker-compose.yml, exemple de .env.example), n'importe qui
# fabrique un cookie administrateur pour l'instance. On refuse de démarrer.
# ─────────────────────────────────────────────────────────────────────────────
SECRET_SESSION="${AUTH_SECRET:-${NEXTAUTH_SECRET:-}}"
case "$SECRET_SESSION" in
  ""|"changez-moi-en-production"|"generate-a-secret-with-openssl-rand-base64-32")
    echo "ERREUR : NEXTAUTH_SECRET est vide ou vaut l'exemple publié dans le dépôt." >&2
    echo "Générez-en un (openssl rand -base64 32), placez-le dans .env, puis redémarrez." >&2
    exit 1
    ;;
esac
if [ "${#SECRET_SESSION}" -lt 32 ]; then
  echo "ATTENTION : NEXTAUTH_SECRET fait moins de 32 caractères ; préférez openssl rand -base64 32." >&2
fi
unset SECRET_SESSION

# ─────────────────────────────────────────────────────────────────────────────
# Migrations Prisma versionnées (sans perte de données).
#
# `migrate deploy` n'applique QUE les migrations présentes dans
# `prisma/migrations/` qui ne sont pas encore enregistrées dans la table
# `_prisma_migrations`. Aucune destruction silencieuse de colonnes,
# contrairement à `db push --accept-data-loss` utilisé avant.
#
# Bascule one-shot pour les instances pré-existantes (la table peut être vide
# alors que le schéma est déjà à jour, ce qui ferait planter `migrate deploy`
# sur des CREATE TABLE redondants). À exécuter manuellement avant le premier
# démarrage post-upgrade, depuis le container app :
#
#   for m in prisma/migrations/*/; do
#     npx prisma migrate resolve --applied "$(basename "$m")"
#   done
#
# Pour une nouvelle installation, rien à faire : la table est créée et toutes
# les migrations sont appliquées dans l'ordre.
# ─────────────────────────────────────────────────────────────────────────────
echo "==> Applying database migrations (prisma migrate deploy)..."
node node_modules/prisma/build/index.js migrate deploy

echo "==> Seeding database (if empty)..."
npx tsx prisma/seed.ts 2>/dev/null || echo "Database already seeded or seed skipped"

echo "==> Creating demo account (if not exists)..."
npx tsx prisma/seed-demo.ts 2>/dev/null || echo "Demo account already exists or creation skipped"

echo "==> Seeding animal breeds referential (idempotent)..."
npx tsx prisma/seed-races.ts 2>/dev/null || echo "Breeds seed skipped"

echo "==> Seeding geographic referential (outre-mer species/ITP, idempotent)..."
npx tsx prisma/seed-referentiel-geographique.ts 2>/dev/null || echo "Geographic referential seed skipped"

# Issue #30 : catalogue variétal arboricole (petits fruits, méditerranéens,
# noyers, châtaigniers, kiwis, agrumes). `prisma/seed-varietes-arbres.sql`
# n'était appelé nulle part, d'où 0 variété arboricole sur toute installation
# neuve. Le seed est idempotent et ne remplace jamais une entrée existante.
#
# Il passe AVANT l'import des CSV parce qu'il crée 15 espèces que le CSV sait
# ensuite enrichir : dans cet ordre, une installation neuve converge en un seul
# démarrage au lieu de deux.
echo "==> Seeding tree/berry varieties referential (idempotent)..."
npx tsx prisma/seed-varietes-arbres.ts || echo "Tree varieties seed skipped"

# Issue #29 (Siruv, 2026-08-26) : `varietes_enriched.csv` était bien copié dans
# l'image (Dockerfile) et le script d'import existait, mais personne ne l'appelait.
# Mesuré sur une base neuve le 2026-08-26 : 36 variétés au lieu de 192, Tomate 5
# au lieu de 16.
#
# L'import COMPLÈTE, il n'écrase pas : seuls les champs vides en base sont
# remplis (cf. `champsAComplete`). Sans cette règle, le passer au démarrage
# rejouerait la régression de mai 2026 où le CSV réécrivait à chaque boot des
# valeurs agronomiques corrigées par migration.
echo "==> Importing enriched CSV data (especes, ITP, varietes, idempotent)..."
npx tsx scripts/import-enriched-csv.ts || echo "Enriched CSV import skipped"

echo "==> Starting application..."
exec node server.js
