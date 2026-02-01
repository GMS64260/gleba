/**
 * Validation des dates de culture
 * Vérifie cohérence chronologique et conformité avec ITP
 */

import { differenceInDays } from 'date-fns'
import { calculerDateDepuisSemaine } from '../assistant-helpers'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Valide les dates d'une culture
 * Vérifie ordre chronologique et conformité avec ITP
 */
export function validateCultureDates(data: {
  dateSemis?: Date | string | null
  datePlantation?: Date | string | null
  dateRecolte?: Date | string | null
  itp?: {
    semaineSemis?: number | null
    semainePlantation?: number | null
    semaineRecolte?: number | null
  } | null
  annee: number
}): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const TOLERANCE_DAYS = 28 // ±4 semaines

  // Convertir en Date si nécessaire
  const dateSemis = data.dateSemis ? new Date(data.dateSemis) : null
  const datePlantation = data.datePlantation ? new Date(data.datePlantation) : null
  const dateRecolte = data.dateRecolte ? new Date(data.dateRecolte) : null

  // 1. Vérification ordre chronologique
  if (dateSemis && datePlantation) {
    if (dateSemis > datePlantation) {
      errors.push("La date de semis doit être avant la date de plantation")
    }
  }

  if (datePlantation && dateRecolte) {
    if (datePlantation > dateRecolte) {
      errors.push("La date de plantation doit être avant la date de récolte")
    }
  }

  if (dateSemis && dateRecolte && !datePlantation) {
    if (dateSemis > dateRecolte) {
      errors.push("La date de semis doit être avant la date de récolte")
    }
  }

  // 2. Vérification dans limites ITP (si ITP fourni)
  if (data.itp) {
    try {
      // Semis
      if (dateSemis && data.itp.semaineSemis) {
        const dateTheorique = calculerDateDepuisSemaine(data.annee, data.itp.semaineSemis)
        const diff = Math.abs(differenceInDays(dateSemis, dateTheorique))
        if (diff > TOLERANCE_DAYS) {
          warnings.push(
            `Date de semis éloignée de la période ITP recommandée (±${TOLERANCE_DAYS} jours)`
          )
        }
      }

      // Plantation
      if (datePlantation && data.itp.semainePlantation) {
        const dateTheorique = calculerDateDepuisSemaine(data.annee, data.itp.semainePlantation)
        const diff = Math.abs(differenceInDays(datePlantation, dateTheorique))
        if (diff > TOLERANCE_DAYS) {
          warnings.push(
            `Date de plantation éloignée de la période ITP recommandée (±${TOLERANCE_DAYS} jours)`
          )
        }
      }

      // Récolte
      if (dateRecolte && data.itp.semaineRecolte) {
        const dateTheorique = calculerDateDepuisSemaine(data.annee, data.itp.semaineRecolte)
        const diff = Math.abs(differenceInDays(dateRecolte, dateTheorique))
        if (diff > TOLERANCE_DAYS) {
          warnings.push(
            `Date de récolte éloignée de la période ITP recommandée (±${TOLERANCE_DAYS} jours)`
          )
        }
      }
    } catch (err) {
      // Erreur calcul dates ITP, ne pas bloquer
      console.warn('Erreur validation dates ITP:', err)
    }
  }

  // 3. Vérification dates dans le futur (pour cultures planifiées)
  const maintenant = new Date()
  if (dateSemis && dateSemis < new Date(maintenant.getFullYear() - 1, 0, 1)) {
    warnings.push("Date de semis très ancienne, vérifiez l'année")
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}
