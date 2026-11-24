import { jourCivilLocal } from '@/lib/cultures/execution'

/** Écart signé entre deux jours locaux, indépendant de l'heure et du changement d'heure. */
export function ecartJoursCivils(debut: Date, fin: Date): number {
  return (jourCivilLocal(fin) - jourCivilLocal(debut)) / 86_400_000
}

/**
 * Rang d'un jour dans son année, 0 pour le 1er janvier. Compté en jours
 * civils : après le passage à l'heure d'été, un minuit local est à N jours
 * moins une heure du 1er janvier, et l'écart d'instants arrondi vers le bas
 * rendait N − 1. Le curseur de date du plan restait bloqué au 30 mars au
 * clavier (FB-M89SKJ).
 */
export function rangJourAnnee(date: Date): number {
  return Math.max(0, ecartJoursCivils(new Date(date.getFullYear(), 0, 1), date))
}
