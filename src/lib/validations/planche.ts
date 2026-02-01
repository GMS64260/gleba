/**
 * Schemas de validation Zod pour les Planches
 */

import { z } from 'zod'

// Types de planche
export const PLANCHE_TYPES = ['Serre', 'Plein champ', 'Tunnel', 'Chassis'] as const

// Types d'irrigation
export const PLANCHE_IRRIGATION = ['Goutte-a-goutte', 'Aspersion', 'Manuel', 'Aucun'] as const

// Types de sol
export const TYPES_SOL = ['Argileux', 'Limoneux', 'Sableux', 'Mixte'] as const

// Niveaux de rétention eau
export const RETENTION_EAU = ['Faible', 'Moyenne', 'Élevée'] as const

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
  // Nouveaux champs (parite Potaleger)
  type: z.string().max(50).nullable().optional(),
  irrigation: z.string().max(50).nullable().optional(),
  annee: z.number().int().min(2000).max(2100).nullable().optional(),
  // Qualité du sol
  typeSol: z.string().max(50).nullable().optional(),
  retentionEau: z.string().max(50).nullable().optional(),
  argile: z.number().min(0).max(100).nullable().optional(),
  limon: z.number().min(0).max(100).nullable().optional(),
  sable: z.number().min(0).max(100).nullable().optional(),
  phSol: z.number().min(0).max(14).nullable().optional(),
  carboneOrg: z.number().min(0).max(100).nullable().optional(),
  derniereAnalyseSol: z.string().datetime().nullable().optional(),
})

export const createPlancheSchema = plancheSchema
export const updatePlancheSchema = plancheSchema.partial().omit({ id: true })

export type PlancheInput = z.infer<typeof plancheSchema>
export type CreatePlancheInput = z.infer<typeof createPlancheSchema>
export type UpdatePlancheInput = z.infer<typeof updatePlancheSchema>
