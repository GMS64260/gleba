/**
 * Schémas de validation Zod pour les Espèces
 */

import { z } from 'zod'

// Types d'espèces valides
export const ESPECE_TYPES = ['legume', 'arbre_fruitier', 'petit_fruit', 'aromatique', 'engrais_vert'] as const

// Schéma de base pour une espèce (correspond au modèle Prisma)
export const baseEspeceSchema = z.object({
  id: z.string().min(1, "Le nom de l'espèce est requis").max(100),
  type: z.enum(ESPECE_TYPES),
  familleId: z.string().nullable().optional(),
  nomLatin: z.string().max(200).nullable().optional(),
  rendement: z.number().min(0).max(100).nullable().optional(),
  vivace: z.boolean(),
  besoinN: z.number().min(0).max(5).nullable().optional(),
  besoinP: z.number().min(0).max(5).nullable().optional(),
  besoinK: z.number().min(0).max(5).nullable().optional(),
  besoinEau: z.number().min(0).max(5).nullable().optional(),
  dateInventaire: z.union([z.string(), z.date()]).nullable().optional(),
  inventaire: z.number().min(0).nullable().optional(),
  aPlanifier: z.boolean(),
  couleur: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Format couleur invalide (#RRGGBB)").nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
})

// Schéma pour la création (id requis)
export const createEspeceSchema = baseEspeceSchema

// Schéma pour la mise à jour (id optionnel, tous les champs optionnels)
export const updateEspeceSchema = baseEspeceSchema.partial().omit({ id: true })

// Types inférés
export type EspeceInput = z.infer<typeof baseEspeceSchema>
export type CreateEspeceInput = z.infer<typeof createEspeceSchema>
export type UpdateEspeceInput = z.infer<typeof updateEspeceSchema>
