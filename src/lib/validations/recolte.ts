/**
 * Schémas de validation Zod pour les Récoltes
 */

import { z } from 'zod'

export const recolteSchema = z.object({
  especeId: z.string().min(1, "L'espèce est requise"),
  cultureId: z.number().int().min(1, "La culture est requise"),
  date: z.coerce.date().default(() => new Date()),
  quantite: z.number().min(0, "La quantité doit être positive"),
  datePeremption: z.coerce.date().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

export const createRecolteSchema = recolteSchema
export const updateRecolteSchema = recolteSchema.partial()

export type RecolteInput = z.infer<typeof recolteSchema>
export type CreateRecolteInput = z.infer<typeof createRecolteSchema>
export type UpdateRecolteInput = z.infer<typeof updateRecolteSchema>
