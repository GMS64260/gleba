/**
 * Observations de santé du verger — source unique de vérité de l'écran
 * Verger > Santé et de GET /api/arbres/observations.
 *
 * Extrait de la route (lot assistant 2026-08-11) pour être partagé avec
 * l'outil assistant `get_observations_sante` : une observation saisie à
 * l'écran doit être visible de l'assistant avec les mêmes filtres.
 */

import prisma from '@/lib/prisma'

export interface ObservationsSanteFiltres {
  arbreId?: number
  type?: string
  gravite?: string
  resolu?: boolean
}

export type ObservationsSante = Awaited<ReturnType<typeof listerObservationsSante>>

export async function listerObservationsSante(
  userId: string,
  filtres: ObservationsSanteFiltres = {},
) {
  const where: Record<string, unknown> = { userId }
  if (filtres.arbreId) where.arbreId = filtres.arbreId
  if (filtres.type && filtres.type !== "all") where.type = filtres.type
  if (filtres.gravite && filtres.gravite !== "all") where.gravite = filtres.gravite
  if (filtres.resolu !== undefined) where.resolu = filtres.resolu

  return prisma.observationSante.findMany({
    where,
    include: {
      arbre: {
        select: { id: true, nom: true, type: true, espece: true },
      },
    },
    orderBy: { date: "desc" },
  })
}
