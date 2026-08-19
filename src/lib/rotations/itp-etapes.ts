/**
 * Contrôle des itinéraires portés par les étapes d'une rotation.
 *
 * Une rotation est un catalogue administré, partagé par toutes les
 * exploitations : les planches de plusieurs comptes peuvent pointer la même
 * rotation, et `getCulturesPrevues` en dérive leurs suggestions de cultures.
 * L'itinéraire d'une étape se propage donc à tout le monde.
 *
 * Or `RotationDetail.itpId` n'était contrôlé nulle part : un identifiant
 * inexistant remontait en 500 (violation de clé étrangère habillée en « erreur
 * interne »), un itinéraire retiré du service continuait d'alimenter des
 * suggestions, et un itinéraire personnel non partagé pouvait entrer dans le
 * catalogue commun.
 */

import type { PrismaClient } from '@prisma/client'

import { whereItpUtilisable } from '@/lib/itp-acces'

export interface EtapeRotation {
  annee: number
  itpId?: string | null
}

export interface EtapeInvalide {
  annee: number
  itpId: string
}

/**
 * Étapes dont l'itinéraire n'est pas exploitable pour cet appelant (inexistant,
 * non visible, ou retiré du service). Une étape sans itinéraire est une jachère
 * déclarée : elle est valide.
 */
export async function etapesRotationInvalides(
  prisma: PrismaClient,
  userId: string,
  etapes: EtapeRotation[] | undefined
): Promise<EtapeInvalide[]> {
  if (!etapes || etapes.length === 0) return []

  const itpIds = [...new Set(etapes.map((e) => e.itpId).filter(Boolean) as string[])]
  if (itpIds.length === 0) return []

  const utilisables = await prisma.iTP.findMany({
    where: { AND: [{ id: { in: itpIds } }, whereItpUtilisable(userId)] },
    select: { id: true },
  })
  const ok = new Set(utilisables.map((i) => i.id))

  return etapes
    .filter((e) => e.itpId && !ok.has(e.itpId))
    .map((e) => ({ annee: e.annee, itpId: e.itpId as string }))
}

/** Message 400 unique pour la création et la modification d'une rotation. */
export function messageEtapesInvalides(invalides: EtapeInvalide[]): string {
  const liste = invalides.map((e) => `étape ${e.annee} → « ${e.itpId} »`).join(', ')
  return `Itinéraire technique indisponible (introuvable, non partagé, ou retiré du service) : ${liste}. Une rotation est partagée par toutes les exploitations : chaque étape doit pointer un itinéraire du catalogue.`
}
