# Story 1.3 : Rattachement des planches aux parcelles

Status: review

## Story

As a utilisateur de Gleba,
I want rattacher mes planches existantes a une parcelle,
So that je puisse voir quelles planches appartiennent a quelle zone de mon exploitation.

## Acceptance Criteria

1. **Select Parcelle sur page detail planche** : Sur la page `/planches/[id]`, dans le composant PlancheInfoTable, un champ "Parcelle" (select inline editable) permet de choisir parmi les parcelles existantes ou de retirer l'assignation (valeur vide = null).

2. **Sauvegarde du rattachement** : Quand l'utilisateur selectionne une parcelle et que la sauvegarde se fait (PUT `/api/planches/[id]` avec `parcelleGeoId`), la planche est mise a jour. L'API retourne la planche avec les donnees `parcelleGeo` associees (nom, surface, centroid).

3. **Section "Planches rattachees" sur page parcelle** : La page `/parcelles/[id]` (a creer) affiche les informations de la parcelle et une section listant toutes les planches rattachees (`parcelleGeoId = parcelle.id`) avec nom, surface, type, et lien cliquable vers `/planches/[nom]`.

4. **Retrait du rattachement** : L'utilisateur peut retirer l'assignation (select vide) et sauvegarder avec `parcelleGeoId = null`. La planche n'est plus rattachee a aucune parcelle.

## Tasks / Subtasks

