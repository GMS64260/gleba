import { jourCivilLocal } from '@/lib/cultures/execution'

/** Écart signé entre deux jours locaux, indépendant de l'heure et du changement d'heure. */
export function ecartJoursCivils(debut: Date, fin: Date): number {
  return (jourCivilLocal(fin) - jourCivilLocal(debut)) / 86_400_000
}
