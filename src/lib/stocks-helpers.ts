/**
 * Helpers pour la gestion des stocks (multi-tenancy via UserStock*).
 * Stock de récolte d'une espèce = somme des restes de ses lots en stock.
 */

import prisma from '@/lib/prisma'
import { finJourLivraison } from '@/lib/commercial/dates-stock'
import type { Prisma } from '@prisma/client'
import { milliemesDuReste } from '@/lib/stocks/milliemes'
import type { UniteQuantite } from '@/lib/recolte/projection'
import type { QuantiteParUnite } from '@/lib/recolte/quantites'
import { chargerUnitesStock } from '@/lib/stocks/sortie-stock'
import { computeStockOeufsParLots, type StockOeufsParLots } from '@/lib/elevage/stock-oeufs-lots'

/**
 * Nombre d'œufs par unité de vente. QA cmsjioqg — le conditionnement n'était
 * converti que pour « douzaine » (×12), à deux endroits avec un multiplicateur
 * en dur : une vente en « boîte » (de 6) comptait 1 œuf, donc le stock vendu
 * était sous-estimé et le prix/œuf surévalué. Constante partagée entre le
 * décompte de stock (`calculerStockOeufs`) et la valorisation (route stocks).
 */
export const OEUFS_PAR_UNITE: Record<string, number> = {
  unite: 1,
  'demi-douzaine': 6,
  'boîte': 6, // boîte standard de 6 (convention du catalogue)
  boite: 6,
  douzaine: 12,
  plaque: 30,
  plateau: 30,
}

/** Nombre d'œufs représentés par une quantité dans une unité de vente donnée. */
export function oeufsDepuisUnite(quantite: number, unite: string | null | undefined): number {
  const parUnite = OEUFS_PAR_UNITE[(unite || '').trim().toLowerCase()] ?? 1
  return quantite * parUnite
}

export interface StockNet {
  stockNet: number
  /**
   * Unité du stock — celle de l'espèce chez cet utilisateur (2026-08-20).
   * Un stock de fleurs coupées se compte en tiges, une salade à la pièce : le
   * nombre seul ne dit plus rien, et l'écran l'étiquetait « kg » en dur.
   */
  unite: UniteQuantite
  /** Date du dernier comptage (null = jamais compté), pour l'affichage. */
  dateInventaire: Date | null
  detail: {
    /** Chiffre du dernier comptage (0 sans comptage). Le stock ne l'ajoute pas : le comptage a aligné les lots. */
    inventaire: number
    /** Nombre de lots en stock dans l'unité du stock. */
    lots: number
  }
  /**
   * Lots en stock enregistrés dans une AUTRE unité que l'unité courante.
   * Cas réel mais rare : l'espèce a changé d'unité en cours de saison, et les
   * lots antérieurs gardent la leur (l'unité est figée à la saisie). On les
   * expose à part plutôt que de les additionner à tort ou de les perdre.
   */
  autresUnites: QuantiteParUnite
}

/**
 * Récoltes mises en vente sur la boutique (produit lié à la récolte, y compris hors ligne) :
 * leur stock est suivi par `ProduitBoutique.stockDispo`, le stock de l'espèce
 * ne les compte pas (audit 2026-07 #51).
 */
export async function chargerIdsRecoltesEnBoutique(userId: string, db: Prisma.TransactionClient = prisma): Promise<number[]> {
  const produitsBoutique = await db.produitBoutique.findMany({
    where: { userId, recolteId: { not: null } },
    select: { recolteId: true },
  })
  return produitsBoutique
    .map(p => p.recolteId)
    .filter((id): id is number => id != null)
}

/**
 * Lots de récolte hors du stock de l'espèce (leur stock vit en boutique). Une
 * seule règle pour le stock (`calculerStocksNet`), l'alignement au comptage,
 * l'écran Récoltes et la comptabilité (stocks unifiés).
 */
export async function chargerIdsRecoltesHorsStock(userId: string, db: Prisma.TransactionClient = prisma): Promise<number[]> {
  return chargerIdsRecoltesEnBoutique(userId, db)
}

