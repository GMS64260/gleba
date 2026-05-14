/**
 * Détection de violation du plan de rotation à la création d'une culture.
 *
 * Une rotation est définie par :
 *   - Rotation.nbAnnees   (cycle, ex: 4 ans)
 *   - RotationDetail[]    (étape 1..nbAnnees, chaque étape lie à un ITP)
 *
 * On considère qu'une planche "en année N de la rotation" attend une culture
 * de la même famille botanique que celle prévue à l'étape correspondante.
 *
 * Limitation actuelle : on ne stocke pas d'année de référence pour la planche.
 * On utilise donc Planche.annee si présent, sinon la culture la plus récente
 * sur la planche. Pour le PROMPT 12, le warning suffit même approximatif —
 * une amélioration plus fine viendra avec une vraie traçabilité annuelle.
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import prisma from "@/lib/prisma"

type Tx = Prisma.TransactionClient | PrismaClient

export type RotationViolation = {
  rotationId: string
  etapeAttendue: number // 1..nbAnnees
  familleAttendue: string | null
  familleDemandee: string | null
  message: string
}

/**
 * Inspecte la rotation de la planche cible. Retourne null si pas de violation,
 * sinon un objet décrivant la violation.
 *
 * @param plancheId   ID de la planche cible (peut être null → pas de check).
 * @param especeId    ID de l'espèce à planter.
 * @param annee       Année cible de la culture (utilisée pour calculer l'étape
 *                    dans le cycle, modulo nbAnnees).
 */
export async function checkRotationViolation(
  plancheId: string | null | undefined,
  especeId: string,
  annee: number,
  tx: Tx = prisma
): Promise<RotationViolation | null> {
  if (!plancheId) return null

  const planche = await tx.planche.findUnique({
    where: { id: plancheId },
    select: {
      id: true,
      annee: true,
      rotation: {
        select: {
          id: true,
          nbAnnees: true,
          details: {
            select: {
              annee: true,
              itp: { select: { espece: { select: { familleId: true } } } },
            },
            orderBy: { annee: "asc" },
          },
        },
      },
    },
  })
  if (!planche?.rotation) return null
  const { rotation } = planche
  const nbAnnees = rotation.nbAnnees ?? rotation.details.length
  if (!nbAnnees || nbAnnees < 1) return null

  // Étape attendue dans le cycle (1..nbAnnees).
  const anneeRef = planche.annee ?? annee
  const offset = ((annee - anneeRef) % nbAnnees + nbAnnees) % nbAnnees
  const etapeAttendue = offset + 1

  const detail = rotation.details.find((d) => d.annee === etapeAttendue)
  const familleAttendue = detail?.itp?.espece?.familleId ?? null
  if (!familleAttendue) return null // pas assez d'info pour décider

  // Famille botanique de l'espèce demandée.
  const espece = await tx.espece.findUnique({
    where: { id: especeId },
    select: { familleId: true },
  })
  const familleDemandee = espece?.familleId ?? null

  if (familleDemandee && familleAttendue === familleDemandee) return null

  return {
    rotationId: rotation.id,
    etapeAttendue,
    familleAttendue,
    familleDemandee,
    message:
      `La planche suit la rotation « ${rotation.id} » et attendait une espèce de la famille ` +
      `« ${familleAttendue} » à l'étape ${etapeAttendue}/${nbAnnees}. ` +
      `Vous plantez « ${familleDemandee ?? "famille inconnue"} ». Continuer ?`,
  }
}
