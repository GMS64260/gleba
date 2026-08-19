#!/bin/bash
# Déploiement Docker sur Pi avec build pré-compilé
set -e

PI_HOST="${PI_HOST:-raspberrypi.local}"
PI_USER="admin"
DEPLOY_DIR="gleba"

echo "🐳 Création de l'archive avec build pré-compilé..."

# Créer archive AVEC le build .next/
tar -czf gleba-docker-prebuild.tar.gz \
  .next \
  Dockerfile \
  docker-compose.yml \
  docker-entrypoint.sh \
  .env.example \
  package.json \
  package-lock.json \
  next.config.mjs \
  tsconfig.json \
  tailwind.config.ts \
  postcss.config.mjs \
  prisma \
  src \
  public

echo "✅ Archive créée: gleba-docker-prebuild.tar.gz ($(du -h gleba-docker-prebuild.tar.gz | cut -f1))"
echo ""
echo "📤 Commandes pour déployer sur le Pi:"
echo ""
echo "scp gleba-docker-prebuild.tar.gz docker-compose.yml .env.example ${PI_USER}@${PI_HOST}:~/"
echo ""
echo "ssh ${PI_USER}@${PI_HOST}"
echo "mkdir -p ~/${DEPLOY_DIR} && cd ~/${DEPLOY_DIR}"
echo "tar -xzf ~/gleba-docker-prebuild.tar.gz"
echo "cp .env.example .env"
echo "nano .env  # Configurer DATABASE_URL, NEXTAUTH_SECRET, etc."
echo "docker-compose up -d"
echo "docker-compose logs -f"
