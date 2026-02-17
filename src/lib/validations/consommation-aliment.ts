import { z } from 'zod'

export const consommationAlimentSchema = z.object({
  alimentId: z.string().min(1, 'Aliment requis'),
  lotId: z.number().int().nullable().optional(),
  date: z.coerce.date().default(() => new Date()),
  quantite: z.number().positive('La quantité doit être positive'),
  notes: z.string().max(5000).nullable().optional(),
})
