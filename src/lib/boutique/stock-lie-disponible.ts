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
import { champsStockLie, cleStockLie, commandableStockLie, ErreurStockLie, lireModeStockLie, lireStockLie, quantiteStockLie, stockLieRetenu, TYPES_STOCK_LIE, validerModeStockLie, validerStockLie, type ChampsStockLie, type ModeStockLie, type StockLie } from './stock-lie'

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

/**
 * Unités de vente encore commandables d'un produit relié ; 0 si le stock est
 * vide ou inconnu, `null` (sans limite) pour un produit vendu « à produire ».
 */
export function commandableProduitLie(etats: Map<string, EtatStockLie>, lie: StockLie, uniteVente: string, mode: ModeStockLie = 'stock'): number | null {
  if (mode === 'a_produire') return null
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
export function lignesEnRuptureStockLie<L extends { nom: string; quantite: number; stockLieMode?: string | null } & ChampsStockLie>(etats: Map<string, EtatStockLie>, lignes: L[]): L[] {
  const demande = new Map<string, number>()
  return lignes.filter((l) => {
    const lie = lireStockLie(l)
    if (!lie) return false
    const cle = cleStockLie(lie)
    const etat = etats.get(cle)
    const quantite = quantiteStockLie(l.quantite, lie.conditionnement)
    const cumul = (demande.get(cle) ?? 0) + quantite
    // Une fraction d'œuf ne sortirait jamais du stock : la ligne est refusée à la commande.
    // « À produire » : pas de limite de stock à la commande, mais toujours pas de fraction d'œuf.
    if (lireModeStockLie(l.stockLieMode) === 'a_produire') return stockEstDenombrable(etat?.unite ?? (lie.type === 'oeufs' ? 'pièce' : '')) && !Number.isInteger(quantite)
    if (!etat || (stockEstDenombrable(etat.unite) && !Number.isInteger(quantite)) || cumul > etat.disponible - etat.retenu + 1e-6) return true
    demande.set(cle, cumul)
    return false
  })
}

/** `produit` : au moins une production enregistrée (sinon seul « à produire » peut s'y relier). */
export interface StockLiable { type: string; ref: string; nom: string; unite: string; disponible: number; retenu: number; tauxTVA: number; produit: boolean }

/**
 * Stocks qu'un produit peut vendre, y compris ceux qui sont vides aujourd'hui
 * ou qui n'ont encore rien produit (seul « à produire » s'y relie alors).
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
    liste.push({ type, ref, nom: etat?.nom ?? nom, unite: etat?.unite ?? unite, disponible: etat?.disponible ?? 0, retenu: etat?.retenu ?? 0, tauxTVA: etat?.tauxTVA ?? tauxTVA, produit: type === 'oeufs' ? pontes > 0 || !!etat : ruches.some((r) => r.produit === ref) })
  }
  // Œufs et miel se proposent toujours : un produit « à produire » se relie
  // avant la première ponte ou la première récolte. Les autres produits de la
  // ruche apparaissent dès qu'ils ont été produits une fois.
  ajouter('oeufs', 'stock', 'Œufs commercialisables', 'pièce', 5.5)
  const produitsRuche = new Set<string>(['miel', ...ruches.map((r) => r.produit)])
  for (const produit of PRODUITS_RUCHE) {
    if (!produitsRuche.has(produit)) continue
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
  if (brut === null) return tx.produitBoutique.update({ where: { id: produitId }, data: { ...champsStockLie(null), stockLieMode: 'stock' } })
  if (produit.recolteId) throw new ErreurStockLie('Ce produit vend déjà une récolte du maraîchage : créez un autre produit pour vendre un stock de l’élevage.')
  if (produit.stockDispo !== null) throw new ErreurStockLie('Ce produit tient son propre compteur de stock. Passez-le d’abord en « stock illimité » : sa quantité sera ensuite lue dans le stock relié.')
  const type = (brut as { type?: unknown } | undefined)?.type
  const ref = type === 'oeufs' ? 'stock' : (brut as { ref?: unknown } | undefined)?.ref
  const stock = (await listerStocksLiables(tx, userId)).find((s) => s.type === type && s.ref === ref)
  // « À produire » se relie avant la première production ; le stock réel exige qu'il existe.
  const aProduire = (brut as { mode?: unknown }).mode === 'a_produire' || ((brut as { mode?: unknown }).mode === undefined && produit.stockLieMode === 'a_produire' && !!produit.stockLieType)
  if ((!stock || !stock.produit) && !aProduire) throw new ErreurStockLie('Ce stock n’existe pas encore dans votre exploitation. Enregistrez d’abord une production, ou vendez ce produit « à produire ».')
  const lie = validerStockLie(brut, stock?.unite ?? (type === 'oeufs' ? 'pièce' : undefined))!
  // Sans mode dans la demande, un produit déjà relié garde le sien.
  const modeDemande = (brut as { mode?: unknown }).mode
  const mode = modeDemande === undefined && produit.stockLieType ? lireModeStockLie(produit.stockLieMode) : validerModeStockLie(modeDemande)
  return tx.produitBoutique.update({ where: { id: produitId }, data: { ...champsStockLie(lie), stockLieMode: mode } })
}

export interface BesoinAProduire { type: string; ref: string; nom: string; unite: string; quantite: number; commandes: number; retraitLePlusProche: string | null; disponible: number; manque: number }

/**
 * Ce que les commandes « à produire » de la boutique attendent encore de la
 * ferme, par stock : lignes non sorties de commandes ni annulées ni livrées.
 * `manque` = ce qu'il reste à produire une fois servi le stock présent que les
 * commandes « stock réel » ne retiennent pas.
 */
export async function besoinsAProduire(db: Prisma.TransactionClient, userId: string, date = new Date()): Promise<BesoinAProduire[]> {
  const lignes = await db.ligneCommandeBoutique.findMany({
    where: { stockLieMode: 'a_produire', commande: { userId, statut: { notIn: ['annulee', 'livree'] } }, mouvementsStock: { none: { origineRetourId: null } } },
    select: { quantite: true, stockLieType: true, stockLieRef: true, stockLieConditionnement: true, commandeId: true, commande: { select: { dateRetraitSouhaitee: true } } },
  })
  if (!lignes.length) return []
  const stocks = new Map((await listerStocksLiables(db, userId, date)).map((s) => [`${s.type}:${s.ref}`, s]))
  const besoins = new Map<string, BesoinAProduire & { ids: Set<number> }>()
  for (const l of lignes) {
    const lie = lireStockLie(l)
    if (!lie) continue
    const cle = cleStockLie(lie), stock = stocks.get(cle)
    const b = besoins.get(cle) ?? { type: lie.type, ref: lie.ref, nom: stock?.nom ?? lie.ref, unite: stock?.unite ?? '', quantite: 0, commandes: 0, retraitLePlusProche: null, disponible: Math.max(0, (stock?.disponible ?? 0) - (stock?.retenu ?? 0)), manque: 0, ids: new Set<number>() }
    b.quantite = Math.round((b.quantite + quantiteStockLie(l.quantite, lie.conditionnement)) * 1000) / 1000
    b.ids.add(l.commandeId)
    const retrait = l.commande.dateRetraitSouhaitee?.toISOString() ?? null
    if (retrait && (!b.retraitLePlusProche || retrait < b.retraitLePlusProche)) b.retraitLePlusProche = retrait
    besoins.set(cle, b)
  }
  return [...besoins.values()].map(({ ids, ...b }) => ({ ...b, commandes: ids.size, manque: Math.max(0, Math.round((b.quantite - b.disponible) * 1000) / 1000) }))
}
