/**
 * Stock d'œufs par lot de ponte avec statuts réglementaires DCR — source
 * unique de vérité de l'écran Élevage > Production > Œufs.
 *
 * Extrait de GET /api/elevage/stock-oeufs (lot assistant 2026-08-11) pour être
 * partagé avec l'outil assistant `get_stock_oeufs` : les statuts
 * (commercialisable J+21, à consommer J+28, périmé, bloqué délai véto —
 * ticket cmsoeyhs5) et le stock physique cités par l'assistant doivent être
 * ceux de l'écran.
 */

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  datesLotOeufs,
  statutLotOeufs,
  stockRestantLotOeufs,
} from '@/lib/elevage/stock-oeufs'
import { ciblesAffectees, floorDayUTC } from '@/lib/elevage/attente-lait'

type Db = Prisma.TransactionClient

export type StockOeufsParLots = Awaited<ReturnType<typeof computeStockOeufsParLots>>

export type BlocageVetoOeufs = {
  finAttenteOeufs: Date
  /** Première date de ponte à nouveau commercialisable (finAttenteOeufs + 1 j,
   * même convention que la remise en vente affichée sur la fiche animal). */
  remiseEnVente: Date
}

/**
 * Ticket cmsoeyhs5 — délai d'attente vétérinaire sur les ŒUFS.
 *
 * Une ponte datée dans [jour du soin, finAttenteOeufs] d'un soin FAIT est
 * bloquée définitivement : les œufs pondus pendant la fenêtre de retrait ne
 * sont jamais commercialisables (la « remise en vente » ne concerne que les
 * pontes postérieures à finAttenteOeufs). La couverture cible réutilise
 * l'expansion cross-granularité individu↔lot de l'attente lait : un soin sur
 * le lot bloque les pontes du lot, un soin sur un animal bloque ses pontes
 * individuelles ET celles de son lot (les œufs y sont collectés en mélange).
 */
export async function blocagesVetoPontes(
  db: Db,
  userId: string,
  pontes: { id: number; date: Date; lotId: number | null; animalId: number | null }[],
): Promise<Map<number, BlocageVetoOeufs>> {
  const result = new Map<number, BlocageVetoOeufs>()
  if (pontes.length === 0) return result
  const minPonte = new Date(Math.min(...pontes.map((ponte) => floorDayUTC(ponte.date).getTime())))
  const soins = await db.soinAnimal.findMany({
    where: { userId, fait: true, finAttenteOeufs: { not: null, gte: minPonte } },
    select: { date: true, finAttenteOeufs: true, animalId: true, lotId: true },
  })
  if (soins.length === 0) return result

  // Expansion cible → {animaux, lots}, une seule fois par cible distincte.
  const cibles = new Map<string, { animalIds: number[]; lotIds: number[] }>()
  const cleCible = (s: { animalId: number | null; lotId: number | null }) =>
    `${s.animalId ?? ''}:${s.lotId ?? ''}`
  for (const soin of soins) {
    if (!cibles.has(cleCible(soin))) {
      cibles.set(cleCible(soin), await ciblesAffectees(db, userId, soin.animalId, soin.lotId))
    }
  }

  for (const ponte of pontes) {
    const jourPonte = floorDayUTC(ponte.date).getTime()
    // En cas de fenêtres qui se chevauchent, le délai le plus contraignant
    // (fin la plus lointaine) donne la date de libération effective.
    let fin: Date | null = null
    for (const soin of soins) {
      if (!soin.finAttenteOeufs) continue
      if (jourPonte < floorDayUTC(soin.date).getTime()) continue
      if (jourPonte > soin.finAttenteOeufs.getTime()) continue
      const cible = cibles.get(cleCible(soin))
      const couverte =
        (ponte.lotId != null && !!cible?.lotIds.includes(ponte.lotId)) ||
        (ponte.animalId != null && !!cible?.animalIds.includes(ponte.animalId))
      if (!couverte) continue
      if (fin == null || soin.finAttenteOeufs.getTime() > fin.getTime()) fin = soin.finAttenteOeufs
    }
    if (fin) {
      const remise = new Date(fin)
      remise.setUTCDate(remise.getUTCDate() + 1)
      result.set(ponte.id, { finAttenteOeufs: fin, remiseEnVente: remise })
    }
  }
  return result
}

export async function computeStockOeufsParLots(userId: string, now = new Date()) {
  const productions = await prisma.productionOeuf.findMany({
    where: { userId },
    orderBy: { date: "asc" },
    take: 2000,
    include: {
      lot: { select: { id: true, nom: true } },
      mouvementsStock: {
        orderBy: { date: "asc" },
        select: { id: true, date: true, type: true, quantite: true, notes: true },
      },
    },
  })
  // Ticket cmsoeyhs5 — le statut de fraîcheur (J+21/J+28) était la seule
  // règle consultée : les délais d'attente œufs des soins faits sont désormais
  // croisés avec chaque ponte (une ponte du 11/08 sous Dectomax jusqu'au 04/09
  // était « commercialisable »).
  const blocages = await blocagesVetoPontes(
    prisma,
    userId,
    productions.map((production) => ({
      id: production.id,
      date: production.date,
      lotId: production.lotId,
      animalId: production.animalId,
    })),
  )
  const lots = productions.map((production) => {
    const restant = stockRestantLotOeufs({
      quantite: production.quantite,
      casses: production.casses,
      sales: production.sales,
      sorties: production.mouvementsStock,
    })
    const dates = datesLotOeufs(production.date)
    const statutFraicheur = statutLotOeufs(production.date, now)
    // « périmé » reste terminal (déjà interdit à la vente ET à la consommation) ;
    // sinon le blocage vétérinaire prime sur la fraîcheur.
    const blocage = statutFraicheur === "perime" ? undefined : blocages.get(production.id)
    return {
      id: production.id,
      datePonte: production.date,
      lot: production.lot,
      calibre: production.calibre,
      quantiteInitiale: production.quantite,
      restant,
      limiteVente: dates.limiteVente,
      dcr: dates.dcr,
      statut: blocage ? ("bloque_attente_veto" as const) : statutFraicheur,
      remiseEnVente: blocage?.remiseEnVente ?? null,
      mouvements: production.mouvementsStock,
    }
  })
  const actifs = lots.filter((lot) => lot.restant > 0)
  const somme = (statut: string) => actifs
    .filter((lot) => lot.statut === statut)
    .reduce((total, lot) => total + lot.restant, 0)
  return {
    data: actifs.sort((a, b) => new Date(a.dcr).getTime() - new Date(b.dcr).getTime()),
    stats: {
      commercialisables: somme("commercialisable"),
      aConsommer: somme("a_consumer"),
      perimes: somme("perime"),
      bloquesVeto: somme("bloque_attente_veto"),
      stockPhysique: actifs.reduce((total, lot) => total + lot.restant, 0),
    },
  }
}
