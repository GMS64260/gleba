# Development Guide — Gleba

> Généré le 2026-03-12

## Prérequis

| Outil | Version | Usage |
|-------|---------|-------|
| Node.js | 20+ | Runtime |
| npm | 10+ | Package manager |
| Docker | 24+ | Conteneurisation |
| Docker Compose | v2+ | Orchestration services |
| PostgreSQL | 16 (PostGIS) | Base de données (via Docker) |

## Installation rapide

```bash
# 1. Cloner le repo
git clone <repo-url> gleba && cd gleba

# 2. Installer les dépendances
npm ci --legacy-peer-deps

# 3. Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs (DATABASE_URL, NEXTAUTH_SECRET, etc.)

# 4. Lancer PostgreSQL via Docker
docker compose up -d db

# 5. Générer le client Prisma + pousser le schéma
npx prisma generate
npx prisma db push

# 6. Seed de la base
npx tsx prisma/seed.ts

# 7. Lancer en dev
npm run dev
# → http://localhost:3000
```

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://gleba:gleba@localhost:5433/gleba` |
| `NEXTAUTH_SECRET` | Secret JWT | (à générer) |
| `NEXTAUTH_URL` | URL de l'app | `http://localhost:3000` |
| `AUTH_TRUST_HOST` | Trust proxy | `true` |
| `ADMIN_EMAIL` | Email admin initial | `admin@gleba.local` |
| `ADMIN_PASSWORD` | Mot de passe admin | `changeme` |
| `OLLAMA_API_KEY` | Clé API Ollama (chat IA) | (optionnel) |
| `OLLAMA_MODEL` | Modèle Ollama | `nemotron-3-nano:30b` |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Configuration email | (optionnel) |

## Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur dev avec hot reload |
| `npm run build` | Build production (`prisma generate && next build`) |
| `npm run start` | Démarrer le serveur production |
| `npm run lint` | Linter ESLint |
| `npm run db:generate` | Générer client Prisma |
| `npm run db:migrate` | Lancer migrations Prisma |
| `npm run db:push` | Push schéma sans migration |
| `npm run db:seed` | Seed base de données |
| `npm run db:studio` | Prisma Studio (GUI BDD) |
| `npm run db:reset` | Reset complet BDD |
| `npm run db:seed-admin` | Créer compte admin |

## Base de données

### Accès direct PostgreSQL
```bash
docker compose exec postgres psql -U gleba -d gleba
```

### Migrations
```bash
# Créer une migration
npx prisma migrate dev --name ma_migration

# Appliquer en production
npx prisma migrate deploy

# Réinitialiser (DESTRUCTIF)
npx prisma migrate reset --force
```

### Seeds
Le seed principal (`prisma/seed.ts`) charge :
- Familles botaniques (référentiel)
- Espèces (135+ depuis CSV enrichis)
- ITPs (itinéraires techniques depuis CSV)
- Variétés (depuis CSV enrichis)
- Associations de plantes (depuis JSON)
- Espèces animales de référence
- Aliments de référence
- Destinations de consommation
- Fertilisants

## Architecture du code

### Conventions de nommage
- **Pages** : `src/app/<module>/page.tsx` (App Router)
- **API Routes** : `src/app/api/<module>/route.ts` (GET/POST/PUT/PATCH/DELETE exports)
- **Composants** : `src/components/<domaine>/<Composant>.tsx` (PascalCase)
- **Lib** : `src/lib/<utilitaire>.ts` (camelCase)
- **Validations** : `src/lib/validations/<schema>.ts` (Zod schemas)
- **Types** : Inline dans les fichiers, pas de fichier types séparé (sauf leaflet-draw.d.ts)

### Patterns de code
- **API routes** : `auth()` pour session → validation Zod → logique Prisma → réponse JSON
- **Auth helper** : `requireAuthApi()` throw si non connecté, retourne session
- **Composants** : Client components avec `"use client"`, fetch API via `useEffect`
- **Tables** : `DataTable` générique avec TanStack Table (tri, filtres, pagination)
- **Formulaires** : React Hook Form + Zod resolvers
- **Édition inline** : `InlineEditField` pour les cellules éditables
- **Auto-comptabilité** : Les ventes créent automatiquement des écritures via `auto-compta.ts`

### Path aliases
```typescript
// tsconfig.json
"@/*": ["./src/*"]
// Usage: import { auth } from "@/lib/auth"
```

## Tests

> **Note** : Pas de tests automatisés dans le projet actuellement. Pas de framework de test configuré.

Scripts de vérification manuels disponibles dans `scripts/` :
- `check-enriched-data.ts` — Vérifie la cohérence des données enrichies
- `check-irrigations.ts` — Vérifie le planning irrigation
- `test-calendrier-api.ts` — Test manuel de l'API calendrier

## Workflow de développement local

1. Modifier les fichiers dans `src/`
2. Le hot reload Next.js applique les changements automatiquement
3. Pour les changements de schéma BDD :
   ```bash
   # Modifier prisma/schema.prisma
   npx prisma db push    # Dev rapide (pas de migration)
   npx prisma generate   # Regénérer le client
   ```
4. Pour ajouter un composant UI (Shadcn) :
   ```bash
   npx shadcn@latest add <composant>
   ```

## Conventions spécifiques Gleba

- **Multi-tenancy** : Toujours filtrer par `userId` dans les requêtes Prisma
- **Référentiels globaux** : Espèces, Variétés, ITPs, Familles sont partagés entre utilisateurs
- **Stocks per-user** : Tables `UserStock*` pour les stocks spécifiques à chaque utilisateur
- **Soft deletes** : Factures et clients ne sont jamais supprimés, seulement marqués annulé/inactif
- **Auto-compta** : Utiliser `createAutoRevenu()` / `createAutoDepense()` pour les écritures automatiques
- **Dates** : `date-fns` pour la manipulation, format FR par défaut
- **Validation** : Toujours valider avec Zod côté API avant toute opération Prisma
