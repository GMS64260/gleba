/**
 * Cave de fromage : unité d'une vente, stock restant d'un lot et valorisation.
 *
 * Signalement QA du 2026-10-19 : un lot de 4 pièces pour 0,30 kg, dont 2 pièces
 * vendues à 2 €/pièce sans pesée, s'affichait « 2 pc · 0,3 kg » valorisé
 * 0,60 € (0,3 kg × 2 €). La cave lisait toute quantité vendue comme des kilos
 * et ne retirait aucun poids d'une vente à la pièce.
 *
 * Règles (une seule source pour la cave, les ventes et les sorties de cave) :
 * - Unité d'une vente de fromage : au poids (kg, ou g converti en kg) ou à la
 *   pièce (pièce, unité). Toute autre unité est refusée par la route.
 * - Stock d'un lot : les pièces suivent le compte (fabriquées moins pièces
 *   sorties, pièces entières), jamais plafonnées par le poids. Le poids suit la
 *   pesée réelle d'une sortie, sinon ses pièces au poids moyen (poids fabriqué
 *   divisé par les pièces fabriquées), borné à 0. Le lot est épuisé sans pièce
 *   restante, ou quand des sorties au poids seul (coupe, vente au kg) ont
 *   consommé tout le poids : une tomme vendue à la coupe ne garde pas « 1 pièce ».
 *   Épuisé, son stock vaut 0 pièce et 0 kg.
 * - Valorisation : prix moyen constaté des ventes payantes du lot, dans leur
 *   unité. Prix à la pièce : pièces restantes × prix ; prix au kg : poids
 *   restant × prix ; ventes des deux sortes : tout est ramené au kg par le
 *   poids moyen d'une pièce.
 *
 * Module pur (aucun accès base) : testé dans `cave-fromage.test.ts`.
 */

export type UniteVenteFromage = 'kg' | 'piece'

const sansAccent = (texte: string) =>
  texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\.$/, '')

const UNITES_KG = new Set(['kg', 'kgs', 'kilo', 'kilos', 'kilogramme', 'kilogrammes'])
const UNITES_G = new Set(['g', 'gr', 'gramme', 'grammes'])
const UNITES_PIECE = new Set(['piece', 'pieces', 'pc', 'pcs', 'unite', 'unites', 'u'])

/** Tolérance de comparaison des poids (kg). */
export const EPSILON_KG = 1e-6

export const arrondirKg = (kg: number) => Math.round(kg * 1000) / 1000
const arrondirEuros = (euros: number) => Math.round(euros * 100) / 100

/**
 * Unité de prix d'une vente de fromage. `facteurKg` convertit la quantité en
 * kilos pour une vente au poids (1 pour kg, 0,001 pour g). Null si l'unité
 * n'a pas de sens pour un fromage (douzaine, litre, vide…).
 */
export function uniteVenteFromage(
  unite: string | null | undefined,
): { unite: UniteVenteFromage; facteurKg: number } | null {
  const cle = sansAccent(unite ?? '')
  if (UNITES_KG.has(cle)) return { unite: 'kg', facteurKg: 1 }
  if (UNITES_G.has(cle)) return { unite: 'kg', facteurKg: 0.001 }
  if (UNITES_PIECE.has(cle)) return { unite: 'piece', facteurKg: 0 }
  return null
}

export type SortieVenteFromage =
  | { ok: true; nbPieces: number; poidsKg: number }
  | { ok: false; champ: 'unite' | 'quantite'; message: string }

/**
 * Sortie de cave d'une vente : des pièces OU un poids, selon l'unité de vente.
 * Une vente à la pièce porte sur un nombre entier de pièces.
 */
export function sortieCaveDepuisVente(
  quantite: number,
  unite: string | null | undefined,
): SortieVenteFromage {
  const u = uniteVenteFromage(unite)
  if (!u) {
    return {
      ok: false,
      champ: 'unite',
      message: 'Unité de vente du fromage non prise en charge : vendez au kg, au gramme ou à la pièce.',
    }
  }
  if (u.unite === 'kg') return { ok: true, nbPieces: 0, poidsKg: arrondirKg(quantite * u.facteurKg) }
  if (!Number.isInteger(quantite)) {
    return { ok: false, champ: 'quantite', message: 'Une vente à la pièce porte sur un nombre entier de pièces.' }
  }
  return { ok: true, nbPieces: quantite, poidsKg: 0 }
}

export interface LotCave {
  nbPieces: number
  poidsTotalKg: number
}

export interface SortieCave {
  nbPieces: number
  poidsKg: number
}

/** Poids moyen d'une pièce du lot (kg), null si le lot n'a pas de poids ou de pièces. */
export function poidsMoyenPieceKg(lot: LotCave): number | null {
  return lot.nbPieces > 0 && lot.poidsTotalKg > 0 ? lot.poidsTotalKg / lot.nbPieces : null
}

