import { dateIsoFacture } from '@/lib/facture-regles'

/** Une livraison porte un jour civil, comme la facture, et non un instant UTC. */
export function livraisonFuture(date: Date, maintenant = new Date()) {
  return dateIsoFacture(date) > dateIsoFacture(maintenant)
}

/**
 * Date d'effet d'un mouvement au journal du stock commercial. Le jour civil du
 * BL reste celui imprimé ; pour un mouvement enregistré ce même jour, l'effet
 * est son instant réel d'enregistrement (journaux 215 datés à midi compris).
 * Avant le modèle de stock unique, cette date plaçait le mouvement avant ou
 * après un comptage ; depuis L4.2 (2026-11-24), le stock est la somme des
 * restes des lots et cette date ne fait plus que dater le journal.
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
