import { z } from 'zod'

export const createDepenseManuelleSchema = z.object({
  date: z.coerce.date().optional(),
  categorie: z.string().min(1, 'Catégorie requise'),
  description: z.string().min(1, 'Description requise').max(500),
  tauxTVA: z.number().min(0).max(100).optional().default(20),
  montant: z.number().min(0, 'Montant requis'),
  montantHT: z.number().min(0).nullable().optional(),
  montantTVA: z.number().min(0).nullable().optional(),
  module: z.string().max(50).nullable().optional(),
  fournisseurId: z.string().nullable().optional(),
  fournisseurNom: z.string().max(200).nullable().optional(),
  refFacture: z.string().max(100).nullable().optional(),
  paye: z.boolean().optional().default(true),
  dateEcheance: z.coerce.date().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

export const updateDepenseManuelleSchema = createDepenseManuelleSchema.partial().extend({
  id: z.number().int().min(1, 'ID requis'),
})
