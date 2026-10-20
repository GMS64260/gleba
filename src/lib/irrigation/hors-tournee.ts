/**
 * Cultures en urgence d'arrosage restées HORS de la tournée du jour.
 *
 * QA cmvge3o5z (2026-10-20) : la page Irriguer annonçait « 3 à arroser
 * aujourd'hui » (toutes les cultures du conseil en urgence critique ou haute)
 * quand la page Tâches en listait 2 (`arrosagesDuJour` : les seules cultures
 * cochées « à irriguer », décision d'opt-in du 2026-10-10). Le Poireau Bleu de
 * Solaise de C2, non coché, était « Urgent » d'un côté et absent de l'autre,
 * sans un mot. Les deux surfaces et l'assistant lisent désormais la même
 * tournée (`tourneeDuJour`, `src/lib/irrigation/a-arroser.ts`) et nomment les
 * cultures qu'elle écarte, avec les mêmes phrases.
 *
 * Deux cas, deux tons (revue du 2026-10-20) : une culture jamais cochée est
 * une invitation (« cochez… ») ; une culture décochée l'a été exprès
 * (goutte-à-goutte programmé…) : on le mentionne, sans alerte.
 *
 * Module pur, sans accès serveur : importé par les écrans.
 */

/** Culture du conseil en urgence critique ou haute, hors de la tournée. */
export interface CultureHorsTournee {
  cultureId: number
  /** « Poireau Bleu de Solaise » : variété si connue, sinon espèce. */
  libelle: string
  plancheNom: string | null
  urgence: 'critique' | 'haute'
  /**
   * `non_cochee` : « à irriguer » jamais renseigné (null) ; `exclue` : décochée
   * volontairement (false). Absent (réponse antérieure) : non cochée.
   */
  motif?: 'non_cochee' | 'exclue'
}

/** « Poireau Bleu de Solaise (C2) ». */
export function nommerCultureHorsTournee(culture: CultureHorsTournee): string {
  return culture.plancheNom ? `${culture.libelle} (${culture.plancheNom})` : culture.libelle
}

function liste(cultures: readonly CultureHorsTournee[]): string {
  const noms = cultures.map(nommerCultureHorsTournee)
  return noms.length === 1 ? noms[0] : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`
}

const estExclue = (c: CultureHorsTournee) => c.motif === 'exclue'

/**
 * Invitation (ton d'alerte) pour les cultures en urgence jamais cochées
 * « à irriguer », ou `null`.
 */
export function phraseHorsTournee(cultures: readonly CultureHorsTournee[]): string | null {
  const nonCochees = cultures.filter((c) => !estExclue(c))
  if (nonCochees.length === 0) return null
  return nonCochees.length === 1
    ? `1 culture en urgence n'est pas cochée « à irriguer » et reste hors de la tournée : ${liste(nonCochees)}.`
    : `${nonCochees.length} cultures en urgence ne sont pas cochées « à irriguer » et restent hors de la tournée : ${liste(nonCochees)}.`
}

/**
 * Mention neutre des cultures en urgence décochées volontairement, ou `null`.
 */
export function phraseExcluesTournee(cultures: readonly CultureHorsTournee[]): string | null {
  const exclues = cultures.filter(estExclue)
  if (exclues.length === 0) return null
  return exclues.length === 1
    ? `Exclue volontairement de la tournée (décochée « à irriguer ») : ${liste(exclues)}.`
    : `Exclues volontairement de la tournée (décochées « à irriguer ») : ${liste(exclues)}.`
}
