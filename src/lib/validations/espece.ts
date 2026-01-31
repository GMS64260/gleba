/**
 * Schémas de validation Zod pour les Espèces
 */

import { z } from 'zod'

// Types d'espèces valides
export const ESPECE_TYPES = ['legume', 'arbre_fruitier', 'petit_fruit', 'aromatique', 'engrais_vert'] as const

// Catégories visuelles
export const ESPECE_CATEGORIES = [
  'racine', 'bulbe', 'feuille', 'fleur', 'fruit_legume', 'grain',
  'petit_fruit', 'fruit', 'agrume', 'engrais_vert', 'mellifere', 'bois', 'arbre', 'ornement'
] as const

// Niveaux de difficulté
export const ESPECE_NIVEAUX = ['Facile', 'Moyen', 'Difficile'] as const

// Niveaux d'irrigation
export const ESPECE_IRRIGATION = ['Faible', 'Moyen', 'Eleve'] as const

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
  // Nouveaux champs (parite Potaleger)
  categorie: z.string().max(50).nullable().optional(),
  niveau: z.string().max(20).nullable().optional(),
  densite: z.number().min(0).max(1000).nullable().optional(),
  doseSemis: z.number().min(0).max(1000).nullable().optional(),
  tauxGermination: z.number().min(0).max(100).nullable().optional(),
  temperatureGerm: z.string().max(50).nullable().optional(),
  joursLevee: z.number().int().min(0).max(365).nullable().optional(),
  irrigation: z.string().max(20).nullable().optional(),
  conservation: z.boolean().nullable().optional(),
  effet: z.string().max(1000).nullable().optional(),
  usages: z.string().max(1000).nullable().optional(),
  objectifAnnuel: z.number().min(0).nullable().optional(),
  prixKg: z.number().min(0).nullable().optional(),
  semaineTaille: z.number().int().min(1).max(52).nullable().optional(),
})

// Schéma pour la création (id requis)
export const createEspeceSchema = baseEspeceSchema

// Schéma pour la mise à jour (id optionnel, tous les champs optionnels)
export const updateEspeceSchema = baseEspeceSchema.partial().omit({ id: true })

// Types inférés
export type EspeceInput = z.infer<typeof baseEspeceSchema>
export type CreateEspeceInput = z.infer<typeof createEspeceSchema>
export type UpdateEspeceInput = z.infer<typeof updateEspeceSchema>
