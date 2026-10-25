/**
 * Jour civil d'une date « jour seul » (semis, plantation, récolte,
 * intervention…) : règle unique d'écriture et de lecture.
 *
 * Les colonnes `timestamp` sans fuseau stockent un instant UTC. Deux formes y
 * coexistent pour un même jour civil :
 *  - SANS HEURE : minuit UTC du jour. C'est la convention d'écriture : un champ
 *    « AAAA-MM-JJ » de formulaire (`normalizeCultureDateFields`,
 *    `normaliserDateApi`) arrive ainsi.
 *  - AVEC HEURE : un instant. Une étape marquée « faite » recalée sur
 *    maintenant, ou un minuit LOCAL calculé côté serveur (`semaineVersDate`) :
 *    le 12 avril à 00:00 à Paris est stocké le 11 avril à 22:00 UTC.
 *
 * Lire le jour UTC de la seconde forme donne la veille. Ticket QA cmvnulry1
 * (2026-10-25) : une courge créée depuis la rotation, semée le 12/04/2027 selon
 * sa fiche (lecture locale), figurait au 11 avr. dans le Registre de culture
 * (lecture UTC). Même règle que `jourSoin` (`src/lib/elevage/date-soin.ts`) :
 * minuit UTC pile = jour saisi ; sinon jour local du processus (Europe/Paris
 * dans le conteneur).
 */

const MS_JOUR = 86_400_000
const JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/

/** Vrai pour une date stockée sans heure (minuit UTC pile). */
export function estMinuitUtc(date: Date): boolean {
  return date.getTime() % MS_JOUR === 0
}

/**
 * Jour civil LOCAL « AAAA-MM-JJ » d'une date (fuseau du processus ou du
 * navigateur), jamais `toISOString`, qui est en UTC. Seule copie : réexportée
 * par `src/lib/accueil/classement.ts`.
 */
export function jourLocalISO(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const j = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${m}-${j}`
}

/**
 * Jour civil « AAAA-MM-JJ » d'une date stockée (objet, ISO ou jour seul), à
 * afficher ou à comparer ; `null` si absente ou illisible (« 2027-02-31 »
 * compris : un jour inexistant n'est pas un jour).
 */
export function jourCivilStocke(date: Date | string | null | undefined): string | null {
  if (date == null || date === "") return null
  if (typeof date === "string" && JOUR_ISO.test(date)) {
    const minuitUtc = new Date(`${date}T00:00:00.000Z`)
    return !Number.isNaN(minuitUtc.getTime()) && minuitUtc.toISOString().slice(0, 10) === date ? date : null
  }
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return estMinuitUtc(d) ? d.toISOString().slice(0, 10) : jourLocalISO(d)
}

/**
 * Date à ÉCRIRE pour un jour seul : minuit UTC du jour civil de `date` (règle
 * `jourCivilStocke`), la forme qu'écrit une saisie « AAAA-MM-JJ ».
 *  - Minuit local (`new Date(a, m, j)`, `semaineVersDate`, `setDate`) : son jour
 *    local.
 *  - Instant reçu (« 2027-04-11T22:00:00.000Z », minuit à Paris) : son jour
 *    local au serveur.
 *  - Minuit UTC déjà écrit : inchangé (idempotent), y compris à Tahiti ou en
 *    Martinique, où une lecture par composantes locales le reculerait d'un jour.
 * Date illisible : date invalide.
 */
export function dateJourSeul(date: Date): Date
export function dateJourSeul(date: Date | null): Date | null
export function dateJourSeul(date: Date | null): Date | null {
  if (!date) return null
  const jour = jourCivilStocke(date)
  return jour ? new Date(`${jour}T00:00:00.000Z`) : new Date(Number.NaN)
}
