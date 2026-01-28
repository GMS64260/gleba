/**
 * Schémas de validation Zod pour les Planches
 */

import { z } from 'zod'

export const plancheSchema = z.object({
  id: z.string().min(1, "Le nom de la planche est requis").max(50),
  rotationId: z.string().nullable().optional(),
  largeur: z.number().min(0).max(10).nullable().optional(),
  longueur: z.number().min(0).max(100).nullable().optional(),
  surface: z.number().min(0).nullable().optional(),
  // Position sur le plan du jardin
  posX: z.number().min(-100).max(100).nullable().optional(),
  posY: z.number().min(-100).max(100).nullable().optional(),
  rotation2D: z.number().min(0).max(360).nullable().optional(),
  planchesInfluencees: z.string().nullable().optional(),
  ilot: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

export const createPlancheSchema = plancheSchema
export const updatePlancheSchema = plancheSchema.partial().omit({ id: true })

export type PlancheInput = z.infer<typeof plancheSchema>
export type CreatePlancheInput = z.infer<typeof createPlancheSchema>
export type UpdatePlancheInput = z.infer<typeof updatePlancheSchema>
