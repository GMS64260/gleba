# Story 1.5 : Rattachement des lots d'animaux aux parcelles

Status: ready-for-dev

## Story

As a utilisateur de Gleba,
I want rattacher mes lots d'animaux a une parcelle,
So that je puisse savoir ou se trouvent mes animaux sur l'exploitation.

## Acceptance Criteria

1. **Select Parcelle dans le formulaire de creation de lot** : Dans le dialog "Ajouter un lot" (LotsSubTab dans AnimauxTab.tsx), un champ optionnel "Parcelle" permet de choisir parmi les parcelles existantes. Le lot cree est associe a la parcelle selectionnee (ou null si aucune).

2. **Assignation/modification de la parcelle sur un lot existant** : L'utilisateur peut assigner ou changer la parcelle d'un lot via le bouton inline `ParcelleAssignButton` dans le tableau des lots, ou via le PATCH `/api/elevage/lots` avec `parcelleGeoId`.

3. **Section "Lots d'animaux" sur la page parcelle** : La page `/parcelles/[id]` affiche une section listant tous les lots rattaches (`parcelleGeoId = parcelle.id`) avec nom du lot, espece, effectif actuel, statut, et lien cliquable.

4. **Retrait du rattachement** : L'utilisateur peut retirer l'assignation (select "Aucune") et sauvegarder avec `parcelleGeoId = null`. Le lot n'est plus rattache a aucune parcelle.

## Etat actuel : QUASI-COMPLET

> **IMPORTANT** : L'analyse du codebase montre que cette story est deja implementee a ~95%.
> Le rattachement lots/parcelles fonctionne deja cote backend ET frontend.
> Seuls 2 elements manquent : l'inclusion des lots dans l'API parcelle detail et la section "Lots" sur la page parcelle.

### Ce qui est DEJA FAIT — ne PAS refaire

1. **Prisma schema** : `parcelleGeoId String? @map("parcelle_geo_id")` + relation `parcelleGeo ParcelleGeo?` sur LotAnimaux (schema.prisma ligne ~1081). Relation inverse `lotsAnimaux LotAnimaux[]` sur ParcelleGeo (ligne ~437).

2. **Validation Zod** : `parcelleGeoId: z.string().nullable().optional()` dans `src/lib/validations/elevage-lot.ts`.

3. **API GET /api/elevage/lots** : Retourne deja `parcelleGeo: { id, nom }` via include (ligne ~28-46).

4. **API POST /api/elevage/lots** : Accepte deja `parcelleGeoId` (ligne ~97 : `parcelleGeoId: parcelleGeoId || null`).

5. **API PATCH /api/elevage/lots** : Met a jour `parcelleGeoId` (ligne ~139 : `if (parcelleGeoId !== undefined) updateData.parcelleGeoId = parcelleGeoId || null`).

6. **UI — Dialog creation lot** : `LotsSubTab` dans `AnimauxTab.tsx` (lignes 845-896) inclut DEJA un select Parcelle (Radix Select) qui fetch `/api/carte` au montage.

7. **UI — Tableau des lots** : Affiche deja la parcelle du lot avec lien vers la carte (`/jardin/carte?parcelle={id}`). Si pas de parcelle, affiche le `ParcelleAssignButton` (lignes 933-941).

8. **UI — ParcelleAssignButton** : Composant inline (lignes 1038-1069) qui permet d'assigner une parcelle directement depuis le tableau via PATCH.

9. **onDelete: SetNull** : Configure sur la relation Prisma — suppression d'une parcelle met `parcelleGeoId = null` sur tous ses lots.

## Tasks / Subtasks

