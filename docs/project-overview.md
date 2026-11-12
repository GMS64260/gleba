# Project Overview — Gleba

> Généré le 2026-03-12

## Résumé

**Gleba** est un logiciel libre (AGPL-3.0) de gestion de micro-fermes diversifiées. C'est un ERP agricole couvrant le maraîchage, le verger, l'élevage et la comptabilité, conçu pour les petits producteurs, maraîchers et permaculteurs.

- **Auteur** : Guillaume Gomes (GMS64260)
- **URL** : https://gleba.fr
- **Licence** : AGPL-3.0
- **Version** : 1.1.0

## Fonctionnalités principales

| Module | Description |
|--------|-------------|
| **Potager** | Gestion cultures (135+ espèces), planches, rotations, associations, irrigation, stocks semences |
| **Verger** | Arbres fruitiers/forestiers, opérations, récoltes, bois, pollinisation, registre phytosanitaire |
| **Élevage** | Animaux individuels + lots, soins, production oeufs, ventes, abattages, généalogie, reproduction |
| **Comptabilité** | Revenus/dépenses unifiés, auto-comptabilité, factures légales, clients, TVA, coûts production |
| **Jardin** | Plan 2D interactif (SVG), carte cadastrale (Leaflet), parcelles géoréférencées |
| **Planification** | Calendrier annuel, Gantt ITPs, cultures prévues, récoltes prévues |
| **Météo** | Open-Meteo + stations perso, irrigation intelligente, bilan hydrique |
| **Assistant IA** | Chat par agents Paperclip (lecture/écriture données, zone privée) |
| **Traçabilité** | Interventions terrain, registre phytosanitaire réglementaire |

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 16 (App Router) + React 18 + TailwindCSS + Shadcn/UI |
| Backend | API Routes Next.js + Prisma ORM |
| BDD | PostgreSQL 16 (PostGIS) |
| Auth | NextAuth v5 (JWT + Credentials) |
| Deploy | Docker multi-stage + Caddy |
| IA | Agents Paperclip (chat) + serveur MCP (`gleba-mcp-server`, distribué séparément) |

## Architecture

- **Type** : Monolithe full-stack
- **Repository** : Single repo (monolith)
- **Pattern** : Server-side rendering + API routes internes
- **Multi-tenancy** : Par userId sur chaque modèle métier
- **Référentiels** : Espèces, variétés et ITPs partagés entre utilisateurs

## Chiffres clés

Ces chiffres évoluent à chaque lot : la commande les recalcule depuis le dépôt.

| Métrique | Commande |
|----------|----------|
| Endpoints API | `git ls-files 'src/app/api/**/route.ts' \| wc -l` |
| Modèles Prisma | `grep -c '^model ' prisma/schema.prisma` |
| Composants React | `git ls-files 'src/components/**/*.tsx' \| wc -l` |
| Schémas de validation Zod | `git ls-files 'src/lib/validations/*.ts' \| wc -l` |

Le référentiel livré compte 135 espèces (`especes_enriched.csv`).

## Documentation générée

- [Architecture](./architecture.md) — Pattern architectural et stack détaillée
- [API Contracts](./api-contracts.md) — Documentation de tous les endpoints
- [Data Models](./data-models.md) — Schéma complet de la base de données
- [Component Inventory](./component-inventory.md) — Inventaire des composants UI
- [Development Guide](./development-guide.md) — Guide de développement local
- [Deployment Guide](./deployment-guide.md) — Guide de déploiement Docker + Caddy
