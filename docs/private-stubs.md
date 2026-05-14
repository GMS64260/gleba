# Stubs publics et code privé

Gleba publie une version open-source du code sur GitHub mais conserve
deux familles de fonctionnalités en privé :

1. **Assistant IA** (`/src/lib/chat`, `/src/lib/ollama.ts`, `/src/app/api/chat`,
   `/src/app/api/mcp`, `/src/hooks/use-chat.ts`, `/mcp-server`).
2. **Boutique en ligne** (`/src/app/boutique`, `/src/components/boutique`,
   `/src/app/api/boutique`).

Toutes ces zones sont listées dans `.gitignore`. Les modèles Prisma de la
boutique (`Boutique`, `ProduitBoutique`, `CommandeBoutique`,
`LigneCommandeBoutique`) restent en revanche dans `prisma/schema.prisma`
car le module Comptabilité y fait référence.

## Pourquoi des stubs

Quatre composants publics importent du code privé :

| Composant                  | Importé par                                       |
|----------------------------|---------------------------------------------------|
| `components/chat/ChatPanel`  | `app/{page,arbres,elevage,comptabilite}/page.tsx` |
| `components/chat/ChatBubble` | `app/layout.tsx`                                  |
| `components/auth/BoutiqueHeaderButton` | 4 pages module                          |

Sans intervention, un clone GitHub ne compile pas (`Module not found`).
On commit donc trois **stubs** au même chemin, qui rendent `null` (ou
gardent leur logique conditionnée par un feature flag).

## Comment ça marche

### 1. ChatPanel / ChatBubble (zone `.gitignore` avec exception)

Le `.gitignore` ignore tout `/src/components/chat/*` **sauf** ces deux
fichiers (cf. la règle `!/src/components/chat/ChatPanel.tsx`). Les stubs
sont donc commités normalement.

Sur le **VPS de production**, le vrai code reste sur disque mais git ne
doit pas voir nos modifications locales. On applique :

```bash
git update-index --skip-worktree src/components/chat/ChatPanel.tsx
git update-index --skip-worktree src/components/chat/ChatBubble.tsx
```

À partir de là :

- `git status` ignore les changements sur ces deux fichiers ;
- `git pull` n'écrasera plus le vrai code (si le stub est mis à jour
  upstream, Git refusera le pull tant que `--no-skip-worktree` n'est pas
  appliqué — c'est volontaire pour éviter les pertes).

Pour annuler (par exemple si on veut mettre à jour le stub) :

```bash
git update-index --no-skip-worktree src/components/chat/ChatPanel.tsx
# modifier le fichier...
git add ...
git update-index --skip-worktree src/components/chat/ChatPanel.tsx
```

### 2. BoutiqueHeaderButton (feature flag)

Le fichier reste public et identique sur GitHub et en prod. Son
comportement dépend de l'env var :

```env
# .env.local (sur le VPS de prod)
NEXT_PUBLIC_FEATURE_BOUTIQUE=true
```

Si la variable n'est pas définie, le bouton rend `null` — invisible.

### 3. Routes API privées (Chat / Boutique)

Les routes `app/api/chat`, `app/api/mcp`, `app/api/boutique`, et
`app/api/user/api-token` ne sont **pas** stubées. Si la version
publique reçoit un fetch vers ces routes, elle répond 404, ce qui est
le comportement souhaité (la feature n'est pas disponible).

## Checklist pour ajouter une nouvelle zone privée

1. Ajouter le chemin dans `.gitignore`.
2. Si du code public importe ce chemin :
   - soit refactor pour rendre l'import conditionnel (feature flag) ;
   - soit créer un stub commité au même path (avec une règle
     d'exception `!path` dans `.gitignore` et `git update-index
     --skip-worktree` sur le VPS).
3. Si des modèles Prisma sont concernés, les laisser publics tant que
   d'autres modules y font référence — sinon les retirer du schéma.
4. Documenter ici.
