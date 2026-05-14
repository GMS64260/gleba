# Story 1.4 : Rattachement des arbres aux parcelles

Status: ready-for-dev

## Story

As a utilisateur de Gleba,
I want rattacher mes arbres existants a une parcelle,
So that je puisse organiser mon verger spatialement par zone.

## Acceptance Criteria

1. **Select Parcelle dans le dialog d'ajout d'arbre** : Dans ArbresTab.tsx, le dialog "Ajouter un arbre" inclut un champ optionnel "Parcelle" (select natif HTML) listant les parcelles de l'utilisateur. L'arbre cree est associe a la parcelle selectionnee (ou null si aucune).

2. **Select Parcelle sur la page detail arbre** : Sur `/arbres/[id]`, dans l'onglet "Fiche", un champ "Parcelle" (select natif HTML) permet de choisir parmi les parcelles existantes ou de retirer l'assignation (valeur vide = null). La sauvegarde (PUT `/api/arbres/[id]` avec `parcelleGeoId`) met a jour l'arbre.

3. **Section "Arbres rattaches" sur la page parcelle** : La page `/parcelles/[id]` affiche une section listant tous les arbres rattaches (`parcelleGeoId = parcelle.id`) avec nom, espece, variete, etat, et lien cliquable vers `/arbres/[id]`.

4. **Retrait du rattachement** : L'utilisateur peut retirer l'assignation (select vide) et sauvegarder avec `parcelleGeoId = null`. L'arbre n'est plus rattache a aucune parcelle.

## Tasks / Subtasks

