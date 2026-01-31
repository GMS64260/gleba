# Gleba

🌱 **Logiciel gratuit et open source de gestion de potager et verger** 🌳

[![Licence AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)

---

## © Licence et Copyright

**Copyright © 2024-2026 GMS64260 (Gleba Project)**

Ce logiciel est distribué sous **licence AGPL-3.0** (GNU Affero General Public License).


**Repository :** https://github.com/GMS64260/gleba

---

## Origine du nom

**Gleba** vient du latin *glēba* qui signifie « motte de terre », « sol cultivé » ou « terrain agricole ». Ce terme a donné naissance au français « glèbe », désignant historiquement la terre cultivée, le sol nourricier auquel le paysan était attaché.

En choisissant ce nom, nous avons voulu rendre hommage à cette connexion ancestrale entre l'homme et la terre qu'il cultive. La *gleba* représente non seulement le support physique de nos cultures, mais aussi tout le savoir-faire transmis de génération en génération pour faire fructifier ce précieux patrimoine.

> *« Celui qui cultive sa glèbe avec soin récoltera l'abondance. »*

---

## Inspiration

Ce projet s'inspire directement de [**Potaléger**](https://github.com/marcpley/potaleger), une application Qt développée par **Marc Pley** pour la gestion maraîchère.

Potaléger a posé les bases d'une gestion complète du potager : planches de culture, rotations, itinéraires techniques (ITP), suivi des semis et récoltes. Gleba reprend ces concepts éprouvés en les adaptant à une architecture web moderne, accessible depuis n'importe quel appareil.

Merci à Marc Pley pour son travail et sa vision qui ont rendu ce projet possible.

---

## Fonctionnalités

### Gestion du jardin
- **Plan du jardin** : Visualisation 2D des planches, allées et arbres
- **Planches** : Création et gestion des parcelles avec dimensions et positions
- **Arbres fruitiers** : Suivi des arbres et arbustes

### Planification
- **Cultures prévues** : Visualisation par espèce, îlot ou planche
- **Récoltes prévues** : Estimation par mois ou semaine
- **Rotations** : Plans de rotation pluriannuels
- **ITPs** : Itinéraires techniques des plantes (semis, plantation, récolte)
- **Semences et plants** : Calcul des besoins

### Suivi
- **Cultures** : Suivi des semis, plantations et récoltes
- **Récoltes** : Saisie des quantités récoltées
- **Tableau de bord** : Statistiques et graphiques avec filtre par année

### Référentiels
- **Espèces** : Catalogue de plantes avec caractéristiques agronomiques
- **Variétés** : Cultivars avec informations semencières
- **Familles botaniques** : Pour la gestion des rotations
- **Fournisseurs** : Annuaire des semenciers

---

## Installation rapide (Docker)

```bash
# Cloner le projet
git clone https://github.com/GMS64260/gleba.git
cd gleba

# Lancer l'application
docker compose up -d
```

L'application sera accessible sur **http://localhost:3000**

### Premier lancement

À la première connexion, vous pouvez importer un **jeu de données de démonstration** complet couvrant 2023-2024 : planches, cultures, récoltes, arbres fruitiers et rotations.

---

## Configuration

Créer un fichier `.env` à partir de l'exemple :

```bash
cp .env.example .env
```

Variables disponibles :

```env
# Base de données PostgreSQL
DATABASE_URL="postgresql://gleba:gleba@localhost:5432/gleba"
POSTGRES_USER=gleba
POSTGRES_PASSWORD=gleba
POSTGRES_DB=gleba

# NextAuth.js (authentification)
NEXTAUTH_SECRET="votre-secret-genere"  # openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# Application
NODE_ENV=development
```

---

## Commandes utiles

```bash
# Démarrer les conteneurs
docker compose up -d

# Arrêter
docker compose down

# Voir les logs
docker compose logs -f app

# Réinitialiser complètement (supprime les données)
docker compose down -v
docker compose up -d
```

---

## Développement local

### Prérequis
- Node.js 20+
- PostgreSQL 16+

### Installation

```bash
# Installer les dépendances
npm install

# Configurer la base de données
cp .env.example .env
# Éditer .env avec vos paramètres PostgreSQL

# Créer les tables
npx prisma db push

# (Optionnel) Charger les données de test
npx tsx prisma/seed.ts

# Lancer en développement
npm run dev
```

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | Next.js 15, React 19, TailwindCSS |
| UI | shadcn/ui, Recharts, Lucide Icons |
| Backend | Next.js API Routes |
| ORM | Prisma |
| Base de données | PostgreSQL 16 |
| Authentification | NextAuth.js v5 |
| Conteneurisation | Docker, Docker Compose |

---

## Remerciements

- **[Marc Pley](https://github.com/marcpley)** pour [Potaléger](https://github.com/marcpley/potaleger), l'inspiration de ce projet
- La communauté **shadcn/ui** pour les composants React
- Tous les jardiniers qui partagent leur savoir
