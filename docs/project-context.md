---
project_name: gleba
date: '2026-03-13'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: complete
rule_count: 121
optimized_for_llm: true
---

# Project Context for AI Agents

_Ce fichier contient les règles critiques et patterns que les agents IA doivent suivre lors de l'implémentation de code dans ce projet. Focus sur les détails non-évidents que les agents pourraient manquer._

---

## Technology Stack & Versions

| Couche | Technologie | Version | Notes |
|--------|-------------|---------|-------|
| Framework | Next.js (App Router) | 16.1.6 | Output standalone pour Docker |
| Langage | TypeScript | 5.9.3 | strict: true |
| Runtime | Node.js | 20 (Alpine) | Via Docker |
| UI | React | 18 | Client components avec "use client" |
| CSS | TailwindCSS | 3.4.1 | + tailwindcss-animate |
| Design System | Shadcn/UI (Radix UI) | Multiple | Composants headless |
| Tables | TanStack React Table | 8.21.3 | Composant DataTable générique |
| Graphiques | Recharts | 3.7.0 | — |
| Cartographie | Leaflet + React-Leaflet | 1.9.4 / 4.2.1 | + leaflet-draw |
| Formulaires | React Hook Form + Zod | 7.71.1 / 4.3.6 | Validation centralisée |
| ORM | Prisma | 5.22.0 | 51 modèles |
| BDD | PostgreSQL (PostGIS) | 16 | Multi-tenancy par userId |
| Auth | NextAuth v5 (Auth.js) | 5.0.0-beta.30 | JWT + Credentials |
| Email | Nodemailer | 8.0.1 | Vérification email |
| IA | Ollama | 0.6.3 | Chat assistant |
| Maths | mathjs | 15.1.0 | Calculs agricoles |
| Dates | date-fns | 4.1.0 | Format FR par défaut |
| Icônes | Lucide React | 0.563.0 | — |
| Linting | ESLint | 8 | next/core-web-vitals + next/typescript |
| Deploy | Docker multi-stage + Caddy | — | HTTPS automatique |

### Dépendances clés
- **Path alias** : `@/*` → `./src/*`
- **Build** : `prisma generate && next build`
- **Package manager** : npm avec `--legacy-peer-deps`

## Critical Implementation Rules

### Règles TypeScript

#### Configuration
- **strict: true** activé — ne jamais désactiver
- **target: ES2017** — pas de syntaxe plus récente que ES2017 dans le code compilé
- **moduleResolution: bundler** — imports modernes (pas de `.js` dans les chemins d'import)
- **jsx: react-jsx** — pas besoin d'importer React dans chaque fichier

#### Imports / Exports
- Toujours utiliser le path alias `@/` pour les imports internes : `import { auth } from "@/lib/auth"`
- Jamais d'imports relatifs comme `../../lib/` — utiliser `@/lib/`
- Les validations Zod sont exportées depuis `@/lib/validations` (barrel export via `index.ts`)
- Prisma client importé depuis `@/lib/prisma` (singleton)

#### Types
- Types définis **inline** dans les fichiers, pas de dossier `types/` séparé (sauf `leaflet-draw.d.ts`)
- Les types API route params : `type RouteParams = { params: Promise<{ id: string }> }` (Next.js 16 — params sont async)
- Étendre les types NextAuth via `declare module "next-auth"` dans `src/lib/auth.ts`
- Types Zod inférés : `type CultureInput = z.infer<typeof cultureSchema>`

#### Patterns spécifiques
- Les IDs de routes dynamiques sont des `string` dans les params, toujours parser avec `parseInt(id)` et vérifier `isNaN()`
- Les dates acceptent `z.union([z.string(), z.date()])` dans les schémas Zod (le client envoie des strings ISO)
- Utiliser `date-fns` pour toute manipulation de dates (jamais `moment` ou `dayjs`)
- Messages d'erreur et labels UI en **français**

### Règles Next.js (App Router)

#### API Routes
- Pattern systématique : `requireAuthApi()` → validation Zod → logique Prisma → `NextResponse.json()`
- Chaque fichier route exporte les méthodes HTTP en fonctions nommées : `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- Erreurs retournées en JSON : `{ error: "message" }` avec status HTTP approprié
- Logging des erreurs : `console.error('METHOD /api/path error:', error)`
- Les params de route dynamique sont **async** (Next.js 16) : `const { id } = await params`

#### Auth & Multi-tenancy
- `requireAuthApi()` importé depuis `@/lib/auth-utils` — retourne `{ error, session }`
- **CRITIQUE** : Toujours filtrer par `userId: session!.user.id` dans TOUTES les requêtes Prisma métier
- Vérifier existence ET propriété avant update/delete : `findUnique({ where: { id, userId } })`
- Rôles : `USER` (standard) et `ADMIN` (accès admin + référentiels globaux)

#### Composants React
- Tous les composants interactifs marqués `"use client"` en haut du fichier
- Fetch API dans `useEffect` avec pattern : `fetch('/api/...').then(r => r.json()).then(setData)`
- Pas de Server Components pour les pages métier (tout est client-side)
- Composants dans `src/components/<domaine>/<Composant>.tsx` (PascalCase)
- Pages dans `src/app/<module>/page.tsx`

#### Prisma ORM
- Singleton importé depuis `@/lib/prisma`
- Transactions avec `prisma.$transaction()` pour les opérations atomiques (auto-compta)
- Cascades de suppression configurées dans le schema — pas besoin de supprimer manuellement les enfants
- Référentiels globaux (Espece, Variete, ITP, Famille) : pas de filtre userId
- Données utilisateur : toujours filtrer par userId
- Tables `UserStock*` : clé composite userId + referenceId

#### Auto-Comptabilité
- Module `@/lib/auto-compta.ts` : les ventes/dépenses créent automatiquement des écritures
- Écritures auto identifiées par `auto: true, sourceType, sourceId`
- Utiliser `createVenteFrom*()` / `createDepenseFromIntervention()` — jamais créer manuellement
- Suppression de la source → toujours nettoyer les écritures auto avec `deleteAutoEntry()`
- TVA : 5.5% (alimentaire), 10% (bois/services), 20% (matériel/intrants)

### Règles de Tests & Vérification

#### Contexte
- Pas de framework de test automatisé (ni Jest, ni Vitest, ni Playwright)
- Ne PAS introduire de framework de test sans accord explicite du propriétaire
- Scripts de vérification manuels dans `scripts/`

#### Checklist de vérification obligatoire (après toute modification)
1. `npm run build` → 0 erreurs TypeScript (filet de sécurité minimum)
2. `rm -rf .next && docker compose up -d --build app` → build Docker réussi
3. `curl -sk -o /dev/null -w "%{http_code}" https://gleba.fr/login` → 200
4. `docker compose logs app --tail 20` → pas d'erreur runtime
5. Si API modifiée : tester l'endpoint avec `curl` (cas nominal + cas d'erreur)
6. Si schéma Prisma modifié : vérifier migration + `prisma generate`

