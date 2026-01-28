/**
 * Schémas de validation Zod pour les Cultures
 */

import { z } from 'zod'

export const cultureSchema = z.object({
  especeId: z.string().min(1, "L'espèce est requise"),
  varieteId: z.string().nullable().optional(),
  itpId: z.string().nullable().optional(),
  plancheId: z.string().nullable().optional(),
  annee: z.number().int().min(2000).max(2100).nullable().optional(),
  dateSemis: z.coerce.date().nullable().optional(),
  datePlantation: z.coerce.date().nullable().optional(),
  dateRecolte: z.coerce.date().nullable().optional(),
  semisFait: z.boolean().default(false),
  plantationFaite: z.boolean().default(false),
  recolteFaite: z.boolean().default(false),
  terminee: z.string().nullable().optional(), // 'x', 'v', 'NS' ou null
  quantite: z.number().min(0).nullable().optional(),
  nbRangs: z.number().int().min(1).nullable().optional(),
  longueur: z.number().min(0).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

export const createCultureSchema = cultureSchema
export const updateCultureSchema = cultureSchema.partial()

export type CultureInput = z.infer<typeof cultureSchema>
export type CreateCultureInput = z.infer<typeof createCultureSchema>
export type UpdateCultureInput = z.infer<typeof updateCultureSchema>
