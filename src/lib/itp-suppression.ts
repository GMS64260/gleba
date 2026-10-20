/**
 * Refus de suppression d'un itinéraire technique (ITP) : la route le décide et
 * le rédige, les écrans (liste et fiche des ITP) l'affichent tel quel.
 *
 * 2026-10-20 : les deux écrans refusaient seuls d'après LEUR compteur (cultures
 * du compte, étapes de rotation), avec un message sans accents et sans dire où
 * retrouver ces cultures. La route portait déjà le refus (409) et distinguait
 * les cultures des autres membres ; elle nomme désormais aussi les années des
 * cultures du compte et les rotations concernées.
 */

import { formaterAnnees } from '@/lib/planches/traces'
import { enumerer } from '@/lib/rotations/suppression'

export interface UsageItp {
  /** Cultures du compte, par année de planification (`Culture.annee`). */
  culturesDuCompte: number
  anneesCulturesDuCompte: number[]
  /** Cultures du compte sans année de planification. */
  culturesDuCompteSansAnnee: number
  /** Cultures d'autres membres (ITP partagé avec la communauté). */
  culturesAutresMembres: number
  /** Étapes de rotation qui pointent l'ITP, et les rotations qui les portent. */
  etapesRotation: number
  rotations: string[]
}

const ROTATIONS_CITEES = 5

function precisionAnnees(usage: UsageItp): string {
  const annees = formaterAnnees(usage.anneesCulturesDuCompte)
  const sansAnnee = usage.culturesDuCompteSansAnnee
  if (!annees) return sansAnnee > 0 ? ' (sans année)' : ''
  return sansAnnee > 0 ? ` (${annees}, et ${sansAnnee} sans année)` : ` (${annees})`
}

function rotationsCitees(rotations: readonly string[]): string {
  if (rotations.length === 0) return ''
  const cites = rotations.slice(0, ROTATIONS_CITEES).map((id) => `« ${id} »`)
  const reste = rotations.length - cites.length
  const liste = reste > 0 ? `${cites.join(', ')} et ${reste} autre${reste > 1 ? 's' : ''}` : enumerer(cites)
  return ` (rotation${rotations.length > 1 ? 's' : ''} ${liste})`
}

/** Message de refus, ou `null` si rien ne retient l'ITP. */
export function messageRefusSuppressionItp(usage: UsageItp): string | null {
  const parties: string[] = []
  if (usage.culturesDuCompte > 0) {
    parties.push(
      `${usage.culturesDuCompte === 1 ? 'une de vos cultures' : `${usage.culturesDuCompte} de vos cultures`}${precisionAnnees(usage)}`,
    )
  }
  if (usage.culturesAutresMembres > 0) {
    parties.push(
      `${usage.culturesAutresMembres} culture${usage.culturesAutresMembres > 1 ? 's' : ''} d'autres membres de la communauté`,
    )
  }
  if (usage.etapesRotation > 0) {
    parties.push(
      `${usage.etapesRotation} étape${usage.etapesRotation > 1 ? 's' : ''} de rotation${rotationsCitees(usage.rotations)}`,
    )
  }
  if (parties.length === 0) return null
  return `Impossible de supprimer cet itinéraire : il est utilisé par ${enumerer(parties)}.`
}
