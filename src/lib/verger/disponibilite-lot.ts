import { dateIsoFacture } from '@/lib/facture-regles'

/** Même règle de jour civil pour le catalogue, une vente native et sa date d'effet. */
export function indisponibiliteLotVerger(lot: { date: Date; datePeremption?: Date | null }, aLaDate: Date) {
  const jour = dateIsoFacture(aLaDate)
  if (dateIsoFacture(lot.date) > jour) return 'avant_production' as const
  if (lot.datePeremption && dateIsoFacture(lot.datePeremption) < jour) return 'perime' as const
  return null
}

/**
 * Jours civils avant la péremption : 0 = dernier jour vendable, négatif = périmé.
 * Même jour civil que la règle de vente ci-dessus, pour que l'écran n'annonce
 * pas « Périmé » un lot encore vendable (équipe debug, D109).
 */
export function joursAvantPeremptionLot(datePeremption: Date | string, aLaDate: Date): number {
  return Math.round((Date.parse(dateIsoFacture(datePeremption)) - Date.parse(dateIsoFacture(aLaDate))) / 86_400_000)
}
