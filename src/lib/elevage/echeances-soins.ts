/**
 * Échéance d'un soin à faire : en retard, à venir dans l'horizon, ou au-delà.
 *
 * QA 2026-10-19 — la tuile « Soins à planifier » du dashboard élevage annonçait
 * « 3 soins prévus dans les 30 prochains jours » quand deux étaient en retard
 * (19/08 et 24/08) et un seul à venir (26/10) : son compteur, calculé à part
 * dans `/api/elevage/stats`, n'avait pas de borne basse. Tuile, bandeau et
 * liste « Soins à faire » lisent désormais les comptes que `/api/elevage/taches`
 * calcule ici, sur les lignes mêmes de la liste.
 *
 * Jours civils : une échéance « AAAA-MM-JJ » est prise telle quelle, une date
 * horodatée par son jour local (le conteneur tourne en Europe/Paris, comme le
 * navigateur de l'éleveur). Module pur, sans accès base : utilisable à l'écran.
 */

/** Horizon de la tuile « Soins à planifier » (jours). */
export const HORIZON_SOINS_A_PLANIFIER_J = 30

const JOUR_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Jour civil local AAAA-MM-JJ d'une date (null si invalide). */
export function jourCivil(date: Date | string): string | null {
  if (typeof date === 'string' && JOUR_ISO.test(date)) return date
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return null
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const j = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${j}`
}

const versJourUtc = (jour: string) => {
  const [a, m, j] = jour.split('-').map(Number)
  return Date.UTC(a, m - 1, j)
}

/** Jours civils d'`aujourdhui` à `echeance` : négatif = en retard, 0 = aujourd'hui. */
export function joursAvantEcheance(echeance: Date | string, aujourdhui: string): number | null {
  const jour = jourCivil(echeance)
  if (!jour || !JOUR_ISO.test(aujourdhui)) return null
  return Math.round((versJourUtc(jour) - versJourUtc(aujourdhui)) / 86_400_000)
}

export type ClasseEcheanceSoin = 'en_retard' | 'a_venir' | 'au_dela'

/**
 * En retard avant aujourd'hui ; à venir d'aujourd'hui à J+horizon inclus ;
 * au-delà ensuite. Null pour une échéance absente ou invalide.
 */
export function classerEcheanceSoin(
  echeance: Date | string | null | undefined,
  aujourdhui: string,
  horizonJours = HORIZON_SOINS_A_PLANIFIER_J,
): ClasseEcheanceSoin | null {
  if (echeance == null) return null
  const jours = joursAvantEcheance(echeance, aujourdhui)
  if (jours == null) return null
  if (jours < 0) return 'en_retard'
  return jours <= horizonJours ? 'a_venir' : 'au_dela'
}

/** Échéance d'un soin à faire : sa date prévue, sinon sa date. */
export function echeanceSoinAFaire(soin: {
  datePrevue?: Date | string | null
  date?: Date | string | null
}): Date | string | null {
  return soin.datePrevue ?? soin.date ?? null
}

export interface CompteEcheancesSoins {
  /** Toutes les lignes à faire comptées, échéance absente comprise. */
  total: number
  enRetard: number
  /** D'aujourd'hui à J+horizon inclus. */
  aVenir: number
  auDela: number
  horizonJours: number
}

export function compterEcheancesSoins(
  echeances: Iterable<Date | string | null | undefined>,
  aujourdhui: string,
  horizonJours = HORIZON_SOINS_A_PLANIFIER_J,
): CompteEcheancesSoins {
  const compte: CompteEcheancesSoins = { total: 0, enRetard: 0, aVenir: 0, auDela: 0, horizonJours }
  for (const echeance of echeances) {
    compte.total += 1
    const classe = classerEcheanceSoin(echeance, aujourdhui, horizonJours)
    if (classe === 'en_retard') compte.enRetard += 1
    else if (classe === 'a_venir') compte.aVenir += 1
    else if (classe === 'au_dela') compte.auDela += 1
  }
  return compte
}

const horodatage = (echeance: Date | string | null) => {
  if (echeance == null) return Number.POSITIVE_INFINITY
  const t = new Date(echeance).getTime()
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
}

/**
 * Soins à faire triés par échéance (`echeanceSoinAFaire`), les plus en retard
 * d'abord, sans échéance en dernier. Revue 2026-10-19 : la liste du dashboard
 * gardait les 20 premiers soins triés par date PUIS les injections, si bien
 * qu'une injection très en retard pouvait sortir de la liste tronquée.
 */
export function trierParEcheanceSoin<T extends { datePrevue?: Date | string | null; date?: Date | string | null }>(
  soins: readonly T[],
): T[] {
  return [...soins].sort((a, b) => horodatage(echeanceSoinAFaire(a)) - horodatage(echeanceSoinAFaire(b)))
}
