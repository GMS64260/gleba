# Architecture — Gleba

> Généré le 2026-03-12 | Type: Monolith Full-Stack Web Application

## Executive Summary

Gleba est un ERP open source (AGPL-3.0) de gestion de micro-fermes diversifiées. L'application couvre le maraîchage, le verger, l'élevage et la comptabilité dans un monolithe Next.js full-stack déployé via Docker avec un reverse proxy Caddy.

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Langage | TypeScript (strict) | 5.9.3 |
| UI | React + Radix UI + TailwindCSS | 18 / Multiple / 3.4.1 |
| Design System | Shadcn/UI (composants headless) | — |
| Tables | TanStack React Table | 8.21.3 |
| Graphiques | Recharts | 3.7.0 |
| Cartographie | Leaflet + React-Leaflet | 1.9.4 / 4.2.1 |
| Formulaires | React Hook Form + Zod | 7.71.1 / 4.3.6 |
| ORM | Prisma | 5.22.0 |
| BDD | PostgreSQL (PostGIS) | 16 |
| Auth | NextAuth v5 (Auth.js) | 5.0.0-beta.30 |
| IA | Ollama | 0.6.3 |
| Email | Nodemailer | 8.0.1 |
| Build | Docker multi-stage | Node 20 Alpine |
| Reverse Proxy | Caddy | — |

## Pattern architectural

### Monolithe Full-Stack avec App Router

```
┌─────────────────────────────────────────────────────┐
│                    CADDY (HTTPS)                     │
│                  https://gleba.fr                     │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│              NEXT.JS APP (Port 3000)                 │
│                                                       │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │   PAGES (SSR)     │  │    API ROUTES (70+)      │  │
│  │   App Router      │  │    /api/*                 │  │
│  │   src/app/        │  │    src/app/api/           │  │
│  └────────┬─────────┘  └───────────┬──────────────┘  │
│           │                         │                  │
│  ┌────────▼─────────┐  ┌──────────▼──────────────┐  │
│  │   COMPONENTS      │  │    MIDDLEWARE             │  │
│  │   95 composants   │  │    Auth + Route guard     │  │
│  │   src/components/ │  │    src/middleware.ts       │  │
│  └──────────────────┘  └──────────────────────────┘  │
│           │                         │                  │
│  ┌────────▼─────────────────────────▼────────────┐   │
│  │              LIB (Business Logic)              │   │
│  │  auth.ts │ auto-compta.ts │ validations/ (Zod) │   │
│  │  planification.ts │ irrigation-scheduler.ts     │   │
│  │  meteo.ts │ lunar.ts │ soil-quality.ts          │   │
│  └────────────────────────┬──────────────────────┘   │
│                            │                          │
│  ┌─────────────────────────▼─────────────────────┐   │
│  │              PRISMA ORM                        │   │
│  │  51 modèles │ Multi-tenancy par userId         │   │
│  └─────────────────────────┬─────────────────────┘   │
└────────────────────────────┼─────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────┐
│         POSTGRESQL 16 (PostGIS 3.4)                   │
│         51 tables │ 180+ indexes │ GeoJSON support     │
└──────────────────────────────────────────────────────┘
```

### Flux de requête typique

1. **Client** → Caddy (HTTPS terminaison)
2. Caddy → Next.js (:3000)
3. `middleware.ts` → Vérifie auth JWT → Redirige si non connecté
4. **Page** (SSR) → Rendu composants React côté serveur
5. **Client** (hydration) → Fetch vers API routes
6. **API route** → `requireAuthApi()` → Validation Zod → Prisma → Réponse JSON

## Modules fonctionnels

### 1. Potager (Maraîchage)
- Gestion des espèces, variétés, ITPs (itinéraires techniques)
- Cultures (cycle complet : semis → plantation → récolte)
- Planches avec positionnement 2D et rotation culturale
- Planification annuelle avec calendrier Gantt
- Associations de plantes (compagnonnage)
- Irrigation automatique (bilan hydrique, météo)
- Stocks de semences et plants per-user

### 2. Verger
- Arbres fruitiers, forestiers, haies avec positionnement
- Opérations (taille, greffe, traitement, fertilisation)
- Récoltes de fruits + production de bois (BRF, chauffage)
- Zones de verger (exposition, altitude, sol)
- Pollinisation (matrice de compatibilité)
- Observations sanitaires (registre phytosanitaire réglementaire)
- Calendrier de soins auto-généré par espèce

