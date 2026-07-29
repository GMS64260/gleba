import prisma from "@/lib/prisma"
import { irrigationCache } from "@/lib/irrigation-cache"
import { cultureIrrigationDemarreeWhere } from "@/lib/irrigation-eligibility"

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
  dateEffective: Date
}

/**
 * Enregistre un arrosage physique et réconcilie toutes les vues :
 * - toutes les cultures actives de la même planche reçoivent la même date ;
 * - les irrigations planifiées dues pour ces cultures sont terminées ;
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

  const [culturesUpdate, irrigationsUpdate] = await prisma.$transaction([
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
      where: {
        userId,
        cultureId: { in: idsCibles },
        fait: false,
        datePrevue: { lte: finJournee },
      },
      data: {
        fait: true,
        dateEffective,
      },
    }),
  ])

  irrigationCache.invalidateUser(userId)

  return {
    cultureIds: idsCibles,
    plancheIds,
    culturesMisesAJour: culturesUpdate.count,
    irrigationsPlanifieesTerminees: irrigationsUpdate.count,
    dateEffective,
  }
}
