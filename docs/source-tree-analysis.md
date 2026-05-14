# Source Tree Analysis — Gleba

> Généré le 2026-03-12 | Monolith Next.js 16 | ~180 fichiers source

## Arbre annoté

```
gleba/
├── .env.example                    # Variables d'environnement (template)
├── CLAUDE.md                       # Instructions Claude Code (procédures deploy)
├── README.md                       # Présentation du projet
├── COPYRIGHT.md                    # Licence AGPL-3.0
├── PLAN_METEO.md                   # Plan d'implémentation module météo
├── PROMPT_AI_ENRICHMENT.md         # Instructions enrichissement IA données CSV
│
├── ★ package.json                  # ENTRY: dépendances et scripts npm
├── ★ next.config.mjs               # ENTRY: config Next.js (standalone, Docker)
├── tsconfig.json                   # Config TypeScript (strict, paths @/*)
├── tailwind.config.ts              # Config TailwindCSS + design tokens custom
├── postcss.config.mjs              # Config PostCSS
├── .eslintrc.json                  # Config ESLint
├── components.json                 # Config Shadcn/UI
│
├── ★ Dockerfile                    # ENTRY: Build production multi-stage (Node 20 Alpine)
├── Dockerfile.dev                  # Build dev (hot reload)
├── ★ docker-compose.yml            # ENTRY: Services app + PostgreSQL (PostGIS)
├── docker-entrypoint.sh            # Script démarrage (migrations + seed + start)
├── .dockerignore                   # Exclusions Docker
│
├── deploy-docker-pi.sh             # Déploiement Raspberry Pi (Docker)
├── deploy-docker-pi-prebuild.sh    # Déploiement Pi (pré-build)
├── deploy-pi.sh                    # Déploiement Pi (natif)
├── gleba-pi.service                # Service systemd
│
├── og-preview-template.html        # Template image Open Graph
│
├── ★ associations_enriched_v2_2026.json  # Données associations plantes (référentiel)
├── ★ especes_enriched.csv                # Données espèces enrichies IA (135+)
├── ★ itps_enriched.csv                   # ITPs enrichis IA
├── ★ varietes_enriched.csv               # Variétés enrichies IA
├── gleba_demo_data.json                  # Données démo complètes
├── nouvelles_rotations_2026.json         # Données rotations
│
├── prisma/                         # ═══ SCHÉMA BDD & MIGRATIONS ═══
│   ├── ★ schema.prisma             # ENTRY: 51 modèles Prisma (tout le schéma)
│   ├── migrations/
│   │   ├── 20250129000000_add_auth/        # Auth + schéma noyau
│   │   ├── 20250129000001_add_arbres/      # Module verger
│   │   ├── 20260308000000_add_login_logs/  # Logs de connexion
│   │   └── 20260308100000_add_email_verification/  # Vérification email
│   ├── seed.ts                     # Seed principal (espèces, ITPs, variétés, associations)
│   ├── seed-data.ts                # Données de seed structurées
│   ├── seed-demo.ts                # Données démo utilisateur
│   ├── seed-demo-enriched.sql      # Données démo enrichies SQL
│   ├── seed-arbres-reference.ts    # Référentiel espèces arbres
│   ├── seed-varietes-fruitiers.ts  # Variétés fruitières
│   ├── seed-varietes-arbres.sql    # Variétés arbres SQL
│   ├── import-potaleger.ts         # Import depuis Potaléger (migration historique)
│   ├── migrate-stocks-to-users.ts  # Migration stocks multi-tenancy
│   └── migration-planche-cuid.sql  # Migration planches vers CUID
│
├── scripts/                        # ═══ SCRIPTS UTILITAIRES ═══
│   ├── migrate-data-v1.ts          # Migration données v1.0.0
│   ├── import-enriched-csv.ts      # Import CSV enrichis → BDD
│   ├── import-inrae-data.ts        # Import données INRAE
│   ├── export-for-ai-enrichment.ts # Export pour enrichissement IA
│   ├── enrich-verger-data.sql      # Enrichissement données verger SQL
│   ├── generate-irrigations-planifiees.ts  # Génération planning irrigation
│   ├── check-enriched-data.ts      # Vérification données enrichies
│   ├── check-irrigations.ts        # Vérification irrigations
│   ├── fix-demo-data-constraints.ts # Fix contraintes données démo
│   ├── test-calendrier-api.ts      # Test API calendrier
│   └── update-irrigation-2026.ts   # MAJ irrigations 2026
│
├── public/                         # ═══ ASSETS STATIQUES ═══
│   ├── gleba-logo.png              # Logo principal
│   ├── favicon.ico, apple-icon.png # Icônes
│   ├── icon-192.png, icon-512.png  # Icônes PWA
│   ├── og-image.png                # Image Open Graph
│   └── manifest.json               # Manifest PWA
│
├── mcp-server/                     # ═══ SERVEUR MCP (IA companion) ═══
│   ├── package.json                # Dépendances séparées
│   ├── tsconfig.json
│   ├── src/                        # 39 outils MCP (Jardin, Verger, Élevage, Compta)
│   ├── dist/                       # Build compilé
│   └── README.md                   # Documentation 39 outils
│
├── src/                            # ═══ CODE SOURCE PRINCIPAL ═══
│   │
│   ├── ★ app/                      # ═══ PAGES & API ROUTES (App Router) ═══
│   │   ├── ★ layout.tsx            # ENTRY: Layout racine (fonts, SessionProvider, Toaster, SEO)
│   │   ├── ★ page.tsx              # ENTRY: Page d'accueil / Dashboard
│   │   ├── globals.css             # Variables CSS design system
│   │   ├── error.tsx               # Page d'erreur globale
│   │   ├── robots.ts               # robots.txt dynamique
│   │   ├── sitemap.ts              # sitemap.xml dynamique
│   │   ├── favicon.ico
│   │   ├── fonts/                  # Polices locales
│   │   │
│   │   ├── (auth)/                 # ── Route group auth (layout minimal) ──
│   │   │   ├── layout.tsx          # Layout auth (centré, sans nav)
│   │   │   ├── login/page.tsx      # Page de connexion
│   │   │   └── register/page.tsx   # Page d'inscription
│   │   │
│   │   ├── admin/                  # ── Administration ──
│   │   │   ├── page.tsx            # Dashboard admin
│   │   │   └── referentiels/page.tsx # Gestion référentiels globaux
│   │   │
│   │   ├── jardin/                 # ── Module Jardin ──
│   │   │   ├── page.tsx            # Plan 2D interactif SVG (éditeur)
│   │   │   └── carte/page.tsx      # Carte cadastrale Leaflet
│   │   │
│   │   ├── cultures/               # ── Cultures ──
│   │   │   ├── page.tsx            # Liste des cultures
│   │   │   ├── new/page.tsx        # Création culture
│   │   │   ├── [id]/page.tsx       # Détail culture
│   │   │   └── irriguer/page.tsx   # Planning irrigation
│   │   │
│   │   ├── recoltes/               # ── Récoltes ──
│   │   │   ├── page.tsx            # Liste des récoltes
│   │   │   ├── saisie/page.tsx     # Saisie rapide récolte
│   │   │   └── [id]/page.tsx       # Détail récolte
│   │   │
│   │   ├── planches/               # ── Planches ──
│   │   │   ├── page.tsx            # Liste des planches
│   │   │   ├── new/page.tsx        # Création planche
│   │   │   └── [id]/page.tsx       # Détail planche (historique, rotation, sol)
│   │   │
│   │   ├── especes/                # ── Référentiel espèces ──
│   │   │   ├── page.tsx            # Liste espèces
│   │   │   ├── new/page.tsx        # Création espèce
│   │   │   └── [id]/page.tsx       # Détail espèce
│   │   │
│   │   ├── itps/                   # ── Itinéraires Techniques ──
│   │   │   ├── page.tsx            # Liste ITPs (Gantt)
│   │   │   ├── new/page.tsx        # Création ITP
│   │   │   ├── [id]/page.tsx       # Détail ITP
│   │   │   └── calendrier/page.tsx # Calendrier ITPs
│   │   │
│   │   ├── rotations/              # ── Rotations ──
│   │   │   ├── page.tsx            # Liste rotations
│   │   │   ├── new/page.tsx        # Création rotation
│   │   │   └── [id]/page.tsx       # Détail rotation
│   │   │
│   │   ├── associations/           # ── Associations de plantes ──
│   │   │   ├── page.tsx            # Liste associations
│   │   │   ├── new/page.tsx        # Création association
│   │   │   └── [id]/page.tsx       # Détail association
│   │   │
│   │   ├── planification/          # ── Planification ──
│   │   │   ├── cultures-prevues/   # Cultures planifiées (par-ilots, par-planches)
│   │   │   ├── creer-cultures/     # Création batch cultures
│   │   │   ├── recoltes-prevues/   # Récoltes prévues (par-semaines)
│   │   │   ├── semences/           # Gestion semences
│   │   │   ├── plants/             # Gestion plants
│   │   │   └── associations/       # Associations dans planification
│   │   │
│   │   ├── arbres/                 # ── Module Verger ──
│   │   │   └── page.tsx            # Hub verger (onglets: Arbres, Opérations, Productions, Santé, Calendrier, Planification, Référentiel)
│   │   │
│   │   ├── elevage/                # ── Module Élevage ──
│   │   │   ├── page.tsx            # Hub élevage (onglets: Dashboard, Animaux, Alimentation, Production, Reproduction, Calendrier, Espèces)
│   │   │   └── animaux/[id]/page.tsx # Détail animal (généalogie)
│   │   │
│   │   ├── comptabilite/           # ── Module Comptabilité ──
│   │   │   ├── page.tsx            # Dashboard comptabilité
│   │   │   ├── transactions/       # Revenus + Dépenses unifiés
│   │   │   ├── factures/           # Gestion factures
│   │   │   ├── clients/            # Gestion clients
│   │   │   ├── fournisseurs/       # Gestion fournisseurs
│   │   │   ├── stocks/             # Stocks comptables
│   │   │   ├── rapports/           # Rapports (CA, TVA, marges)
│   │   │   └── couts-production/   # Coûts de production
│   │   │
│   │   ├── interventions/          # ── Interventions terrain ──
│   │   │   └── page.tsx            # Liste interventions (traçabilité phyto)
│   │   │
│   │   ├── tracabilite/            # ── Traçabilité ──
│   │   │   └── page.tsx            # Registre réglementaire
│   │   │
│   │   ├── stocks/page.tsx         # Gestion stocks globale
│   │   ├── taches/page.tsx         # Tâches à faire (tous modules)
│   │   ├── parametres/page.tsx     # Paramètres utilisateur
│   │   │
│   │   └── api/                    # ── API ROUTES (70+ endpoints) ──
│   │       ├── auth/               # NextAuth + register + verify
│   │       ├── admin/              # Logs, métriques, référentiels
│   │       ├── cultures/           # CRUD cultures + irrigation
│   │       ├── recoltes/           # CRUD récoltes + vente auto
│   │       ├── arbres/             # Arbres, récoltes, bois, opérations, zones, observations, pollinisation
│   │       ├── elevage/            # Animaux, lots, soins, oeufs, ventes, abattages, naissances, aliments
│   │       ├── comptabilite/       # Clients, factures, revenus, dépenses, ventes/dépenses manuelles, TVA, stats
│   │       ├── jardin/             # Données plan 2D
│   │       ├── objets-jardin/      # CRUD objets jardin
│   │       ├── carte/              # Parcelles géo, cadastre, communes, satellite
│   │       ├── calendrier/         # Événements calendrier
│   │       ├── taches/             # Tâches à faire
│   │       ├── interventions/      # CRUD interventions
│   │       ├── tracabilite/        # Registre traçabilité
│   │       ├── meteo/              # Cache météo Open-Meteo
│   │       ├── lunaire/            # Calendrier lunaire
│   │       ├── sol/                # Données pédologiques SoilGrids
│   │       ├── irrigations/        # Génération planning irrigation
│   │       ├── chat/               # Conversations IA (Ollama)
│   │       ├── varietes/           # CRUD variétés
│   │       ├── especes/            # CRUD espèces (pour pages especes/)
│   │       ├── associations/       # CRUD associations
│   │       ├── consommations/      # CRUD consommations
│   │       ├── planches/           # CRUD planches + historique + rotation-advice
│   │       ├── rotations/          # CRUD rotations
│   │       ├── itps/               # CRUD ITPs
│   │       ├── stocks/             # Stocks multi-tenancy
│   │       ├── familles/           # Familles botaniques
│   │       ├── fournisseurs/       # Fournisseurs
│   │       └── dashboard/          # Données dashboard
│   │
│   ├── components/                 # ═══ COMPOSANTS REACT (95 fichiers) ═══
│   │   ├── ui/                     # Design system (Shadcn/UI + Radix UI) — 28 composants
│   │   ├── admin/                  # Administration — 3 composants
│   │   ├── auth/                   # Authentification — 4 composants
│   │   ├── assistant/              # Wizard création culture — 6 composants
│   │   ├── dashboard/              # Calendriers et événements — 4 composants
│   │   ├── potager/                # Module potager — 5 composants
│   │   ├── verger/                 # Module verger — 9 composants
│   │   ├── elevage/                # Module élevage — 8 composants
│   │   ├── carte/                  # Carte Leaflet + cadastre — 9 composants
│   │   ├── meteo/                  # Météo et irrigation — 5 composants
│   │   ├── lunaire/                # Calendrier lunaire — 1 composant
│   │   ├── chat/                   # Chat IA — 2 composants
│   │   ├── itps/                   # Gantt ITPs — 2 composants
│   │   ├── planches/               # Édition inline planches — 3 composants
│   │   ├── planche/                # Détail planche — 3 composants
│   │   ├── tables/                 # DataTable générique — 1 composant
│   │   ├── stocks/                 # Consommations — 1 composant
│   │   ├── garden/                 # Création culture jardin — 1 composant
│   │   ├── onboarding/             # Bienvenue — 1 composant
│   │   └── Footer.tsx              # Footer global
│   │
│   ├── lib/                        # ═══ BIBLIOTHÈQUES & UTILITAIRES ═══
│   │   ├── ★ auth.ts               # ENTRY: Config NextAuth v5 (Credentials + JWT)
│   │   ├── ★ prisma.ts             # ENTRY: Singleton client Prisma
│   │   ├── utils.ts                # Utilitaires (cn, formatDate, etc.)
│   │   ├── auth-utils.ts           # Helpers auth (requireAuth, requireAdmin)
│   │   ├── auto-compta.ts          # Auto-comptabilité (ventes → écritures)
│   │   ├── facture-utils.ts        # Génération factures (numérotation, calculs TVA)
│   │   ├── planification.ts        # Logique planification cultures
│   │   ├── assistant-helpers.ts    # Helpers assistant de création
│   │   ├── planche-validation.ts   # Validation planches (occupation)
│   │   ├── soil-quality.ts         # Score qualité sol (calcul composite)
│   │   ├── stocks-helpers.ts       # Helpers gestion stocks
│   │   ├── categories-emojis.ts    # Mapping catégories → emojis
│   │   ├── user-sample-data.ts     # Données exemple utilisateur
│   │   ├── rate-limit.ts           # Rate limiting API
│   │   ├── ollama.ts               # Client Ollama (chat IA)
│   │   ├── meteo.ts                # Client météo Open-Meteo
│   │   ├── meteo-agro.ts           # Calculs agro-météo (ET0, bilan hydrique)
│   │   ├── hubeau.ts               # Client API Hub'Eau (hydrologie)
│   │   ├── soilgrids.ts            # Client SoilGrids (pédologie)
│   │   ├── lunar.ts                # Calculs calendrier lunaire
│   │   ├── mail.ts                 # Envoi emails (Nodemailer)
│   │   ├── irrigation-scheduler.ts # Planificateur irrigation automatique
│   │   ├── irrigation-cache.ts     # Cache irrigation
│   │   ├── tree-care-calendar.ts   # Générateur calendrier soins arbres
│   │   │
│   │   ├── validations/            # Schémas Zod (22 fichiers)
│   │   │   ├── index.ts            # Barrel export
│   │   │   ├── culture.ts, recolte.ts, planche.ts, espece.ts, variete.ts, itp.ts
│   │   │   ├── rotation.ts, association.ts, consommation-aliment.ts
│   │   │   ├── elevage-animal.ts, elevage-lot.ts, elevage-soin.ts
│   │   │   ├── elevage-vente.ts, elevage-abattage.ts, elevage-production-oeufs.ts
│   │   │   ├── elevage-naissance.ts, intervention.ts, client.ts
│   │   │   ├── depense-manuelle.ts, vente-manuelle.ts
│   │   │   └── date-validation.ts
│   │   │
│   │   ├── rotation/               # Logique rotation culturale
│   │   │   ├── index.ts            # Calcul conseil rotation
│   │   │   └── types.ts            # Types rotation
│   │   │
│   │   └── chat/                   # Outils chat IA (MCP-like)
│   │       ├── tools.ts            # Définition outils jardin (14)
│   │       ├── tools-verger.ts     # Outils verger (7)
│   │       ├── tools-elevage.ts    # Outils élevage (9)
│   │       ├── tools-compta.ts     # Outils comptabilité (9)
│   │       ├── tool-executor.ts    # Exécuteur d'outils
│   │       ├── executor-verger.ts  # Exécuteur verger
│   │       ├── executor-elevage.ts # Exécuteur élevage
│   │       ├── executor-compta.ts  # Exécuteur comptabilité
│   │       └── system-prompt.ts    # Prompt système assistant IA
│   │
│   ├── hooks/                      # ═══ HOOKS REACT ═══
│   │   └── use-settings.ts         # Hook paramètres utilisateur
│   │
│   └── types/                      # ═══ TYPES ═══
│       └── leaflet-draw.d.ts       # Déclarations types Leaflet Draw
```

