/**
 * Durées d'une espèce animale (jours) : entières et strictement positives.
 * Une gestation de −7 jours passait jusqu'en base et faisait prévoir la
 * naissance avant l'accouplement (équipe debug, D222).
 */
const DUREES = [
  ['dureeGestation', 'Gestation'],
  ['dureeCouvaison', 'Couvaison'],
  ['dureeElevage', "Durée d'élevage"],
] as const

export function refusDureesEspece(body: Record<string, unknown>): { champ: string; erreur: string } | null {
  for (const [champ, libelle] of DUREES) {
    const valeur = body[champ]
    if (valeur === undefined || valeur === null || valeur === '') continue
    if (typeof valeur !== 'number' || !Number.isInteger(valeur) || valeur <= 0) {
      return { champ, erreur: `${libelle} : nombre entier de jours supérieur à 0.` }
    }
  }
  return null
}
