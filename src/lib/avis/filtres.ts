import type { Prisma } from '@prisma/client'
import { criteresKeys } from './criteres'
import type { AvisRefType } from './types'

/** Un support de témoignages vide ne constitue pas un avis personnel. */
export function filtreAvisDirect(refType: AvisRefType): Prisma.AvisWhereInput {
  return { OR: [
    { reprend: { not: null } },
    { commentaire: { not: null, notIn: [''] } },
    ...criteresKeys(refType).map(key => ({ notes: { path: [key], gte: 1, lte: 5 } })),
    { photos: { some: {} } },
  ] }
}

/** Appliqué en base avant pagination, y compris après une suppression en cascade. */
export function filtreAvisAvecContributions(refType: AvisRefType): Prisma.AvisWhereInput {
  return { OR: [filtreAvisDirect(refType), { temoignages: { some: {} } }] }
}
