/**
 * Comparaison, pour UNE espèce, du stock de Gestion des stocks et des lots
 * de récolte encore en stock.
 *
 * Ticket QA cmvnpe6ip (2026-10-25) — Gestion des stocks > Récoltes disait
 * « Radis 7,5 kg, inventaire du 25/10/2026 » ; Récoltes > Stock disait
 * « En stock 8 kg » (quatre lots de 2 kg), sans rien qui relie les deux.
 * Deux grandeurs portent le même mot :
 *
 * - Gestion des stocks (`calculerStocksNet`) : dernier comptage daté + lots
 *   datés après lui − sorties saisies dans Consommations après lui, lots en
 *   boutique exclus ;
 * - les lots `Recolte.statut = 'en_stock'`, ce qui se vend lot par lot
 *   (Récoltes > Stock, boutique). C'est la grandeur de l'écran Récoltes.
 *
 * Ce module ne choisit pas entre les deux et n'attribue pas de cause à
 * l'écart : il donne la différence et les seules composantes que les données
 * établissent. Limites connues (revue du 2026-10-25) : un lot daté avant le
 * comptage puis vendu, perdu ou consommé après n'est déduit de Gestion des
 * stocks qu'au comptage suivant (seule la vente est datée, par `dateVente`) ;
 * une récolte datée du jour du comptage ou d'avant n'y est pas ajoutée, même
 * saisie après lui. Pur et sans base : l'écran Récoltes l'importe.
 */
import { arrondiQuantiteStock } from '@/lib/stocks/agregation'
import { formatQuantite, formatQuantiteParUnite, type QuantiteParUnite } from '@/lib/recolte/quantites'
import type { UniteQuantite } from '@/lib/recolte/projection'

/** Un lot de récolte encore en stock. `unite` null = kg. */
export interface LotEnStock {
  date: Date | string
  quantite: number
  unite: string | null
  /** Lot mis en vente sur la boutique : Gestion des stocks ne le compte pas. */
  enBoutique: boolean
}

/** Un lot vendu (statut `vendu`, `dateVente` renseignée). */
export interface LotVendu {
  date: Date | string
  dateVente: Date | string
  quantite: number
  unite: string | null
}

/** Ce que la comparaison lit du stock de Gestion des stocks (`StockNet`). */
export interface StockGestion {
  stockNet: number
  unite: UniteQuantite
  dateInventaire: Date | string | null
  detail: { consommations: number }
}

export interface ComparaisonStockLots {
  unite: UniteQuantite
  /** Stock affiché par Gestion des stocks. */
  stockGestion: number
  /** Date du comptage dont Gestion des stocks repart (null = aucun). */
  dateComptage: Date | string | null
  /** Lots en stock dans l'unité du stock, toutes années, boutique comprise. */
  lotsEnStock: number
  /** stockGestion − lotsEnStock, 0 sous le seuil de l'unité. */
  ecart: number
  /** Lots datés jusqu'au comptage, vendus après lui : non déduits de Gestion des stocks. */
  vendusDepuisComptage: number
  /** Sorties saisies dans Consommations (depuis le comptage) : aucun lot ne les porte. */
  sortiesConsommations: number
  /** Lots en boutique que Gestion des stocks ne compte pas. */
  lotsEnBoutique: number
  /** Lots en stock dans une autre unité que celle du stock : hors Gestion des stocks. */
  autresUnites: QuantiteParUnite
}

/** En dessous, une différence n'est qu'un arrondi : 5 g, ou une demi-pièce. */
export function seuilEcart(unite: UniteQuantite): number {
  return unite === 'kg' ? 0.005 : 0.5
}

export function ecartSignificatif(quantite: number, unite: UniteQuantite): boolean {
  return Math.abs(quantite) >= seuilEcart(unite)
}

const instant = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime()