/**
 * Stock de récolte de chaque espèce (modèle de stock unique, L4.2,
 * 2026-11-24) : la SOMME DES RESTES DES LOTS en stock, dans l'unité du stock
 * de l'espèce. Le reste d'un lot est `stockDisponibleCommercial` quand il est
 * suivi (bon, facture, caisse, boutique), sa quantité sinon.
 *
 * Chaque reste est arrondi au millième avant la somme, comme dans son double
 * SQL `source_recolte_net_milli`, que lisent les gardes de la caisse et de la
 * boutique : les deux calculs donnent le même nombre.
 *
 * Un comptage ne s'ajoute plus au stock : il aligne les lots (écart
 * d'inventaire ou lot d'inventaire, `ajusterLotsAuComptage`). Son chiffre et
 * sa date restent servis pour l'affichage. Les lots dont le stock vit en
 * boutique sont hors du stock (`chargerIdsRecoltesHorsStock`). Les lots d'une
 * autre unité sont rendus à part (`autresUnites`), jamais additionnés.
 */
export async function calculerStocksNet(
  userId: string,
  especeId?: string,
  db: Prisma.TransactionClient = prisma
): Promise<Record<string, StockNet>> {
  // Espèces suivies : comptées, ou avec des récoltes ou des sorties.
  const userStocks = await db.userStockEspece.findMany({
    where: {
      userId,
      ...(especeId && { especeId }),
    },
    select: {
      especeId: true,
      inventaire: true,
      dateInventaire: true,
    },
  })
  const especeIds = userStocks.map(us => us.especeId)
  // `especeId` et `notIn` portent sur la même colonne : les combiner dans un
  // seul filtre, sinon le second écrasait le premier.
  const additionalEspeces = await db.espece.findMany({
    where: {
      id: especeId ? { equals: especeId, notIn: especeIds } : { notIn: especeIds },
      OR: [
        { recoltes: { some: { userId } } },
        { consommations: { some: { userId } } },
      ],
    },
    select: { id: true },
  })
  const allEspeces = [
    ...userStocks.map(us => ({ id: us.especeId, inventaire: us.inventaire, dateInventaire: us.dateInventaire })),
    ...additionalEspeces.map(e => ({ id: e.id, inventaire: null as number | null, dateInventaire: null as Date | null })),
  ]
  if (allEspeces.length === 0) return {}

  // Unité de chaque espèce : celle déclarée par la ferme si elle l'a fait,
  // celle du catalogue sinon (QA cmvgef6ou).
  const uniteParEspece = await chargerUnitesStock(userId, allEspeces.map(e => e.id), db)
  const horsStock = await chargerIdsRecoltesHorsStock(userId, db)
  const lots = await db.recolte.findMany({
    where: {
      userId,
      statut: 'en_stock',
      especeId: { in: allEspeces.map(e => e.id) },
      ...(horsStock.length > 0 && { id: { notIn: horsStock } }),
    },
    select: { especeId: true, unite: true, quantite: true, stockDisponibleCommercial: true },
  })

  // Millièmes par espèce et par unité ; nombre de lots dans l'unité du stock.
  const milliemes = new Map<string, Map<UniteQuantite, number>>()
  const nombreLots = new Map<string, number>()
  for (const lot of lots) {
    // Même somme que le SQL, reste négatif compris (aucun en base : la
    // validation l'interdit) ; seuls les lots au reste positif sont comptés.
    const m = milliemesDuReste(lot.stockDisponibleCommercial ?? lot.quantite)
    if (m === 0) continue
    const unite = (lot.unite ?? 'kg') as UniteQuantite
    const parUnite = milliemes.get(lot.especeId) ?? new Map<UniteQuantite, number>()
    parUnite.set(unite, (parUnite.get(unite) ?? 0) + m)
    milliemes.set(lot.especeId, parUnite)
    if (m > 0 && unite === (uniteParEspece.get(lot.especeId) ?? 'kg')) nombreLots.set(lot.especeId, (nombreLots.get(lot.especeId) ?? 0) + 1)
  }

  const result: Record<string, StockNet> = {}
  for (const espece of allEspeces) {
    const uniteEspece = uniteParEspece.get(espece.id) ?? 'kg'
    const parUnite = milliemes.get(espece.id) ?? new Map<UniteQuantite, number>()
    const autresUnites: QuantiteParUnite = {}
    for (const [unite, m] of parUnite) if (unite !== uniteEspece) autresUnites[unite] = m / 1000
    result[espece.id] = {
      stockNet: (parUnite.get(uniteEspece) ?? 0) / 1000,
      unite: uniteEspece,
      dateInventaire: espece.dateInventaire,
      detail: { inventaire: espece.inventaire ?? 0, lots: nombreLots.get(espece.id) ?? 0 },
      autresUnites,
    }
  }
  return result
}

