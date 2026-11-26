/**
 * Horizon des exercices : les années qu'un écran sait ouvrir.
 *
 * Le sélecteur d'année propose de `PREMIER_EXERCICE` à l'année suivante. Une
 * écriture datée hors de cet horizon s'enregistrait pourtant sans erreur, puis
 * restait introuvable : aucun écran ne pouvait rouvrir son exercice (équipe
 * debug, D73 : vente et dépense datées de 2036). Une date d'écriture se
 * contrôle donc contre le même horizon que le sélecteur.
 *
 * Module sans dépendance d'écran : importable par les schémas de validation
 * comme par les composants.
 */
import { z } from 'zod'
import { jourCivilStocke } from '@/lib/jour-civil'

/** Premier exercice proposé par les sélecteurs d'année. */
export const PREMIER_EXERCICE = 2000

/** Dernier exercice proposé : l'année suivante (planification anticipée). */
export function dernierExercice(maintenant: Date = new Date()): number {
  return maintenant.getFullYear() + 1
}

/** Bornes « AAAA-MM-JJ » d'un champ de date d'écriture. */
export function bornesDateEcriture(maintenant: Date = new Date()): { min: string; max: string } {
  return { min: `${PREMIER_EXERCICE}-01-01`, max: `${dernierExercice(maintenant)}-12-31` }
}

/** Message de refus si la date tombe hors des exercices consultables, sinon `null`. */
export function refusDateHorsExercices(date: Date, maintenant: Date = new Date()): string | null {
  const annee = Number(jourCivilStocke(date)?.slice(0, 4))
  const dernier = dernierExercice(maintenant)
  if (Number.isInteger(annee) && annee >= PREMIER_EXERCICE && annee <= dernier) return null
  return `Date hors des exercices consultables (${PREMIER_EXERCICE} à ${dernier}).`
}

/** Date d'une écriture (vente, dépense) : une date lisible, dans l'horizon des exercices. */
export const dateEcritureSchema = z.coerce.date().superRefine((date, ctx) => {
  const refus = refusDateHorsExercices(date)
  if (refus) ctx.addIssue({ code: z.ZodIssueCode.custom, message: refus })
})
