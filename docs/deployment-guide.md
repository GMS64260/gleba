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
- **Base image** : `node:20-alpine` (multi-stage build)

## Docker Build (Production)

### Dockerfile multi-stage

| Stage | Rôle |
|-------|------|
| `deps` | Installation dépendances (`npm ci --legacy-peer-deps`) |
| `builder` | Prisma generate + Next.js build (standalone output) |
| `runner` | Image finale minimaliste (standalone + prisma + seeds) |

### Processus de build

```bash
# OBLIGATOIRE : Supprimer le cache Next.js avant rebuild
rm -rf /var/www/gleba/.next

# Stopper les process orphelins
fuser -k 3000/tcp 2>/dev/null

# Build et restart
cd /var/www/gleba && docker compose up -d --build app
```

### Points critiques

1. **TOUJOURS supprimer `.next/` avant un rebuild** — Docker copie ce dossier via `COPY . .`, servant l'ancien cache
2. **Process orphelins sur le port 3000** — `fuser -k 3000/tcp` avant restart
3. **Cache navigateur** — Next.js en prod envoie `cache-control: immutable`. Hard refresh (Ctrl+Shift+R) si nécessaire

## Docker Compose

### Services

| Service | Image | Port | Volume |
|---------|-------|------|--------|
| `db` | `postgis/postgis:16-3.4-alpine` | 5433:5432 | `postgres_data` (persistent) |
| `app` | Build local (Dockerfile) | 3000:3000 | Aucun (standalone) |

### Healthcheck
Le service `db` dispose d'un healthcheck (`pg_isready`). Le service `app` attend que `db` soit healthy avant de démarrer.

## Entrypoint de démarrage

Le script `docker-entrypoint.sh` exécute au démarrage du container :

1. `prisma db push` — Applique le schéma (idempotent)
2. `prisma/seed.ts` — Seed si la BDD est vide
3. `prisma/seed-demo.ts` — Crée le compte démo
4. `scripts/migrate-data-v1.ts` — Migration données v1.0.0 (si CSV enrichis présents)
5. `node server.js` — Démarre le serveur Next.js standalone

## Configuration Caddy

Le Caddyfile (situé dans `/etc/caddy/Caddyfile`) configure le reverse proxy HTTPS vers le port 3000.

## Vérification post-déploiement

```bash
# Vérifier que le container tourne
docker compose ps

# Vérifier la réponse HTTP
curl -sk -o /dev/null -w "%{http_code}" https://gleba.fr/login

# Voir les logs
docker compose logs app --tail 20
```

## Mode dev temporaire (hot reload)

Pour du debug avec hot reload en production :

```bash
# 1. Créer override
cat > docker-compose.override.yml << 'EOF'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./src:/app/src
      - ./public:/app/public
      - ./prisma:/app/prisma
    environment:
      NODE_ENV: development
EOF

# 2. Rebuild
rm -rf .next && fuser -k 3000/tcp 2>/dev/null
docker compose up -d --build app

# 3. IMPORTANT: Repasser en prod après debug
rm docker-compose.override.yml
rm -rf .next && fuser -k 3000/tcp 2>/dev/null
docker compose up -d --build app
```

## Déploiement Raspberry Pi

Scripts spécifiques disponibles :
- `deploy-docker-pi.sh` — Déploiement Docker sur Pi
- `deploy-docker-pi-prebuild.sh` — Pré-build sur machine puissante, transfert sur Pi
- `deploy-pi.sh` — Déploiement natif (sans Docker)
- `gleba-pi.service` — Service systemd pour Pi

## CI/CD

> **Note** : Pas de pipeline CI/CD configuré (.github/workflows/ absent). Déploiement manuel via SSH + Docker Compose.
