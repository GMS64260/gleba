import { z } from "zod"

export const EVOLUTION_CATEGORIES = [
  "MARAICHAGE",
  "VERGER",
  "ELEVAGE",
  "COMPTABILITE",
  "GENERAL",
] as const

export const EVOLUTION_STATUTS = [
  "PROPOSEE",
  "PLANIFIEE",
  "EN_COURS",
  "LIVREE",
  "REFUSEE",
] as const

/** Création d'une demande d'évolution (Community Voice) */
export const evolutionSchema = z.object({
  titre: z
    .string()
    .trim()
    .min(5, "Le titre doit contenir au moins 5 caractères")
    .max(120, "Le titre ne peut pas dépasser 120 caractères"),
  description: z
    .string()
    .trim()
    .min(10, "La description doit contenir au moins 10 caractères")
    .max(2000, "La description ne peut pas dépasser 2000 caractères"),
  categorie: z.enum(EVOLUTION_CATEGORIES).default("GENERAL"),
})

/** Mise à jour admin du statut / note d'une évolution */
export const evolutionUpdateSchema = z.object({
  statut: z.enum(EVOLUTION_STATUTS).optional(),
  adminNote: z.string().trim().max(2000).nullable().optional(),
})

export type EvolutionInput = z.infer<typeof evolutionSchema>
export type EvolutionUpdateInput = z.infer<typeof evolutionUpdateSchema>
