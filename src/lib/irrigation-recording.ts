import prisma from "@/lib/prisma"
import { irrigationCache } from "@/lib/irrigation-cache"
import { cultureIrrigationDemarreeWhere } from "@/lib/irrigation-eligibility"
import { idsAExpirer } from "@/lib/irrigation-peremption"

interface EnregistrerArrosageParams {
  userId: string
  cultureIds: number[]
  dateEffective?: Date
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
    select: { id: true },
  })
  const idsCibles = culturesCibles.map((culture) => culture.id)

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
  const closesAujourdhui = await prisma.irrigationPlanifiee.findMany({
    where: {
      userId,
      cultureId: { in: idsCibles },
      fait: true,
      dateEffective: { gte: debutJournee, lte: finJournee },
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
          notes: 'Arrosage noté depuis les conseils d’irrigation',
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
  }
}
