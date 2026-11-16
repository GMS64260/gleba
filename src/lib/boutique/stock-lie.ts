/**
 * Produit de la boutique relié à un stock du verger ou de l'élevage.
 *
 * Le produit ne tient pas de second compteur : son disponible se lit dans le
 * stock lié, converti par le conditionnement (quantité de l'unité du stock par
 * unité vendue : une douzaine d'œufs = 12 pièces, un pot de 500 g de miel =
 * 0,5 kg). Le lien et le conditionnement sont figés sur la ligne à la
 * commande ; la sortie passe par le stock commercial, comme un bon de livraison.
 */
import type { Prisma } from '@prisma/client'
import { PRODUITS_RUCHE } from '@/lib/elevage/produits-ruche'
import { stockEstDenombrable } from '@/lib/commercial/stock-types'

/** Stocks que la boutique sait vendre aujourd'hui (FIFO natif). */
export const TYPES_STOCK_LIE = ['oeufs', 'ruche'] as const
export type TypeStockLie = (typeof TYPES_STOCK_LIE)[number]
export interface StockLie { type: TypeStockLie; ref: string; conditionnement: number }
export interface ChampsStockLie { stockLieType: string | null; stockLieRef: string | null; stockLieConditionnement: number | null }

export const CONDITIONNEMENT_MAX = 1_000_000
const MILLI = 1000

export class ErreurStockLie extends Error {
  constructor(message: string, public champ = 'stockLie') { super(message); this.name = 'ErreurStockLie' }
}

export function cleStockLie(lie: Pick<StockLie, 'type' | 'ref'>) { return `${lie.type}:${lie.ref}` }

/** Lien enregistré sur un produit ou figé sur une ligne ; `null` s'il n'y en a pas ou s'il est illisible. */
export function lireStockLie(o: ChampsStockLie): StockLie | null {
  if (!o.stockLieType || !o.stockLieRef || o.stockLieConditionnement == null) return null
  if (!(TYPES_STOCK_LIE as readonly string[]).includes(o.stockLieType)) return null
  if (!Number.isFinite(o.stockLieConditionnement) || o.stockLieConditionnement <= 0) return null
  return { type: o.stockLieType as TypeStockLie, ref: o.stockLieRef, conditionnement: o.stockLieConditionnement }
}

export function champsStockLie(lie: StockLie | null): ChampsStockLie {
  return { stockLieType: lie?.type ?? null, stockLieRef: lie?.ref ?? null, stockLieConditionnement: lie?.conditionnement ?? null }
}

function nombre(v: unknown): number {
  return typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.trim().replace(',', '.')) : NaN
}

/**
 * Valide le lien saisi par le producteur. `uniteStock` est l'unité réelle du
 * stock (catalogue) : un stock dénombrable ne se vend que par conditionnements
 * entiers, sinon une vente sortirait une fraction d'œuf.
 */
export function validerStockLie(brut: unknown, uniteStock?: string): StockLie | null {
  if (brut === null || brut === undefined) return null
  if (typeof brut !== 'object') throw new ErreurStockLie('Stock lié invalide.')
  const { type, ref, conditionnement } = brut as Record<string, unknown>
  if (typeof type !== 'string' || !(TYPES_STOCK_LIE as readonly string[]).includes(type))
    throw new ErreurStockLie('Choisissez le stock à vendre : œufs ou produit de la ruche.')
  const reference = type === 'oeufs' ? 'stock' : typeof ref === 'string' ? ref.trim() : ''
  if (type === 'ruche' && !(PRODUITS_RUCHE as readonly string[]).includes(reference))
    throw new ErreurStockLie('Choisissez le produit de la ruche à vendre.')
  const c = nombre(conditionnement)
  if (!Number.isFinite(c) || c <= 0 || c > CONDITIONNEMENT_MAX || Math.abs(c * MILLI - Math.round(c * MILLI)) > 1e-6)
    throw new ErreurStockLie('Conditionnement : indiquez la quantité de stock contenue dans une unité vendue (par exemple 12 pour une douzaine d’œufs, 0,5 pour un pot de 500 g).', 'stockLieConditionnement')
  const arrondi = Math.round(c * MILLI) / MILLI
  if ((type === 'oeufs' || (uniteStock && stockEstDenombrable(uniteStock))) && !Number.isInteger(arrondi))
    throw new ErreurStockLie('Ce stock se compte en unités entières : le conditionnement doit être un nombre entier.', 'stockLieConditionnement')
  return { type: type as TypeStockLie, ref: reference, conditionnement: arrondi }
}

/** Quantité à sortir du stock pour une quantité vendue, au millième. */
export function quantiteStockLie(quantiteVendue: number, conditionnement: number): number {
  return Math.round(quantiteVendue * conditionnement * MILLI) / MILLI
}

/**
 * Nombre d'unités de vente encore commandables : stock disponible moins ce que
 * les commandes en cours retiennent, divisé par le conditionnement. Une unité
 * vendue à la pièce ne se propose qu'entière.
 */
export function commandableStockLie(disponibleStock: number, retenu: number, conditionnement: number, uniteVenteEntiere: boolean): number {
  const reste = Math.round(disponibleStock * MILLI) - Math.round(retenu * MILLI)
  if (!(reste > 0) || !(conditionnement > 0)) return 0
  const unites = reste / Math.round(conditionnement * MILLI)
  return uniteVenteEntiere ? Math.floor(unites + 1e-9) : Math.floor(unites * MILLI + 1e-6) / MILLI
}

type DbLignes = Pick<Prisma.TransactionClient, 'ligneCommandeBoutique'>

/**
 * Stock retenu par les commandes en cours, par stock lié (unité du stock) :
 * lignes reliées de commandes ni annulées ni livrées dont la sortie n'a pas
 * encore eu lieu. Une commande payée restée sans stock continue de retenir sa quantité.
 */
export async function stockLieRetenu(db: DbLignes, userId: string): Promise<Map<string, number>> {
  const lignes = await db.ligneCommandeBoutique.findMany({
    where: {
      stockLieType: { not: null },
      // Une commande livrée ne retient plus rien : si sa sortie n'a pas pu se
      // faire (reprise sans stock), l'écart est au journal, pas dans la vitrine.
      commande: { userId, statut: { notIn: ['annulee', 'livree'] } },
      mouvementsStock: { none: { origineRetourId: null } },
    },
    select: { quantite: true, stockLieType: true, stockLieRef: true, stockLieConditionnement: true },
  })
  const retenu = new Map<string, number>()
  for (const l of lignes) {
    const lie = lireStockLie(l)
    if (!lie) continue
    const cle = cleStockLie(lie)
    retenu.set(cle, Math.round(((retenu.get(cle) ?? 0) + quantiteStockLie(l.quantite, lie.conditionnement)) * MILLI) / MILLI)
  }
  return retenu
}
