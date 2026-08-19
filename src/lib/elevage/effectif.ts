/**
 * Effectif reconstitué des lots d'animaux.
 *
 * Le compteur stocké `quantiteActuelle` dérive (les abattages/mortalités ne le
 * décrémentent pas toujours — cf. bug cmpmr3837 : lot Lapins affiché 14 au lieu
 * de 2). On reconstitue donc l'effectif à partir des mouvements traçables :
 * `initial + naissances explicitement rattachées − abattages − sorties des
 * fiches nominatives` sert de plafond prudent, et l'effectif = anonymes
 * présents (`quantiteActuelle`) + animaux nominatifs présents rattachés au
 * lot, borné par ce plafond. Les naissances
 * individualisées en fiches (qui décrémentent `quantiteActuelle` et créent des
 * `Animal`) sont ainsi réintégrées au lieu d'être perdues (ticket cmrz0mt8c).
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
  /** Fiches nominatives actives rattachées au lot (incluses dans effectifCalcule). */
  nominatifsActifs: number
  /** Fiches nominatives sorties (mortes, vendues, abattues) rattachées au lot. */
  sortiesNominatives: number
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
  const nominatifsParLot = new Map<number, number>()
  const sortiesParLot = new Map<number, number>()
  const abattagesNominatifsParLot = new Map<number, number>()

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

  // Abattages déjà rattachés à une fiche nominative : ils sont comptés dans la
  // somme ci-dessus, il ne faut donc pas les retrancher une seconde fois au
  // titre de la sortie de la fiche (cf. `sortiesParLot` plus bas).
  const abattagesNominatifs = await prisma.abattage.groupBy({
    by: ['lotId'],
    where: { userId, lotId: { in: lotIds }, annule: false, animalId: { not: null } },
    _count: { _all: true },
  })
  for (const a of abattagesNominatifs) {
    if (a.lotId == null) continue
    abattagesNominatifsParLot.set(a.lotId, a._count._all)
  }

  // Bug QA caprin 2026-07-24 (ticket cmrz0mt8c) — quand une naissance de lot est
  // « individualisée » en fiches, la route fiches décrémente `quantiteActuelle`
  // (les petits quittent le comptage anonyme) et crée autant d'`Animal`
  // nominatifs rattachés au lot. Sans les réintégrer, l'effectif reconstitué
  // figeait à `quantiteActuelle` (6 initial + 3 naissances → 6 au lieu de 9) et
  // les petits « disparaissaient » du comptage. On somme donc les animaux
  // nominatifs présents (actifs) au comptage anonyme.
  const nominatifs = await prisma.animal.groupBy({
    by: ['lotId'],
    where: { userId, lotId: { in: lotIds }, statut: 'actif' },
    _count: { _all: true },
  })
  for (const n of nominatifs) {
    if (n.lotId == null) continue
    nominatifsParLot.set(n.lotId, n._count._all)
  }

  // QA cmswxat0n — le décès d'une fiche nominative rattachée à un lot ne
  // décrémentait RIEN : `quantiteActuelle` (comptage anonyme) ne bouge pas à la
  // mort d'un individu, et le plafond tracé ignorait les sorties nominatives.
  // Le lot restait donc à 4 têtes après la mort de la 4ᵉ, et le dashboard
  // comptait un animal actif de trop. Une fiche rattachée NOMME une tête du lot
  // (c'est le sens du plafond prudent) : sa sortie définitive — morte, vendue,
  // abattue — doit sortir cette tête du lot.
  const sorties = await prisma.animal.groupBy({
    by: ['lotId'],
    where: { userId, lotId: { in: lotIds }, statut: { not: 'actif' } },
    _count: { _all: true },
  })
  for (const s of sorties) {
    if (s.lotId == null) continue
    sortiesParLot.set(s.lotId, s._count._all)
  }

  for (const l of lots) {
    const naissancesL = naissancesParLot.get(l.id) ?? 0
    const abattagesL = abattagesParLot.get(l.id) ?? 0
    const nominatifsL = nominatifsParLot.get(l.id) ?? 0
    // Sorties nominatives non déjà retranchées par la somme des abattages du lot.
    const sortiesL = Math.max(
      0,
      (sortiesParLot.get(l.id) ?? 0) - (abattagesNominatifsParLot.get(l.id) ?? 0),
    )
    // Le total tracé (initial + naissances − abattages − sorties nominatives)
    // reste le plafond prudent : il borne les dérives du compteur stocké. Mais
    // les fiches nominatives actives rattachées au lot sont des présences
    // RÉELLES : une affectation manuelle au-delà du plafond (ticket cmsogdr7i :
    // « 4 effectif actuel » face à 5 nominatifs) doit se voir. Les nominatifs
    // planchonnent donc le résultat :
    // effectif = max(nominatifs actifs, min(anonymes + nominatifs, plafond)).
    const plafond = Math.max(0, l.quantiteInitiale + naissancesL - abattagesL - sortiesL)
    const effectifCalcule = Math.max(nominatifsL, Math.min(l.quantiteActuelle + nominatifsL, plafond))
    result.set(l.id, {
      naissancesVivantes: naissancesL,
      abattagesTotal: abattagesL,
      effectifCalcule,
      nominatifsActifs: nominatifsL,
      sortiesNominatives: sortiesL,
    })
  }
  return result
}
