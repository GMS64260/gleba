/**
 * Espèces animales qu'un compte peut utiliser : catalogue Gleba, fiches
 * partagées par la communauté, fiches personnelles du compte
 * (`visibiliteReferentiel`).
 *
 * Seul contrôle d'une `especeAnimaleId` choisie par l'appelant, à la création
 * comme à la modification (animal, lot, campagne de reproduction). Avant le
 * 2026-10-19, seul le PATCH des animaux l'appliquait : les autres routes ne
 * vérifiaient que l'existence, et on pouvait viser la fiche privée d'un autre
 * compte (son nom fuitait, et `onDelete: Restrict` empêchait son auteur de la
 * supprimer).
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import prisma from '@/lib/prisma'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'

type Db = PrismaClient | Prisma.TransactionClient

/** Vrai si l'espèce existe et que le compte `userId` peut l'utiliser. */
export async function especeAnimaleAccessible(
  userId: string,
  especeAnimaleId: string,
  db: Db = prisma,
): Promise<boolean> {
  const espece = await db.especeAnimale.findFirst({
    where: { id: especeAnimaleId, AND: [visibiliteReferentiel(userId)] },
    select: { id: true },
  })
  return espece !== null
}