/** Poids retiré par une sortie : son poids pesé, sinon ses pièces au poids moyen. */
export function poidsSortieKg(sortie: SortieCave, poidsMoyen: number | null): number {
  if (sortie.poidsKg > 0) return sortie.poidsKg
  return poidsMoyen != null ? sortie.nbPieces * poidsMoyen : 0
}

export interface StockLotFromage {
  /** Pièces sorties, telles que saisies. */
  sortiPieces: number
  /** Poids sorti (kg), pièces non pesées comprises au poids moyen. */
  sortiKg: number
  restantPieces: number
  restantKg: number
  /** Le lot a un poids de fabrication : le stock se suit aussi en kg. */
  suiviPoids: boolean
  /** Plus aucune pièce en cave. */
  epuise: boolean
}

export function stockLotFromage(lot: LotCave, sorties: ReadonlyArray<SortieCave>): StockLotFromage {
  const poidsMoyen = poidsMoyenPieceKg(lot)
  const sortiPieces = sorties.reduce((s, m) => s + (m.nbPieces || 0), 0)
  const sortiKg = arrondirKg(sorties.reduce((s, m) => s + poidsSortieKg(m, poidsMoyen), 0))
  const poidsRestant = Math.max(0, arrondirKg(lot.poidsTotalKg - sortiKg))
  const piecesAuCompte = Math.max(0, lot.nbPieces - sortiPieces)

  // Revue 2026-10-19 : pas de plafond des pièces par le poids. Sur 10 pièces
  // pour 1,5 kg, un don de 5 pièces pesées 0,9 kg laissait 4 pièces et refusait
  // la 5e, qui existe pourtant. Seules des sorties au poids seul épuisent le lot
  // par le poids.
  const sortiesAuPoidsSeul = sorties.some((m) => !(m.nbPieces > 0) && m.poidsKg > 0)
  const epuise =
    piecesAuCompte <= 0 || (poidsMoyen != null && sortiesAuPoidsSeul && poidsRestant <= EPSILON_KG)

  return {
    sortiPieces,
    sortiKg,
    restantPieces: epuise ? 0 : piecesAuCompte,
    restantKg: epuise ? 0 : poidsRestant,
    suiviPoids: poidsMoyen != null,
    epuise,
  }
}

export interface VenteCave {
  quantite: number
  unite: string | null
  prixTotal: number
}

export interface PrixConstateFromage {
  /** Prix moyen (€ par unité). */
  montant: number
  unite: UniteVenteFromage
}

/**
 * Prix moyen constaté sur les ventes payantes du lot, dans leur unité. Ventes
 * à la pièce et au poids mêlées : ramené au kg par le poids moyen d'une pièce
 * (à la pièce si le lot n'a pas de poids).
 */
export function prixConstateFromage(lot: LotCave, ventes: ReadonlyArray<VenteCave>): PrixConstateFromage | null {
  let pieces = 0
  let caPieces = 0
  let kg = 0
  let caKg = 0
  for (const v of ventes) {
    const u = uniteVenteFromage(v.unite)
    if (!u || !(v.quantite > 0) || !(v.prixTotal > 0)) continue
    if (u.unite === 'piece') {
      pieces += v.quantite
      caPieces += v.prixTotal
    } else {
      kg += v.quantite * u.facteurKg
      caKg += v.prixTotal
    }
  }
  if (pieces > 0 && kg <= 0) return { montant: caPieces / pieces, unite: 'piece' }
  if (kg > 0 && pieces <= 0) return { montant: caKg / kg, unite: 'kg' }
  if (pieces <= 0 && kg <= 0) return null
  const poidsMoyen = poidsMoyenPieceKg(lot)
  if (poidsMoyen == null) return { montant: caPieces / pieces, unite: 'piece' }
  return { montant: (caPieces + caKg) / (kg + pieces * poidsMoyen), unite: 'kg' }
}

export interface ValorisationLotFromage {
  /** Valeur du stock restant (€), null sans vente pour fixer un prix. */
  valorisation: number | null
  prix: PrixConstateFromage | null
}

export function valoriserStockFromage(
  lot: LotCave,
  stock: Pick<StockLotFromage, 'restantPieces' | 'restantKg' | 'suiviPoids'>,
  ventes: ReadonlyArray<VenteCave>,
): ValorisationLotFromage {
  const prix = prixConstateFromage(lot, ventes)
  if (!prix) return { valorisation: null, prix: null }
  const quantite = prix.unite === 'piece' ? stock.restantPieces : stock.restantKg
  if (prix.unite === 'kg' && !stock.suiviPoids) return { valorisation: null, prix: arrondirPrix(prix) }
  return { valorisation: arrondirEuros(quantite * prix.montant), prix: arrondirPrix(prix) }
}

const arrondirPrix = (prix: PrixConstateFromage): PrixConstateFromage => ({
  montant: arrondirEuros(prix.montant),
  unite: prix.unite,
})
