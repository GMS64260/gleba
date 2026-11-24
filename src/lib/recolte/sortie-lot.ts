/**
 * Sortie de stock hors vente d'un lot de récolte : perte, consommation
 * personnelle ou don, en tout ou partie, à un jour donné.
 *
 * Même mécanique que la vente partielle : la partie sortie garde la ligne du
 * lot (son statut et son jour de sortie), le reste redevient un lot en stock
 * de la même culture. Le stock d'une espèce reste ainsi la somme de ses lots
 * en stock, sans seconde écriture à tenir d'accord avec eux.
 */
import { dateIsoFacture } from '@/lib/facture-regles'
import { libelleUniteQuantite, type UniteQuantite } from '@/lib/recolte/projection'
import { estAuMillieme } from '@/lib/stocks/milliemes'

const EPSILON = 1e-9

export type SortieLotPreparee =
  | { ok: true; quantite: number; reliquat: number; date: Date }
  | { ok: false; error: string; champ: 'quantiteSortie' | 'dateSortie' }

/**
 * Jour civil « AAAA-MM-JJ » d'une date du lot ou de la saisie : un jour seul
 * est stocké à minuit UTC et se lit tel quel ; un instant se lit à Paris.
 */
const jourCivil = (date: Date): string =>
  date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0
    ? date.toISOString().slice(0, 10)
    : dateIsoFacture(date)

const lendemain = (jour: string): string =>
  new Date(Date.parse(`${jour}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10)

export function preparerSortieLot(
  lot: { quantite: number; unite: string | null; date: Date },
  saisie: { quantiteSortie?: number | null; dateSortie?: Date | null },
  maintenant: Date = new Date(),
): SortieLotPreparee {
  let quantite = saisie.quantiteSortie ?? lot.quantite
  if (!(Number.isFinite(quantite) && quantite > 0)) {
    return { ok: false, error: 'Indiquez une quantité supérieure à zéro.', champ: 'quantiteSortie' }
  }
  if (quantite > lot.quantite + EPSILON) {
    return { ok: false, error: 'La quantité sortie dépasse la quantité disponible du lot.', champ: 'quantiteSortie' }
  }
  const lotEntier = Math.abs(quantite - lot.quantite) <= EPSILON
  if (lotEntier) quantite = lot.quantite
  const unite = (lot.unite ?? 'kg') as UniteQuantite
  if (unite !== 'kg' && !Number.isInteger(quantite)) {
    return { ok: false, error: `Un nombre entier de ${libelleUniteQuantite(unite, 2)} est attendu.`, champ: 'quantiteSortie' }
  }
  // Une part de lot se compte au millième, comme tout le stock commercial : une
  // quantité plus fine ferait un lot que la boutique ne sait pas publier. Le
  // lot entier sort tel qu'il est, quelle que soit sa précision d'origine.
  if (!lotEntier && !estAuMillieme(quantite)) {
    return { ok: false, error: 'Indiquez une quantité avec trois décimales au plus.', champ: 'quantiteSortie' }
  }
  // Jours civils. Sans date : aujourd'hui à Paris, ou le jour du lot s'il est
  // en avance (Outre-mer de l'Est : une récolte du matin y est datée du
  // lendemain de Paris). Borne haute avec un jour de marge, pour la même
  // raison que `apresDemain` ; l'écran, lui, borne au jour du navigateur.
  const aujourdhui = dateIsoFacture(maintenant)
  const jourLot = jourCivil(lot.date)
  const jour = saisie.dateSortie ? jourCivil(saisie.dateSortie) : (jourLot > aujourdhui ? jourLot : aujourdhui)
  if (jour < jourLot) {
    return { ok: false, error: 'La sortie ne peut pas être antérieure à la récolte du lot.', champ: 'dateSortie' }
  }
  if (jour > lendemain(aujourdhui)) {
    return { ok: false, error: 'Une sortie réelle ne peut pas être datée dans le futur.', champ: 'dateSortie' }
  }
  // Arrondi au millième : le reliquat d'un lot pesé ne porte pas la bavure du flottant.
  const reliquat = lotEntier ? 0 : Math.round((lot.quantite - quantite) * 1000) / 1000
  // Le jour de sortie est un jour seul, stocké à minuit UTC comme la date d'une récolte saisie.
  return { ok: true, quantite, reliquat: reliquat > EPSILON ? reliquat : 0, date: new Date(`${jour}T00:00:00.000Z`) }
}