- [ ] Task 1 : Enrichir GET /api/planches/[id] (AC: #1, #2)
  - [ ] 1.1 Ajouter `parcelleGeo: { select: { id: true, nom: true, surface: true, centroidLat: true, centroidLng: true } }` dans le bloc `include` du `findUnique` (ligne ~35)
  - [ ] 1.2 Verifier que le PUT retourne aussi `parcelleGeo` apres update (ajouter dans le `include` du `prisma.planche.update`, ligne ~135)

- [ ] Task 2 : Mettre a jour l'interface TypeScript de la page detail (AC: #1)
  - [ ] 2.1 Dans `src/app/planches/[id]/page.tsx`, ajouter dans l'interface `Planche` (ligne ~13-30) :
    ```
    parcelleGeoId: string | null
    parcelleGeo: { id: string; nom: string; surface: number | null; centroidLat: number | null; centroidLng: number | null } | null
    ```

- [ ] Task 3 : Ajouter InlineEditField "Parcelle" dans PlancheInfoTable (AC: #1, #2, #4)
  - [ ] 3.1 Dans `PlancheInfoTable.tsx`, ajouter un `useState` pour les parcelles (`parcelles`) et un `useEffect` qui fetch `GET /api/carte` au montage
  - [ ] 3.2 Ajouter `parcelleGeoId` dans l'interface `Planche` du composant (ligne ~14-35)
  - [ ] 3.3 Dans la Card "Infrastructure", ajouter une ligne "Parcelle" avec un `InlineEditField` de type `select` dont les options sont les parcelles fetchees
  - [ ] 3.4 Le callback `onSave` appelle `handleUpdate('parcelleGeoId', selectedId || null)`
  - [ ] 3.5 Afficher le nom de la parcelle comme valeur courante (pas l'ID)

- [ ] Task 4 : Creer la page /parcelles/[id] (AC: #3)
  - [ ] 4.1 Creer `src/app/parcelles/[id]/page.tsx` ("use client")
  - [ ] 4.2 Fetch GET `/api/parcelles/[id]` qui retourne les infos parcelle + planches rattachees
  - [ ] 4.3 Afficher : nom, surface (ha), couches (badges colores), notes
  - [ ] 4.4 Section "Planches rattachees" : tableau simple avec nom (lien vers `/planches/[nom]`), surface, type, irrigation
  - [ ] 4.5 Breadcrumb : Parcelles / [nom] avec lien retour vers /parcelles
  - [ ] 4.6 Si aucune planche rattachee, afficher message "Aucune planche rattachee a cette parcelle"

- [ ] Task 5 : Enrichir GET /api/carte/[id] pour inclure les planches (AC: #3)
  - [ ] 5.1 Dans `src/app/api/carte/[id]/route.ts`, ajouter dans le GET (fonction `findUnique`) : `include: { planches: { select: { id: true, nom: true, surface: true, type: true, irrigation: true }, where: { userId: session!.user.id } } }`
  - [ ] 5.2 ATTENTION : toujours filtrer les planches par `userId` dans le `where` du include (multi-tenancy)

- [ ] Task 6 : Verification (AC: tous)
  - [ ] 6.1 `npm run build` → 0 erreur TypeScript
  - [ ] 6.2 `rm -rf .next && fuser -k 3000/tcp 2>/dev/null && docker compose up -d --build app`
  - [ ] 6.3 Tester la page /planches/[nom] : le champ Parcelle apparait, selection et sauvegarde fonctionnent
  - [ ] 6.4 Tester le retrait (select vide → null) → la planche n'est plus rattachee
  - [ ] 6.5 Tester /parcelles/[id] : les planches rattachees apparaissent, les liens fonctionnent
  - [ ] 6.6 Tester la fonctionnalite "Estimer depuis GPS" dans PlancheInfoTable — ne doit pas regresser
  - [ ] 6.7 Tester la creation de planche avec parcelle selectionnee (/planches/new) — ne doit pas regresser
  - [ ] 6.8 `docker compose logs app --tail 20` → pas d'erreur runtime

## Dev Notes

### ATTENTION : Le modele s'appelle ParcelleGeo (pas Parcelle)

Le modele Prisma est `ParcelleGeo` (table SQL `parcelles_geo`). Les FK sur les autres modeles utilisent `parcelleGeoId`. Ne PAS creer un nouveau modele "Parcelle".

### Ce qui existe DEJA — ne PAS recreer

1. **Champ Prisma** : `parcelleGeoId String? @map("parcelle_geo_id")` + relation `parcelleGeo ParcelleGeo?` sur le modele Planche (schema.prisma lignes ~368-369). La migration est DEJA appliquee.

2. **Validation Zod** : `parcelleGeoId: z.string().nullable().optional()` dans `src/lib/validations/planche.ts`. Le `updatePlancheSchema` l'inclut deja.

3. **Formulaire de creation** : `src/app/planches/new/page.tsx` (lignes 197-225) a DEJA un select Parcelle qui fetch `/api/carte` et passe `parcelleGeoId` dans le body POST. NE PAS toucher ce fichier.

4. **PUT API** : `src/app/api/planches/[id]/route.ts` accepte DEJA `parcelleGeoId` via le spread de `validationResult.data` (ligne ~131). Le champ est transmis a Prisma.

5. **PlancheInfoTable interface** : `src/components/planches/PlancheInfoTable.tsx` (lignes 31-34) declare DEJA `parcelleGeo?: { centroidLat?, centroidLng? }` pour la fonctionnalite GPS/SoilGrids. Etendre cette interface, ne pas la remplacer.

6. **onDelete: SetNull** : configure sur la relation Prisma — la suppression d'une parcelle met automatiquement `parcelleGeoId = null` sur toutes ses planches.

### Ce qui MANQUE — le travail a faire

1. **GET /api/planches/[id]** (ligne ~35-61) : le bloc `include` ne contient PAS `parcelleGeo`. Ajouter `parcelleGeo: { select: { id: true, nom: true, surface: true, centroidLat: true, centroidLng: true } }` pour que la page detail recoive les donnees de la parcelle associee.

2. **Include dans le PUT response** (ligne ~129-138) : apres update, le `include` ne contient que `rotation: true`. Ajouter `parcelleGeo: { select: { id: true, nom: true, surface: true, centroidLat: true, centroidLng: true } }` pour que le client recoive les donnees parcelle a jour.

3. **Interface TypeScript page detail** (`planches/[id]/page.tsx` lignes 13-30) : manque `parcelleGeoId` et `parcelleGeo` dans l'interface `Planche`.

4. **Select inline dans PlancheInfoTable** : aucun champ editable pour la parcelle. Ajouter un `InlineEditField` type `select` dans la Card "Infrastructure".

5. **Page /parcelles/[id]** : n'existe PAS du tout. A creer.

6. **GET /api/carte/[id]** : ne retourne PAS les planches rattachees. Ajouter un `include: { planches }` dans la query Prisma.

### Pattern InlineEditField pour le select Parcelle

Le composant `InlineEditField` (`src/components/planches/InlineEditField.tsx`) supporte le type `"select"` avec une prop `options: string[]`. Pour afficher le nom de la parcelle (pas l'ID), il faut :

1. Fetch les parcelles au montage dans PlancheInfoTable (comme pour les ilots, lignes 55-61)
2. Creer un mapping `id → nom` pour l'affichage
3. Utiliser `InlineEditField` avec `type="select"` et `options={parcelleNoms}`
4. Dans le callback `onSave`, convertir le nom selectionne vers l'ID correspondant avant d'appeler `handleUpdate('parcelleGeoId', id)`

**Alternative plus simple** : utiliser un `<select>` HTML natif inline (coherent avec la migration Radix → select natif documentee dans project-context). Pattern :
```typescript
// Dans PlancheInfoTable, apres le fetch parcelles :
<tr>
  <td className="py-2 text-muted-foreground w-1/3">Parcelle</td>
  <td className="py-2 font-medium">
    <select
      value={planche.parcelleGeoId || ""}
      onChange={async (e) => {
        await handleUpdate('parcelleGeoId', e.target.value || null)
      }}
      className="bg-transparent border-0 p-0 text-sm font-medium cursor-pointer hover:text-green-600"
    >
      <option value="">Aucune</option>
      {parcelles.map(p => (
        <option key={p.id} value={p.id}>{p.nom}</option>
      ))}
    </select>
  </td>
</tr>
```

### Pattern page detail parcelle

Copier le pattern de `src/app/planches/[id]/page.tsx` :
- `"use client"`, `use(params)` pour extraire l'ID (Next.js 16 async params)
- Fetch via `GET /api/parcelles/[id]`
- Les IDs parcelles sont des CUID (string), pas des noms — utiliser l'ID directement dans l'URL
- Les parcelles sont accedees via `/api/parcelles/[id]` qui est un alias de `/api/carte/[id]`

Structure de la page :
```
Header : breadcrumb + titre (parcelle.nom)
Infos : surface (ha), couches (badges), notes
Section "Planches rattachees" : tableau simple ou liste
```

Couleurs badges couches (coherent avec Story 1.2) :
- MARAICHAGE → `bg-emerald-100 text-emerald-800`
- VERGER → `bg-lime-100 text-lime-800`
- ELEVAGE → `bg-amber-100 text-amber-800`
- PATURAGE → `bg-green-100 text-green-800`

### API patterns critiques

**Auth** : Toujours `requireAuthApi()` + `session!.user.id` dans les where clauses.

**Params async (Next.js 16)** :
```typescript
type RouteParams = { params: Promise<{ id: string }> }
const { id } = await params
```

**Multi-tenancy** : Le include des planches dans `/api/carte/[id]` DOIT filtrer par userId :
```typescript
planches: {
  select: { id: true, nom: true, surface: true, type: true, irrigation: true },
  where: { userId: session!.user.id }
}
```

### Composants UI a utiliser (ne pas recreer)

- `Card`, `CardContent`, `CardHeader`, `CardTitle` depuis `@/components/ui/card`
- `Badge` depuis `@/components/ui/badge`
- `InlineEditField` depuis `@/components/planches/InlineEditField`
- `<select>` HTML natif — PAS Radix Select (migration deja faite)
- `Link` depuis `next/link`

### Project Structure Notes

**Fichiers a MODIFIER :**
- `src/app/api/planches/[id]/route.ts` — ajouter parcelleGeo dans include GET + PUT
- `src/app/planches/[id]/page.tsx` — ajouter parcelleGeoId/parcelleGeo dans l'interface
- `src/components/planches/PlancheInfoTable.tsx` — ajouter fetch parcelles + select inline
- `src/app/api/carte/[id]/route.ts` — ajouter include planches dans GET

**Fichiers a CREER :**
- `src/app/parcelles/[id]/page.tsx` — page detail parcelle avec planches rattachees

**Fichiers a NE PAS TOUCHER :**
- `prisma/schema.prisma` — parcelleGeoId deja present
- `src/lib/validations/planche.ts` — parcelleGeoId deja valide
- `src/app/planches/new/page.tsx` — select Parcelle deja present
- `src/app/api/parcelles/route.ts` — alias existant, ne pas modifier
- `src/app/api/parcelles/[id]/route.ts` — alias existant, ne pas modifier

### Intelligence Story precedente (1.2)

**Apprentissages de la Story 1.2 :**
- Les routes `/api/parcelles/` sont des re-exports purs de `/api/carte/`. Modifier `/api/carte/[id]/route.ts` pour impacter `/api/parcelles/[id]`.
- Les IDs parcelles sont des CUID (string), pas des int. Ne PAS utiliser `parseInt()`.
- Le champ `geometry` est stocke en TEXT (String), pas en type natif PostGIS.
- `fuser -k 3000/tcp` avant chaque rebuild Docker (process orphelins).

**Apprentissages de la Story 1.1 :**
- `prisma migrate dev` est casse (shadow database). Utiliser `prisma db push` si besoin de migration. Ici, PAS de migration necessaire car le champ existe deja.
- Les `couches` sont un tableau de l'enum `CoucheActivite` avec default `[]`.

### Git Intelligence

Derniers commits :
- `a162a1a feat: ajout modules verger, elevage, comptabilite + ameliorations globales`
- `abbb4bd fix: ajouter champs qualite sol au schema validation`
- `2669d34 fix: stopPropagation sur cellules editables`

Conventions : prefixes `feat:`, `fix:`, `refactor:` en francais dans les messages de commit.

### References

- [Source: docs/planning-artifacts/epics.md lignes 277-305] — Story 1.3 dans les epics
- [Source: docs/planning-artifacts/prd.md] — PRD Phase 1 (FR6: rattacher planches aux parcelles)
- [Source: docs/implementation-artifacts/1-2-page-gestion-parcelles.md] — Story precedente
- [Source: docs/implementation-artifacts/1-1-modele-parcelle-api-crud.md] — Story 1.1 (modele + API)
- [Source: src/app/api/planches/[id]/route.ts] — API planche detail (GET/PUT/DELETE)
- [Source: src/app/planches/[id]/page.tsx] — Page detail planche
- [Source: src/components/planches/PlancheInfoTable.tsx] — Tableau info planche (inline edit)
- [Source: src/components/planches/InlineEditField.tsx] — Composant edition inline
- [Source: src/app/api/carte/[id]/route.ts] — API carte/parcelle detail
- [Source: src/app/planches/new/page.tsx lignes 197-225] — Select parcelle dans creation
- [Source: src/lib/validations/planche.ts] — Validation Zod (parcelleGeoId inclus)
- [Source: prisma/schema.prisma lignes 352-438] — Modeles Planche + ParcelleGeo

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Change Log

### File List
