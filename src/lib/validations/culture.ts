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
  dateSemis: z.union([z.string(), z.date()]).nullable().optional(),
  datePlantation: z.union([z.string(), z.date()]).nullable().optional(),
  dateRecolte: z.union([z.string(), z.date()]).nullable().optional(),
  semisFait: z.boolean(),
  plantationFaite: z.boolean(),
  recolteFaite: z.boolean(),
  terminee: z.string().nullable().optional(), // 'x', 'v', 'NS' ou null
  quantite: z.number().min(0).nullable().optional(),
  nbRangs: z.number().int().min(1).nullable().optional(),
  longueur: z.number().min(0).nullable().optional(),
  espacement: z.number().int().min(1).nullable().optional(),
  aIrriguer: z.boolean().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

export const createCultureSchema = cultureSchema
export const updateCultureSchema = cultureSchema.partial()

export type CultureInput = z.infer<typeof cultureSchema>
export type CreateCultureInput = z.infer<typeof createCultureSchema>
export type UpdateCultureInput = z.infer<typeof updateCultureSchema>
