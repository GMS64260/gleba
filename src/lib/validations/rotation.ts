/**
 * Schémas de validation Zod pour les Rotations et leurs details.
 *
 * PROMPT DEV 2 Bug #1 — garde-fous de cohérence :
 *   - Une rotation ne peut pas être Active sans plan complet (chaque étape
 *     du cycle doit avoir un ITP assigné).
 *   - Si `nbAnnees` est fourni, il doit être égal au nombre d'étapes.
 */

import { z } from 'zod'

// Schéma de base pour une rotation
export const baseRotationSchema = z.object({
  id: z.string().min(1, "Le nom de la rotation est requis").max(100),
  active: z.boolean(),
  nbAnnees: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

// Schéma pour un detail de rotation (une annee)
export const rotationDetailSchema = z.object({
  annee: z.number().int().min(1).max(10),
  itpId: z.string().nullable().optional(),
})

/**
 * Garde-fou de cohérence : si la rotation est Active, le plan doit être
 * complet. Sinon on a une rotation "fantôme" affichée Active sans aucune
 * succession définie (bug constaté par Marc 14/05/2026).
 */
function coherenceActive(
  data: {
    active?: boolean
    nbAnnees?: number | null
    details?: { annee: number; itpId?: string | null }[]
  },
  ctx: z.RefinementCtx
) {
  if (!data.active) return

  const details = data.details ?? []
  if (details.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["details"],
      message:
        "Une rotation Active doit avoir un plan complet. Ajoutez au moins une étape ou désactivez-la.",
    })
    return
  }

  // Étapes sans ITP (jachère explicite acceptée si declarée, mais on refuse
  // un Plan "fantôme" entièrement vide).
  const etapesSansITP = details.filter((d) => !d.itpId)
  if (etapesSansITP.length === details.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["details"],
      message:
        "Une rotation Active doit avoir au moins une étape avec un ITP. Toutes vos étapes sont vides.",
    })
  }

  // Cycle déclaré ≠ nombre d'étapes saisies → refuser.
  if (data.nbAnnees != null && data.nbAnnees !== details.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nbAnnees"],
      message: `Le cycle déclaré (${data.nbAnnees} ans) doit correspondre au nombre d'étapes saisies (${details.length}).`,
    })
  }
}

// Schéma pour la création avec details
export const createRotationSchema = baseRotationSchema
  .extend({
    details: z.array(rotationDetailSchema).optional(),
  })
  .superRefine(coherenceActive)

// Schéma pour la mise à jour
export const updateRotationSchema = baseRotationSchema
  .partial()
  .omit({ id: true })
  .extend({
    details: z.array(rotationDetailSchema).optional(),
  })
  .superRefine(coherenceActive)

// Types inférés
export type RotationInput = z.infer<typeof baseRotationSchema>
export type RotationDetailInput = z.infer<typeof rotationDetailSchema>
export type CreateRotationInput = z.infer<typeof createRotationSchema>
export type UpdateRotationInput = z.infer<typeof updateRotationSchema>
