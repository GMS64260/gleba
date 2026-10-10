import prisma from "@/lib/prisma"
import { irrigationCache } from "@/lib/irrigation-cache"
import { cultureIrrigationDemarreeWhere } from "@/lib/irrigation-eligibility"
import { idsAExpirer } from "@/lib/irrigation-peremption"

/** Deux « Noter » à moins de 10 minutes d'écart sont un seul arrosage. */
export const FENETRE_DOUBLON_MS = 10 * 60_000

interface EnregistrerArrosageParams {
  userId: string
  cultureIds: number[]
  dateEffective?: Date
  /** Observation saisie avec l'arrosage (page Tâches) ; sinon libellé par défaut. */
  notes?: string | null
}

export interface EnregistrerArrosageResult {
  cultureIds: number[]
  plancheIds: string[]
  culturesMisesAJour: number
  irrigationsPlanifieesTerminees: number
  /** Passages trop anciens pour être rattrapés : abandonnés, pas clos. */
  irrigationsPerimees: number
  irrigationsTraceesCreees: number
  dateEffective: Date
  /**
   * `derniereIrrigation` de chaque culture touchée AVANT ce geste (ISO ou
   * null) : ce qu'il faut pour l'annuler exactement (`annulerArrosageCultures`).
   */
  derniereIrrigationAvant: Record<number, string | null>
}

/**
 * Enregistre un arrosage physique et réconcilie toutes les vues :
 * - toutes les cultures actives de la même planche reçoivent la même date ;
 * - les irrigations planifiées encore RATTRAPABLES sont terminées ; celles
 *   manquées depuis plus d'un cycle sont abandonnées, pas antidatées ;
 * - une irrigation clôturée est créée pour les cultures qui n'en avaient
 *   aucune, afin que l'arrosage apparaisse dans le registre d'interventions ;
 * - le cache des recommandations météo est invalidé.
 */
export async function enregistrerArrosageCultures({
  userId,
  cultureIds,
  dateEffective = new Date(),
  notes,
}: EnregistrerArrosageParams): Promise<EnregistrerArrosageResult> {
  const idsDemandes = Array.from(new Set(
    cultureIds.filter((id) => Number.isInteger(id) && id > 0)
  ))

  if (idsDemandes.length === 0) {
    return {
      cultureIds: [],
      plancheIds: [],
      culturesMisesAJour: 0,
      irrigationsPlanifieesTerminees: 0,
      irrigationsPerimees: 0,
      irrigationsTraceesCreees: 0,
      dateEffective,
      derniereIrrigationAvant: {},
    }
  }

  const culturesDemandees = await prisma.culture.findMany({
    where: {
      userId,
      id: { in: idsDemandes },
    },
    select: {
      id: true,
      plancheId: true,
    },
  })

  const idsAutorises = culturesDemandees.map((culture) => culture.id)
  const plancheIds = Array.from(new Set(
    culturesDemandees
      .map((culture) => culture.plancheId)
      .filter((id): id is string => Boolean(id))
  ))

  if (idsAutorises.length === 0) {
    return {
      cultureIds: [],
      plancheIds: [],
      culturesMisesAJour: 0,
      irrigationsPlanifieesTerminees: 0,
      irrigationsPerimees: 0,
      irrigationsTraceesCreees: 0,
      dateEffective,
      derniereIrrigationAvant: {},
    }
  }

  const culturesCibles = await prisma.culture.findMany({
    where: {
      userId,
      OR: [
        { id: { in: idsAutorises } },
        ...(plancheIds.length > 0
          ? [{
              plancheId: { in: plancheIds },
              terminee: null,
              AND: [cultureIrrigationDemarreeWhere],
            }]
          : []),
      ],
    },
    select: { id: true, derniereIrrigation: true },
  })
  const idsCibles = culturesCibles.map((culture) => culture.id)
  const derniereIrrigationAvant = Object.fromEntries(
    culturesCibles.map((c) => [c.id, c.derniereIrrigation ? c.derniereIrrigation.toISOString() : null]),
  ) as Record<number, string | null>

  const finJournee = new Date(dateEffective)
  finJournee.setHours(23, 59, 59, 999)
  const debutJournee = new Date(dateEffective)
  debutJournee.setHours(0, 0, 0, 0)

  // Passages encore ouverts pour ces cultures jusqu'à la fin de la journée.
  const ouvertes = await prisma.irrigationPlanifiee.findMany({
    where: {
      userId,
      cultureId: { in: idsCibles },
      fait: false,
      perimee: false,
      datePrevue: { lte: finJournee },
    },
    select: {
      id: true,
      cultureId: true,
      datePrevue: true,
      fait: true,
      perimee: true,
      culture: { select: { espece: { select: { besoinEau: true } } } },
    },
  })

  // Un arrosage ne se rattrape pas. « Noter » ne clôt donc que les passages
  // encore dans leur cycle ; les plus anciens sont ABANDONNÉS, jamais
  // estampillés d'aujourd'hui. Sans cette coupure, un seul clic soldait six
  // jours de retard d'un coup et le registre affirmait des arrosages qui
  // n'avaient pas eu lieu (constaté le 2026-08-14 : 30 lignes prévues du 08 au
  // 13 toutes datées du 14).
  const idsPerimes = idsAExpirer(ouvertes, dateEffective)
  const perimeesSet = new Set(idsPerimes)
  const aClore = ouvertes.filter((irr) => !perimeesSet.has(irr.id))

  // QA cmsioeku5 (2026-08-07) — « Noter » ne posait qu'un horodatage sur la
  // culture (`derniereIrrigation`) : le compteur d'urgences bougeait mais aucun
  // arrosage n'apparaissait dans Interventions, qui ne dérive ses lignes
  // « arrosage » que d'IrrigationPlanifiee. Un arrosage réel devenait donc
  // intraçable. Les cultures dont aucune irrigation planifiée ne couvre la
  // journée reçoivent donc une irrigation clôturée, qui sert de trace — un
  // passage périmé ne compte pas comme trace, sinon l'arrosage réel du jour
  // disparaîtrait du registre.
  //
  // Itération du 2026-10-10 : chaque arrosage noté a sa trace, un second
  // arrosage le soir compris (il gardait sinon la seule trace du matin et
  // perdait son observation). Seul un double geste dans les
  // FENETRE_DOUBLON_MS (double tap, deux écrans) est dédoublonné.
  const closesAujourdhui = await prisma.irrigationPlanifiee.findMany({
    where: {
      userId,
      cultureId: { in: idsCibles },
      fait: true,
      dateEffective: {
        gte: new Date(Math.max(debutJournee.getTime(), dateEffective.getTime() - FENETRE_DOUBLON_MS)),
        lte: finJournee,
      },
    },
    select: { cultureId: true },
  })
  const cultureIdsTracees = new Set<number>([
    ...aClore.map((irr) => irr.cultureId),
    ...closesAujourdhui.map((irr) => irr.cultureId),
  ])
  const idsSansTrace = idsCibles.filter((id) => !cultureIdsTracees.has(id))

  const [culturesUpdate, irrigationsUpdate, perimeesUpdate, tracesCreees] =
    await prisma.$transaction([
      prisma.culture.updateMany({
        where: {
          userId,
          id: { in: idsCibles },
        },
        data: {
          derniereIrrigation: dateEffective,
        },
      }),
      prisma.irrigationPlanifiee.updateMany({
        where: { id: { in: aClore.map((irr) => irr.id) } },
        data: {
          fait: true,
          dateEffective,
        },
      }),
      prisma.irrigationPlanifiee.updateMany({
        where: { id: { in: idsPerimes } },
        data: { perimee: true },
      }),
      prisma.irrigationPlanifiee.createMany({
        data: idsSansTrace.map((cultureId) => ({
          userId,
          cultureId,
          datePrevue: dateEffective,
          fait: true,
          dateEffective,
          notes: notes?.trim().slice(0, 1000) || 'Arrosage noté',
        })),
      }),
    ])

  irrigationCache.invalidateUser(userId)

  return {
    cultureIds: idsCibles,
    plancheIds,
    culturesMisesAJour: culturesUpdate.count,
    irrigationsPlanifieesTerminees: irrigationsUpdate.count,
    irrigationsPerimees: perimeesUpdate.count,
    irrigationsTraceesCreees: tracesCreees.count,
    dateEffective,
    derniereIrrigationAvant,
  }
}

