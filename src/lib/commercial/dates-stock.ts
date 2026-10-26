import { dateIsoFacture } from '@/lib/facture-regles'

/** Une livraison porte un jour civil, comme la facture, et non un instant UTC. */
export function livraisonFuture(date: Date, maintenant = new Date()) {
  return dateIsoFacture(date) > dateIsoFacture(maintenant)
}

/**
 * Le jour civil du BL reste celui imprimé. Pour un mouvement enregistré ce
 * même jour, son effet sur un comptage est son instant réel d'enregistrement.
 * Couvre aussi les journaux 215 déjà datés à midi ; une livraison historique
 * conserve son effet antérieur au comptage, même si elle est saisie plus tard.
 */
export function dateEffetStockCommercial(m: { date: Date; createdAt: Date }) {
  return dateIsoFacture(m.date) === dateIsoFacture(m.createdAt) ? m.createdAt : m.date
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
