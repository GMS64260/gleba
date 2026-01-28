/**
 * Schémas de validation Zod pour les Variétés
 */

import { z } from 'zod'

export const varieteSchema = z.object({
  id: z.string().min(1, "Le nom de la variété est requis").max(100),
  especeId: z.string().min(1, "L'espèce est requise"),
  fournisseurId: z.string().nullable().optional(),
  semaineRecolte: z.number().int().min(1).max(52).nullable().optional(),
  dureeRecolte: z.number().int().min(1).max(52).nullable().optional(),
  nbGrainesG: z.number().min(0).nullable().optional(),
  prixGraine: z.number().min(0).nullable().optional(),
  stockGraines: z.number().min(0).nullable().optional(),
  dateStock: z.coerce.date().nullable().optional(),
  bio: z.boolean().default(false),
  description: z.string().max(5000).nullable().optional(),
})

export const createVarieteSchema = varieteSchema
export const updateVarieteSchema = varieteSchema.partial().omit({ id: true })

export type VarieteInput = z.infer<typeof varieteSchema>
export type CreateVarieteInput = z.infer<typeof createVarieteSchema>
export type UpdateVarieteInput = z.infer<typeof updateVarieteSchema>
