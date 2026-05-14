# Project Overview — Gleba

> Généré le 2026-03-12

## Résumé

**Gleba** est un logiciel libre (AGPL-3.0) de gestion de micro-fermes diversifiées. C'est un ERP agricole couvrant le maraîchage, le verger, l'élevage et la comptabilité, conçu pour les petits producteurs, maraîchers et permaculteurs.

- **Auteur** : Guillaume Gomes (GMS64260)
- **URL** : https://gleba.fr
- **Licence** : AGPL-3.0
- **Version** : 1.0.0

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
| **Assistant IA** | Chat Ollama avec 39 outils (lecture/écriture données) |
| **Traçabilité** | Interventions terrain, registre phytosanitaire réglementaire |

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 16 (App Router) + React 18 + TailwindCSS + Shadcn/UI |
| Backend | API Routes Next.js + Prisma ORM |
| BDD | PostgreSQL 16 (PostGIS) — 51 modèles |
| Auth | NextAuth v5 (JWT + Credentials) |
| Deploy | Docker multi-stage + Caddy |
| IA | Ollama (chat) + serveur MCP (39 outils) |

## Architecture

- **Type** : Monolithe full-stack
- **Repository** : Single repo (monolith)
- **Pattern** : Server-side rendering + API routes internes
- **Multi-tenancy** : Par userId sur chaque modèle métier
- **Référentiels** : Espèces, variétés et ITPs partagés entre utilisateurs

## Chiffres clés

| Métrique | Valeur |
|----------|--------|
| Endpoints API | 70+ |
| Modèles Prisma | 51 |
| Composants React | 95 |
| Schémas de validation Zod | 22 |
| Outils IA (MCP) | 39 |
| Espèces pré-configurées | 135+ |

## Documentation générée

- [Architecture](./architecture.md) — Pattern architectural et stack détaillée
- [API Contracts](./api-contracts.md) — Documentation de tous les endpoints
- [Data Models](./data-models.md) — Schéma complet de la base de données
- [Component Inventory](./component-inventory.md) — Inventaire des 95 composants UI
- [Source Tree Analysis](./source-tree-analysis.md) — Arbre source annoté
- [Development Guide](./development-guide.md) — Guide de développement local
- [Deployment Guide](./deployment-guide.md) — Guide de déploiement Docker + Caddy
