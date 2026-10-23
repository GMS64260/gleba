/**
 * Porte-greffes qu'un compte peut rattacher à un arbre : catalogue Gleba,
 * entrées partagées par la communauté, entrées personnelles du compte
 * (`visibiliteReferentiel`).
 *
 * Revue du 2026-10-23 : POST et PUT /api/arbres écrivaient `porteGreffeId` tel
 * que reçu. Un compte pouvait viser l'entrée privée d'un autre compte, et la
 * liste comme la fiche, qui joignent `porteGreffeRef`, en affichaient le nom
 * et la vigueur. Même règle que `especeAnimaleAccessible`.
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import prisma from '@/lib/prisma'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'

type Db = PrismaClient | Prisma.TransactionClient

/** Vrai si le porte-greffe existe et que le compte `userId` peut l'utiliser. */
export async function porteGreffeAccessible(userId: string, porteGreffeId: string, db: Db = prisma): Promise<boolean> {
  const porteGreffe = await db.porteGreffe.findFirst({
    where: { id: porteGreffeId, AND: [visibiliteReferentiel(userId)] },
    select: { id: true },
  })
  return porteGreffe !== null
}
