/**
 * Cheptel vivant en stock — têtes présentées par Comptabilité > Stocks
 * (`computeStocksUnifies`, donc aussi l'outil assistant `get_stocks_valorises`).
 *
 * QA cmvgdo90z (2026-10-20) : Stocks affichait « Pintades perle A3 1708 :
 * 5 têtes » en lisant le compteur stocké `quantiteActuelle`, alors qu'Élevage >
 * Lots en affichait 4 : 2 initiales + 3 nées vivantes − 1 fiche nominative
 * rattachée morte. La mort d'une fiche ne décrémente pas le compteur ; seul
 * `reconstituerEffectifsLots` (`effectif.ts`) la retranche. Les deux écrans
 * lisent désormais ce même helper.
 *
 * Partition sans double compte : l'effectif reconstitué d'un lot actif inclut
 * ses fiches nominatives actives, la ligne « Animaux individuels » ne compte
 * donc que les fiches actives hors lot actif (sans lot, ou lot terminé/réformé
 * qui n'a pas de ligne).
 *
 * Aussi lu par GET /api/elevage/especes-animales (`effectifTotal` par espèce).
 */
import prisma from '@/lib/prisma'
import { reconstituerEffectifsLots } from '@/lib/elevage/effectif'

export interface IndividuelsEnStock {
  especeAnimaleId: string
  tetes: number
}

export interface LotEnStock {
  id: number
  especeAnimaleId: string
  nom: string
  tetes: number
}

export interface CheptelEnStock {
  individuels: IndividuelsEnStock[]
  lots: LotEnStock[]
}

export async function chargerCheptelEnStock(userId: string): Promise<CheptelEnStock> {
  const [individuels, lotsActifs] = await Promise.all([
    prisma.animal.groupBy({
      by: ['especeAnimaleId'],
      where: {
        userId,
        statut: 'actif',
        OR: [{ lotId: null }, { lot: { statut: { not: 'actif' } } }],
      },
      _count: true,
    }),
    prisma.lotAnimaux.findMany({
      where: { userId, statut: 'actif' },
      select: {
        id: true,
        especeAnimaleId: true,
        nom: true,
        quantiteInitiale: true,
        quantiteActuelle: true,
        especeAnimale: { select: { nom: true } },
      },
    }),
  ])

  const effectifs = await reconstituerEffectifsLots(userId, lotsActifs)

  return {
    individuels: individuels.map((a) => ({ especeAnimaleId: a.especeAnimaleId, tetes: a._count })),
    lots: lotsActifs.map((l) => ({
      id: l.id,
      especeAnimaleId: l.especeAnimaleId,
      nom: l.nom || l.especeAnimale.nom,
      tetes: effectifs.get(l.id)?.effectifCalcule ?? l.quantiteActuelle,
    })),
  }
}
