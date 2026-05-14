import { z } from 'zod'

export const TRAITES = ['Matin', 'Soir', 'Unique'] as const

export const collecteLaitSchema = z
  .object({
    date: z.coerce.date(),
    traite: z.enum(TRAITES),
    animalId: z.coerce.number().int().positive().nullable().optional(),
    lotId: z.coerce.number().int().positive().nullable().optional(),
    quantiteLitres: z.coerce.number().min(0).max(100),
    mgGpl: z.coerce.number().min(0).max(80).nullable().optional(),
    mpGpl: z.coerce.number().min(0).max(80).nullable().optional(),
    cellulesParMl: z.coerce.number().int().min(0).nullable().optional(),
    temperatureC: z.coerce.number().min(-10).max(50).nullable().optional(),
    ecarteAttente: z.boolean().optional().default(false),
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
    quantiteLitres: z.coerce.number().min(0).max(100).optional(),
    mgGpl: z.coerce.number().min(0).max(80).nullable().optional(),
    mpGpl: z.coerce.number().min(0).max(80).nullable().optional(),
    cellulesParMl: z.coerce.number().int().min(0).nullable().optional(),
    temperatureC: z.coerce.number().min(-10).max(50).nullable().optional(),
    ecarteAttente: z.boolean().optional(),
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