export function comparerStockEtLots(
  stock: StockGestion,
  lotsEnStock: LotEnStock[],
  lotsVendus: LotVendu[] = [],
): ComparaisonStockLots {
  const unite = stock.unite
  const comptage = stock.dateInventaire ? instant(stock.dateInventaire) : null
  const dansUnite = (u: string | null) => (u ?? 'kg') === unite

  let lots = 0
  let enBoutique = 0
  const autresUnites: QuantiteParUnite = {}
  for (const lot of lotsEnStock) {
    if (!dansUnite(lot.unite)) {
      const u = lot.unite as UniteQuantite
      autresUnites[u] = (autresUnites[u] ?? 0) + lot.quantite
      continue
    }
    lots += lot.quantite
    // Même règle que `calculerStocksNet` : un lot daté jusqu'au comptage est
    // remplacé par lui ; seuls les suivants sont exclus au titre de la boutique.
    const apresComptage = comptage == null || instant(lot.date) > comptage
    if (lot.enBoutique && apresComptage) enBoutique += lot.quantite
  }

  let vendus = 0
  if (comptage != null) {
    for (const v of lotsVendus) {
      if (dansUnite(v.unite) && instant(v.date) <= comptage && instant(v.dateVente) > comptage) {
        vendus += v.quantite
      }
    }
  }

  const lotsArrondis = arrondiQuantiteStock(lots)
  const ecart = arrondiQuantiteStock(stock.stockNet - lotsArrondis)
  const garder = (q: number) => (ecartSignificatif(q, unite) ? arrondiQuantiteStock(q) : 0)
  return {
    unite,
    stockGestion: stock.stockNet,
    dateComptage: stock.dateInventaire,
    lotsEnStock: lotsArrondis,
    ecart: garder(ecart),
    vendusDepuisComptage: garder(vendus),
    sortiesConsommations: garder(stock.detail.consommations),
    lotsEnBoutique: garder(enBoutique),
    autresUnites: Object.fromEntries(
      Object.entries(autresUnites)
        .map(([u, q]) => [u, arrondiQuantiteStock(q)] as const)
        .filter(([u, q]) => ecartSignificatif(q, u as UniteQuantite)),
    ) as QuantiteParUnite,
  }
}

/** Y a-t-il quelque chose à dire pour cette espèce ? */
export function comparaisonADire(c: ComparaisonStockLots): boolean {
  return c.ecart !== 0 || Object.keys(c.autresUnites).length > 0
}

/** « −0,5 kg », « +5 tiges » : le signe dit le sens de l'écart. */
export function formatEcartQuantite(quantite: number, unite: UniteQuantite): string {
  const signe = quantite < 0 ? '−' : '+'
  return `${signe}${formatQuantite(Math.abs(quantite), unite)}`
}

const jourFr = (d: Date | string) => (d instanceof Date ? d : new Date(d)).toLocaleDateString('fr-FR')

/** Phrase de limite, dite une fois sous les comparaisons. */
export const LIMITE_GESTION_STOCKS =
  "Gestion des stocks repart du dernier comptage : une récolte datée du jour du comptage ou d'avant n'y est pas ajoutée, et un lot récolté avant le comptage puis vendu, perdu ou consommé n'en est déduit qu'au comptage suivant."

/**
 * Ligne d'information d'une espèce et ses compléments, sans cause supposée :
 * « Gestion des stocks : 7,5 kg (comptage du 25/10/2026) · lots en stock :
 * 8 kg · écart : −0,5 kg ».
 */
export function lignesComparaison(c: ComparaisonStockLots): { ligne: string; complements: string[] } {
  const u = c.unite
  const comptage = c.dateComptage ? `comptage du ${jourFr(c.dateComptage)}` : 'sans comptage'
  const ecart = c.ecart === 0 ? 'aucun écart' : `écart : ${formatEcartQuantite(c.ecart, u)}`
  const ligne = `Gestion des stocks : ${formatQuantite(c.stockGestion, u)} (${comptage}) · lots en stock : ${formatQuantite(c.lotsEnStock, u)} · ${ecart}`

  const complements: string[] = []
  if (c.vendusDepuisComptage) {
    complements.push(`dont ${formatQuantite(c.vendusDepuisComptage, u)} vendus depuis le comptage, non déduits de Gestion des stocks`)
  }
  if (c.sortiesConsommations) {
    complements.push(
      `dont ${formatQuantite(c.sortiesConsommations, u)} de sorties saisies dans Consommations${c.dateComptage ? ' depuis le comptage' : ''}, sur aucun lot`,
    )
  }
  if (c.lotsEnBoutique) {
    complements.push(`dont ${formatQuantite(c.lotsEnBoutique, u)} de lots en boutique, hors Gestion des stocks`)
  }
  if (Object.keys(c.autresUnites).length > 0) {
    complements.push(`lots dans une autre unité, hors Gestion des stocks : ${formatQuantiteParUnite(c.autresUnites)}`)
  }
  return { ligne, complements }
}
