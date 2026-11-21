/**
 * Stub public. La caisse de marché n'est pas distribuée : sur gleba.fr, ce
 * module lit les lots et quantités emportés au marché, que le stock net
 * retranche (voir docs/private-stubs.md). Sans elle, rien n'est jamais
 * réservé : les lectures rendent du vide, les calculs d'unité restent ceux
 * du stock.
 */

/** Lot emporté au marché, tel que le lisent les modules de stock. */
export type LotReserve = {
  id: string
  userId: string
  affectationId: string
  ponteId: number | null
  rucheId: number | null
  fromageId: string | null
  unite: string
  ordre: number
  quantite: bigint
  consomme: bigint
  poidsMg: bigint | null
  poidsConsommeMg: bigint | null
}

/** mg pour la masse, milli-pièces pour les produits comptés. */
export function facteurAtomique(unite: string): number {
  if (unite === 'kg') return 1_000_000
  if (unite === 'g' || unite === 'pièce') return 1000
  throw new Error('Unité du lot réservé non prise en charge.')
}

export function atomesLot(quantite: number, unite: string): bigint {
  const n = quantite * facteurAtomique(unite), arrondi = Math.round(n)
  if (!Number.isSafeInteger(arrondi) || arrondi < 0 || Math.abs(n - arrondi) > 0.0001)
    throw new Error('Quantité du lot réservé hors précision prise en charge.')
  return BigInt(arrondi)
}

export const lotsReservesCaisse: (db: unknown, userId: string, sessionExclue?: string) => Promise<LotReserve[]> =
  async () => []

export const lotsArticleCaisse: (db: unknown, userId: string, sessionId: string, articleId: string) => Promise<LotReserve[]> =
  async () => []

export function resteLot(lot: { quantite: bigint; consomme: bigint; unite: string }) {
  return Number(lot.quantite - lot.consomme) / facteurAtomique(lot.unite)
}

export function poidsSortieLot(lot: { quantite: bigint; consomme: bigint; poidsMg: bigint | null; poidsConsommeMg: bigint | null }, quantite: bigint): bigint {
  const reste = lot.quantite - lot.consomme, poids = (lot.poidsMg ?? BigInt(0)) - (lot.poidsConsommeMg ?? BigInt(0))
  if (quantite > reste || quantite <= BigInt(0)) throw new Error('Quantité du lot emporté insuffisante.')
  if (quantite === reste) return poids
  return ((poids * quantite + reste * BigInt(500)) / (reste * BigInt(1000))) * BigInt(1000)
}

export const consommerLotCaisse: (db: unknown, userId: string, id: string, quantite: bigint, poidsMg?: bigint) => Promise<void> =
  async () => {}

/** Quantités réservées par clé « type:id:unité » : aucune sans caisse. */
export const quantitesCaisse: (db: unknown, userId: string, sessionExclue?: string) => Promise<Map<string, number>> =
  async () => new Map()
