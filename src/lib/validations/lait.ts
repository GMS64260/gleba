import { z } from 'zod'

export const TRAITES = ['Matin', 'Soir', 'Unique'] as const

/**
 * Borne technique d'une traite, individuelle ou de lot (revue du 2026-11-01).
 * Le contrôle métier est le plafond indicatif par espèce et par effectif
 * (`plafondCollecteLait`), dépassable sur confirmation : une borne fixe de
 * 100 L refusait la traite d'un grand troupeau de chèvres avant même la
 * confirmation. Celle-ci n'arrête que les saisies absurdes.
 */
export const VOLUME_TRAITE_MAX_L = 20000
const quantiteTraite = z.coerce
  .number()
  .min(0)
  .max(VOLUME_TRAITE_MAX_L, { message: `Une traite ne peut pas dépasser ${VOLUME_TRAITE_MAX_L} L.` })

export const collecteLaitSchema = z
  .object({
    date: z.coerce.date(),
    traite: z.enum(TRAITES),
    animalId: z.coerce.number().int().positive().nullable().optional(),
    lotId: z.coerce.number().int().positive().nullable().optional(),
    quantiteLitres: quantiteTraite,
    mgGpl: z.coerce.number().min(0).max(80).nullable().optional(),
    mpGpl: z.coerce.number().min(0).max(80).nullable().optional(),
    cellulesParMl: z.coerce.number().int().min(0).max(20000, { message: 'Cellules en milliers/mL (ex. 1250 pour 1 250 000). Une valeur brute (> 20 000) est probablement une erreur d’unité.' }).nullable().optional(),
    temperatureC: z.coerce.number().min(-10).max(50).nullable().optional(),
    ecarteAttente: z.boolean().optional().default(false),
    confirmerVolumeInhabituel: z.boolean().optional().default(false),
    notes: z.string().max(2000).nullable().optional(),
    lotFromageId: z.string().nullable().optional(),
  })
  .refine(
    (d) => (d.animalId != null && !d.lotId) || (!d.animalId && d.lotId != null),
    { message: 'Renseignez soit animalId, soit lotId, mais pas les deux.' }
  )

export const updateCollecteLaitSchema = z
  .object({
    id: z.string().min(1),
    date: z.coerce.date().optional(),
    traite: z.enum(TRAITES).optional(),
    quantiteLitres: quantiteTraite.optional(),
    mgGpl: z.coerce.number().min(0).max(80).nullable().optional(),
    mpGpl: z.coerce.number().min(0).max(80).nullable().optional(),
    cellulesParMl: z.coerce.number().int().min(0).max(20000, { message: 'Cellules en milliers/mL (ex. 1250 pour 1 250 000). Une valeur brute (> 20 000) est probablement une erreur d’unité.' }).nullable().optional(),
    temperatureC: z.coerce.number().min(-10).max(50).nullable().optional(),
    ecarteAttente: z.boolean().optional(),
    confirmerVolumeInhabituel: z.boolean().optional().default(false),
    notes: z.string().max(2000).nullable().optional(),
    lotFromageId: z.string().nullable().optional(),
  })

export const TRAITEMENTS_THERMIQUES = ['cru', 'thermise', 'pasteurise'] as const

export const lotFromageSchema = z.object({
  dateFabrication: z.coerce.date(),
  typeFromage: z.string().min(1).max(100),
  volumeLaitUtiliseL: z.coerce.number().min(0),
  nbPieces: z.coerce.number().int().min(1),
  poidsTotalKg: z.coerce.number().min(0),
  dluo: z.coerce.date().nullable().optional(),
  statutBioSnapshot: z.string().nullable().optional(),
  traitementThermique: z.enum(TRAITEMENTS_THERMIQUES).optional().default('cru'),
  allergenes: z.string().max(500).nullable().optional(),
  numeroAgrement: z.string().max(50).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  // IDs de collectes à affecter au lot
  collecteIds: z.array(z.string()).optional().default([]),
})

export type CollecteLaitInput = z.infer<typeof collecteLaitSchema>
export type LotFromageInput = z.infer<typeof lotFromageSchema>
