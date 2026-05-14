# Story 2.1 : Modele Transaction unifie et migration

Status: ready-for-dev

## Story

As a utilisateur de Gleba,
I want que mes revenus et depenses soient stockes dans un modele unique plutot que dans des tables separees (VenteManuelle, DepenseManuelle),
So that je puisse avoir une comptabilite coherente et unifiee quel que soit le module source.

## Acceptance Criteria

1. **Modele Transaction cree** : Un nouveau modele Prisma `Transaction` existe avec les champs : id (Int autoincrement), type (enum TypeTransaction : REVENU, DEPENSE, MOUVEMENT_INTERNE), montant (Float), description (String), categorie (String), date (DateTime), auto (Boolean default false), sourceType (String nullable), sourceId (Int nullable), userId (String FK User), tauxTVA (Float), montantHT (Float nullable), montantTVA (Float nullable), module (String nullable), paye (Boolean default true), clientId (Int nullable FK Client), clientNom (String nullable), fournisseurId (String nullable), fournisseurNom (String nullable), quantite (Float nullable), unite (String nullable), prixUnitaire (Float nullable), refFacture (String nullable), dateEcheance (DateTime nullable), notes (String nullable), createdAt (DateTime).

2. **Coexistence** : Les tables VenteManuelle et DepenseManuelle restent en place — aucune suppression ni modification de ces modeles. La migration est non-destructive.

3. **API GET /api/comptabilite/transactions** : Retourne les transactions de l'utilisateur connecte filtrees par userId, avec support des query params : type, dateDebut, dateFin, sourceType, module, categorie. Pagination via limit/offset.

4. **API POST /api/comptabilite/transactions** : Cree une transaction manuelle (auto=false, sans sourceType/sourceId). Validation Zod obligatoire. Calcul automatique de montantHT et montantTVA a partir de montant et tauxTVA.

5. **API PUT /api/comptabilite/transactions/[id]** : Met a jour une transaction. Si auto=true, seule la description et les notes sont modifiables. Verification ownership (userId).

6. **API DELETE /api/comptabilite/transactions/[id]** : Supprime une transaction. Si auto=true, la suppression est refusee avec message "Les ecritures auto-generees sont gerees par le systeme. Supprimez l'evenement source." Verification ownership.

7. **Migration des donnees existantes** : Toutes les lignes de VenteManuelle sont copiees dans Transaction (type=REVENU) et toutes les lignes de DepenseManuelle sont copiees dans Transaction (type=DEPENSE). La migration est executee dans des transactions SQL atomiques avec verification de coherence (row count + somme des montants). Les anciennes tables restent en place comme backup. Aucune donnee utilisateur ne doit etre perdue.

## Tasks / Subtasks

