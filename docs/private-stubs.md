# Stubs publics et code privé

Gleba publie une version open-source du code sur GitHub mais conserve
trois familles de fonctionnalités en privé :

1. **Assistant IA** (`/src/lib/chat`, `/src/app/api/chat`,
   `/src/app/api/mcp`, `/src/hooks/use-chat.ts`, `/mcp-server`).
2. **Boutique en ligne** (`/src/app/boutique`, `/src/components/boutique`,
   `/src/app/api/boutique`).
3. **Système de feedback** (`/src/app/feedback`, `/src/app/admin/feedback`,
   `/src/app/api/feedback`, `/src/app/api/admin/feedback`,
   `/src/lib/mail-feedback.ts`). Outil opérationnel propre à
   gleba.fr (campagnes emails, enquêtes, signalement de bugs), non distribué
   aux instances auto-hébergées.

Toutes ces zones sont listées dans `.gitignore`. Les modèles Prisma de la
boutique (`Boutique`, `ProduitBoutique`, `CommandeBoutique`,
`LigneCommandeBoutique`) et du feedback (`BugReport`, `FeedbackToken`,
`FeedbackResponse`) restent en revanche dans `prisma/schema.prisma` (et leurs
migrations), ainsi que le schéma de validation `src/lib/validations/feedback.ts`,
car d'autres modules y font référence et pour garder les migrations cohérentes.

Le mécanisme de **désabonnement** (`/src/app/desabonnement`,
`/src/app/api/desabonnement`, `/src/lib/unsubscribe.ts`) reste **public** : c'est
de l'infrastructure email générique, utilisée aussi par l'email de bienvenue.

## Pourquoi des stubs

Quatre composants publics importent du code privé :

| Composant                  | Importé par                                       |
|----------------------------|---------------------------------------------------|
| `components/chat/ChatPanel`  | `app/{page,arbres,elevage,comptabilite}/page.tsx` |
| `components/chat/ChatBubble` | `app/layout.tsx`                                  |
| `components/auth/BoutiqueHeaderButton` | 4 pages module                          |
| `components/feedback/FeedbackWidget`   | `app/layout.tsx`                        |

Sans intervention, un clone GitHub ne compile pas (`Module not found`).
On commit donc des **stubs** au même chemin, qui rendent `null` (ou
gardent leur logique conditionnée par un feature flag).

`FeedbackWidget` suit la même mécanique que ChatPanel/ChatBubble : le stub
public rend `null`, et le vrai composant reste sur le VPS via
`git update-index --skip-worktree src/components/feedback/FeedbackWidget.tsx`.

## Comment ça marche

### Politique de débit des API

`src/lib/auth-utils.ts` est commun aux deux versions. Il appelle
`src/lib/auth-politique.ts`, dont le contrat est `auth-politique-types.ts`.
Le dépôt public reçoit à ce chemin le stub `auth-politique.public.ts` :
`null` conserve le quota générique par IP. L'assemblage privé remplace ce
seul module par sa politique par acteur, après validation de la session.
Les deux versions exportent uniquement `politiqueDebitApi` avec le même type.
Le vrai module et `src/lib/caisse/auth-politique.test.ts` restent privés.

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

### Extension du middleware

`src/middleware.ts` importe `estExceptionMiddleware(pathname: string,
methode: string): boolean` depuis `src/lib/middleware-extension-caisse.ts`.
L'assemblage privé conserve ce module pur, sans dépendance Node ni accès en base.
Les contrôles d'authentification des routes serveur restent en place.

Pour le dépôt public, le manager utilise à ce même chemin le contenu de
`src/lib/middleware-extension-caisse.public.ts` : mêmes exports et signature,
retour toujours faux. Le middleware reste identique dans les deux assemblages.
L'implémentation privée ne doit pas être publiée. `src/middleware.test.ts`
vérifie l'assemblage privé ; `src/middleware-public.test.ts` exerce le vrai
stub public avec le middleware.

Les bancs `scripts/qa/serie-assistant-*.ts` dépendent de la zone privée du VPS.
Ils sont exclus du typecheck applicatif pour qu'un clone public compile sans
ces modules. Les sondes d'interface de l'assistant nécessitent également les
vrais composants du VPS ; les stubs publics rendent volontairement `null`.

1. Ajouter le chemin dans `.gitignore`.
2. Si du code public importe ce chemin :
   - soit refactor pour rendre l'import conditionnel (feature flag) ;
   - soit créer un stub commité au même path (avec une règle
     d'exception `!path` dans `.gitignore` et `git update-index
     --skip-worktree` sur le VPS).
3. Si des modèles Prisma sont concernés, les laisser publics tant que
   d'autres modules y font référence — sinon les retirer du schéma.
4. Documenter ici.
