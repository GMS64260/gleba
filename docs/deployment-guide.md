# Deployment Guide — Gleba

> Généré le 2026-03-12

## Architecture de déploiement

```
Internet → Caddy (HTTPS, reverse proxy) → Docker: gleba_app (:3000) → Docker: gleba_db (PostgreSQL :5432)
```

- **Reverse proxy** : Caddy (`/etc/caddy/Caddyfile`)
- **URL** : https://gleba.fr
- **SSL** : Automatique via Caddy (Let's Encrypt)
- **Container runtime** : Docker Compose
- **Base image** : Node sur Alpine, version fixée en tête de chaque étape du `Dockerfile` (multi-stage build)

## Docker Build (Production)

### Dockerfile multi-stage

| Stage | Rôle |
|-------|------|
| `deps` | Installation dépendances (`npm ci --legacy-peer-deps`) |
| `builder` | Prisma generate + Next.js build (standalone output) |
| `runner` | Image finale minimaliste (standalone + prisma + seeds) |

### Processus de build

```bash
# Depuis la racine du dépôt : build et restart
docker compose up -d --build app
```

### Points critiques

1. **Cache `.next/` local** — `.dockerignore` exclut `.next/` : l'image est construite à partir des sources, sans reprendre un build local
2. **Port 3000 déjà occupé** — choisir un autre port hôte avec `APP_PORT` dans `.env`
3. **Cache navigateur** — Next.js en prod envoie `cache-control: immutable`. Hard refresh (Ctrl+Shift+R) si nécessaire

## Docker Compose

### Services

| Service | Image | Port | Volume |
|---------|-------|------|--------|
| `db` | `postgis/postgis:16-3.4-alpine` | 5433:5432 (localhost) | `postgres_data` (persistent) |
| `app` | Build local (Dockerfile) | 3000:3000 (localhost, `APP_PORT`) | `uploads_data`, `justificatifs_data`, `plan_fonds_data`, `registres_elevage_data` |

`docker-compose.override.yml`, versionné, est chargé automatiquement par `docker compose` : il durcit les deux conteneurs (`no-new-privileges`, `cap_drop`, limites de processus, plafond mémoire de `app`). Il fait partie de la configuration de production : ne pas le supprimer ni l'écraser.

### Healthcheck
Le service `db` dispose d'un healthcheck (`pg_isready`). Le service `app` attend que `db` soit healthy avant de démarrer.

## Entrypoint de démarrage

Le script `docker-entrypoint.sh` exécute au démarrage du container :

1. Refus de démarrer si `NEXTAUTH_SECRET` (ou `AUTH_SECRET`) est vide ou vaut l'exemple publié
2. `prisma migrate deploy` — Applique les migrations de `prisma/migrations/` pas encore enregistrées
3. `prisma/seed.ts` — Seed si la BDD est vide
4. `prisma/seed-demo.ts` — Crée le compte démo
5. `prisma/seed-races.ts` — Référentiel des races (idempotent)
6. `prisma/seed-referentiel-geographique.ts` — Référentiel géographique (idempotent)
7. `prisma/seed-varietes-arbres.ts` — Variétés arboricoles (idempotent)
8. `scripts/import-enriched-csv.ts` — Complète espèces, ITP et variétés depuis les CSV enrichis, sans écraser les champs déjà remplis
9. `node server.js` — Démarre le serveur Next.js standalone

Le schéma évolue uniquement par migrations versionnées : jamais de `prisma db push` ni de `db:reset` sur une base qui contient des données.

## Configuration Caddy

Le Caddyfile (situé dans `/etc/caddy/Caddyfile`) configure le reverse proxy HTTPS vers le port 3000.

## Vérification post-déploiement

```bash
# Vérifier que le container tourne
docker compose ps

# Vérifier la réponse HTTP
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login

# Voir les logs
docker compose logs app --tail 20
```

## CI/CD

Le workflow `.github/workflows/test.yml` tourne à chaque push et pull request sur `main`, en quatre jobs indépendants :

- `lint` : `npm run test:lint-gate` puis `npm run lint:ci` ;
- `tests` : `npm test` (Vitest) ;
- `typage` : `npx tsc --noEmit` ;
- `base-neuve` : `prisma migrate deploy` et `prisma/seed.ts` joués deux fois sur une base PostGIS vierge, puis un test d'intégration PostgreSQL.

Le déploiement n'est pas automatisé : il se fait avec Docker Compose (voir ci-dessus).
