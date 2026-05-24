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

echo "==> Starting application..."
exec node server.js
