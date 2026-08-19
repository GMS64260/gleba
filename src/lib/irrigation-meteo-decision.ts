/**
 * Décision météo « ce passage d'arrosage est-il probablement inutile ? »,
 * partagée par les deux consommateurs du plan (getTachesPotager et
 * GET /api/calendrier) qui en dupliquaient chacun une copie.
 *
 * QA cmswu3260 — l'ancienne règle forfaitaire « 5 mm cumulés sur 3 jours
 * couvrent 3 jours d'arrosage » annulait 12 passages sous 0 mm de prévision
 * et 35 °C (5,8 mm tombés trois jours plus tôt, ET0 ≈ 5 mm/j), et l'écran
 * affichait la mauvaise cause (« 0mm de pluie prévue — probablement
 * inutile »). Trois corrections :
 *  - seuil de pluie récente aligné sur irrigation-conseil
 *    (SEUIL_PLUIE_AUTO_VALIDE = 8 mm) et couverture calculée depuis l'ET0
 *    réelle au lieu d'un forfait de 3 jours ;
 *  - la CAUSE de la décision est remontée (pluie récente vs pluie prévue)
 *    pour que l'écran nomme la bonne grandeur ;
 *  - le jour de prévision est le jour civil LOCAL du passage (date_prevue est
 *    un timestamp naïf UTC : 22:00 UTC = le lendemain à Paris, l'ancien
 *    toISOString() lisait la prévision de la veille).
 */

export type RaisonIrrigationInutile = 'pluie-recente' | 'pluie-prevue'

export interface DecisionIrrigationMeteo {
  /** mm prévus le jour civil local du passage (null hors fenêtre de prévision). */
  pluiePrevue: number | null
  /** mm tombés sur les 3 derniers jours + aujourd'hui. */
  pluieRecente: number
  probablementInutile: boolean
  raisonInutile: RaisonIrrigationInutile | null
}

/** Pluie prévue le jour même du passage qui couvre l'arrosage (mm). */
export const SEUIL_PLUIE_PREVUE = 5

/**
 * Cumul récent en dessous duquel la pluie n'annule JAMAIS un passage (mm).
 * Aligné sur SEUIL_PLUIE_AUTO_VALIDE d'irrigation-conseil : les deux écrans
 * (calendrier et Cultures > Irrigation) ne doivent pas se contredire.
 */
export const SEUIL_PLUIE_RECENTE = 8

/**
 * Jours d'arrosage couverts par une pluie récente selon l'évapotranspiration
 * (même formule qu'irrigation-conseil : pluie efficace 80 %, ETc ≈ ET0 × 0,8,
 * sans le facteur sol, inconnu ici). Sans ET0 (panne archive), repli prudent
 * sur 2 jours — jamais les 3 jours forfaitaires historiques.
 */
export function joursCouvertsParPluie(pluieMm: number, et0Journalier: number | null): number {
  if (et0Journalier == null || et0Journalier <= 0) return 2
  const jours = Math.floor((pluieMm * 0.8) / (et0Journalier * 0.8))
  return Math.min(jours, 6)
}

export function decideIrrigationMeteo(params: {
  /** mm prévus le jour civil local du passage, null si hors fenêtre. */
  pluiePrevueJour: number | null
  /** mm cumulés sur les 3 derniers jours + aujourd'hui. */
  pluieRecente: number
  /** ET0 moyenne journalière récente (mm/j), null si indisponible. */
  et0MoyenneJournaliere: number | null
  /** Jours civils entre aujourd'hui et le passage (0 = aujourd'hui). */
  joursAvant: number
}): DecisionIrrigationMeteo {
  const { pluiePrevueJour, pluieRecente, et0MoyenneJournaliere, joursAvant } = params

  const inutileParPrevision =
    pluiePrevueJour !== null && pluiePrevueJour >= SEUIL_PLUIE_PREVUE
  const inutileParPluieRecente =
    pluieRecente >= SEUIL_PLUIE_RECENTE &&
    joursAvant <= joursCouvertsParPluie(pluieRecente, et0MoyenneJournaliere)

  return {
    pluiePrevue: pluiePrevueJour,
    pluieRecente,
    probablementInutile: inutileParPluieRecente || inutileParPrevision,
    raisonInutile: inutileParPrevision
      ? 'pluie-prevue'
      : inutileParPluieRecente
        ? 'pluie-recente'
        : null,
  }
}

/**
 * Jour civil LOCAL au format YYYY-MM-DD : la clé des données journalières
 * Open-Meteo (interrogé en timezone=auto). Le conteneur tourne en
 * Europe/Paris ; utiliser toISOString() décalait d'un jour tout passage
 * horodaté après 22:00 UTC.
 */
export function jourCivilLocalISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Jours civils locaux entre la référence et une échéance (négatif si passée). */
export function joursCivilsAvant(datePrevue: Date, reference: Date = new Date()): number {
  const jour = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((jour(datePrevue) - jour(reference)) / 86_400_000)
}

/**
 * Libellé écran expliquant pourquoi un passage est probablement inutile.
 * Nomme la grandeur qui a réellement motivé la décision — jamais « 0mm de
 * pluie prévue — probablement inutile ».
 */
export function libelleIrrigationInutile(item: {
  raisonInutile?: RaisonIrrigationInutile | null
  pluiePrevue?: number | null
  pluieRecente?: number | null
}): string {
  const mm = (v: number) => `${String(Math.round(v * 10) / 10).replace('.', ',')}mm`
  if (item.raisonInutile === 'pluie-recente' && item.pluieRecente != null) {
    return `${mm(item.pluieRecente)} tombés ces 3 derniers jours — sol encore humide`
  }
  if (item.pluiePrevue != null && item.pluiePrevue > 0) {
    return `${mm(item.pluiePrevue)} de pluie prévue — irrigation probablement inutile`
  }
  return 'Pluie récente ou prévue — irrigation probablement inutile'
}