export interface AnnulerArrosageParams {
  userId: string
  /** Horodatage EXACT du geste à annuler (renvoyé par `enregistrerArrosageCultures`). */
  dateEffective: Date
  /** `derniereIrrigation` d'avant le geste, par culture (renvoyé par le même appel). */
  avant: Record<number, string | null>
}

/**
 * Inverse exact de « Noter » (revue du modèle d'arrosage, 2026-10-10) : sans
 * lui, un tap de trop effaçait le besoin de toute la planche pendant des
 * jours et laissait une trace définitive au registre.
 *
 * Ne supprime que les traces posées par CE geste (même horodatage exact, même
 * compte, cultures concernées) et ne restaure `derniereIrrigation` que si
 * aucun arrosage plus récent ne l'a remplacé depuis.
 */
export async function annulerArrosageCultures({ userId, dateEffective, avant }: AnnulerArrosageParams) {
  const ids = Object.keys(avant)
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
  if (ids.length === 0 || Number.isNaN(dateEffective.getTime())) {
    return { tracesSupprimees: 0, culturesRestaurees: 0 }
  }

  const resultat = await prisma.$transaction(async (tx) => {
    const cultures = await tx.culture.findMany({
      where: { userId, id: { in: ids } },
      select: { id: true, derniereIrrigation: true },
    })
    const idsAutorises = cultures.map((c) => c.id)
    const traces = await tx.irrigationPlanifiee.deleteMany({
      where: { userId, cultureId: { in: idsAutorises }, fait: true, dateEffective },
    })
    let culturesRestaurees = 0
    for (const c of cultures) {
      // Un arrosage noté depuis l'emporte : on ne le défait pas.
      if (c.derniereIrrigation?.getTime() !== dateEffective.getTime()) continue
      const precedente = avant[c.id]
      const date = precedente ? new Date(precedente) : null
      await tx.culture.update({
        where: { id: c.id },
        data: { derniereIrrigation: date && !Number.isNaN(date.getTime()) ? date : null },
      })
      culturesRestaurees++
    }
    return { tracesSupprimees: traces.count, culturesRestaurees }
  })

  irrigationCache.invalidateUser(userId)
  return resultat
}
