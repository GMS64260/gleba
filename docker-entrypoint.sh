#!/bin/sh
set -e

echo "==> Applying database migrations..."
npx prisma db push --skip-generate

echo "==> Seeding database (if empty)..."
npx tsx prisma/seed.ts 2>/dev/null || echo "Database already seeded or seed skipped"

echo "==> Starting application..."
exec node server.js
