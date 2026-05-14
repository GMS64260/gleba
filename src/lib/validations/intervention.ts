import { z } from 'zod'

export const createInterventionSchema = z.object({
  date: z.coerce.date(),
  type: z.string().min(1, 'Type requis'),
  cultureId: z.number().int().nullable().optional(),
  plancheId: z.string().nullable().optional(),
  arbreId: z.number().int().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  dureeMinutes: z.number().int().min(0).nullable().optional(),
  nbPersonnes: z.number().int().min(1).optional().default(1),
  coutMainOeuvre: z.number().min(0).nullable().optional(),
  coutTotal: z.number().min(0).nullable().optional(),
  datePrevue: z.coerce.date().nullable().optional(),
  fait: z.boolean().optional().default(true),
  // Phyto
  produitPhyto: z.string().max(200).nullable().optional(),
  numAMM: z.string().max(50).nullable().optional(),
  cibleTraitement: z.string().max(200).nullable().optional(),
  doseAppliquee: z.number().min(0).nullable().optional(),
  uniteDose: z.string().max(50).nullable().optional(),
  surfaceTraitee: z.number().min(0).nullable().optional(),
  dar: z.number().int().min(0).nullable().optional(),
  delaiReentree: z.number().int().min(0).nullable().optional(),
  conditionsMeteo: z.string().max(200).nullable().optional(),
  // Intrant
  intrantNom: z.string().max(200).nullable().optional(),
  intrantQuantite: z.number().min(0).nullable().optional(),
  intrantUnite: z.string().max(50).nullable().optional(),
  intrantCout: z.number().min(0).nullable().optional(),
  intrantNumLot: z.string().max(100).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

export const updateInterventionSchema = createInterventionSchema.partial().extend({
  id: z.number().int().min(1, 'ID requis'),
})
