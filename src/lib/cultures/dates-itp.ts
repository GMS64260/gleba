/**
 * Dates d'un cycle cultural déduites d'un itinéraire technique.
 *
 * Un ITP ne porte que des numéros de semaine (1-52), sans année : un cycle
 * peut donc chevaucher deux, voire trois millésimes (semis en octobre,
 * plantation en février, récolte en janvier suivant).
 *
 * L'ancien calcul, dupliqué dans trois formulaires, comparait chaque étape à
 * la semaine de référence prise isolément. Il pouvait produire une récolte
 * ANTÉRIEURE à la plantation : semis semaine 40 → plantation semaine 5 de
 * l'année suivante, mais récolte semaine 45 laissée sur l'année de départ.
 * Deux ITP du référentiel tombaient dans ce cas.
 *
 * On construit désormais les jalons en cascade : chacun est repoussé d'une
 * année tant qu'il précède le précédent. L'ordre semis ≤ plantation ≤ récolte
 * est donc garanti par construction.
 */

/** Lundi de la semaine ISO `semaine` de l'année `annee`. */
export function semaineVersDate(annee: number, semaine: number): Date {
  const jan4 = new Date(annee, 0, 4)
  const jourSemaine = jan4.getDay() || 7
  const lundi = new Date(jan4)
  lundi.setDate(jan4.getDate() - jourSemaine + 1 + (semaine - 1) * 7)
  return lundi
}

export type SemainesItp = {
  semaineSemis?: number | null
  semainePlantation?: number | null
  semaineRecolte?: number | null
  semaineImplantationDebut?: number | null
}

export type DatesCycle = {
  dateSemis: Date | null
  datePlantation: Date | null
  dateRecolte: Date | null
}

/** Nombre maximum de reports d'un an : un cycle ne s'étale pas au-delà. */
const REPORTS_MAX = 2

/**
 * Place une étape à la semaine donnée, en la repoussant d'année en année tant
 * qu'elle précède le jalon précédent.
 */
function jalonApres(annee: number, semaine: number, precedent: Date | null): Date {
  let date = semaineVersDate(annee, semaine)
  for (let report = 0; report < REPORTS_MAX && precedent && date < precedent; report++) {
    date = semaineVersDate(annee + report + 1, semaine)
  }
  return date
}

/**
 * Semaine de début de cycle exploitable.
 *
 * 173 ITP du référentiel (mesclun INRAE et assimilés) ne portent ni semaine de
 * semis ni semaine de plantation : seule leur fenêtre d'implantation situe le
 * début du cycle. Sans elle, la récolte était posée en absolu et pouvait
 * précéder le semis saisi par l'utilisateur (QA cmsfxvbab : Pourpier semé le
 * 05/08/2026, récolte proposée au 20/04/2026, création refusée par l'API).
 *
 * Ces ITP décrivent un semis direct (aucune durée de pépinière renseignée) :
 * l'implantation vaut donc semis. Si l'ITP porte une semaine de plantation, on
 * n'invente pas de semis — le jalon plantation suffit à ancrer la récolte.
 */
export function semaineSemisEffective(itp: SemainesItp): number | null {
  if (itp.semaineSemis) return itp.semaineSemis
  if (itp.semainePlantation) return null
  return itp.semaineImplantationDebut ?? null
}

/**
 * Durée du cycle cultural en jours, de l'ancrage (plantation, sinon semis
 * effectif) à la récolte, d'après les semaines de l'ITP. Modulo l'année : une
 * récolte en janvier pour un semis d'août vaut 21 semaines, pas −31. À défaut
 * de semaines exploitables, la durée de culture brute de l'ITP fait foi.
 *
 * Friction 2026-08-14 : la date de récolte ne suivait pas la date de début
 * saisie (ail planté le 05/03, récolte laissée au 11/07 de l'année suivante,
 * héritée de l'ancrage ITP semaine 40). Cette durée est la référence unique
 * des trois formulaires ET de la reprise de données — ne pas la recopier.
 */
export function dureeCycleItpJours(
  itp: SemainesItp & { dureeCulture?: number | null }
): number | null {
  const ancrage = itp.semainePlantation ?? semaineSemisEffective(itp)
  if (itp.semaineRecolte && ancrage) {
    const jours = ((((itp.semaineRecolte - ancrage) % 52) + 52) % 52) * 7
    if (jours > 0) return jours
  }
  if (itp.dureeCulture && itp.dureeCulture > 0) return itp.dureeCulture
  return null
}

/**
 * Récolte recalée sur le début réel du cycle (plantation, sinon semis), en
 * préservant la durée du cycle ITP. Null si l'ITP ne permet aucun calcul.
 */
export function recolteApresDebut(
  debut: Date,
  itp: SemainesItp & { dureeCulture?: number | null }
): Date | null {
  const duree = dureeCycleItpJours(itp)
  if (!duree) return null
  const recolte = new Date(debut)
  recolte.setDate(recolte.getDate() + duree)
  return recolte
}

/**
 * Dates de semis, plantation et récolte pour une saison donnée.
 * Les étapes absentes de l'ITP restent nulles et ne décalent rien.
 */
export function datesDepuisItp(annee: number, itp: SemainesItp): DatesCycle {
  const semaineSemis = semaineSemisEffective(itp)
  const dateSemis = semaineSemis ? semaineVersDate(annee, semaineSemis) : null

  const datePlantation = itp.semainePlantation
    ? jalonApres(annee, itp.semainePlantation, dateSemis)
    : null

  const ancre = datePlantation ?? dateSemis
  const dateRecolte = itp.semaineRecolte
    ? jalonApres(annee, itp.semaineRecolte, ancre)
    : null

  return { dateSemis, datePlantation, dateRecolte }
}
