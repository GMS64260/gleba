/**
 * Aliments visibles d'un compte : le référentiel officiel partagé
 * (`ownerUserId` NULL) et les aliments privés du compte.
 *
 * Seule règle d'accès à un aliment choisi par l'appelant (consommations,
 * stocks, rations, justificatifs). Avant le 2026-10-19, la consommation (POST
 * et PATCH) et le stock (`PATCH /api/elevage/aliments`) écrivaient l'`alimentId`
 * reçu sans rien vérifier : on pouvait y viser l'aliment privé d'un autre
 * compte, dont le nom fuitait et que son propriétaire ne pouvait plus
 * supprimer (`onDelete: Restrict`).
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import prisma from '@/lib/prisma'

type Db = PrismaClient | Prisma.TransactionClient

/** Fragment `where` Prisma : aliments que le compte `userId` peut utiliser. */
export function whereAlimentAccessible(userId: string) {
  return { OR: [{ ownerUserId: null }, { ownerUserId: userId }] }
}

export const MESSAGE_ALIMENT_INACCESSIBLE = 'Aliment introuvable ou inaccessible pour ce compte'

/** Vrai si `alimentId` désigne un aliment utilisable par le compte. */
export async function alimentAccessible(
  userId: string,
  alimentId: string,
  db: Db = prisma,
): Promise<boolean> {
  const aliment = await db.aliment.findFirst({
    where: { id: alimentId, ...whereAlimentAccessible(userId) },
    select: { id: true },
  })
  return aliment !== null
}