#### Vérifications critiques de sécurité
- **Multi-tenancy** : vérifier que CHAQUE nouvelle requête Prisma filtre par `userId`
- **Auto-compta** : si la route touche à des ventes/récoltes/abattages, vérifier les écritures auto
- **Zod** : tout nouveau champ Prisma doit être reflété dans le schéma de validation correspondant

### Règles de Qualité & Style

#### Linting / Formatting
- ESLint configuré avec `next/core-web-vitals` + `next/typescript`
- Pas de Prettier — le formatage suit les conventions ESLint par défaut
- Pas de pre-commit hooks (Husky/lint-staged non installés)

#### Organisation des fichiers
- **Pages** : `src/app/<module>/page.tsx` (App Router)
- **API Routes** : `src/app/api/<module>/route.ts` (GET/POST/PUT/PATCH/DELETE)
- **Composants** : `src/components/<domaine>/<Composant>.tsx` (PascalCase)
- **Composants UI** : `src/components/ui/<composant>.tsx` (kebab-case, Shadcn)
- **Lib** : `src/lib/<utilitaire>.ts` (camelCase ou kebab-case)
- **Validations** : `src/lib/validations/<schema>.ts` (barrel export dans index.ts)

#### Conventions de nommage
- **Fichiers composants** : PascalCase (`DataTable.tsx`, `CalendarView.tsx`)
- **Fichiers lib/utils** : camelCase ou kebab-case (`auto-compta.ts`, `soil-quality.ts`)
- **Variables/fonctions** : camelCase
- **Schémas Zod** : camelCase + suffixe `Schema` (`cultureSchema`, `updateCultureSchema`)
- **Types** : PascalCase + suffixe `Input` (`CultureInput`, `CreateCultureInput`)

#### Gestion d'état
- **Pas de state manager global** (ni Redux, ni Zustand, ni Context global) — ne pas en introduire
- État local via `useState` + données fetchées dans `useEffect`
- Pas de Server Components pour les pages métier — tout est client-side avec `"use client"`

