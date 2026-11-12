/**
 * Effectif d'un lot traité, figé au jour du soin (constat C10 de la revue
 * réglementaire du 2026-11-12).
 *
 * Le carnet sanitaire affichait derrière un soin de lot l'effectif reconstitué
 * d'AUJOURD'HUI : un lot de 100 poules traité en mars puis réduit à 60 portait
 * « (60 animaux) » pour le traitement de mars. Aucun effectif daté n'existe
 * (`reconstituerEffectifsLots` ne date pas) : la seule valeur sûre est celle du
 * jour même. On la fige donc quand le soin est enregistré comme administré le
 * jour civil de son administration ; sinon on ne l'invente pas (NULL).
 *
 * Règlement (UE) 2019/6, art. 108 §2 f) exige « l'identification de l'animal
 * ou du groupe d'animaux traités », pas leur nombre : ce nombre est une aide.
 */

import type { Prisma } from '@prisma/client'
import { jourLocalISO } from '@/lib/jour-civil'
import { jourSoin } from './date-soin'
import { reconstituerEffectifsLots } from './effectif'

export async function effectifTraiteAuJour(
  db: Prisma.TransactionClient,
  userId: string,
  lotId: number | null | undefined,
  dateSoin: Date,
  maintenant: Date = new Date(),
): Promise<number | null> {
  if (!lotId) return null
  if (jourSoin(dateSoin) !== jourLocalISO(maintenant)) return null
  const lot = await db.lotAnimaux.findFirst({
    where: { id: lotId, userId },
    select: { id: true, quantiteInitiale: true, quantiteActuelle: true },
  })
  if (!lot) return null
  const effectif = (await reconstituerEffectifsLots(userId, [lot], db)).get(lot.id)?.effectifCalcule
  return effectif != null && effectif > 0 ? effectif : null
}
