#!/bin/bash
# Déploiement Docker sur Raspberry Pi 4
set -e

PI_HOST="${PI_HOST:-raspberrypi.local}"
PI_USER="admin"
DEPLOY_DIR="gleba"

echo "🐳 Création de l'archive de déploiement..."

# Créer archive avec fichiers Docker
tar -czf gleba-docker.tar.gz \
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

echo "✅ Archive créée: gleba-docker.tar.gz ($(du -h gleba-docker.tar.gz | cut -f1))"

echo "📤 Transfert vers le Pi (${PI_HOST})..."
scp gleba-docker.tar.gz ${PI_USER}@${PI_HOST}:~/

echo "🚀 Déploiement sur le Pi..."
ssh ${PI_USER}@${PI_HOST} << ENDSSH
  set -e

  # Créer dossier si nécessaire
  mkdir -p ~/${DEPLOY_DIR}
  cd ~/${DEPLOY_DIR}

  # Extraire
  tar -xzf ~/gleba-docker.tar.gz

  # Créer .env si n'existe pas
  if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  .env créé - configurez-le avant le premier lancement"
  fi

  # Build et lancer
  docker-compose down
  docker-compose build
  docker-compose up -d

  echo ""
  echo "✅ Gleba déployé !"
  echo "📍 http://${PI_HOST}:3000"
  echo ""
  echo "Logs (Ctrl+C pour quitter):"
  docker-compose logs -f
ENDSSH

echo "✅ Déploiement terminé !"