- [ ] Task 1 : Enrichir GET /api/carte/[id] pour inclure les lots d'animaux (AC: #3)
  - [ ] 1.1 Dans `src/app/api/carte/[id]/route.ts`, ajouter dans le GET :
    ```typescript
    // Apres le parcelleSelect, ou dans un include separe
    lotsAnimaux: {
      select: {
        id: true,
        nom: true,
        quantiteActuelle: true,
        statut: true,
        especeAnimale: { select: { id: true, nom: true, type: true } }
      },
      where: { userId: session!.user.id }
    }
    ```
  - [ ] 1.2 ATTENTION : le `parcelleSelect` actuel est un objet `select` (pas `include`). Pour ajouter des relations, il faut soit passer a un `include` soit restructurer la requete. Voir note technique ci-dessous.
  - [ ] 1.3 Toujours filtrer les lots par `userId` (multi-tenancy)

- [ ] Task 2 : Ajouter la section "Lots d'animaux" sur la page /parcelles/[id] (AC: #3)
  - [ ] 2.1 Si la page `/parcelles/[id]` n'existe PAS (Story 1.3/1.4 non implementees) : la creer en suivant le pattern documenté dans la Story 1.4
  - [ ] 2.2 Si la page existe deja : ajouter une section "Lots d'animaux" apres la section Arbres (si presente)
  - [ ] 2.3 Afficher : nom du lot (ou "Lot #{id}" si nom null), espece, effectif actuel, statut (badge), lien vers la page elevage
  - [ ] 2.4 Si aucun lot rattache, afficher "Aucun lot d'animaux rattache a cette parcelle"

- [ ] Task 3 : Verification (AC: tous)
  - [ ] 3.1 `npm run build` → 0 erreur TypeScript
  - [ ] 3.2 `rm -rf .next && fuser -k 3000/tcp 2>/dev/null && docker compose up -d --build app`
  - [ ] 3.3 Tester le dialog d'ajout de lot : le champ Parcelle apparait, la creation avec parcelle fonctionne
  - [ ] 3.4 Tester l'assignation inline (ParcelleAssignButton) : cliquer sur un lot sans parcelle, assigner, verifier
  - [ ] 3.5 Tester le retrait via PATCH (si UI le permet) ou via l'API directement
  - [ ] 3.6 Tester /parcelles/[id] : les lots rattaches apparaissent avec espece et effectif
  - [ ] 3.7 `docker compose logs app --tail 20` → pas d'erreur runtime

## Dev Notes

### ATTENTION : Le modele s'appelle ParcelleGeo (pas Parcelle)

Le modele Prisma est `ParcelleGeo` (table SQL `parcelles_geo`). Les FK utilisent `parcelleGeoId`.

### Note technique : parcelleSelect et relations

Le fichier `src/app/api/carte/[id]/route.ts` utilise un objet `parcelleSelect` qui est un `select` pur (lignes 63-81). Pour ajouter des relations (`arbres`, `lotsAnimaux`, `planches`), il faut restructurer la requete.

**Approche recommandee** : convertir le `select` en combinaison `select` + `include`, ou etendre le `select` avec les relations imbriquees :

```typescript
const parcelle = await prisma.parcelleGeo.findUnique({
  where: { id, userId: session!.user.id },
  select: {
    ...parcelleSelect,
    lotsAnimaux: {
      select: {
        id: true,
        nom: true,
        quantiteActuelle: true,
        statut: true,
        especeAnimale: { select: { id: true, nom: true, type: true } }
      },
      where: { userId: session!.user.id }
    },
    // Si Story 1.4 est implementee, arbres sera deja la :
    // arbres: { ... }
  },
})
```

**Note Prisma** : `select` et `include` sont mutuellement exclusifs au meme niveau. On peut imbriquer des `select` dans un `select` parent, ce qui est la bonne approche ici.

### DEPENDANCE : Page /parcelles/[id]

Comme pour la Story 1.4, la page `/parcelles/[id]` n'existe pas encore. Si les Stories 1.3 et 1.4 sont implementees avant, la page existera avec les sections Planches et Arbres. Sinon, la creer (voir pattern dans Story 1.4).

**Si la page est creee dans cette story**, inclure au minimum :
- Infos parcelle (nom, surface, couches)
- Section "Lots d'animaux" (cette story)

**Couleurs badges couches** (coherent avec stories precedentes) :
- MARAICHAGE → `bg-emerald-100 text-emerald-800`
- VERGER → `bg-lime-100 text-lime-800`
- ELEVAGE → `bg-amber-100 text-amber-800`
- PATURAGE → `bg-green-100 text-green-800`

**Couleurs badges statut lot** :
- actif → `bg-green-100 text-green-700`
- reforme → `bg-gray-100 text-gray-700`

### Liens de navigation pour les lots

Le tableau des lots dans AnimauxTab affiche un lien vers `/jardin/carte?parcelle={id}` pour la parcelle. Pour la page parcelle, le lien vers un lot devrait pointer vers `/elevage` (pas de page detail lot individuelle).

### Pattern d'implementation — cette story est minimaliste

Vu que 95% du travail est fait, cette story se resume a :
1. Ajouter `lotsAnimaux` dans le select du GET `/api/carte/[id]`
2. Afficher la section "Lots" sur la page parcelle `/parcelles/[id]`
3. Tester

### Intelligence Stories precedentes (1.3, 1.4)

- Les routes `/api/parcelles/` sont des re-exports purs de `/api/carte/`. Modifier `/api/carte/[id]/route.ts` pour impacter `/api/parcelles/[id]`.
- Les IDs parcelles sont des CUID (string), pas des int. Ne PAS utiliser `parseInt()`.
- `fuser -k 3000/tcp` avant chaque rebuild Docker.
- `prisma migrate dev` est casse. Utiliser `prisma db push` si besoin. Ici, PAS de migration necessaire.
- Les `couches` sont un tableau de l'enum `CoucheActivite`.

### Composants UI a utiliser (ne pas recreer)

- `Card`, `CardContent`, `CardHeader`, `CardTitle` depuis `@/components/ui/card`
- `Badge` depuis `@/components/ui/badge`
- `Link` depuis `next/link`
- `<select>` HTML natif pour nouveaux champs (coherent avec direction de migration)
- NE PAS toucher les selects Radix existants dans AnimauxTab (ils fonctionnent)

### Project Structure Notes

**Fichiers a MODIFIER :**
- `src/app/api/carte/[id]/route.ts` — ajouter include lotsAnimaux dans GET

**Fichiers a CREER (si pas deja fait par Story 1.3/1.4) :**
- `src/app/parcelles/[id]/page.tsx` — page detail parcelle avec section lots

**Fichiers a NE PAS TOUCHER :**
- `prisma/schema.prisma` — parcelleGeoId deja present sur LotAnimaux
- `src/app/api/elevage/lots/route.ts` — tout est deja gere
- `src/lib/validations/elevage-lot.ts` — parcelleGeoId deja valide
- `src/components/elevage/AnimauxTab.tsx` — select parcelle + ParcelleAssignButton deja implementes

### Git Intelligence

Derniers commits :
- `a162a1a feat: ajout modules verger, elevage, comptabilite + ameliorations globales`
- `abbb4bd fix: ajouter champs qualite sol au schema validation`

Conventions : prefixes `feat:`, `fix:`, `refactor:` en francais.

### References

- [Source: docs/planning-artifacts/epics.md lignes 335-362] — Story 1.5 dans les epics
- [Source: docs/planning-artifacts/prd.md] — PRD Phase 1 (FR8: rattacher lots aux parcelles)
- [Source: docs/implementation-artifacts/1-4-rattachement-arbres-parcelles.md] — Story precedente (pattern page parcelle)
- [Source: src/app/api/elevage/lots/route.ts] — API lots (GET/POST/PATCH/DELETE, parcelleGeoId deja gere)
- [Source: src/components/elevage/AnimauxTab.tsx lignes 731-1069] — LotsSubTab + ParcelleAssignButton
- [Source: src/app/api/carte/[id]/route.ts] — API parcelle detail (GET, manque include lots)
- [Source: src/lib/validations/elevage-lot.ts] — Validation Zod (parcelleGeoId inclus)
- [Source: prisma/schema.prisma lignes 1064-1095 (LotAnimaux), 399-445 (ParcelleGeo)]
- [Source: docs/project-context.md] — Regles projet

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Change Log

### File List
