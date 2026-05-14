# Story 1.6 : Deplacement de lots entre parcelles avec historique

Status: ready-for-dev

## Story

As a utilisateur de Gleba,
I want deplacer un lot d'animaux d'une parcelle a une autre et consulter l'historique des deplacements,
So that je puisse suivre la rotation de paturage et savoir ou etaient mes animaux a chaque moment.

## Acceptance Criteria

1. **Bouton "Deplacer"** : Dans le tableau des lots (LotsSubTab dans AnimauxTab.tsx), un bouton "Deplacer" apparait sur chaque lot actif qui possede une parcelle assignee (ou sans parcelle pour un premier placement). Le bouton ouvre un dialog.

2. **Dialog de deplacement** : Le dialog affiche le lot concerne (nom, espece, parcelle actuelle), un select pour la parcelle de destination (excluant la parcelle actuelle), un champ date (defaut: maintenant), et une note optionnelle. La soumission cree un DeplacementLot et met a jour le parcelleGeoId du lot.

3. **Validation destination** : Si l'utilisateur tente de deplacer un lot vers la meme parcelle ou il se trouve deja, une erreur est affichee ("La parcelle de destination est identique a la parcelle actuelle").

4. **Premier placement** : Si un lot n'a pas de parcelle assignee, le deplacement est enregistre avec `parcelleOrigineId = null` (premier placement).

5. **Historique par lot** : Le tableau des lots affiche le nombre de deplacements. Un clic sur un lot (ou un bouton "Historique") montre la liste chronologique des deplacements avec parcelle d'origine, parcelle de destination, date, et note.

