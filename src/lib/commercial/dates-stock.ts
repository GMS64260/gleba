import { dateIsoFacture } from '@/lib/facture-regles'

/** Une livraison porte un jour civil, comme la facture, et non un instant UTC. */
export function livraisonFuture(date: Date, maintenant = new Date()) {
  return dateIsoFacture(date) > dateIsoFacture(maintenant)
}

export function finJourLivraison(date: Date) {
  const jour = dateIsoFacture(date)
  // Les changements d'heure de Paris ont lieu avant midi. Son décalage à
  // midi est donc aussi celui de la fin de cette journée, y compris les jours DST.
  const midi = new Date(`${jour}T12:00:00Z`)
  const heure = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23',
  }).format(midi))
  return new Date(Date.parse(`${jour}T23:59:59.999Z`) - (heure - 12) * 3_600_000)
}
