/**
 * Fenêtre de travail de l'accueil v2 : « sec jusqu'à samedi · 6 mm dimanche ·
 * gel probable mardi nuit », dérivée des prévisions déjà servies par
 * `GET /api/meteo` (aucun appel supplémentaire). Fonctions PURES.
 */

import { dateMidiLocal } from "./classement"

/** Sous-ensemble d'une prévision journalière (`MeteoPrevision`, `src/lib/meteo.ts`). */
export interface PrevisionFenetre {
  /** AAAA-MM-JJ */
  date: string
  tempMin: number
  /** mm */
  precipitation: number
}

export interface FenetreTravail {
  /** Jours consécutifs sans pluie significative à partir du premier jour fourni. */
  joursSecs: number
  /** Dernier jour sec de la série, s'il y en a au moins un. */
  dernierJourSec: string | null
  prochainePluie: { date: string; mm: number } | null
  gel: { date: string; tempMin: number } | null
}

/** En deçà, une journée compte comme sèche (même seuil que le conseil d'irrigation). */
export const SEUIL_PLUIE_MM = 1
/** À partir de cette température minimale, on annonce un gel probable. */
export const SEUIL_GEL_C = 0

export function calculerFenetreTravail(
  previsions: readonly PrevisionFenetre[],
  options: { seuilPluieMm?: number; seuilGelC?: number } = {},
): FenetreTravail {
  const seuilPluie = options.seuilPluieMm ?? SEUIL_PLUIE_MM
  const seuilGel = options.seuilGelC ?? SEUIL_GEL_C

  let joursSecs = 0
  let dernierJourSec: string | null = null
  let prochainePluie: FenetreTravail["prochainePluie"] = null
  let gel: FenetreTravail["gel"] = null

  for (const jour of previsions) {
    if (prochainePluie === null) {
      if (jour.precipitation >= seuilPluie) {
        prochainePluie = { date: jour.date, mm: Math.round(jour.precipitation * 10) / 10 }
      } else {
        joursSecs += 1
        dernierJourSec = jour.date
      }
    }
    if (gel === null && jour.tempMin <= seuilGel) {
      gel = { date: jour.date, tempMin: Math.round(jour.tempMin * 10) / 10 }
    }
  }

  return { joursSecs, dernierJourSec, prochainePluie, gel }
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"]

/** « samedi », ou « aujourd'hui » / « demain » quand c'est le cas. */
export function nommerJour(jourIso: string, aujourdhui: Date): string {
  const cible = dateMidiLocal(jourIso)
  const ref = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate(), 12)
  const ecart = Math.round((cible.getTime() - ref.getTime()) / 86_400_000)
  if (ecart === 0) return "aujourd'hui"
  if (ecart === 1) return "demain"
  return JOURS[cible.getDay()]
}

export interface PhraseFenetre {
  /** Mis en avant : « sec jusqu'à samedi ». */
  principal: string
  /** Compléments : « 6 mm dimanche », « gel probable mardi ». */
  details: string[]
}

export function phraseFenetreTravail(fenetre: FenetreTravail, aujourdhui: Date, nbJoursPrevus = 7): PhraseFenetre {
  const details: string[] = []
  let principal: string

  if (fenetre.joursSecs === 0 && fenetre.prochainePluie) {
    principal = `pluie ${nommerJour(fenetre.prochainePluie.date, aujourdhui)} · ${fenetre.prochainePluie.mm} mm`
  } else if (fenetre.joursSecs >= nbJoursPrevus) {
    principal = "sec toute la semaine"
  } else if (fenetre.joursSecs === 1) {
    principal = "sec aujourd'hui"
  } else if (fenetre.dernierJourSec) {
    principal = `sec jusqu'à ${nommerJour(fenetre.dernierJourSec, aujourdhui)}`
  } else {
    principal = "prévisions indisponibles"
  }

  if (fenetre.prochainePluie && fenetre.joursSecs > 0) {
    details.push(`${fenetre.prochainePluie.mm} mm ${nommerJour(fenetre.prochainePluie.date, aujourdhui)}`)
  }
  if (fenetre.gel) {
    details.push(`gel probable ${nommerJour(fenetre.gel.date, aujourdhui)} (${fenetre.gel.tempMin} °C)`)
  }

  return { principal, details }
}
