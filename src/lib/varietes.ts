/**
 * Helpers métier autour du référentiel Variétés.
 *
 * Le placeholder "Non spécifiée" est une Variete avec isPlaceholder=true.
 * Il existe une par espèce, créé à la demande lorsque l'utilisateur sauvegarde
 * une Culture sans choisir de variété. L'UI affiche alors un bandeau
 * "À renseigner" sur la ligne, jamais "-".
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import prisma from "@/lib/prisma"
import { normalizeVarieteName } from "@/lib/normalize"

export const PLACEHOLDER_VARIETE_SUFFIX = " — Non spécifiée"

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Retourne l'id de la variété placeholder pour cette espèce, en la créant
 * si elle n'existe pas. Le nom canonique est "<EspeceId> — Non spécifiée".
 */
export async function ensurePlaceholderVariete(especeId: string, tx: Tx = prisma): Promise<string> {
  const placeholderId = `${especeId}${PLACEHOLDER_VARIETE_SUFFIX}`
  const nomNormalise = normalizeVarieteName(placeholderId)

  const existing = await tx.variete.findFirst({
    where: { especeId, isPlaceholder: true },
    select: { id: true },
  })
  if (existing) return existing.id

  // Pas de placeholder pour cette espèce : on le crée.
  await tx.variete.upsert({
    where: { id: placeholderId },
    create: {
      id: placeholderId,
      nomNormalise,
      isPlaceholder: true,
      especeId,
      description: "Variété non spécifiée — à renseigner",
    },
    update: { isPlaceholder: true },
  })
  return placeholderId
}
