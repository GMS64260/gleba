/**
 * Schémas de validation Zod pour les Cultures
 */

import { z } from 'zod'
import { etapeDejaRealisable } from '@/lib/cultures/deja-fait'

// QA cmsbtr0e4 — un Select piloté peut émettre '' pour une référence
// facultative ; '' inséré tel quel violait la FK (P2003 ⇒ 500). '' vaut
// « aucune référence » (⇒ null), même sémantique que l'effacement des dates.
// `.transform` (et non `.preprocess`) : l'input reste string|null|undefined
// pour l'inférence des formulaires react-hook-form.
const refFacultative = z
  .string()
  .nullable()
  .transform((v) => (typeof v === 'string' && v.trim() === '' ? null : v))
  .optional()

export const cultureSchema = z.object({
  especeId: z.string().min(1, "L'espèce est requise"),
  // varieteId reste nullable côté validation : si absent à la création,
  // le backend assigne automatiquement le placeholder "Non spécifiée" de l'espèce
  // (Variete.isPlaceholder=true) — l'UI affiche un bandeau "À renseigner".
  // Aucune Culture ne reste sans variete en BDD.
  varieteId: refFacultative,
  itpId: refFacultative,
  plancheId: refFacultative,
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

// QA cmsfxvbab — l'API refuse déjà récolte < semis (400 explicite), mais côté
// formulaire ce refus n'apparaissait que dans un toast éphémère : l'utilisateur
// voyait un échec silencieux. Schéma réservé aux formulaires react-hook-form
// (l'API garde createCultureSchema : ses messages d'erreur dédiés priment sur
// un flatten Zod générique). Mêmes règles que validateCultureDates côté serveur.
function champDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function refineChronologie(
  data: Pick<CultureInput, 'dateSemis' | 'datePlantation' | 'dateRecolte'>,
  ctx: z.RefinementCtx,
) {
  const semis = champDate(data.dateSemis)
  const plantation = champDate(data.datePlantation)
  const recolte = champDate(data.dateRecolte)
  if (semis && plantation && semis > plantation) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['datePlantation'],
      message: 'La plantation doit être postérieure au semis',
    })
  }
  const debutCycle = plantation ?? semis
  if (debutCycle && recolte && debutCycle > recolte) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dateRecolte'],
      message: 'La récolte doit être postérieure au semis et à la plantation',
    })
  }
}

// Friction 2026-08-23 — les formulaires de création proposent « déjà fait »
// quand la date saisie est passée (cf. lib/cultures/deja-fait.ts). Filet
// symétrique : une étape déclarée faite ne peut pas être datée dans le futur,
// même invariant que le SSOT d'exécution (execution.ts). Réservé au schéma de
// CRÉATION : le formulaire d'édition peut recharger une culture antérieure au
// SSOT et ne doit pas bloquer une correction sans rapport.
function refineFaitsPasses(
  data: Pick<
    CultureInput,
    'dateSemis' | 'datePlantation' | 'dateRecolte' | 'semisFait' | 'plantationFaite' | 'recolteFaite'
  >,
  ctx: z.RefinementCtx,
) {
  const etapes = [
    { fait: data.semisFait, date: champDate(data.dateSemis), champ: 'dateSemis', libelle: 'Un semis marqué fait' },
    { fait: data.plantationFaite, date: champDate(data.datePlantation), champ: 'datePlantation', libelle: 'Une plantation marquée faite' },
    { fait: data.recolteFaite, date: champDate(data.dateRecolte), champ: 'dateRecolte', libelle: 'Une récolte marquée faite' },
  ]
  for (const { fait, date, champ, libelle } of etapes) {
    if (fait && date && !etapeDejaRealisable(date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [champ],
        message: `${libelle} ne peut pas être daté(e) dans le futur.`,
      })
    }
  }
}

export const cultureFormSchema = cultureSchema
  .superRefine(refineChronologie)
  .superRefine(refineFaitsPasses)
export const cultureUpdateFormSchema = cultureSchema.partial().superRefine(refineChronologie)

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
