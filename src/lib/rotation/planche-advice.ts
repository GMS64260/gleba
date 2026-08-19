/**
 * Conseil de rotation d'une planche : chargement des données + calcul.
 *
 * QA cmsfyxhk5 (2026-08-07) — l'assistant IA ne disposait que de la séquence
 * brute du plan (`get_rotations`) et redérivait lui-même le retour autorisé
 * d'une famille. Sur la planche B5 il annonçait « éviter 2027, 2028 et 2029,
 * attendre 2030 » quand la fiche planche affiche « Cucurbitaceae planté en 2026,
 * attendre 2029 » : deux conventions de comptage pour la même donnée. Le calcul
 * est donc extrait ici et devient la seule source, partagée par
 * GET /api/planches/[id]/rotation-advice et par l'outil de l'assistant.
 */

import prisma from '@/lib/prisma'
import { calculateRotationAdvice } from '@/lib/rotation'
import { checkRotationViolation } from '@/lib/rotation-check'
import { resoudreIdPlanche } from '@/lib/planches/resolution'
import type { RotationAdvice } from '@/lib/rotation/types'

export interface ConseilRotationPlanche {
  planche: { id: string; nom: string }
  advice: RotationAdvice
}

/**
 * `reference` accepte l'identifiant de la planche ; son nom reste toléré en
 * repli. `especeId` déclenche en plus le verdict de conformité au plan, produit
 * par la même fonction que POST /api/cultures.
 */
export async function conseilRotationPlanche(
  reference: string,
  userId: string,
  targetYear: number,
  especeId?: string | null
): Promise<ConseilRotationPlanche | null> {
  const resolu = await resoudreIdPlanche(prisma, reference, userId)
  const planche = resolu
    ? await prisma.planche.findUnique({ where: { id: resolu } })
    : null
  if (!planche) return null

  // Historique sur 10 ans : assez pour couvrir tout intervalle de retour.
  // QA cmsw8pzzw (2026-08-16) — borne haute `lte: targetYear` : une culture
  // d'année future (plan de rotation matérialisé par creer-cultures) n'est pas
  // un précédent cultural acquis et ne doit ni bloquer une famille ni figurer
  // dans les cultures récentes de l'année visée.
  const cultures = await prisma.culture.findMany({
    where: {
      plancheId: planche.id,
      userId,
      annee: { gte: targetYear - 10, lte: targetYear },
    },
    include: { espece: { include: { famille: true } } },
  })

  const allFamilies = await prisma.famille.findMany()

  const culturesData = cultures.map((c) => ({
    annee: c.annee || targetYear,
    especeId: c.especeId,
    espece: {
      id: c.especeId,
      familleId: c.espece.familleId,
      famille: c.espece.famille
        ? {
            id: c.espece.famille.id,
            intervalle: c.espece.famille.intervalle ?? 4,
            couleur: c.espece.famille.couleur,
          }
        : null,
      besoinN: c.espece.besoinN,
      besoinP: c.espece.besoinP,
      besoinK: c.espece.besoinK,
    },
  }))

  const familiesData = allFamilies.map((f) => ({
    id: f.id,
    intervalle: f.intervalle ?? 4,
    couleur: f.couleur,
    nomFr: f.nomFr,
  }))

  let especeToCheck = undefined
  if (especeId) {
    const espece = await prisma.espece.findUnique({ where: { id: especeId } })
    if (espece) {
      especeToCheck = {
        id: espece.id,
        familleId: espece.familleId,
        besoinN: espece.besoinN,
      }
    }
  }

  const advice = calculateRotationAdvice({
    plancheId: reference,
    targetYear,
    cultures: culturesData,
    allFamilies: familiesData,
    especeToCheck,
  })

  // QA cmsg52uzr — le verdict de conformité au plan vient de la MÊME fonction
  // que celle appliquée par POST /api/cultures, pour que l'indicateur affiché
  // avant sauvegarde ne puisse plus contredire la validation finale.
  if (especeId && especeToCheck) {
    const violation = await checkRotationViolation(
      planche.id,
      especeId,
      targetYear,
      userId
    )
    advice.planRotation = violation
      ? {
          conforme: false,
          etapeAttendue: violation.etapeAttendue,
          familleAttendue: violation.familleAttendue,
          message: violation.message,
        }
      : { conforme: true }
  }

  return { planche: { id: planche.id, nom: planche.nom }, advice }
}
