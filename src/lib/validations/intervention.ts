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
  // PROMPT 11 LOT B/D — Réglementaire phyto + traçabilité PBI
  produitPhytoId: z.string().nullable().optional(),
  volumeBouillieLHa: z.number().min(0).nullable().optional(),
  temperatureC: z.number().nullable().optional(),
  ventKmh: z.number().min(0).nullable().optional(),
  hygrometriePct: z.number().int().min(0).max(100).nullable().optional(),
  operateurId: z.string().nullable().optional(),
  certiphytoNum: z.string().max(50).nullable().optional(),
  certiphytoValidite: z.coerce.date().nullable().optional(),
  justification: z.string().max(2000).nullable().optional(),
  observationLieeId: z.number().int().nullable().optional(),
})

export const updateInterventionSchema = createInterventionSchema.partial().extend({
  id: z.number().int().min(1, 'ID requis'),
})
