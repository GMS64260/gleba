import type { Prisma } from '@prisma/client'

/**
 * Une recommandation d'irrigation ne concerne qu'une culture réellement
 * démarrée. Une culture encore entièrement planifiée ne doit pas produire
 * d'alerte sur la planche qui la recevra plus tard.
 */
export const cultureIrrigationDemarreeWhere = {
  OR: [
    { semisFait: true },
    { plantationFaite: true },
  ],
} satisfies Prisma.CultureWhereInput

export function cultureIrrigationEstDemarree(culture: {
  semisFait: boolean
  plantationFaite: boolean
}): boolean {
  return culture.semisFait || culture.plantationFaite
}