/**
 * Stock physique d'œufs d'un utilisateur, avec son détail.
 *
 * Bug cmp8rw40u (Marc 2026-05-16) — les œufs souillés étaient saisis
 * mais jamais sortis du stock, donc "stock œufs == production" même
 * quand l'éleveur déclarait des sales. On les soustrait désormais comme
 * les cassés (ils ne sont pas vendables).
 *
 * QA cmv29bm4o (2026-10-10) — le tableau de bord annonçait 1 441 œufs et
 * Production > Œufs 1 435 : ici on déduisait les ventes commerciales
 * (`VenteProduit`, 1 douzaine = 12), là les sorties de lot
 * (`MouvementStockOeuf` : 18 vendus, dons, autoconsommation…). Deux
 * registres, deux stocks. Le stock physique est celui des lots de ponte
 * (`computeStockOeufsParLots`, source unique de l'écran Production et de
 * l'assistant) ; le détail restitue ses sorties par type. Les ventes
 * commerciales ne sont plus un décompte de stock : elles passent par les
 * sorties FIFO des lots (`stock-oeufs-vente.ts`, miroir écrit à chaque vente
 * depuis 2026-07 ; vérifié le 2026-10-10 : aucun compte n'a de vente d'œufs
 * sans ses sorties de lot).
 *
 * Le détail est informatif : chaque lot est borné à zéro, l'API refuse une
 * sortie supérieure au restant, donc produits − cassés − souillés − sorties
 * = stock sauf donnée incohérente héritée.
 *
 * `lots` : résultat déjà calculé par l'appelant (la route stats le charge
 * aussi), pour ne pas relire deux fois pontes, mouvements et blocages véto.
 */
export async function calculerStockOeufs(
  userId: string,
  lots?: StockOeufsParLots,
): Promise<{
  stockNet: number
  /** Œufs encore vendables : hors délai vétérinaire, hors limite de vente dépassée. */
  stockVendable: number
  detail: { produits: number; casses: number; sales: number; vendus: number; autresSorties: number }
}> {
  // Revue du 2026-11-01 — même borne que le stock : une ponte datée après
  // aujourd'hui n'entre ni dans le stock ni dans son détail.
  const finJour = finJourLivraison(new Date())
  const [production, sorties, lotsCalcules] = await Promise.all([
    prisma.productionOeuf.aggregate({
      where: { userId, date: { lte: finJour } },
      _sum: { quantite: true, casses: true, sales: true },
    }),
    prisma.mouvementStockOeuf.groupBy({
      by: ['type'],
      where: { userId, production: { date: { lte: finJour } } },
      _sum: { quantite: true },
    }),
    lots ?? computeStockOeufsParLots(userId),
  ])

  const produits = production._sum.quantite || 0
  const casses = production._sum.casses || 0
  const sales = production._sum.sales || 0
  const vendus = sorties.find((s) => s.type === 'vente')?._sum.quantite || 0
  const autresSorties = sorties
    .filter((s) => s.type !== 'vente')
    .reduce((somme, s) => somme + (s._sum.quantite || 0), 0)

  return {
    stockNet: lotsCalcules.stats.stockPhysique,
    stockVendable: lotsCalcules.stats.commercialisables,
    detail: { produits, casses, sales, vendus, autresSorties },
  }
}
