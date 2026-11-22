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


  // Nom affiché : pour une espèce du catalogue Gleba, l'id EST le nom lisible ;
  // pour une espèce perso, l'id est un cuid et le libellé vit dans `nom`.
  // Sans cette lecture, le sélecteur de variété affichait
  // « cms7n0lx10003k0rei0qb6pkv — Non spécifiée » (friction du 2026-07-30).
  const espece = await tx.espece.findUnique({
    where: { id: especeId },
    select: { nom: true, userId: true, partageCommunaute: true },
  })
  // La variété « Non spécifiée » appartient au même propriétaire que son espèce
  // (officielle pour une espèce officielle). Sans ce filtre, une variété privée
  // marquée ainsi sur une espèce officielle ou partagée captait les cultures
  // sans variété de tous les comptes.
  const existing = await tx.variete.findFirst({
    where: { especeId, isPlaceholder: true, userId: espece?.userId ?? null },
    select: { id: true },
  })
  if (existing) return existing.id

  const nomEspece = espece?.nom ?? especeId
  // La clé de dédup se calcule sur le LIBELLÉ affiché, pas sur l'identifiant :
  // pour une espèce perso, l'id est un cuid, donc la clé valait
  // « cms7n0lx… non spécifiée » et ne correspondait à rien de cherchable. Reste
  // du constat C28 (formule unique de `nom_normalise`).
  const nomAffiche = `${nomEspece}${PLACEHOLDER_VARIETE_SUFFIX}`
  const nomNormalise = normalizeVarieteName(nomAffiche)

  // Pas de placeholder pour cette espèce : on le crée.
  await tx.variete.upsert({
    where: { id: placeholderId },
    create: {
      id: placeholderId,
      nom: nomAffiche,
      nomNormalise,
      isPlaceholder: true,
      especeId,
      // Le placeholder hérite de l'attribution de SON espèce. Il naissait en
      // catalogue Gleba officiel (userId null) même sur une espèce privée : son
      // libellé nommait alors l'espèce privée d'un membre à tous les autres, et
      // la réponse de /api/varietes embarquait la fiche complète de cette espèce.
      userId: espece?.userId ?? null,
      partageCommunaute: espece?.partageCommunaute ?? false,
      description: "Variété non spécifiée — à renseigner",
    },
    update: { isPlaceholder: true },
  })
  return placeholderId
}
