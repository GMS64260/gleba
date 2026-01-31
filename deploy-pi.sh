#!/bin/bash
# Script de déploiement Gleba sur Raspberry Pi 4

set -e

echo "📦 Préparation du déploiement pour Raspberry Pi..."

# Créer l'archive
tar -czf gleba-deploy.tar.gz \
  .next \
  prisma \
  public \
  src \
  package.json \
  package-lock.json \
  tsconfig.json \
  next.config.mjs \
  tailwind.config.ts \
  postcss.config.mjs \
  .env.example

echo "✅ Archive créée: gleba-deploy.tar.gz ($(du -h gleba-deploy.tar.gz | cut -f1))"
echo ""
echo "📋 Commandes pour le Pi:"
echo ""
echo "1. Transférer l'archive:"
echo "   scp gleba-deploy.tar.gz pi@[IP_DU_PI]:~/"
echo ""
echo "2. Sur le Pi, déployer:"
echo "   tar -xzf gleba-deploy.tar.gz -C /chemin/vers/gleba"
echo "   cd /chemin/vers/gleba"
echo "   npm install --production"
echo "   cp .env.example .env"
echo "   # Configurer .env avec DATABASE_URL, NEXTAUTH_SECRET, etc."
echo "   npx prisma db push"
echo "   npm run start"
echo ""
echo "💡 Pour un service systemd, voir gleba-pi.service"