- [ ] Task 1 : Creer le modele Prisma Transaction (AC: #1, #2)
  - [ ] 1.1 Ajouter l'enum `TypeTransaction` dans `prisma/schema.prisma` :
    ```prisma
    enum TypeTransaction {
      REVENU
      DEPENSE
      MOUVEMENT_INTERNE
    }
    ```
  - [ ] 1.2 Ajouter le modele `Transaction` dans `prisma/schema.prisma` :
    ```prisma
    model Transaction {
      id              Int              @id @default(autoincrement())
      userId          String           @map("user_id")
      user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
      type            TypeTransaction  @map("type")
      date            DateTime         @default(now()) @map("date")
      categorie       String           @map("categorie")
      description     String           @map("description")
      quantite        Float?           @map("quantite")
      unite           String?          @map("unite")
      prixUnitaire    Float?           @map("prix_unitaire")
      tauxTVA         Float            @default(5.5) @map("taux_tva")
      montantHT       Float?           @map("montant_ht")
      montantTVA      Float?           @map("montant_tva")
      montant         Float            @map("montant")
      clientId        Int?             @map("client_id")
      client          Client?          @relation(fields: [clientId], references: [id], onDelete: SetNull)
      clientNom       String?          @map("client_nom")
      fournisseurId   String?          @map("fournisseur_id")
      fournisseurNom  String?          @map("fournisseur_nom")
      refFacture      String?          @map("ref_facture")
      module          String?          @map("module")
      paye            Boolean          @default(true) @map("paye")
      dateEcheance    DateTime?        @map("date_echeance")
      sourceType      String?          @map("source_type")
      sourceId        Int?             @map("source_id")
      auto            Boolean          @default(false) @map("auto")
      notes           String?          @map("notes")
      createdAt       DateTime         @default(now()) @map("created_at")

      @@index([userId])
      @@index([date])
      @@index([type])
      @@index([categorie])
      @@index([sourceType, sourceId])
      @@index([clientId])
      @@map("transactions")
    }
    ```
  - [ ] 1.3 Ajouter la relation inverse sur User : `transactions Transaction[]`
  - [ ] 1.4 Ajouter la relation inverse sur Client : `transactions Transaction[]`
  - [ ] 1.5 NE PAS toucher aux modeles VenteManuelle et DepenseManuelle — ils restent intacts
  - [ ] 1.6 Appliquer : `npx prisma db push` (prisma migrate dev est casse, voir notes)
  - [ ] 1.7 Regenerer le client : `npx prisma generate`

- [ ] Task 2 : Creer le schema de validation Zod (AC: #4, #5)
  - [ ] 2.1 Creer `src/lib/validations/transaction.ts` :
    ```typescript
    import { z } from 'zod'

    export const createTransactionSchema = z.object({
      type: z.enum(['REVENU', 'DEPENSE', 'MOUVEMENT_INTERNE']),
      date: z.coerce.date().optional(),
      categorie: z.string().min(1, 'Categorie requise'),
      description: z.string().min(1, 'Description requise').max(500),
      quantite: z.number().min(0).nullable().optional(),
      unite: z.string().max(50).nullable().optional(),
      prixUnitaire: z.number().min(0).nullable().optional(),
      tauxTVA: z.number().min(0).max(100).optional(),
      montant: z.number().min(0, 'Montant requis'),
      montantHT: z.number().min(0).nullable().optional(),
      montantTVA: z.number().min(0).nullable().optional(),
      clientId: z.number().int().nullable().optional(),
      clientNom: z.string().max(200).nullable().optional(),
      fournisseurId: z.string().nullable().optional(),
      fournisseurNom: z.string().max(200).nullable().optional(),
      refFacture: z.string().max(100).nullable().optional(),
      module: z.string().max(50).nullable().optional(),
      paye: z.boolean().optional().default(true),
      dateEcheance: z.coerce.date().nullable().optional(),
      notes: z.string().max(5000).nullable().optional(),
    })

    export const updateTransactionSchema = createTransactionSchema.partial().extend({
      id: z.number().int().min(1, 'ID requis'),
    })
    ```
  - [ ] 2.2 Ajouter les exports dans `src/lib/validations/index.ts` :
    ```typescript
    export { createTransactionSchema, updateTransactionSchema } from './transaction'
    ```

- [ ] Task 3 : Creer l'API GET/POST /api/comptabilite/transactions (AC: #3, #4)
  - [ ] 3.1 Creer `src/app/api/comptabilite/transactions/route.ts`
  - [ ] 3.2 Implementer GET :
    - `requireAuthApi()` depuis `@/lib/auth`
    - Query params : `type`, `dateDebut`, `dateFin`, `sourceType`, `module`, `categorie`, `limit` (default 100), `offset` (default 0)
    - Filtrer par `userId: session!.user.id`
    - Ordonner par `date: 'desc'`
    - Retourner `{ data: transactions, meta: { total, limit, offset } }`
  - [ ] 3.3 Implementer POST :
    - `requireAuthApi()`
    - Valider avec `createTransactionSchema`
    - Forcer `auto: false`, `sourceType: null`, `sourceId: null` (creation manuelle)
    - Calculer montantHT/montantTVA via `calculTVA()` de `@/lib/auto-compta`
    - Creer avec `userId: session!.user.id`
    - Retourner la transaction creee

- [ ] Task 4 : Creer l'API PUT/DELETE /api/comptabilite/transactions/[id] (AC: #5, #6)
  - [ ] 4.1 Creer `src/app/api/comptabilite/transactions/[id]/route.ts`
  - [ ] 4.2 Implementer PUT :
    - `requireAuthApi()`
    - `const { id } = await params` (Next.js 16 async params)
    - Verifier existence + ownership : `prisma.transaction.findFirst({ where: { id: parseInt(id), userId: session!.user.id } })`
    - Si `auto === true` : n'autoriser que la modification de `description` et `notes`, ignorer les autres champs
    - Sinon : valider avec `updateTransactionSchema`, recalculer montantHT/montantTVA si montant ou tauxTVA change
    - Retourner la transaction mise a jour
  - [ ] 4.3 Implementer DELETE :
    - `requireAuthApi()`
    - Verifier existence + ownership
    - Si `auto === true` : retourner 400 avec message "Les ecritures auto-generees sont gerees par le systeme. Supprimez l'evenement source."
    - Sinon : supprimer et retourner 200

- [ ] Task 5 : Migration des donnees existantes (AC: #7)
  - [ ] 5.1 Compter les enregistrements existants AVANT migration :
    ```sql
    SELECT 'ventes_manuelles' AS table_name, COUNT(*) AS row_count FROM ventes_manuelles
    UNION ALL
    SELECT 'depenses_manuelles', COUNT(*) FROM depenses_manuelles;
    ```
  - [ ] 5.2 Executer la migration VenteManuelle → Transaction (REVENU) dans une transaction atomique :
    ```sql
    BEGIN;

    INSERT INTO transactions (
      user_id, type, date, categorie, description,
      quantite, unite, prix_unitaire,
      taux_tva, montant_ht, montant_tva, montant,
      client_id, client_nom,
      module, paye, source_type, source_id, auto, notes, created_at
    )
    SELECT
      user_id, 'REVENU', date, categorie, description,
      quantite, unite, prix_unitaire,
      taux_tva, montant_ht, montant_tva, montant,
      client_id, client_nom,
      module, paye, source_type, source_id, auto, notes, created_at
    FROM ventes_manuelles;

    -- Verification post-insert : le nombre de REVENU doit correspondre au nombre de ventes_manuelles
    DO $$
    DECLARE
      count_source INT;
      count_target INT;
    BEGIN
      SELECT COUNT(*) INTO count_source FROM ventes_manuelles;
      SELECT COUNT(*) INTO count_target FROM transactions WHERE type = 'REVENU';
      IF count_source <> count_target THEN
        RAISE EXCEPTION 'Migration VenteManuelle echouee : % source vs % cible', count_source, count_target;
      END IF;
      RAISE NOTICE 'Migration VenteManuelle OK : % enregistrements migres', count_source;
    END $$;

    COMMIT;
    ```
  - [ ] 5.3 Executer la migration DepenseManuelle → Transaction (DEPENSE) dans une transaction atomique :
    ```sql
    BEGIN;

    INSERT INTO transactions (
      user_id, type, date, categorie, description,
      taux_tva, montant_ht, montant_tva, montant,
      fournisseur_id, fournisseur_nom, ref_facture,
      module, paye, date_echeance, source_type, source_id, auto, notes, created_at
    )
    SELECT
      user_id, 'DEPENSE', date, categorie, description,
      taux_tva, montant_ht, montant_tva, montant,
      fournisseur_id, fournisseur_nom, ref_facture,
      module, paye, date_echeance, source_type, source_id, auto, notes, created_at
    FROM depenses_manuelles;

    -- Verification post-insert
    DO $$
    DECLARE
      count_source INT;
      count_target INT;
    BEGIN
      SELECT COUNT(*) INTO count_source FROM depenses_manuelles;
      SELECT COUNT(*) INTO count_target FROM transactions WHERE type = 'DEPENSE';
      IF count_source <> count_target THEN
        RAISE EXCEPTION 'Migration DepenseManuelle echouee : % source vs % cible', count_source, count_target;
      END IF;
      RAISE NOTICE 'Migration DepenseManuelle OK : % enregistrements migres', count_source;
    END $$;

    COMMIT;
    ```
  - [ ] 5.4 Verification croisee des montants totaux :
    ```sql
    -- Les totaux doivent correspondre exactement
    SELECT 'ventes_manuelles' AS source, SUM(montant) AS total FROM ventes_manuelles
    UNION ALL
    SELECT 'transactions REVENU', SUM(montant) FROM transactions WHERE type = 'REVENU'
    UNION ALL
    SELECT 'depenses_manuelles', SUM(montant) FROM depenses_manuelles
    UNION ALL
    SELECT 'transactions DEPENSE', SUM(montant) FROM transactions WHERE type = 'DEPENSE';
    ```
  - [ ] 5.5 Verification des liens auto-compta migres (sourceType/sourceId) :
    ```sql
    -- Chaque couple sourceType/sourceId doit exister dans les deux tables
    SELECT source_type, COUNT(*) AS count_ventes FROM ventes_manuelles WHERE auto = true GROUP BY source_type
    UNION ALL
    SELECT source_type, COUNT(*) FROM transactions WHERE auto = true AND type = 'REVENU' GROUP BY source_type;
    ```
  - [ ] 5.6 NE PAS supprimer les anciennes tables — elles servent de backup jusqu'a validation complete en production

- [ ] Task 6 : Verification (AC: tous)
  - [ ] 6.1 `npx prisma generate` → schema valide
  - [ ] 6.2 `npm run build` → 0 erreur TypeScript
  - [ ] 6.3 `rm -rf .next && fuser -k 3000/tcp 2>/dev/null && docker compose up -d --build app`
  - [ ] 6.4 Tester GET /api/comptabilite/transactions → 200, retourne les donnees migrees
  - [ ] 6.5 Tester POST /api/comptabilite/transactions avec type REVENU → 200, transaction creee
  - [ ] 6.6 Tester POST /api/comptabilite/transactions avec type DEPENSE → 200, transaction creee
  - [ ] 6.7 Tester PUT /api/comptabilite/transactions/[id] → mise a jour reussie
  - [ ] 6.8 Tester DELETE /api/comptabilite/transactions/[id] sur transaction manuelle → 200
  - [ ] 6.9 Creer une transaction auto (directement en BDD) puis tester DELETE → 400 avec message de refus
  - [ ] 6.10 Verifier que les tables VenteManuelle et DepenseManuelle sont intactes et fonctionnelles
  - [ ] 6.11 Verifier que GET /api/comptabilite/transactions retourne autant d'entrees que ventes_manuelles + depenses_manuelles
  - [ ] 6.12 `docker compose logs app --tail 20` → pas d'erreur runtime

## Dev Notes

### ATTENTION : Le nom de table SQL est `transactions`

Le modele Prisma s'appelle `Transaction` (PascalCase) et est mappe sur la table SQL `transactions` via `@@map("transactions")`. Le client Prisma utilisera `prisma.transaction` (camelCase).

**Attention au conflit de noms** : `prisma.$transaction()` (la methode Prisma pour les transactions atomiques) et `prisma.transaction` (le modele) ont des noms similaires. Ne pas confondre :
- `prisma.$transaction([...])` = transaction atomique Prisma (methode)
- `prisma.transaction.create({...})` = creer un enregistrement Transaction (modele)

### Champs fusionnes des deux modeles existants

Le modele Transaction unifie les champs de VenteManuelle ET DepenseManuelle :

| Champ | Origine | Notes |
|-------|---------|-------|
| clientId (Int?) | VenteManuelle | FK vers Client, SetNull on delete |
| clientNom (String?) | VenteManuelle | Fallback si pas de fiche client |
| fournisseurId (String?) | DepenseManuelle | Attention : type String (pas Int) |
| fournisseurNom (String?) | DepenseManuelle | Fallback si pas de fiche fournisseur |
| quantite, unite, prixUnitaire | VenteManuelle | Optionnels pour les depenses aussi |
| refFacture (String?) | DepenseManuelle | Reference facture fournisseur |
| dateEcheance (DateTime?) | DepenseManuelle | Pour les echeances non payees |

### TVA : reutiliser calculTVA() existant

La fonction `calculTVA(montantTTC, taux)` existe deja dans `@/lib/auto-compta.ts`. Elle calcule montantHT et montantTVA a partir du montant TTC. L'utiliser dans les routes POST et PUT au lieu de reimplementer le calcul.

```typescript
import { calculTVA } from '@/lib/auto-compta'

// Dans POST/PUT :
const tauxTVA = validated.tauxTVA ?? (validated.type === 'DEPENSE' ? 20 : 5.5)
const { montantHT, montantTVA: calculatedTVA } = calculTVA(validated.montant, tauxTVA)
```

### TVA par defaut selon le type

- **REVENU** : tauxTVA defaut 5.5% (produits alimentaires)
- **DEPENSE** : tauxTVA defaut 20% (materiel, intrants)
- **MOUVEMENT_INTERNE** : montant = 0, pas de TVA

### Pattern API route Next.js 16 (async params)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createTransactionSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const dateDebut = searchParams.get('dateDebut')
  const dateFin = searchParams.get('dateFin')
  // ... construire le where dynamiquement

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: session!.user.id,
      ...(type && { type: type as any }),
      ...(dateDebut && { date: { gte: new Date(dateDebut) } }),
      // etc.
    },
    orderBy: { date: 'desc' },
    take: limit,
    skip: offset,
  })
  // ...
}
```

Pour la route [id] :
```typescript
type RouteParams = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const { id } = await params
  // parseInt(id) et isNaN() check
}
```

### CRITIQUE : Migration des donnees utilisateur (zero perte)

La Task 5 migre les donnees existantes des utilisateurs vers la table `transactions`. C'est une etape **obligatoire** — sans elle, la page transactions serait vide apres le deploiement car les anciennes pages (`depenses-manuelles`, `ventes-manuelles`, `revenus`) sont supprimees du frontend.

**Ordre d'execution :**
1. Task 1-4 : Creer le modele + APIs (table vide)
2. Task 5 : Migrer les donnees (table remplie avec l'historique)
3. Task 6 : Verifier que tout fonctionne avec les donnees migrees

**Rollback en cas de probleme :**
- Les anciennes tables restent intactes → l'ancien code peut toujours les lire
- Si la migration echoue (ROLLBACK automatique), aucune donnee n'est perdue
- Ne supprimer les anciennes tables qu'apres validation complete en production (story separee)

### NE PAS modifier auto-compta.ts dans cette story

Cette story cree UNIQUEMENT le modele et les APIs CRUD manuelles. La migration de `auto-compta.ts` pour ecrire dans Transaction au lieu de VenteManuelle/DepenseManuelle sera faite dans la Story 2.2. Ne pas anticiper.

### NE PAS modifier la page transactions existante

La page `src/app/comptabilite/transactions/page.tsx` sera refaite dans la Story 2.3. Pour l'instant, elle continue de fonctionner avec les anciens endpoints (`/api/comptabilite/revenus` et `/api/comptabilite/depenses`). Ne pas la toucher.

### Enum Prisma : ne pas utiliser de string literal

Le type `TypeTransaction` est un enum Prisma. Dans le code TypeScript, utiliser les valeurs de l'enum :

```typescript
import { TypeTransaction } from '@prisma/client'