### 3. Élevage
- Animaux individuels + lots (troupeaux)
- Généalogie (3 générations)
- Production d'oeufs (journalière)
- Soins vétérinaires (vaccination, vermifuge)
- Alimentation (stocks, consommation par lot)
- Ventes de produits + abattages
- Naissances et reproduction
- Dashboard avec statistiques et alertes

### 4. Comptabilité
- Revenus et dépenses unifiés (agrégation tous modules)
- Auto-comptabilité (ventes → écritures automatiques)
- Factures avec numérotation légale (F-YYYY-NNNN)
- Clients et fournisseurs
- Déclarations TVA (5.5%, 10%, 20%)
- Coûts de production par culture
- Rapports et statistiques

### 5. Jardin (Plan 2D)
- Éditeur SVG interactif (planches, objets, arbres)
- Carte cadastrale Leaflet (IGN, OSM, satellite)
- Parcelles géoréférencées (GeoJSON)
- Recherche cadastrale par commune/section/numéro

### 6. Transversal
- Calendrier unifié (tous événements)
- Tâches à faire (agrégation tous modules)
- Interventions terrain (traçabilité phytosanitaire)
- Météo (Open-Meteo, stations personnelles)
- Calendrier lunaire
- Qualité du sol (SoilGrids, analyses labo)
- Assistant IA (Ollama, 39 outils MCP)

## Architecture des données

### Multi-tenancy
Chaque modèle métier possède un champ `userId` lié à `User`. Les requêtes Prisma filtrent systématiquement par `userId: session.user.id`.

### Référentiels vs données utilisateur
- **Globaux** : Espece, Variete, ITP, Famille, Fournisseur, EspeceAnimale, Aliment, Fertilisant
- **Per-user** : Culture, Recolte, Planche, Arbre, Animal, Facture, etc.
- **Stocks per-user** : Tables `UserStock*` (clé composite userId + referenceId)

### Auto-comptabilité
Le module `auto-compta.ts` intercepte les ventes (récoltes, produits élevage, bois, abattages) et crée automatiquement des `VenteManuelle` avec `auto=true, sourceType, sourceId`. Les suppressions nettoient les écritures associées.

### Relations clés (voir data-models.md pour le détail complet)
- User → Planche → Culture → Recolte
- Espece → Variete, ITP → RotationDetail → Rotation → Planche
- Arbre → RecolteArbre, OperationArbre, ProductionBois, ObservationSante
- Animal → SoinAnimal, ProductionOeuf, Abattage (+ LotAnimaux)
- Client → Facture → LigneFacture
- VenteManuelle/DepenseManuelle ← auto-compta

## Authentification & sécurité

### NextAuth v5 (Auth.js)
- **Provider** : Credentials (email + bcrypt password)
- **Session** : JWT (pas de session BDD)
- **Adapter** : PrismaAdapter
- **Vérification email** : Token unique + expiration + Nodemailer

### Middleware de protection
- Routes publiques : `/login`, `/register`, `/robots.txt`, `/sitemap.xml`
- API publiques : `/api/auth/*`, `/api/mcp/*` (bearer token)
- Routes admin : `/admin/*` → vérifie `role === "ADMIN"`
- Toutes les autres routes : redirigent vers `/login` si non connecté

### Rôles
| Rôle | Accès |
|------|-------|
| USER | Toutes les fonctionnalités sauf admin |
| ADMIN | Administration + gestion référentiels globaux |

## APIs externes intégrées

| Service | Usage | Fichier |
|---------|-------|---------|
| Open-Meteo | Prévisions météo | `src/lib/meteo.ts` |
| Hub'Eau | Données hydrologiques | `src/lib/hubeau.ts` |
| SoilGrids | Données pédologiques | `src/lib/soilgrids.ts` |
| IGN Géoportail | Couches carte (satellite, cadastre) | `src/components/carte/` |
| API Cadastre | Recherche parcellaire | `src/app/api/carte/cadastre/` |
| Ollama | Chat IA assistant | `src/lib/ollama.ts` |

## Performance et cache

- **Next.js standalone** : Build optimisé pour Docker (pas de node_modules en prod)
- **Cache météo** : Table `MeteoCache` en BDD (évite les appels répétés à Open-Meteo)
- **Cache irrigation** : Mémoire applicative (`irrigation-cache.ts`)
- **Assets immutables** : `cache-control: s-maxage=31536000, immutable` sur les assets Next.js
- **Rate limiting** : `rate-limit.ts` sur les API sensibles