- [ ] Task 1 : Ajouter le select Parcelle dans le dialog ArbresTab (AC: #1)
  - [ ] 1.1 Ajouter un `useState` pour les parcelles et un `useEffect` qui fetch `GET /api/carte` au montage
  - [ ] 1.2 Ajouter `parcelleGeoId` dans l'etat `newArbre` (defaut: `""`)
  - [ ] 1.3 Ajouter un `<select>` HTML natif "Parcelle (optionnel)" dans le formulaire
  - [ ] 1.4 Inclure `parcelleGeoId: newArbre.parcelleGeoId || null` dans le body du POST
  - [ ] 1.5 Ajouter `parcelleGeoId` dans `resetForm()`

- [ ] Task 2 : Ajouter le select Parcelle sur la page detail arbre (AC: #2, #4)
  - [ ] 2.1 Dans `src/app/arbres/[id]/page.tsx`, ajouter dans l'interface `Arbre` :
    ```
    parcelleGeoId: string | null
    parcelleGeo: { id: string; nom: string } | null
    ```
  - [ ] 2.2 Ajouter un `useState` pour les parcelles et un `useEffect` qui fetch `GET /api/carte`
  - [ ] 2.3 Dans l'onglet "Fiche" (CardContent), ajouter un select natif "Parcelle" apres la section "Identite"
  - [ ] 2.4 Verifier que `handleSave` envoie bien `parcelleGeoId` dans le body (deja couvert par `JSON.stringify(arbre)`)

- [ ] Task 3 : Enrichir GET /api/arbres/[id] pour inclure parcelleGeo (AC: #2)
  - [ ] 3.1 Dans `src/app/api/arbres/[id]/route.ts`, ajouter dans le bloc include/select du `findUnique` :
    ```
    parcelleGeo: { select: { id: true, nom: true } }
    ```
  - [ ] 3.2 Verifier que le PUT retourne aussi parcelleGeo apres update

- [ ] Task 4 : Enrichir GET /api/carte/[id] pour inclure les arbres (AC: #3)
  - [ ] 4.1 Dans `src/app/api/carte/[id]/route.ts`, ajouter dans le GET un include conditionnel ou systematique :
    ```
    arbres: {
      select: { id: true, nom: true, espece: true, variete: true, etat: true, type: true },
      where: { userId: session!.user.id }
    }
    ```
  - [ ] 4.2 ATTENTION : toujours filtrer les arbres par `userId` dans le `where` du include (multi-tenancy)

- [ ] Task 5 : Creer/enrichir la page /parcelles/[id] avec section Arbres (AC: #3)
  - [ ] 5.1 Si la page `/parcelles/[id]` n'existe PAS encore (Story 1.3 non implementee) : la creer en suivant le pattern `src/app/planches/[id]/page.tsx`
  - [ ] 5.2 Si la page existe deja : ajouter la section "Arbres rattaches"
  - [ ] 5.3 Afficher : nom (lien vers `/arbres/[id]`), espece, variete, etat (badge colore), type
  - [ ] 5.4 Si aucun arbre rattache, afficher "Aucun arbre rattache a cette parcelle"

- [ ] Task 6 : Verification (AC: tous)
  - [ ] 6.1 `npm run build` → 0 erreur TypeScript
  - [ ] 6.2 `rm -rf .next && fuser -k 3000/tcp 2>/dev/null && docker compose up -d --build app`
  - [ ] 6.3 Tester le dialog d'ajout d'arbre : le champ Parcelle apparait, la creation fonctionne avec et sans parcelle
  - [ ] 6.4 Tester la page /arbres/[id] : le champ Parcelle apparait, selection et sauvegarde fonctionnent
  - [ ] 6.5 Tester le retrait (select vide → null) → l'arbre n'est plus rattache
  - [ ] 6.6 Tester /parcelles/[id] : les arbres rattaches apparaissent, les liens fonctionnent
  - [ ] 6.7 `docker compose logs app --tail 20` → pas d'erreur runtime

## Dev Notes

### ATTENTION : Le modele s'appelle ParcelleGeo (pas Parcelle)

Le modele Prisma est `ParcelleGeo` (table SQL `parcelles_geo`). Les FK sur les autres modeles utilisent `parcelleGeoId`. Ne PAS creer un nouveau modele "Parcelle".

### Ce qui existe DEJA — ne PAS recreer

1. **Champ Prisma** : `parcelleGeoId String? @map("parcelle_geo_id")` + relation `parcelleGeo ParcelleGeo? @relation(fields: [parcelleGeoId], references: [id], onDelete: SetNull)` sur le modele Arbre (schema.prisma ligne ~707). La migration est DEJA appliquee.

2. **API GET /api/arbres (liste)** : Supporte DEJA le filtre `?parcelle=ID|all|none` via `where.parcelleGeoId`. Retourne `parcelleGeoId` dans la reponse.

3. **API POST /api/arbres** : Ligne ~138 : `parcelleGeoId: body.parcelleGeoId || null`. Prend DEJA en charge le rattachement a la creation. NE PAS modifier cette logique.

4. **API PUT /api/arbres/[id]** : Ligne ~116 : `parcelleGeoId: body.parcelleGeoId !== undefined ? (body.parcelleGeoId || null) : undefined`. Prend DEJA en charge la modification du rattachement.

5. **onDelete: SetNull** : configure sur la relation Prisma — la suppression d'une parcelle met automatiquement `parcelleGeoId = null` sur tous ses arbres.

### Ce qui MANQUE — le travail a faire

1. **GET /api/arbres/[id]** : ne retourne PAS la relation `parcelleGeo` (nom de la parcelle). Le `findUnique` utilise un select/include qui n'inclut pas `parcelleGeo`. Ajouter `parcelleGeo: { select: { id: true, nom: true } }` pour que la page detail recoive le nom de la parcelle associee.

2. **GET /api/carte/[id]** : ne retourne PAS les arbres rattaches. Ajouter un include `arbres` (avec filtre `userId` !) pour que la page parcelle puisse afficher la liste.

3. **ArbresTab.tsx (dialog d'ajout)** : le formulaire ne contient aucun champ pour la parcelle. Ajouter un `<select>` HTML natif.

4. **Page detail arbre** (`/arbres/[id]/page.tsx`) : l'interface `Arbre` (lignes 18-41) n'inclut ni `parcelleGeoId` ni `parcelleGeo`. Le formulaire n'a aucun champ pour la parcelle.

5. **Page /parcelles/[id]** : N'EXISTE PAS. Aucune page `src/app/parcelles/[id]/page.tsx` n'a ete creee (Story 1.3 non implementee). Il faut soit la creer soit s'assurer que la Story 1.3 est faite avant.

### DEPENDANCE : Story 1.3 (page parcelle)

La Story 1.3 devait creer la page `/parcelles/[id]` avec une section "Planches rattachees". Cette page N'EXISTE PAS encore. Deux approches :

**Option A (recommandee)** : Creer une page `/parcelles/[id]` minimale qui affiche les infos parcelle + section Arbres. Quand Story 1.3 sera implementee, elle ajoutera la section Planches.

**Option B** : Implementer Story 1.3 d'abord, puis ajouter la section Arbres.

→ **Choisir Option A** pour etre autonome. La page sera enrichie par les stories suivantes.

### Pattern pour le select Parcelle (ArbresTab)

Le dialog d'ajout dans ArbresTab.tsx utilise des composants Shadcn (Select) pour Type et Etat, et des Combobox pour Espece/Variete/Fournisseur. Pour la parcelle, utiliser un `<select>` HTML natif (coherent avec la migration Radix → natif documentee dans project-context).

```typescript
// Dans ArbresTab, ajouter un state pour les parcelles :
const [parcelles, setParcelles] = React.useState<{id: string, nom: string}[]>([])

React.useEffect(() => {
  fetch("/api/carte").then(r => r.json()).then(data => {
    if (Array.isArray(data)) setParcelles(data.map((p: any) => ({ id: p.id, nom: p.nom })))
  })
}, [])

// Dans newArbre state, ajouter :
parcelleGeoId: ""

// Dans le formulaire, avant le bouton submit :
<div>
  <Label>Parcelle (optionnel)</Label>
  <select
    value={newArbre.parcelleGeoId}
    onChange={(e) => setNewArbre({ ...newArbre, parcelleGeoId: e.target.value })}
    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
  >
    <option value="">Aucune</option>
    {parcelles.map(p => (
      <option key={p.id} value={p.id}>{p.nom}</option>
    ))}
  </select>
</div>

// Dans handleSubmit, ajouter au body :
parcelleGeoId: newArbre.parcelleGeoId || null,
```

### Pattern pour le select Parcelle (page detail arbre)

La page detail `/arbres/[id]` utilise un state `arbre` qu'elle spread dans le body du PUT. Il suffit d'ajouter `parcelleGeoId` et `parcelleGeo` dans l'interface, de fetcher les parcelles, et d'ajouter un select.

```typescript
// Interface Arbre — ajouter :
parcelleGeoId: string | null
parcelleGeo: { id: string; nom: string } | null

// State parcelles :
const [parcelles, setParcelles] = React.useState<{id: string, nom: string}[]>([])

React.useEffect(() => {
  fetch("/api/carte").then(r => r.json()).then(data => {
    if (Array.isArray(data)) setParcelles(data.map((p: any) => ({ id: p.id, nom: p.nom })))
  })
}, [])

// Dans le formulaire, apres la section "Identite" (grid grid-cols-2) :
<div>
  <Label>Parcelle</Label>
  <select
    value={arbre.parcelleGeoId || ""}
    onChange={(e) => setArbre({ ...arbre, parcelleGeoId: e.target.value || null })}
    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
  >
    <option value="">Aucune</option>
    {parcelles.map(p => (
      <option key={p.id} value={p.id}>{p.nom}</option>
    ))}
  </select>
</div>
```

### Pattern page detail parcelle (si creation necessaire)

Copier le pattern de `src/app/planches/[id]/page.tsx` :
- `"use client"`, `useParams()` pour extraire l'ID
- Fetch via `GET /api/carte/[id]` (les routes `/api/parcelles/` sont des alias de `/api/carte/`)
- Les IDs parcelles sont des CUID (string), pas des int — ne PAS utiliser `parseInt()`

Structure de la page :
```
Header : breadcrumb (Parcelles / [nom]) + titre
Infos : nom, surface (ha), couches (badges colores), notes
Section "Arbres rattaches" : tableau simple
```

Couleurs badges couches :
- MARAICHAGE → `bg-emerald-100 text-emerald-800`
- VERGER → `bg-lime-100 text-lime-800`
- ELEVAGE → `bg-amber-100 text-amber-800`
- PATURAGE → `bg-green-100 text-green-800`

Couleurs badges etat arbres :
- excellent → `bg-green-100 text-green-700`
- bon → `bg-lime-100 text-lime-700`
- moyen → `bg-yellow-100 text-yellow-700`
- mauvais → `bg-red-100 text-red-700`

### API patterns critiques

**Auth** : Toujours `requireAuthApi()` + `session!.user.id` dans les where clauses.

**Params async (Next.js 16)** :
```typescript
type RouteParams = { params: Promise<{ id: string }> }
const { id } = await params
```

**Multi-tenancy** : Le include des arbres dans `/api/carte/[id]` DOIT filtrer par userId :
```typescript
arbres: {
  select: { id: true, nom: true, espece: true, variete: true, etat: true, type: true },
  where: { userId: session!.user.id }
}
```

### Composants UI a utiliser (ne pas recreer)

- `Card`, `CardContent`, `CardHeader`, `CardTitle` depuis `@/components/ui/card`
- `Badge` depuis `@/components/ui/badge`
- `Button` depuis `@/components/ui/button`
- `Label` depuis `@/components/ui/label`
- `<select>` HTML natif — PAS Radix Select (migration deja faite)
- `Link` depuis `next/link`
- `Combobox` depuis `@/components/ui/combobox` (utilise dans ArbresTab pour espece/variete)
- `DataTable` depuis `@/components/tables/DataTable` (si tableau avec tri/filtres necessaire)

### ATTENTION : Radix Select vs select natif

ArbresTab.tsx utilise ENCORE des imports Radix Select (`Select, SelectContent, SelectItem, SelectTrigger, SelectValue`) pour les champs Type et Etat. NE PAS toucher ces champs existants — ils fonctionnent. Pour le NOUVEAU champ Parcelle, utiliser un `<select>` HTML natif (coherent avec la direction de migration).

### Project Structure Notes

**Fichiers a MODIFIER :**
- `src/components/verger/ArbresTab.tsx` — ajouter fetch parcelles + select parcelle dans dialog d'ajout + parcelleGeoId dans le state et submit
- `src/app/arbres/[id]/page.tsx` — ajouter parcelleGeoId/parcelleGeo dans l'interface + select parcelle dans le formulaire
- `src/app/api/arbres/[id]/route.ts` — ajouter parcelleGeo dans include du GET + du PUT response
- `src/app/api/carte/[id]/route.ts` — ajouter include arbres dans GET (avec filtre userId)

**Fichiers a CREER :**
- `src/app/parcelles/[id]/page.tsx` — page detail parcelle avec section arbres rattaches

**Fichiers a NE PAS TOUCHER :**
- `prisma/schema.prisma` — parcelleGeoId deja present sur Arbre
- `src/app/api/arbres/route.ts` — POST et GET deja pris en charge (parcelleGeoId)
- `src/app/api/carte/route.ts` — GET liste parcelles, ne pas modifier
- `src/lib/validations/parcelle.ts` — pas de modification necessaire

### Intelligence Story precedente (1.3)

**Apprentissages de la Story 1.3 :**
- Les routes `/api/parcelles/` sont des re-exports purs de `/api/carte/`. Modifier `/api/carte/[id]/route.ts` pour impacter `/api/parcelles/[id]`.
- Les IDs parcelles sont des CUID (string), pas des int. Ne PAS utiliser `parseInt()`.
- Le champ `geometry` est stocke en TEXT (String), pas en type natif PostGIS.
- `fuser -k 3000/tcp` avant chaque rebuild Docker (process orphelins).

**Apprentissages de la Story 1.1 :**
- `prisma migrate dev` est casse (shadow database). Utiliser `prisma db push` si besoin de migration. Ici, PAS de migration necessaire car le champ existe deja.
- Les `couches` sont un tableau de l'enum `CoucheActivite` avec default `[]`.

**Apprentissages de la Story 1.2 :**
- La page `/parcelles` (liste) a ete creee en Story 1.2.
- Pattern du ParcellePanel dans `/components/carte/ParcellePanel.tsx` : edition inline des champs parcelle.

### Git Intelligence

Derniers commits :
- `a162a1a feat: ajout modules verger, elevage, comptabilite + ameliorations globales`
- `abbb4bd fix: ajouter champs qualite sol au schema validation`
- `2669d34 fix: stopPropagation sur cellules editables`

Conventions : prefixes `feat:`, `fix:`, `refactor:` en francais dans les messages de commit.

### References

- [Source: docs/planning-artifacts/epics.md lignes 306-333] — Story 1.4 dans les epics
- [Source: docs/planning-artifacts/prd.md] — PRD Phase 1 (FR7: rattacher arbres aux parcelles)
- [Source: docs/implementation-artifacts/1-3-rattachement-planches-parcelles.md] — Story precedente (pattern de reference)
- [Source: docs/implementation-artifacts/1-1-modele-parcelle-api-crud.md] — Story 1.1 (modele + API)
- [Source: src/app/api/arbres/route.ts] — API arbres (GET/POST, parcelleGeoId deja gere)
- [Source: src/app/api/arbres/[id]/route.ts] — API arbre detail (GET/PUT/DELETE)
- [Source: src/components/verger/ArbresTab.tsx] — Composant liste/ajout arbres
- [Source: src/app/arbres/[id]/page.tsx] — Page detail arbre (formulaire edition)
- [Source: src/app/api/carte/[id]/route.ts] — API carte/parcelle detail
- [Source: docs/project-context.md] — Regles projet (select natif, multi-tenancy, Next.js 16 async params)
- [Source: prisma/schema.prisma lignes 399-438 (ParcelleGeo), 682-754 (Arbre)]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Change Log

### File List
