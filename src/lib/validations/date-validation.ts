/**
 * Validation des dates de culture
 * Vérifie cohérence chronologique et conformité avec ITP
 */

import { differenceInDays } from 'date-fns'
import { calculerDateDepuisSemaine, dateSemaineChrono } from '../assistant-helpers'
import { datesDepuisItp } from '../cultures/dates-itp'
import { jourCivilStocke } from '../jour-civil'
import {
  alerteSaisonCulture,
  etapeImplantation,
  fenetreImplantation,
  type AlerteSaisonCulture,
  type ItpSaison,
} from '../cultures/saison-culture'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  /**
   * Date d'implantation hors de la fenêtre de l'ITP (`alerteSaisonCulture`),
   * déjà comprise dans `warnings` : les écrans qui l'affichent sous le champ
   * la lisent ici.
   */
  alerteSaison: AlerteSaisonCulture | null
}

/**
 * Année de la date d'implantation incohérente avec la saison de la culture :
 * plus de six mois d'écart avec la date que l'ITP propose pour `annee` ET une
 * autre année civile ; sans ITP qui situe l'implantation, deux ans d'écart ou
 * plus avec `annee` (une plantation l'année suivante reste plausible).
 */
function incoherenceAnneeImplantation(params: {
  itp?: (ItpSaison & { semaineRecolte?: number | null }) | null
  annee: number
  dateSemis: Date | null
  datePlantation: Date | null
}): string | null {
  const { itp, annee, dateSemis, datePlantation } = params
  const etape = itp ? etapeImplantation(itp) : datePlantation ? 'plantation' : 'semis'
  const date = etape === 'plantation' ? datePlantation : dateSemis ?? datePlantation
  const jour = jourCivilStocke(date)
  if (!date || !jour) return null
  const anneeDate = Number(jour.slice(0, 4))
  const libelle = date === datePlantation ? 'Plantation prévue' : 'Semis prévu'
  const message = `${libelle} en ${anneeDate} pour une culture de la saison ${annee} : vérifiez l'année.`
  const cycle = itp ? datesDepuisItp(annee, itp) : null
  const theorique = cycle ? (etape === 'plantation' ? cycle.datePlantation : cycle.dateSemis) : null
  if (theorique) {
    const ecart = Math.abs(differenceInDays(date, theorique))
    return ecart > 182 && anneeDate !== theorique.getFullYear() ? message : null
  }
  return Math.abs(anneeDate - annee) >= 2 ? message : null
}

/**
 * Valide les dates d'une culture
 * Vérifie ordre chronologique et conformité avec ITP
 */
export function validateCultureDates(data: {
  dateSemis?: Date | string | null
  datePlantation?: Date | string | null
  dateRecolte?: Date | string | null
  itp?: (ItpSaison & {
    semaineSemis?: number | null
    semainePlantation?: number | null
    semaineRecolte?: number | null
  }) | null
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
  //
  // 2026-10-25 — quand l'ITP documente sa fenêtre d'implantation, l'étape qui
  // implante la culture est jugée sur cette fenêtre (`alerteSaisonCulture`, à
  // 3 semaines près, passage d'année compris) et non plus sur ±28 jours autour
  // d'une seule semaine : un seul message, celui que les écrans affichent sous
  // le champ.
  const alerteSaison = alerteSaisonCulture({ itp: data.itp, dateSemis, datePlantation })
  if (alerteSaison) warnings.push(alerteSaison.message)
  // L'alerte ne regarde que la SEMAINE : une plantation en S16 2028 pour une
  // culture 2026 y échappe. L'année se contrôle à part (revue du 2026-10-25),
  // contre la date que l'ITP propose pour la saison (`datesDepuisItp`, cycles à
  // cheval sur deux années compris), à défaut contre `annee` à un an près.
  const avertissementAnnee = incoherenceAnneeImplantation({ itp: data.itp, annee: data.annee, dateSemis, datePlantation })
  if (avertissementAnnee) warnings.push(avertissementAnnee)
  const etapeJugeeSurFenetre = data.itp && fenetreImplantation(data.itp) ? etapeImplantation(data.itp) : null
  if (data.itp) {
    try {
      // Semis
      if (dateSemis && data.itp.semaineSemis && etapeJugeeSurFenetre !== 'semis') {
        const dateTheorique = calculerDateDepuisSemaine(data.annee, data.itp.semaineSemis)
        const diff = Math.abs(differenceInDays(dateSemis, dateTheorique))
        if (diff > TOLERANCE_DAYS) {
          warnings.push(
            `Semis le ${dateLabel(dateSemis)} hors fenêtre ITP recommandée (${fenetreLabel(data.itp.semaineSemis)})`
          )
        }
      }

      // Plantation
      if (datePlantation && data.itp.semainePlantation && etapeJugeeSurFenetre !== 'plantation') {
        const dateTheorique = dateSemaineChrono(data.annee, data.itp.semainePlantation, data.itp.semaineSemis)
        const diff = Math.abs(differenceInDays(datePlantation, dateTheorique))
        if (diff > TOLERANCE_DAYS) {
          warnings.push(
            `Plantation le ${dateLabel(datePlantation)} hors fenêtre ITP recommandée (${fenetreLabel(data.itp.semainePlantation)})`
          )
        }
      }

      // Récolte
      if (dateRecolte && data.itp.semaineRecolte) {
        const dateTheorique = dateSemaineChrono(data.annee, data.itp.semaineRecolte, data.itp.semainePlantation ?? data.itp.semaineSemis)
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
    warnings,
    alerteSaison,
  }
}
