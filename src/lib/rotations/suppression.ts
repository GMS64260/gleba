/**
 * Refus de suppression d'une rotation : la route le décide et le rédige, les
 * écrans (liste et fiche des rotations) l'affichent tel quel.
 *
 * 2026-10-20 : les deux écrans refusaient seuls dès que LEUR compteur voyait
 * des planches (« X est utilisee par 2 planche(s) »). Ce compteur ne porte que
 * les planches du compte, alors que la rotation est un référentiel global :
 * un administrateur sans planche passait la garde de l'écran, la route
 * refusait (planches d'autres comptes) et l'écran remplaçait son message par
 * « Impossible de supprimer la rotation ».
 */

export interface UsageRotation {
  /** Noms des planches du compte qui suivent la rotation. */
  planchesDuCompte: string[]
  /** Planches des autres comptes (la rotation est partagée). */
  planchesAutresComptes: number
}

/** Noms cités au plus avant « et N autres ». */
const NOMS_CITES = 5

/** « a », « a et b », « a, b et c ». */
export function enumerer(elements: readonly string[]): string {
  if (elements.length <= 1) return elements[0] ?? ''
  return `${elements.slice(0, -1).join(', ')} et ${elements[elements.length - 1]}`
}

function nomsCites(noms: readonly string[]): string {
  const cites = noms.slice(0, NOMS_CITES).map((nom) => `« ${nom} »`)
  const reste = noms.length - cites.length
  return reste > 0 ? `${cites.join(', ')} et ${reste} autre${reste > 1 ? 's' : ''}` : enumerer(cites)
}

/**
 * Message de refus, ou `null` si rien ne retient la rotation.
 * « Impossible de supprimer la rotation « R1 » : elle est suivie par 2 de vos
 * planches (« P1 » et « P2 ») et par 3 planches d'autres comptes. … »
 */
export function messageRefusSuppressionRotation(id: string, usage: UsageRotation): string | null {
  const duCompte = usage.planchesDuCompte.length
  const autres = usage.planchesAutresComptes
  const parties: string[] = []
  if (duCompte === 1) parties.push(`votre planche ${nomsCites(usage.planchesDuCompte)}`)
  else if (duCompte > 1) parties.push(`${duCompte} de vos planches (${nomsCites(usage.planchesDuCompte)})`)
  if (autres > 0) parties.push(`${autres} planche${autres > 1 ? 's' : ''} d'autres comptes`)
  if (parties.length === 0) return null
  const consigne =
    duCompte > 0
      ? ' Retirez-la d’abord de ces planches, depuis leur fiche.'
      : ''
  return `Impossible de supprimer la rotation « ${id} » : elle est suivie par ${parties.join(' et par ')}.${consigne}`
}
