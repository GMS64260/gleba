/**
 * Résolution d'une planche depuis un paramètre d'URL.
 *
 * Règle du projet : on raisonne par identifiant technique, jamais par libellé
 * (cf. conventions). Les routes `/api/planches/[id]` et la fiche
 * `/maraichage/planches/[id]` adressaient historiquement la planche par son
 * `nom`. Conséquence directe : `updatePlancheSchema` retirait `nom` des champs
 * modifiables pour protéger le routage, donc une planche mal nommée le restait
 * définitivement — constaté le 2026-07-30 sur dix planches issues de
 * duplications en chaîne.
 *
 * On résout désormais par `id` en priorité, avec repli sur `nom` pour ne casser
 * ni les liens existants, ni les favoris, ni les appels encore basés sur le
 * libellé. Tout nouvel appel doit passer l'`id`.
 */

import type { Prisma, PrismaClient } from '@prisma/client'

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Traduit une référence d'URL en identifiant de planche.
 *
 * L'identifiant est tenté d'abord, le nom ensuite : la résolution reste
 * déterministe même si un utilisateur nommait une planche comme l'identifiant
 * d'une autre. Toujours borné à `userId`, aucune fuite inter-comptes.
 *
 * @returns l'`id` de la planche, ou `null` si rien ne correspond.
 */
export async function resoudreIdPlanche(
  tx: Tx,
  reference: string,
  userId: string
): Promise<string | null> {
  const parId = await tx.planche.findFirst({
    where: { id: reference, userId },
    select: { id: true },
  })
  if (parId) return parId.id

  const parNom = await tx.planche.findFirst({
    where: { nom: reference, userId },
    select: { id: true },
  })
  return parNom?.id ?? null
}
