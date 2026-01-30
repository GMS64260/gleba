/**
 * Schémas de validation Zod pour les ITPs (Itinéraires Techniques de Plantes)
 */

import { z } from 'zod'

// Schéma de base pour un ITP
export const baseITPSchema = z.object({
  id: z.string().min(1, "L'identifiant de l'ITP est requis").max(100),
  especeId: z.string().nullable().optional(),
  semaineSemis: z.number().int().min(1).max(52).nullable().optional(),
  semainePlantation: z.number().int().min(1).max(52).nullable().optional(),
  semaineRecolte: z.number().int().min(1).max(52).nullable().optional(),
  dureePepiniere: z.number().int().min(0).max(365).nullable().optional(),
  dureeCulture: z.number().int().min(0).max(365).nullable().optional(),
  nbRangs: z.number().int().min(1).max(20).nullable().optional(),
  espacement: z.number().min(1).max(200).nullable().optional(), // cm entre plants
  notes: z.string().max(5000).nullable().optional(),
})

// Schéma pour la création
export const createITPSchema = baseITPSchema

// Schéma pour la mise à jour (tous les champs optionnels sauf id)
export const updateITPSchema = baseITPSchema.partial().omit({ id: true })

// Types inférés
export type ITPInput = z.infer<typeof baseITPSchema>
export type CreateITPInput = z.infer<typeof createITPSchema>
export type UpdateITPInput = z.infer<typeof updateITPSchema>
