#!/bin/sh
set -e

echo "==> Applying database migrations..."
node node_modules/prisma/build/index.js db push --accept-data-loss 2>/dev/null || echo "Warning: prisma db push failed (schema may already be in sync)"

echo "==> Seeding database (if empty)..."
npx tsx prisma/seed.ts 2>/dev/null || echo "Database already seeded or seed skipped"

echo "==> Creating demo account (if not exists)..."
npx tsx prisma/seed-demo.ts 2>/dev/null || echo "Demo account already exists or creation skipped"

echo "==> Checking data migration v1.0.0..."
if [ -f "especes_enriched.csv" ]; then
  # Lancer la migration automatique (avec force si première installation)
  npx tsx scripts/migrate-data-v1.ts --force 2>/dev/null || echo "Migration skipped or already done"
else
  echo "No enriched CSV files found, skipping data migration"
fi

echo "==> Starting application..."
exec node server.js
