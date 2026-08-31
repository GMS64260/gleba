#!/bin/sh
set -e

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

echo "==> Checking data migration v1.0.0..."
if [ -f "especes_enriched.csv" ]; then
  # Feedback Marc 2026-05-16 — V3 Bug 2 : on n'utilise plus `--force`
  # à chaque démarrage. Le script `migrate-data-v1` est désormais
  # idempotent (skip si description contient FranceAgriMer). Sans ce
  # retrait, chaque restart ré-importait `doseSemis_AI` du CSV et
  # écrasait les doses agronomiques corrigées par les migrations SQL
  # (Carotte 0.8 → 100).
  npx tsx scripts/migrate-data-v1.ts 2>/dev/null || echo "Migration skipped or already done"
else
  echo "No enriched CSV files found, skipping data migration"
fi

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
# l'image (Dockerfile) et le script d'import existait, mais personne ne l'appelait
# — ni ici, ni `migrate-data-v1.ts` (qui ne traite qu'espèces et ITP, et reste
# de toute façon inerte sans `--force`). Mesuré sur une base neuve le 2026-08-26 :
# 36 variétés au lieu de 192, Tomate 5 au lieu de 16.
#
# L'import COMPLÈTE, il n'écrase pas : seuls les champs vides en base sont
# remplis (cf. `champsAComplete`). Sans cette règle, le passer au démarrage
# rejouerait la régression de mai 2026 où le CSV réécrivait à chaque boot des
# valeurs agronomiques corrigées par migration.
echo "==> Importing enriched CSV data (especes, ITP, varietes, idempotent)..."
npx tsx scripts/import-enriched-csv.ts || echo "Enriched CSV import skipped"

echo "==> Starting application..."
exec node server.js
