/**
 * Schémas de validation Zod pour les Cultures
 */

import { z } from 'zod'

export const cultureSchema = z.object({
  especeId: z.string().min(1, "L'espèce est requise"),
  // varieteId reste nullable côté validation : si absent à la création,
  // le backend assigne automatiquement le placeholder "Non spécifiée" de l'espèce
  // (Variete.isPlaceholder=true) — l'UI affiche un bandeau "À renseigner".
  // Aucune Culture ne reste sans variete en BDD.
  varieteId: z.string().nullable().optional(),
  itpId: z.string().nullable().optional(),
  plancheId: z.string().nullable().optional(),
  annee: z.number().int().min(2000).max(2100).nullable().optional(),
  dateSemis: z.union([z.string(), z.date()]).nullable().optional(),
  datePlantation: z.union([z.string(), z.date()]).nullable().optional(),
  dateRecolte: z.union([z.string(), z.date()]).nullable().optional(),
  semisFait: z.boolean(),
  plantationFaite: z.boolean(),
  recolteFaite: z.boolean(),
  terminee: z.string().nullable().optional(), // 'x', 'v', 'NS' ou null
  quantite: z.number().min(0).nullable().optional(),
  nbRangs: z.number().int().min(1).nullable().optional(),
  longueur: z.number().min(0).nullable().optional(),
  espacement: z.number().int().min(1).nullable().optional(),
  aIrriguer: z.boolean().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

export const createCultureSchema = cultureSchema
export const updateCultureSchema = cultureSchema.partial()

export type CultureInput = z.infer<typeof cultureSchema>
export type CreateCultureInput = z.infer<typeof createCultureSchema>
export type UpdateCultureInput = z.infer<typeof updateCultureSchema>

/**
 * Normalise en place les champs date d'un payload culture validé par zod.
 *
 * Bug utilisateur 2026-08-02 — le schéma accepte toute chaîne, mais Prisma
 * exige un DateTime ISO complet : un champ édité via un input type=date
 * (« YYYY-MM-DD ») faisait échouer le PUT en 500 et l'édition était perdue.
 * '' vaut effacement (⇒ null). Retourne le nom du premier champ dont la
 * chaîne n'est pas une date lisible, ou null si tout est normalisé.
 */
export function normalizeCultureDateFields(
  data: Partial<Record<'dateSemis' | 'datePlantation' | 'dateRecolte', string | Date | null>>,
): string | null {
  for (const field of ['dateSemis', 'datePlantation', 'dateRecolte'] as const) {
    const value = data[field]
    if (typeof value !== 'string') continue
    if (value.trim() === '') {
      data[field] = null
      continue
    }
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return field
    data[field] = parsed
  }
  return null
}
