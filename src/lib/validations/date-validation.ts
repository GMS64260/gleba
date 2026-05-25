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

  // Convertir en Date si necessaire
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

  // Bug Ail #509 — cycle agronomiquement impossible : récolte moins de 14 j
  // après semis/plantation. Avant : Ail #509 acceptait semis=24/05 + récolte
  // =25/05 sans broncher. Warning non-bloquant pour ne pas refuser des
  // micro-pousses légitimes (radis ~21 j, micropousses ~10 j).
  const debutCycle = dateSemis ?? datePlantation
  if (debutCycle && dateRecolte) {
    const cycleJours = differenceInDays(dateRecolte, debutCycle)
    if (cycleJours >= 0 && cycleJours < 14) {
      warnings.push(
        `Cycle très court : ${cycleJours} j entre ${dateSemis ? "semis" : "plantation"} et récolte — vérifiez les dates.`
      )
    }
  }

  // Audit Marc 2026-05-14 — Bug 04 : message contextualisé avec la
  // fenêtre ITP recommandée (mois français), pour que l'utilisateur
  // comprenne ce qu'il faut corriger. Exemple :
  //   "Semis le 01/06 hors fenêtre ITP recommandée (mars–avril)"
  const MOIS_FR = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ]
  function moisDepuisSemaine(semaine: number): string {
    // Semaine 1 = janvier, semaine 5 ≈ février, … semaine 49 ≈ décembre
    const moisIdx = Math.min(11, Math.max(0, Math.floor((semaine - 1) / 4.345)))
    return MOIS_FR[moisIdx]
  }
  function fenetreLabel(semaineCentre: number): string {
    // ±28 jours = ±4 semaines → fenêtre ITP couvre semaineCentre±4
    const moisDebut = moisDepuisSemaine(Math.max(1, semaineCentre - 4))
    const moisFin = moisDepuisSemaine(Math.min(52, semaineCentre + 4))
    return moisDebut === moisFin ? moisDebut : `${moisDebut}–${moisFin}`
  }
  function dateLabel(d: Date): string {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
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
            `Semis le ${dateLabel(dateSemis)} hors fenêtre ITP recommandée (${fenetreLabel(data.itp.semaineSemis)})`
          )
        }
      }

      // Plantation
      if (datePlantation && data.itp.semainePlantation) {
        const dateTheorique = calculerDateDepuisSemaine(data.annee, data.itp.semainePlantation)
        const diff = Math.abs(differenceInDays(datePlantation, dateTheorique))
        if (diff > TOLERANCE_DAYS) {
          warnings.push(
            `Plantation le ${dateLabel(datePlantation)} hors fenêtre ITP recommandée (${fenetreLabel(data.itp.semainePlantation)})`
          )
        }
      }

      // Récolte
      if (dateRecolte && data.itp.semaineRecolte) {
        const dateTheorique = calculerDateDepuisSemaine(data.annee, data.itp.semaineRecolte)
        const diff = Math.abs(differenceInDays(dateRecolte, dateTheorique))
        if (diff > TOLERANCE_DAYS) {
          warnings.push(
            `Récolte le ${dateLabel(dateRecolte)} hors fenêtre ITP recommandée (${fenetreLabel(data.itp.semaineRecolte)})`
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
