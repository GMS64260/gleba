/**
 * Disponible des stocks reliés aux produits de la boutique, lu dans le
 * catalogue du stock commercial (même fraîcheur qu'un bon de livraison), net de
 * ce que les commandes en cours retiennent. Limite connue : un bon de livraison
 * ou une vente directe ne voit pas cette retenue et peut prendre le stock promis.
 */
import type { Prisma } from '@prisma/client'
import { chargerCatalogueStock } from '@/lib/commercial/catalogue-stock'
import { uniteEntiereBoutique } from '@/lib/boutique/unites'
import { stockEstDenombrable } from '@/lib/commercial/stock-types'
import { verrouillerStockCommercial } from '@/lib/stocks/verrou-commercial'
import { PRODUITS_RUCHE, PRODUITS_RUCHE_LABELS, tauxTvaProduitRucheParDefaut, uniteProduitRucheParDefaut, type ProduitRuche } from '@/lib/elevage/produits-ruche'
import { champsStockLie, cleStockLie, commandableStockLie, ErreurStockLie, lireStockLie, quantiteStockLie, stockLieRetenu, TYPES_STOCK_LIE, validerStockLie, type ChampsStockLie, type StockLie } from './stock-lie'

export interface EtatStockLie { type: string; ref: string; nom: string; unite: string; disponible: number; retenu: number; tauxTVA: number }

/** État de chaque stock que la boutique sait vendre, par clé `type:ref`. */
export async function chargerStocksLies(db: Prisma.TransactionClient, userId: string, date = new Date()): Promise<Map<string, EtatStockLie>> {
  const [catalogue, retenu] = await Promise.all([chargerCatalogueStock(userId, db, date), stockLieRetenu(db, userId)])
  const etats = new Map<string, EtatStockLie>()
  for (const a of catalogue) {
    if (!(TYPES_STOCK_LIE as readonly string[]).includes(a.type)) continue
    const cle = `${a.type}:${a.id}`
    etats.set(cle, { type: a.type, ref: a.id, nom: a.nom, unite: a.unite, disponible: a.disponible ?? 0, retenu: retenu.get(cle) ?? 0, tauxTVA: a.tauxTVA })
  }
  return etats
}

/** Unités de vente encore commandables d'un produit relié ; 0 si le stock est vide ou inconnu. */
export function commandableProduitLie(etats: Map<string, EtatStockLie>, lie: StockLie, uniteVente: string): number {
  const etat = etats.get(cleStockLie(lie))
  // Un stock compté à la pièce ne se vend que par unités entières, quelle que soit l'unité de vente.
  return etat ? commandableStockLie(etat.disponible, etat.retenu, lie.conditionnement, uniteEntiereBoutique(uniteVente) || stockEstDenombrable(etat.unite)) : 0
}

/**
 * Lignes d'un panier que le stock lié ne couvre pas, ou qui demanderaient une
 * fraction d'un stock compté à la pièce. Plusieurs produits peuvent
 * vendre le même stock (douzaine et demi-douzaine) : la demande se cumule par
 * stock, dans l'ordre du panier.
 */
export function lignesEnRuptureStockLie<L extends { nom: string; quantite: number } & ChampsStockLie>(etats: Map<string, EtatStockLie>, lignes: L[]): L[] {
  const demande = new Map<string, number>()
  return lignes.filter((l) => {
    const lie = lireStockLie(l)
    if (!lie) return false
    const cle = cleStockLie(lie)
    const etat = etats.get(cle)
    const quantite = quantiteStockLie(l.quantite, lie.conditionnement)
    const cumul = (demande.get(cle) ?? 0) + quantite
    // Une fraction d'œuf ne sortirait jamais du stock : la ligne est refusée à la commande.
    if (!etat || (stockEstDenombrable(etat.unite) && !Number.isInteger(quantite)) || cumul > etat.disponible - etat.retenu + 1e-6) return true
    demande.set(cle, cumul)
    return false
  })
}

export interface StockLiable { type: string; ref: string; nom: string; unite: string; disponible: number; retenu: number; tauxTVA: number }

/**
 * Stocks qu'un produit peut vendre, y compris ceux qui sont vides aujourd'hui :
 * on relie un produit avant la prochaine ponte ou la prochaine récolte de miel.
 */
export async function listerStocksLiables(db: Prisma.TransactionClient, userId: string, date = new Date()): Promise<StockLiable[]> {
  const [etats, ruches, pontes] = await Promise.all([
    chargerStocksLies(db, userId, date),
    db.productionRuche.findMany({ where: { userId }, distinct: ['produit'], select: { produit: true } }),
    db.productionOeuf.count({ where: { userId } }),
  ])
  const liste: StockLiable[] = []
  const ajouter = (type: string, ref: string, nom: string, unite: string, tauxTVA: number) => {
    const etat = etats.get(`${type}:${ref}`)
    liste.push({ type, ref, nom: etat?.nom ?? nom, unite: etat?.unite ?? unite, disponible: etat?.disponible ?? 0, retenu: etat?.retenu ?? 0, tauxTVA: etat?.tauxTVA ?? tauxTVA })
  }
  if (pontes > 0 || etats.has('oeufs:stock')) ajouter('oeufs', 'stock', 'Œufs commercialisables', 'pièce', 5.5)
  for (const { produit } of ruches) {
    if (!(PRODUITS_RUCHE as readonly string[]).includes(produit)) continue
    const p = produit as ProduitRuche
    ajouter('ruche', p, PRODUITS_RUCHE_LABELS[p], uniteProduitRucheParDefaut(p), tauxTvaProduitRucheParDefaut(p))
  }
  return liste
}

/**
 * Relie un produit à un stock, ou retire le lien (`null`). Le produit ne tient
 * alors plus de compteur propre : il doit être à « stock illimité » et ne pas
 * venir d'une récolte maraîchère.
 */
export async function relierProduitAuStock(tx: Prisma.TransactionClient, userId: string, produitId: number, brut: unknown) {
  await verrouillerStockCommercial(tx, userId)
  await tx.$queryRaw`SELECT id FROM produits_boutique WHERE id=${produitId} AND user_id=${userId} FOR UPDATE`
  const produit = await tx.produitBoutique.findFirst({ where: { id: produitId, userId } })
  if (!produit) throw new ErreurStockLie('Produit introuvable.', 'introuvable')
  if (brut === null) return tx.produitBoutique.update({ where: { id: produitId }, data: champsStockLie(null) })
  if (produit.recolteId) throw new ErreurStockLie('Ce produit vend déjà une récolte du maraîchage : créez un autre produit pour vendre un stock de l’élevage.')
  if (produit.stockDispo !== null) throw new ErreurStockLie('Ce produit tient son propre compteur de stock. Passez-le d’abord en « stock illimité » : sa quantité sera ensuite lue dans le stock relié.')
  const type = (brut as { type?: unknown } | undefined)?.type
  const ref = type === 'oeufs' ? 'stock' : (brut as { ref?: unknown } | undefined)?.ref
  const stock = (await listerStocksLiables(tx, userId)).find((s) => s.type === type && s.ref === ref)
  if (!stock) throw new ErreurStockLie('Ce stock n’existe pas encore dans votre exploitation. Enregistrez d’abord une production.')
  const lie = validerStockLie(brut, stock.unite)!
  return tx.produitBoutique.update({ where: { id: produitId }, data: champsStockLie(lie) })
}