#### UI / Design System
- Couleurs : `tech-green` (#10B981), `carbone` (#1E293B), `terre-cuite` (#B45309), `gris-nuage` (#F8FAFC)
- Polices : Inter (body), Space Grotesk (headings), JetBrains Mono (code)
- Dark mode supporté via `darkMode: ["class"]`
- **Merger les classes CSS** avec la fonction utilitaire `cn()` (clsx + tailwind-merge)
- Icônes : exclusivement `lucide-react`

#### Composants à réutiliser (ne pas recréer)
- **`DataTable`** : tables de données avec tri, filtres, pagination (TanStack)
- **`InlineEditField`** : édition inline dans les cellules de tables
- **Selects** : utiliser `<select>` HTML natif (PAS Radix Select — migration faite)
- **Toast** : utiliser le système existant `@radix-ui/react-toast`
- **Dialog, Tabs, Popover, Tooltip** : composants Shadcn/UI dans `src/components/ui/`
- Vérifier `src/components/ui/` avant de créer un nouveau composant UI

#### Règles anti-erreurs courantes
- **Leaflet/cartes** : toujours importer avec `dynamic(() => import(...), { ssr: false })` — pas de SSR
- **Enums Prisma** : utiliser les types générés (`import { Role } from '@prisma/client'`), ne pas redéfinir
- **Non-null assertion (`!`)** : autorisé uniquement après `requireAuthApi()` sur `session!.user.id` — interdit ailleurs sans vérification
- **Couleurs CSS** : utiliser les classes sémantiques Tailwind (`bg-primary`, `text-muted-foreground`), pas de couleurs hardcodées
- **Sécurité API** : ne jamais inclure le modèle `User` complet dans les `include` Prisma (fuite hash password) — sélectionner `{ id, name, email }` si nécessaire
- **Erreurs API** : toujours retourner un message générique au client (`{ error: "..." }`), jamais l'objet error complet

### Règles de Workflow de Développement

#### Déploiement production (procédure OBLIGATOIRE)
1. Supprimer le cache Next.js : `rm -rf /var/www/gleba/.next` (OBLIGATOIRE sinon l'ancien cache est copié dans l'image Docker)
2. Tuer les process orphelins : `fuser -k 3000/tcp 2>/dev/null`
3. Rebuild : `cd /var/www/gleba && docker compose up -d --build app`
4. Vérifier : `docker compose ps` + `curl -sk https://gleba.fr/login`
5. Logs : `docker compose logs app --tail 20`

#### Schéma Prisma
- Modifier `prisma/schema.prisma`
- Dev rapide : `npx prisma db push` (pas de migration)
- Production : créer une migration `npx prisma migrate dev --name ma_migration`
- Toujours regénérer le client : `npx prisma generate`
- Seeds : `npx tsx prisma/seed.ts` (chargement référentiels)

#### Git
- Branche principale : `main`
- Pas de convention de branchage stricte documentée
- Messages de commit en français, préfixés : `feat:`, `fix:`, `refactor:`, etc.

#### Fichiers sensibles
- Ne jamais committer `.env` (contient DATABASE_URL, NEXTAUTH_SECRET, SMTP credentials)
- `docker-compose.override.yml` est temporaire (mode dev) — ne pas committer
- Le dossier `.next/` est dans `.gitignore`

### Règles Critiques — Ne Pas Manquer

#### Anti-patterns à éviter absolument
- **Oublier `userId`** dans une requête Prisma métier → fuite de données entre utilisateurs
- **Créer une écriture comptable manuellement** au lieu d'utiliser `auto-compta.ts` → désynchronisation revenus/dépenses
- **Utiliser `import` classique pour Leaflet** → crash SSR (`window is not defined`)
- **Modifier le schema Prisma sans regénérer le client** → types obsolètes, erreurs runtime
- **Déployer sans supprimer `.next/`** → ancien build servi malgré les modifications
- **Ajouter un state manager global** (Redux, Zustand) → casse le pattern existant
- **Utiliser Radix Select** au lieu de `<select>` natif → migration déjà faite, ne pas régresser
- **Retourner un objet Prisma brut avec `include: { user: true }`** → fuite du hash password

#### Edge cases spécifiques au domaine agricole
- Les **IDs d'espèces** sont des `string` (slug), pas des `number` — ne pas confondre avec les IDs numériques des autres modèles
- Les **planches** ont un `id` de type `string` (identifiant utilisateur comme "P1", "A3")
- Les **cultures** peuvent avoir `terminee` = `'x'` (abandon), `'v'` (succès), `'NS'` (non semée), ou `null` (en cours) — ce n'est PAS un booléen
- Les **factures** suivent une numérotation légale `F-YYYY-NNNN` — ne jamais modifier la logique de numérotation
- Les **soft deletes** s'appliquent aux factures et clients (jamais de vraie suppression)

#### Sécurité
- Middleware protège toutes les routes sauf `/login`, `/register`, `/api/auth/*`, `/api/mcp/*`
- Les routes admin vérifient `role === "ADMIN"` dans le middleware
- L'API MCP utilise un bearer token séparé (`/api/mcp/*`)
- Mots de passe hashés avec `bcryptjs` — ne jamais stocker en clair
- Sessions JWT (pas de table session en BDD) — la durée de vie est gérée par NextAuth

---

## Usage Guidelines

**Pour les agents IA :**
- Lire ce fichier AVANT d'implémenter du code
- Suivre TOUTES les règles telles que documentées
- En cas de doute, préférer l'option la plus restrictive
- Mettre à jour ce fichier si de nouveaux patterns émergent

**Pour les humains :**
- Garder ce fichier lean et focalisé sur les besoins des agents
- Mettre à jour quand la stack technique change
- Revoir trimestriellement pour supprimer les règles obsolètes
- Supprimer les règles qui deviennent évidentes avec le temps

Dernière mise à jour : 2026-03-13
