/**
 * Schémas de validation Zod pour les Espèces
 */

import { z } from 'zod'

// Types d'especes valides. Convention DB = snake_case ; label FR mappé via
// ESPECE_TYPE_LABELS pour l'affichage (cf. docs/conventions.md).
export const ESPECE_TYPES = [
  'legume',
  'aromatique',
  'engrais_vert',
  'arbre_fruitier',
  'petit_fruit',
  'ornement',
] as const

export const ESPECE_TYPE_LABELS: Record<typeof ESPECE_TYPES[number], string> = {
  legume: 'Maraîchage',
  aromatique: 'Aromatique',
  engrais_vert: 'Engrais vert',
  arbre_fruitier: 'Arbre fruitier',
  petit_fruit: 'Petit fruit',
  ornement: 'Ornement',
}

// Unités de rendement métier — dépendent du type.
//   kg_m2          : maraîchage, aromatique, petit fruit, ornement
//   kg_arbre       : arbre fruitier
//   biomasse_t_ha  : engrais vert
export const UNITE_RENDEMENT = ['kg_m2', 'kg_arbre', 'biomasse_t_ha'] as const

export const UNITE_RENDEMENT_LABELS: Record<typeof UNITE_RENDEMENT[number], string> = {
  kg_m2: 'kg/m²',
  kg_arbre: 'kg/arbre',
  biomasse_t_ha: 't/ha',
}

// Catégories visuelles
export const ESPECE_CATEGORIES = [
  'racine', 'bulbe', 'feuille', 'fleur', 'fruit_legume', 'grain',
  'petit_fruit', 'fruit', 'agrume', 'engrais_vert', 'mellifere', 'bois', 'arbre', 'ornement'
] as const

// Niveaux de difficulté
export const ESPECE_NIVEAUX = ['Facile', 'Moyen', 'Difficile'] as const

// Niveaux d'irrigation
export const ESPECE_IRRIGATION = ['Faible', 'Moyen', 'Eleve'] as const

// Schéma de base pour une espece (correspond au modèle Prisma)
export const baseEspeceSchema = z.object({
  id: z.string().min(1, "Le nom de l'espèce est requis").max(100),
  type: z.enum(ESPECE_TYPES),
  uniteRendement: z.enum(UNITE_RENDEMENT).optional(),
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
  // Audit Marc — unité explicite + type de culture pour empêcher les
  // saisies aberrantes (carotte avec date plantation, etc.)
  uniteDose: z.enum(['g_m2','pieces_m2','graines_plant','caieux_m2']).nullable().optional(),
  typeCultureSemis: z.enum(['semis_direct','pepiniere_puis_repiquage','plantation_bulbes_caieux','bouture']).nullable().optional(),
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
