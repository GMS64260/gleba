import { jourCivilStocke } from '@/lib/jour-civil'
import { ecartJoursCivils } from '@/lib/dates/jours-civils'

/**
 * Ancienneté signée entre le jour stocké de la pièce et le jour local courant.
 * Minuit UTC reste un jour sans heure ; les autres instants suivent le fuseau
 * du navigateur. Midi local permet de comparer les jours, même au changement
 * d'heure, sans transformer le jour stocké en veille à l'ouest d'UTC.
 */
export function ancienneteImpayee(date: Date | string, maintenant: Date): number {
  const jour = jourCivilStocke(date)
  if (!jour) return Number.NaN
  return ecartJoursCivils(new Date(`${jour}T12:00:00`), maintenant)
}
