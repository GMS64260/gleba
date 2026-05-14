import { z } from 'zod'

const JOURNAUX = ['VE', 'AC', 'BQ', 'CA', 'OD'] as const
const MODES_REGLEMENT = ['Espèces', 'Chèque', 'Virement', 'CB', 'Prélèvement', 'À crédit'] as const

export const createVenteManuelleSchema = z.object({
  date: z.coerce.date().optional(),
  categorie: z.string().min(1, 'Catégorie requise'),
  description: z.string().min(1, 'Description requise').max(500),
  quantite: z.number().min(0).nullable().optional(),
  unite: z.string().max(50).nullable().optional(),
  prixUnitaire: z.number().min(0).nullable().optional(),
  tauxTVA: z.number().min(0).max(100).optional().default(5.5),
  montant: z.number().min(0, 'Montant requis'),
  montantHT: z.number().min(0).nullable().optional(),
  montantTVA: z.number().min(0).nullable().optional(),
  clientId: z.number().int().nullable().optional(),
  clientNom: z.string().max(200).nullable().optional(),
  module: z.string().max(50).nullable().optional(),
  paye: z.boolean().optional().default(true),
  notes: z.string().max(5000).nullable().optional(),
  // PROMPT 15A
  journal: z.enum(JOURNAUX).optional().default('VE'),
  modeReglement: z.enum(MODES_REGLEMENT).nullable().optional(),
  numeroPiece: z.string().max(50).nullable().optional(),
  pjUrl: z.string().url().nullable().optional().or(z.literal('')),
})

export const updateVenteManuelleSchema = createVenteManuelleSchema.partial().extend({
  id: z.number().int().min(1, 'ID requis'),
})