6. **Historique sur page parcelle** : La page `/parcelles/[id]` affiche une section "Historique des deplacements" listant tous les mouvements impliquant cette parcelle (en tant qu'origine ou destination).

## Tasks / Subtasks

- [ ] Task 1 : Creer le modele Prisma DeplacementLot (AC: tous)
  - [ ] 1.1 Ajouter le modele dans `prisma/schema.prisma` :
    ```prisma
    model DeplacementLot {
      id                    Int          @id @default(autoincrement())
      userId                String       @map("user_id")
      user                  User         @relation(fields: [userId], references: [id], onDelete: Cascade)
      lotId                 Int          @map("lot_id")
      lot                   LotAnimaux   @relation(fields: [lotId], references: [id], onDelete: Cascade)
      parcelleOrigineId     String?      @map("parcelle_origine_id")
      parcelleOrigine       ParcelleGeo? @relation("DeplacementOrigine", fields: [parcelleOrigineId], references: [id], onDelete: SetNull)
      parcelleDestinationId String       @map("parcelle_destination_id")
      parcelleDestination   ParcelleGeo  @relation("DeplacementDestination", fields: [parcelleDestinationId], references: [id], onDelete: Cascade)
      dateHeure             DateTime     @default(now()) @map("date_heure")
      note                  String?
      createdAt             DateTime     @default(now()) @map("created_at")

      @@index([userId])
      @@index([lotId])
      @@index([parcelleOrigineId])
      @@index([parcelleDestinationId])
      @@map("deplacements_lots")
    }
    ```
  - [ ] 1.2 Ajouter la relation inverse sur LotAnimaux : `deplacements DeplacementLot[]`
  - [ ] 1.3 Ajouter les relations inverses sur ParcelleGeo :
    ```prisma
    deplacementsOrigine     DeplacementLot[] @relation("DeplacementOrigine")
    deplacementsDestination DeplacementLot[] @relation("DeplacementDestination")
    ```
  - [ ] 1.4 Ajouter la relation sur User : `deplacementsLots DeplacementLot[]`
  - [ ] 1.5 Appliquer : `npx prisma db push` (prisma migrate dev est casse, voir notes)
  - [ ] 1.6 Regenerer le client : `npx prisma generate`

- [ ] Task 2 : Creer le schema de validation Zod (AC: #2, #3)
  - [ ] 2.1 Creer `src/lib/validations/elevage-deplacement.ts` :
    ```typescript
    import { z } from 'zod'

    export const deplacementLotSchema = z.object({
      parcelleDestinationId: z.string().min(1, 'Parcelle de destination requise'),
      dateHeure: z.coerce.date().optional(),
      note: z.string().max(2000).nullable().optional(),
    })
    ```
  - [ ] 2.2 Ajouter l'export dans `src/lib/validations/index.ts`

- [ ] Task 3 : Creer l'API POST /api/elevage/lots/[id]/deplacements (AC: #1, #2, #3, #4)
  - [ ] 3.1 Creer `src/app/api/elevage/lots/[id]/deplacements/route.ts`
  - [ ] 3.2 Implementer POST :
    - `requireAuthApi()` + verifier ownership du lot
    - Valider avec `deplacementLotSchema`
    - Verifier que la parcelle destination existe et appartient a l'utilisateur
    - Verifier que `parcelleDestinationId !== lot.parcelleGeoId` (AC: #3)
    - Utiliser `prisma.$transaction()` pour :
      a. Creer le DeplacementLot (parcelleOrigineId = lot.parcelleGeoId actuel, peut etre null)
      b. Mettre a jour lot.parcelleGeoId vers la destination
    - Retourner le deplacement cree avec les noms des parcelles
  - [ ] 3.3 Implementer GET :
    - `requireAuthApi()` + verifier ownership du lot
    - Retourner tous les deplacements du lot, ordonnes par dateHeure DESC
    - Inclure `parcelleOrigine: { select: { id, nom } }` et `parcelleDestination: { select: { id, nom } }`

- [ ] Task 4 : Ajouter le dialog "Deplacer" dans LotsSubTab (AC: #1, #2, #3, #4)
  - [ ] 4.1 Ajouter un state pour le dialog deplacement : `const [deplacerDialog, setDeplacerDialog] = React.useState<Lot | null>(null)`
  - [ ] 4.2 Ajouter un state pour le formulaire : `const [deplacerForm, setDeplacerForm] = React.useState({ parcelleDestinationId: "", dateHeure: "...", note: "" })`
  - [ ] 4.3 Ajouter un bouton "Deplacer" (icone ArrowRightLeft ou MoveRight) dans la colonne actions du tableau, a cote du bouton abattage, pour chaque lot actif
  - [ ] 4.4 Implementer le dialog (pattern identique au dialog abattage lignes 973-1033) :
    - DialogTitle avec icone
    - DialogDescription : nom lot, espece, parcelle actuelle
    - Select parcelle destination (filtrer pour exclure la parcelle actuelle du lot)
    - Input date (defaut: aujourd'hui)
    - Textarea note optionnelle
    - Boutons Annuler / Deplacer
  - [ ] 4.5 Implementer `handleDeplacerSubmit` : POST vers `/api/elevage/lots/${lot.id}/deplacements`, puis `fetchData()`

- [ ] Task 5 : Afficher l'historique des deplacements (AC: #5)
  - [ ] 5.1 Option A (recommandee) : Ajouter un dialog "Historique" accessible depuis le tableau des lots (icone History)
    - Fetch GET `/api/elevage/lots/${lotId}/deplacements` au clic
    - Afficher la liste chronologique dans un Dialog scrollable
    - Chaque entree : date, parcelle origine → parcelle destination, note
  - [ ] 5.2 Option B : Ajouter un expandable row dans le tableau (plus complexe)
  - [ ] 5.3 Ajouter un compteur `_count.deplacements` dans le GET /api/elevage/lots pour afficher le nombre dans le tableau

- [ ] Task 6 : Section historique sur la page parcelle (AC: #6)
  - [ ] 6.1 Creer une API ou un query param pour recuperer les deplacements d'une parcelle :
    - Soit GET `/api/elevage/deplacements?parcelleId=XXX`
    - Soit enrichir GET `/api/carte/[id]` avec les deplacements
  - [ ] 6.2 Sur la page `/parcelles/[id]`, ajouter une section "Historique des deplacements" apres la section Lots
  - [ ] 6.3 Afficher : date, lot (nom + espece), origine → destination, note

- [ ] Task 7 : Verification (AC: tous)
  - [ ] 7.1 `npx prisma generate` → schema valide
  - [ ] 7.2 `npm run build` → 0 erreur TypeScript
  - [ ] 7.3 `rm -rf .next && fuser -k 3000/tcp 2>/dev/null && docker compose up -d --build app`
  - [ ] 7.4 Tester le deplacement : lot avec parcelle A → selectionner parcelle B → verifier DeplacementLot cree + lot.parcelleGeoId = B
  - [ ] 7.5 Tester le premier placement : lot sans parcelle → assigner parcelle → verifier DeplacementLot avec parcelleOrigineId = null
  - [ ] 7.6 Tester la validation : tenter de deplacer vers la meme parcelle → erreur
  - [ ] 7.7 Tester l'historique : verifier que les deplacements apparaissent chronologiquement
  - [ ] 7.8 `docker compose logs app --tail 20` → pas d'erreur runtime

## Dev Notes

### ATTENTION : Le modele s'appelle ParcelleGeo (pas Parcelle)

Le modele Prisma est `ParcelleGeo` (table SQL `parcelles_geo`). Les FK utilisent des suffixes `Id` referant a ParcelleGeo.

### Prisma : relations nommees obligatoires

Le modele `DeplacementLot` a DEUX FK vers `ParcelleGeo` (`parcelleOrigineId` et `parcelleDestinationId`). Prisma exige des **relations nommees** quand un modele a plusieurs FK vers le meme modele. Utiliser :
```prisma
parcelleOrigine       ParcelleGeo? @relation("DeplacementOrigine", ...)
parcelleDestination   ParcelleGeo  @relation("DeplacementDestination", ...)
```

Et sur ParcelleGeo :
```prisma
deplacementsOrigine     DeplacementLot[] @relation("DeplacementOrigine")
deplacementsDestination DeplacementLot[] @relation("DeplacementDestination")
```

### Transaction atomique pour le deplacement

L'operation de deplacement DOIT etre atomique :
1. Creer le record DeplacementLot
2. Mettre a jour `lot.parcelleGeoId` vers la destination

Utiliser `prisma.$transaction()` :
```typescript
const [deplacement, updatedLot] = await prisma.$transaction([
  prisma.deplacementLot.create({
    data: {
      userId: session!.user.id,
      lotId: parseInt(id),
      parcelleOrigineId: lot.parcelleGeoId, // peut etre null (premier placement)
      parcelleDestinationId: body.parcelleDestinationId,
      dateHeure: body.dateHeure || new Date(),
      note: body.note || null,
    },
  }),
  prisma.lotAnimaux.update({
    where: { id: parseInt(id) },
    data: { parcelleGeoId: body.parcelleDestinationId },
  }),
])
```

### Validation cote API : pas de deplacement vers la meme parcelle

```typescript
if (lot.parcelleGeoId && lot.parcelleGeoId === body.parcelleDestinationId) {
  return NextResponse.json(
    { error: 'La parcelle de destination est identique a la parcelle actuelle' },
    { status: 400 }
  )
}
```

### Lot sans parcelle = premier placement

Si `lot.parcelleGeoId` est `null`, le deplacement est un premier placement. `parcelleOrigineId` est `null` dans le record. C'est valide et ne doit PAS lever d'erreur.

### Pattern du dialog deplacement (calquer le dialog abattage)

Le dialog abattage dans AnimauxTab.tsx (lignes 973-1033) est le pattern exact a suivre :

```typescript
// State
const [deplacerDialog, setDeplacerDialog] = React.useState<Lot | null>(null)
const [deplacerForm, setDeplacerForm] = React.useState({
  parcelleDestinationId: "",
  dateHeure: new Date().toISOString().split('T')[0],
  note: "",
})

// Bouton dans le tableau (a cote du bouton abattage, ligne ~946-960)
<TooltipProvider delayDuration={100}>
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={() => {
          setDeplacerForm(f => ({ ...f, parcelleDestinationId: "", dateHeure: new Date().toISOString().split('T')[0], note: "" }))
          setDeplacerDialog(lot)
        }}
        className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600"
      >
        <ArrowRightLeft className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent>Deplacer</TooltipContent>
  </Tooltip>
</TooltipProvider>

// Dialog (apres le dialog abattage)
<Dialog open={!!deplacerDialog} onOpenChange={(open) => { if (!open) setDeplacerDialog(null) }}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <ArrowRightLeft className="h-5 w-5 text-blue-500" />
        Deplacer un lot
      </DialogTitle>
      <DialogDescription>
        {deplacerDialog?.nom || `Lot #${deplacerDialog?.id}`} — {deplacerDialog?.especeAnimale.nom}
        {deplacerDialog?.parcelleGeo ? ` (actuellement : ${deplacerDialog.parcelleGeo.nom})` : ' (aucune parcelle)'}
      </DialogDescription>
    </DialogHeader>
    <form onSubmit={handleDeplacerSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Parcelle de destination *</Label>
        <select
          value={deplacerForm.parcelleDestinationId}
          onChange={(e) => setDeplacerForm(f => ({ ...f, parcelleDestinationId: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          required
        >
          <option value="">Selectionner...</option>
          {parcelles
            .filter(p => p.id !== deplacerDialog?.parcelleGeo?.id)
            .map(p => <option key={p.id} value={p.id}>{p.nom}</option>)
          }
        </select>
      </div>
      <div className="space-y-2">
        <Label>Date</Label>
        <Input type="date" value={deplacerForm.dateHeure} onChange={(e) => setDeplacerForm(f => ({ ...f, dateHeure: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Note (optionnel)</Label>
        <Textarea value={deplacerForm.note} onChange={(e) => setDeplacerForm(f => ({ ...f, note: e.target.value }))} rows={2} placeholder="Rotation paturage, raison du deplacement..." />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => setDeplacerDialog(null)}>Annuler</Button>
        <Button type="submit" disabled={!deplacerForm.parcelleDestinationId}>Deplacer</Button>
      </div>
    </form>
  </DialogContent>
</Dialog>
```

### Icones a importer

Ajouter dans les imports de AnimauxTab.tsx :
```typescript
import { ArrowRightLeft, History } from "lucide-react"
```

`ArrowRightLeft` pour le bouton/dialog deplacement, `History` pour le bouton historique.

### API route pattern : /api/elevage/lots/[id]/deplacements

Creer le dossier `src/app/api/elevage/lots/[id]/deplacements/route.ts`. Le pattern Next.js 16 pour les params :
```typescript
type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const { id } = await params
  // Verifier ownership du lot
  const lot = await prisma.lotAnimaux.findFirst({
    where: { id: parseInt(id), userId: session!.user.id },
  })
  if (!lot) return NextResponse.json({ error: 'Lot non trouve' }, { status: 404 })
  // ...
}
```

### Enrichir le GET /api/elevage/lots pour le compteur de deplacements

Ajouter `deplacements: true` dans le `_count.select` (ligne ~38-43 de lots/route.ts) :
```typescript
_count: {
  select: {
    animaux: true,
    productionsOeufs: true,
    soins: true,
    deplacements: true,  // AJOUTER
  },
},
```

Cela permet d'afficher un badge ou compteur dans le tableau sans fetch supplementaire.

### Ne PAS modifier le PATCH existant

Le PATCH `/api/elevage/lots` (ligne 139) met deja a jour `parcelleGeoId` directement. Ce mecanisme RESTE valide pour l'assignation simple (ParcelleAssignButton). Le deplacement passe par la NOUVELLE route `/api/elevage/lots/[id]/deplacements` qui cree l'historique EN PLUS de mettre a jour le lot.

### DEPENDANCE : prisma db push (pas migrate dev)

`prisma migrate dev` est casse (shadow database). Utiliser `npx prisma db push` pour appliquer le nouveau modele. C'est suffisant pour un ajout de table.

### Composants UI a utiliser (ne pas recreer)

- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` depuis `@/components/ui/dialog`
- `Button` depuis `@/components/ui/button`
- `Input` depuis `@/components/ui/input`
- `Label` depuis `@/components/ui/label`
- `Textarea` depuis `@/components/ui/textarea`
- `Badge` depuis `@/components/ui/badge`
- `Tooltip`, `TooltipProvider`, `TooltipTrigger`, `TooltipContent` depuis `@/components/ui/tooltip`
- `<select>` HTML natif pour la parcelle destination (coherent avec migration Radix → natif)
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `TableHead` depuis `@/components/ui/table`

### Project Structure Notes

**Fichiers a CREER :**
- `src/app/api/elevage/lots/[id]/deplacements/route.ts` — API POST + GET deplacements
- `src/lib/validations/elevage-deplacement.ts` — Schema Zod

**Fichiers a MODIFIER :**
- `prisma/schema.prisma` — Ajouter modele DeplacementLot + relations inverses sur LotAnimaux, ParcelleGeo, User
- `src/components/elevage/AnimauxTab.tsx` — Ajouter dialog deplacement + bouton dans tableau + dialog historique
- `src/app/api/elevage/lots/route.ts` — Ajouter `deplacements: true` dans `_count.select` du GET
- `src/lib/validations/index.ts` — Exporter le nouveau schema
- `src/app/parcelles/[id]/page.tsx` — Ajouter section historique deplacements (si page existe)

**Fichiers a NE PAS TOUCHER :**
- `src/app/api/elevage/lots/route.ts` PATCH — le mecanisme d'assignation directe reste valide
- `src/components/elevage/AnimauxTab.tsx` lignes 1038-1069 (ParcelleAssignButton) — reste valide pour assignation simple

### Intelligence Stories precedentes

- **Story 1.5** : le rattachement lot/parcelle fonctionne deja (PATCH + UI). Cette story ajoute l'HISTORIQUE des deplacements.
- **Story 1.3/1.4** : la page `/parcelles/[id]` est a creer ou enrichir. Cette story ajoute la section historique deplacements.
- `prisma migrate dev` est casse → `prisma db push`.
- IDs parcelles = CUID (string). IDs lots = int (autoincrement).
- `fuser -k 3000/tcp` avant chaque rebuild Docker.

### Git Intelligence

Derniers commits :
- `a162a1a feat: ajout modules verger, elevage, comptabilite + ameliorations globales`
- `abbb4bd fix: ajouter champs qualite sol au schema validation`

Conventions : prefixes `feat:`, `fix:`, `refactor:` en francais.

### References

- [Source: docs/planning-artifacts/epics.md lignes 364-397] — Story 1.6 dans les epics
- [Source: docs/planning-artifacts/prd.md] — PRD Phase 1 (FR9: deplacer lots, FR10: historique deplacements)
- [Source: docs/implementation-artifacts/1-5-rattachement-lots-animaux-parcelles.md] — Story precedente
- [Source: src/app/api/elevage/lots/route.ts] — API lots actuelle (GET/POST/PATCH/DELETE)
- [Source: src/components/elevage/AnimauxTab.tsx lignes 731-1069] — LotsSubTab + dialog abattage (pattern)
- [Source: src/lib/validations/elevage-lot.ts] — Validation lots (pattern)
- [Source: prisma/schema.prisma] — LotAnimaux (lignes 1064-1095), ParcelleGeo (lignes 399-445)
- [Source: docs/project-context.md] — Regles projet (transactions atomiques, multi-tenancy, Next.js 16 async params)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Change Log

### File List
