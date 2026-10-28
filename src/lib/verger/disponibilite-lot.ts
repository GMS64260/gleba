import { dateIsoFacture } from '@/lib/facture-regles'

/** Même règle de jour civil pour le catalogue, une vente native et sa date d'effet. */
export function indisponibiliteLotVerger(lot: { date: Date; datePeremption?: Date | null }, aLaDate: Date) {
  const jour = dateIsoFacture(aLaDate)
  if (dateIsoFacture(lot.date) > jour) return 'avant_production' as const
  if (lot.datePeremption && dateIsoFacture(lot.datePeremption) < jour) return 'perime' as const
  return null
}
