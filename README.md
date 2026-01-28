# Potaléger

Application de gestion de potager - planification des cultures, suivi des récoltes et rotations.

## Installation rapide (Docker)

```bash
# Cloner le projet
git clone https://github.com/VOTRE_USER/potaleger.git
cd potaleger

# Lancer l'application
docker compose up -d
```

L'application sera accessible sur **http://localhost:3000**

La base de données et les données initiales (34 espèces, 12 familles botaniques) sont créées automatiquement au premier lancement.

## Configuration (optionnel)

Créer un fichier `.env` pour personnaliser :

```env
# Port de l'application (défaut: 3000)
APP_PORT=3000

# Base de données (défauts recommandés)
POSTGRES_USER=potaleger
POSTGRES_PASSWORD=potaleger
POSTGRES_DB=potaleger
```

## Fonctionnalités

- **Cultures** : Planification et suivi des semis, plantations, récoltes
- **Espèces** : Référentiel de plantes avec caractéristiques agronomiques
- **Planches** : Gestion des parcelles et surfaces cultivables
- **Récoltes** : Saisie rapide et statistiques de production

## Commandes utiles

```bash
# Démarrer
docker compose up -d

# Arrêter
docker compose down

# Voir les logs
docker compose logs -f app

# Réinitialiser la base de données
docker compose down -v
docker compose up -d
```

## Développement local

```bash
# Prérequis : Node.js 20+, PostgreSQL

# Installer les dépendances
npm install

# Configurer la base de données
cp .env.example .env
# Éditer .env avec vos paramètres

# Créer les tables et données initiales
npx prisma db push
npm run db:seed

# Lancer en développement
npm run dev
```

## Stack technique

- **Frontend** : Next.js 16, React 19, TailwindCSS, shadcn/ui
- **Backend** : Next.js API Routes, Prisma ORM
- **Base de données** : PostgreSQL 16
- **Conteneurisation** : Docker, Docker Compose

## Licence

MIT
