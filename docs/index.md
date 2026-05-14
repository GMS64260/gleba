# Gleba — Documentation Projet

> ERP open source pour micro-fermes diversifiées (maraîchage, verger, élevage, comptabilité)
> Généré le 2026-03-12 | Scan level: deep

## Vue d'ensemble

- **Type** : Monolithe full-stack (single repo)
- **Langage** : TypeScript (strict)
- **Framework** : Next.js 16 (App Router) + React 18
- **Base de données** : PostgreSQL 16 (PostGIS) via Prisma ORM
- **Auth** : NextAuth v5 (JWT + Credentials)
- **Déploiement** : Docker multi-stage + Caddy (https://gleba.fr)
- **Licence** : AGPL-3.0

## Référence rapide

- **Entry point** : `src/app/layout.tsx` → `src/app/page.tsx`
- **Auth** : `src/lib/auth.ts` + `src/middleware.ts`
- **BDD** : `prisma/schema.prisma` (51 modèles)
- **API** : `src/app/api/` (70+ endpoints)
- **Composants** : `src/components/` (95 fichiers)
- **Design system** : Shadcn/UI + Radix UI + TailwindCSS

## Documentation générée

- [Project Overview](./project-overview.md) — Résumé du projet et fonctionnalités
- [Architecture](./architecture.md) — Pattern architectural, stack technique, flux de requête
- [Source Tree Analysis](./source-tree-analysis.md) — Arbre source complet annoté
- [API Contracts](./api-contracts.md) — 70+ endpoints documentés par module
- [Data Models](./data-models.md) — 51 modèles Prisma, enums, relations
- [Component Inventory](./component-inventory.md) — 95 composants React par domaine
- [Development Guide](./development-guide.md) — Installation, scripts, conventions
- [Deployment Guide](./deployment-guide.md) — Docker, Caddy, CI/CD, Raspberry Pi

## Documentation existante

- [README.md](../README.md) — Présentation du projet, mission, fonctionnalités
- [CLAUDE.md](../CLAUDE.md) — Instructions Claude Code (procédures de déploiement)
- [COPYRIGHT.md](../COPYRIGHT.md) — Licence AGPL-3.0 (GMS64260, 2024-2026)
- [PLAN_METEO.md](../PLAN_METEO.md) — Plan d'implémentation du module météo
- [PROMPT_AI_ENRICHMENT.md](../PROMPT_AI_ENRICHMENT.md) — Instructions enrichissement IA des données CSV
- [MCP Server README](../mcp-server/README.md) — Documentation des 39 outils MCP

## Getting Started

### Développement local
```bash
npm ci --legacy-peer-deps
cp .env.example .env
docker compose up -d db
npx prisma db push && npx prisma generate
npx tsx prisma/seed.ts
npm run dev
```

### Production (Docker)
```bash
rm -rf .next
fuser -k 3000/tcp 2>/dev/null
docker compose up -d --build app
```

Voir [Development Guide](./development-guide.md) et [Deployment Guide](./deployment-guide.md) pour plus de détails.

## Pour les agents IA

Cette documentation fournit le contexte nécessaire pour :
1. **Comprendre l'existant** — Architecture, modèles de données, API, composants
2. **Planifier de nouvelles fonctionnalités** — Les patterns, conventions et points d'intégration sont documentés
3. **Modifier le code** — Les chemins de fichiers, conventions de nommage et patterns sont détaillés
4. **Respecter les contraintes** — Multi-tenancy, soft deletes, auto-comptabilité, validation Zod
