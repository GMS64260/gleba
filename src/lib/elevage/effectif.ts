/**
 * Effectif reconstitué des lots d'animaux.
 *
 * Le compteur stocké `quantiteActuelle` dérive (les abattages/mortalités ne le
 * décrémentent pas toujours — cf. bug cmpmr3837 : lot Lapins affiché 14 au lieu
 * de 2). On reconstitue donc l'effectif à partir des mouvements traçables :
 * `initial + naissances explicitement rattachées − abattages`, plafonné par le compteur stocké
 * (s'il est plus bas, mortalités/ventes individuelles non tracées par lot, on
 * garde la valeur prudente).
 *
 * Source de vérité partagée entre GET /api/elevage/lots (affichage détaillé) et
 * GET /api/elevage/stats (dashboard « en lots ») pour qu'ils ne divergent plus.
 */
import prisma from '@/lib/prisma'

export interface LotEffectifInput {
  id: number
  quantiteInitiale: number
  quantiteActuelle: number
}

export interface LotEffectifResult {
  naissancesVivantes: number
  abattagesTotal: number
  /** Effectif reconstitué — source de vérité pour l'affichage. */
  effectifCalcule: number
}

/**
 * Reconstitue l'effectif de chaque lot fourni. Retourne une Map indexée par
 * `lot.id`. Aucune requête n'est émise si la liste est vide.
 */
export async function reconstituerEffectifsLots(
  userId: string,
  lots: LotEffectifInput[],
): Promise<Map<number, LotEffectifResult>> {
  const result = new Map<number, LotEffectifResult>()
  const lotIds = lots.map((l) => l.id)
  if (lotIds.length === 0) return result

  const naissancesParLot = new Map<number, number>()
  const abattagesParLot = new Map<number, number>()

  // Une naissance ne crédite jamais implicitement le lot de la mère. Seul le
  // lot des petits explicitement choisi sur la mise bas est comptabilisé.
  const naissances = await prisma.naissanceAnimale.findMany({
    where: { userId, lotId: { in: lotIds } },
    select: { lotId: true, nombreVivants: true },
  })
  for (const n of naissances) {
    const lotId = n.lotId
    if (!lotId) continue
    naissancesParLot.set(lotId, (naissancesParLot.get(lotId) ?? 0) + n.nombreVivants)
  }

  const abattages = await prisma.abattage.groupBy({
    by: ['lotId'],
    where: { userId, lotId: { in: lotIds }, annule: false },
    _sum: { quantite: true },
  })
  for (const a of abattages) {
    if (a.lotId == null) continue
    abattagesParLot.set(a.lotId, a._sum.quantite ?? 0)
  }

  for (const l of lots) {
    const naissancesL = naissancesParLot.get(l.id) ?? 0
    const abattagesL = abattagesParLot.get(l.id) ?? 0
    // Le compteur stocké reste le plafond prudent car il peut intégrer des
    // sorties non modélisées ici. Cette valeur n'est pas qualifiée
    // d'autoritaire : les mouvements explicites restent la référence métier.
    const plafond = Math.max(0, l.quantiteInitiale + naissancesL - abattagesL)
    const effectifCalcule = Math.min(l.quantiteActuelle, plafond)
    result.set(l.id, {
      naissancesVivantes: naissancesL,
      abattagesTotal: abattagesL,
      effectifCalcule,
    })
  }
  return result
}