## Répertoires critiques

| Répertoire | Rôle | Importance |
|-----------|------|-----------|
| `src/app/` | Pages et API routes (App Router) | Toute la logique applicative |
| `src/components/` | 95 composants React | Toute l'interface utilisateur |
| `src/lib/` | Logique métier, auth, API clients externes | Coeur de l'application |
| `src/lib/validations/` | 22 schémas Zod | Validation de toutes les entrées |
| `src/lib/chat/` | Outils IA (39 outils) | Intégration assistant Ollama |
| `prisma/` | Schéma BDD (51 modèles) + migrations + seeds | Fondation données |
| `public/` | Assets statiques (logo, icônes PWA) | PWA manifest |

## Points d'entrée

| Fichier | Rôle |
|---------|------|
| `src/app/layout.tsx` | Layout racine (fonts, auth, toaster, SEO, JSON-LD) |
| `src/app/page.tsx` | Dashboard principal |
| `src/lib/auth.ts` | Configuration NextAuth (JWT, Credentials) |
| `src/lib/prisma.ts` | Client Prisma singleton |
| `src/middleware.ts` | Protection des routes (auth middleware) |
| `docker-entrypoint.sh` | Bootstrap container (migrate → seed → start) |
| `prisma/schema.prisma` | Schéma base de données complet |

## Patterns de state management

- **Pas de state manager global** (Redux, Zustand, etc.)
- **Server-side** : Les pages App Router font des requêtes API côté serveur
- **Client-side** : `useState`/`useEffect` dans les composants, `fetch` vers les API routes
- **Session** : `NextAuth` via `SessionProvider` + JWT
- **Paramètres** : Hook custom `use-settings.ts` (lecture/écriture via API `/api/parametres`)
- **Cache** : Cache météo en BDD (`MeteoCache`), cache irrigation en mémoire
