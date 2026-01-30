/**
 * Schémas de validation Zod pour les Rotations et leurs détails
 */

import { z } from 'zod'

// Schéma de base pour une rotation
export const baseRotationSchema = z.object({
  id: z.string().min(1, "Le nom de la rotation est requis").max(100),
  active: z.boolean(),
  nbAnnees: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

// Schéma pour un détail de rotation (une année)
export const rotationDetailSchema = z.object({
  annee: z.number().int().min(1).max(10),
  itpId: z.string().nullable().optional(),
})

// Schéma pour la création avec détails
export const createRotationSchema = baseRotationSchema.extend({
  details: z.array(rotationDetailSchema).optional(),
})

// Schéma pour la mise à jour
export const updateRotationSchema = baseRotationSchema.partial().omit({ id: true }).extend({
  details: z.array(rotationDetailSchema).optional(),
})

// Types inférés
export type RotationInput = z.infer<typeof baseRotationSchema>
export type RotationDetailInput = z.infer<typeof rotationDetailSchema>
export type CreateRotationInput = z.infer<typeof createRotationSchema>
export type UpdateRotationInput = z.infer<typeof updateRotationSchema>
