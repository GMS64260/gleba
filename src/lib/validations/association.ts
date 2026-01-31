/**
 * Schémas de validation pour les associations de plantes
 */

import { z } from "zod"

// Schéma pour un détail d'association
export const associationDetailSchema = z.object({
  id: z.number().optional(),
  especeId: z.string().nullable().optional(),
  familleId: z.string().nullable().optional(),
  groupe: z.string().max(100).nullable().optional(),
  requise: z.boolean(),
  notes: z.string().max(2000).nullable().optional(),
})

// Schéma de base pour une association
export const baseAssociationSchema = z.object({
  nom: z.string().min(1, "Le nom est requis").max(200),
  description: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

// Schéma pour créer une association
export const createAssociationSchema = baseAssociationSchema.extend({
  details: z.array(associationDetailSchema).optional(),
})

// Schéma pour mettre à jour une association
export const updateAssociationSchema = baseAssociationSchema.partial().extend({
  details: z.array(associationDetailSchema).optional(),
})

// Types TypeScript
export type AssociationDetail = z.infer<typeof associationDetailSchema>
export type CreateAssociationInput = z.infer<typeof createAssociationSchema>
export type UpdateAssociationInput = z.infer<typeof updateAssociationSchema>
