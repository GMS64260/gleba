/**
 * Reprise du modèle de stock unique, L3 (2026-11-24) : pour chaque comptage
 * existant dont le stock dépasse les lots, un LOT D'INVENTAIRE porte la
 * différence, daté et saisi à l'instant de ce comptage. Le stock affiché ne
 * bouge pas (le comptage compte déjà ce lot) ; la somme des lots le rejoint.
 *
 * Un écart dans l'autre sens (lots au-delà du stock compté) n'est pas repris :
 * il est seulement rendu, à examiner (aucun cas en production le 2026-11-24).
 * Idempotente : une fois les lots alignés, l'écart est nul et rien n'est écrit.
 */
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { calculerStocksNet, chargerIdsRecoltesHorsStock } from '@/lib/stocks-helpers'
import { verrouillerStockCommercial, verrouillerStockNetRecolte } from '@/lib/stocks/verrou-commercial'

const EPSILON = 0.0005
const auMillieme = (q: number) => Math.round(q * 1000) / 1000

export interface LigneReprise {
  userId: string
  especeId: string
  unite: string
  stock: number
  lots: number
  ecart: number
  action: 'lot_inventaire' | 'aucune' | 'a_examiner' | 'comptage_modifie'
  lotId?: number
}

/** Mêmes lots que la comparaison stock / lots : en stock, hors boutique selon la règle du stock. */
async function lotsEnStock(tx: Prisma.TransactionClient, userId: string, especeId: string, unite: string): Promise<number> {
  const horsStock = await chargerIdsRecoltesHorsStock(userId, tx)
  const lots = await tx.recolte.findMany({
    where: {
      userId, especeId, statut: 'en_stock',
      ...(horsStock.length > 0 && { id: { notIn: horsStock } }),
      ...(unite === 'kg' ? { OR: [{ unite: 'kg' }, { unite: null }] } : { unite }),
    },
    select: { quantite: true, stockDisponibleCommercial: true },
  })
  return auMillieme(lots.reduce((s, l) => s + (l.stockDisponibleCommercial ?? l.quantite), 0))
}

/** `ecrire` faux : passage à blanc, aucune écriture. */
export async function repriseLotsInventaire(options: { ecrire: boolean; userId?: string }): Promise<LigneReprise[]> {
  const comptages = await prisma.userStockEspece.findMany({
    where: { ...(options.userId ? { userId: options.userId } : {}), inventaire: { not: null }, dateInventaire: { not: null } },
    select: { userId: true, especeId: true, dateInventaire: true },
    orderBy: [{ userId: 'asc' }, { especeId: 'asc' }],
  })
  const lignes: LigneReprise[] = []
  for (const c of comptages) {
    const ligne = await prisma.$transaction(async (tx): Promise<LigneReprise> => {
      await verrouillerStockCommercial(tx, c.userId)
      await verrouillerStockNetRecolte(tx, c.userId, c.especeId)
      // Relu sous les verrous : un comptage refait ou effacé entre-temps n'est
      // pas repris avec une date périmée.
      const relu = await tx.userStockEspece.findUnique({
        where: { userId_especeId: { userId: c.userId, especeId: c.especeId } },
        select: { inventaire: true, dateInventaire: true },
      })
      if (relu?.inventaire == null || relu.dateInventaire?.getTime() !== c.dateInventaire!.getTime()) {
        return { userId: c.userId, especeId: c.especeId, unite: '', stock: 0, lots: 0, ecart: 0, action: 'comptage_modifie' }
      }
      const net = (await calculerStocksNet(c.userId, c.especeId, tx))[c.especeId]
      const stock = auMillieme(net?.stockNet ?? 0)
      const unite = net?.unite ?? 'kg'
      const lots = await lotsEnStock(tx, c.userId, c.especeId, unite)
      const ecart = auMillieme(stock - lots)
      const base = { userId: c.userId, especeId: c.especeId, unite, stock, lots, ecart }
      if (Math.abs(ecart) < EPSILON) return { ...base, action: 'aucune' }
      if (ecart < 0) return { ...base, action: 'a_examiner' }
      if (!options.ecrire) return { ...base, action: 'lot_inventaire' }
      const lot = await tx.recolte.create({
        data: {
          userId: c.userId, especeId: c.especeId, cultureId: null, unite, quantite: ecart, statut: 'en_stock',
          date: c.dateInventaire!, createdAt: c.dateInventaire!,
          notes: "Lot d'inventaire : reprise du stock compté au-delà des lots enregistrés (modèle de stock unique).",
        },
        select: { id: true },
      })
      return { ...base, action: 'lot_inventaire', lotId: lot.id }
    })
    lignes.push(ligne)
  }
  return lignes
}
