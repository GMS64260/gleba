/**
 * BUG-15 — Breakdown des besoins en semences par mode (graines vs caïeux).
 *
 * Permet d'aligner le header « X manquant + Y insuffisant » avec ce que
 * voit l'utilisateur dans les onglets de la page Semences (graines /
 * plants à produire / caïeux). Sans ça, un header « 8 manquant » mais
 * une liste « 6 graines » à l'écran donne un sentiment d'incohérence.
 */

import type { ModeSemis, StatutSemence } from './calcul'

export interface BesoinShape {
  mode: ModeSemis
  statut: StatutSemence
}

export interface ManquantsBreakdown {
  nbMissingGraines: number
  nbMissingCaieux: number
  nbLowGraines: number
  nbLowCaieux: number
}

function isCaieu(b: BesoinShape): boolean {
  return b.mode === 'bulbe_caieu' || b.mode === 'bouture'
}

export function computeManquantsBreakdown(besoins: BesoinShape[]): ManquantsBreakdown {
  let nbMissingGraines = 0
  let nbMissingCaieux = 0
  let nbLowGraines = 0
  let nbLowCaieux = 0
  for (const b of besoins) {
    if (b.statut === 'MISSING') {
      if (isCaieu(b)) nbMissingCaieux++
      else nbMissingGraines++
    } else if (b.statut === 'LOW') {
      if (isCaieu(b)) nbLowCaieux++
      else nbLowGraines++
    }
  }
  return { nbMissingGraines, nbMissingCaieux, nbLowGraines, nbLowCaieux }
}
