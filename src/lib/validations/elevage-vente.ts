import { z } from 'zod'

export const venteProduitSchema = z.object({
  date: z.coerce.date().optional(),
  type: z.enum(['oeufs', 'viande', 'animal_vivant', 'lait', 'autre']),
  description: z.string().max(500).nullable().optional(),
  quantite: z.number().positive('La quantité doit être positive'),
  unite: z.string().min(1, 'Unité requise'),
  prixUnitaire: z.number().min(0, 'Le prix doit être positif'),
  client: z.string().max(200).nullable().optional(),
  destinationId: z.string().nullable().optional(),
  paye: z.boolean().default(true),
  tauxTVA: z.number().min(0).max(100).default(5.5),
  animalId: z.number().int().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})