// Pour le filtre par type dans GET :
...(type && { type: type as TypeTransaction })

// Pour les valeurs par defaut dans POST :
// Le schema Zod valide deja 'REVENU' | 'DEPENSE' | 'MOUVEMENT_INTERNE'
// Prisma accepte ces string literals car elles correspondent a l'enum
```

### Index composite pour les ecritures auto

L'index `@@index([sourceType, sourceId])` est critique pour :
- La recherche rapide d'ecritures auto par source (utilise par auto-compta pour eviter les doublons)
- La suppression cascade quand la source est supprimee
- Cet index existe deja sur VenteManuelle et DepenseManuelle — le reproduire sur Transaction

### Checklist de verification multi-tenancy

CHAQUE requete Prisma dans les routes DOIT inclure `userId: session!.user.id` :
- GET : `where: { userId: session!.user.id, ... }`
- PUT/DELETE : `findFirst({ where: { id: parseInt(id), userId: session!.user.id } })`
- POST : `create({ data: { userId: session!.user.id, ... } })`

Ne JAMAIS permettre a un utilisateur d'acceder aux transactions d'un autre.

### DEPENDANCE : prisma db push (pas migrate dev)

`prisma migrate dev` est casse (shadow database). Utiliser `npx prisma db push` pour appliquer le nouveau modele. C'est suffisant pour un ajout de table + enum.

### Composants UI — non concerne par cette story

Cette story est 100% backend (schema + APIs). Aucun composant React a creer ou modifier.

### Project Structure Notes

**Fichiers a CREER :**
- `src/lib/validations/transaction.ts` — Schema Zod pour Transaction
- `src/app/api/comptabilite/transactions/route.ts` — API GET + POST
- `src/app/api/comptabilite/transactions/[id]/route.ts` — API PUT + DELETE

**Fichiers a MODIFIER :**
- `prisma/schema.prisma` — Ajouter enum TypeTransaction + modele Transaction + relations inverses sur User et Client
- `src/lib/validations/index.ts` — Ajouter export du nouveau schema

**Fichiers a NE PAS TOUCHER :**
- `src/lib/auto-compta.ts` — sera modifie en Story 2.2
- `src/app/comptabilite/transactions/page.tsx` — sera refaite en Story 2.3
- `src/app/api/comptabilite/revenus/route.ts` — reste fonctionnel pour l'ancienne page
- `src/app/api/comptabilite/depenses/route.ts` — reste fonctionnel pour l'ancienne page
- `src/app/api/comptabilite/ventes-manuelles/route.ts` — reste fonctionnel (coexistence)
- `src/app/api/comptabilite/depenses-manuelles/route.ts` — reste fonctionnel (coexistence)
- Les modeles `VenteManuelle` et `DepenseManuelle` dans le schema Prisma — intacts

### Intelligence Stories precedentes (Epic 1)

- **Story 1.1-1.6** : Parcelles. Le pattern API est identique : `requireAuthApi()` → validation Zod → Prisma → NextResponse.json()
- `prisma migrate dev` est casse → utiliser `prisma db push`
- IDs utilisateurs = String (cuid). IDs entites metier = Int (autoincrement) sauf ParcelleGeo (String cuid).
- `fuser -k 3000/tcp` avant chaque rebuild Docker.
- Pattern pour filtrer les query params dynamiquement :
  ```typescript
  const where: any = { userId: session!.user.id }
  if (type) where.type = type
  if (dateDebut) where.date = { ...where.date, gte: new Date(dateDebut) }
  if (dateFin) where.date = { ...where.date, lte: new Date(dateFin) }
  ```
- Note du fournisseurId : c'est un **String** (pas Int) sur DepenseManuelle — reproduire ce type sur Transaction.

### Git Intelligence

Derniers commits :
- `a162a1a feat: ajout modules verger, elevage, comptabilite + ameliorations globales`
- `abbb4bd fix: ajouter champs qualite sol au schema validation`

Conventions : prefixes `feat:`, `fix:`, `refactor:` en francais.

### References

- [Source: docs/planning-artifacts/epics.md lignes 400-437] — Story 2.1 dans les epics
- [Source: docs/planning-artifacts/prd.md] — PRD Phase 3 (FR17-FR21: comptabilite unifiee)
- [Source: docs/architecture.md] — Architecture comptabilite + auto-compta pattern
- [Source: docs/project-context.md] — Regles projet (transactions atomiques, multi-tenancy, Next.js 16 async params)
- [Source: src/lib/auto-compta.ts] — Module auto-compta existant (calculTVA, findAutoEntry, deleteAutoEntry)
- [Source: prisma/schema.prisma] — VenteManuelle (lignes 1362-1396), DepenseManuelle (lignes 1399-1431), Client
- [Source: src/lib/validations/vente-manuelle.ts] — Pattern validation Zod ventes
- [Source: src/lib/validations/depense-manuelle.ts] — Pattern validation Zod depenses
- [Source: src/app/api/comptabilite/ventes-manuelles/route.ts] — Pattern API comptabilite existant
- [Source: docs/implementation-artifacts/1-6-deplacement-lots-entre-parcelles.md] — Derniere story implementee

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

### Change Log

### File List
