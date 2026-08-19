/**
 * Détection de violation du plan de rotation à la création d'une culture.
 *
 * Une rotation est définie par :
 *   - Rotation.nbAnnees   (cycle, ex: 4 ans)
 *   - RotationDetail[]    (étape 1..nbAnnees, chaque étape lie à un ITP)
 *
 * On considère qu'une planche « en étape N de la rotation » attend une culture
 * de la même famille botanique que celle prévue à cette étape.
 *
 * Position dans le cycle (QA cmsg52uzr, 2026-08-05) : aucune année d'ancrage
 * n'est stockée. L'implémentation précédente prenait `Planche.annee` pour un
 * ancrage, alors que ce champ porte l'année de TRAVAIL de la planche — il vaut
 * l'année courante sur toutes les planches du compte, donc l'écart avec l'année
 * cible était toujours nul et l'étape attendue toujours la première. Résultat
 * mesuré : sur les planches C, toute espèce non Cucurbitaceae déclenchait le
 * warning, quelle que soit l'année.
 *
 * L'étape est désormais DÉDUITE de l'historique : la culture la plus récente
 * dont la famille identifie une étape unique du cycle sert de repère, et le
 * cycle est déroulé à partir d'elle. Sans repère exploitable, on ne prétend
 * pas connaître la position et on ne signale rien — un warning faux coûte plus
 * cher qu'un warning absent, puisqu'il pousse l'agriculteur à confirmer par
 * réflexe et vide le signal de son sens.
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

/** Culture connue sur la planche, réduite à ce qui sert au calcul du cycle. */
export type CultureHistorique = {
  annee: number | null
  familleId: string | null
}

export type EtapeCycle = {
  etape: number
  familleAttendue: string
}

/**
 * Étape du cycle pour `annee`, déduite de l'historique de la planche.
 *
 * `familleParEtape` mappe 1..nbAnnees → famille attendue. Le repère retenu est
 * la culture la plus récente (année ≤ `annee`) dont la famille correspond à une
 * étape et une seule : une famille présente à deux étapes du cycle ne permet pas
 * de trancher, l'inclure fabriquerait un ancrage arbitraire.
 *
 * Exporté pour être testable sans base.
 */
export function etapePourAnnee(
  annee: number,
  nbAnnees: number,
  familleParEtape: Map<number, string>,
  historique: CultureHistorique[]
): EtapeCycle | null {
  if (nbAnnees < 1 || familleParEtape.size === 0) return null

  const etapesParFamille = new Map<string, number[]>()
  for (const [etape, famille] of familleParEtape) {
    const etapes = etapesParFamille.get(famille)
    if (etapes) etapes.push(etape)
    else etapesParFamille.set(famille, [etape])
  }

  let repere: { annee: number; etape: number } | null = null
  for (const culture of historique) {
    if (culture.annee == null || culture.familleId == null) continue
    if (culture.annee > annee) continue
    const etapes = etapesParFamille.get(culture.familleId)
    if (!etapes || etapes.length !== 1) continue
    if (!repere || culture.annee > repere.annee) {
      repere = { annee: culture.annee, etape: etapes[0] }
    }
  }
  if (!repere) return null

  const decalage = annee - repere.annee
  const index = (((repere.etape - 1 + decalage) % nbAnnees) + nbAnnees) % nbAnnees
  const etape = index + 1
  const familleAttendue = familleParEtape.get(etape)
  if (!familleAttendue) return null
  return { etape, familleAttendue }
}

/**
 * Inspecte la rotation de la planche cible. Retourne null si pas de violation,
 * sinon un objet décrivant la violation.
 *
 * @param plancheId   ID de la planche cible (peut être null → pas de check).
 * @param especeId    ID de l'espèce à planter.
 * @param annee       Année cible de la culture.
 * @param userId      Propriétaire attendu. La planche et son historique sont
 *                    lus sous ce filtre : sans lui, le message de violation
 *                    révélait le plan de rotation d'un autre compte à qui
 *                    postait l'identifiant d'une planche étrangère.
 */
export async function checkRotationViolation(
  plancheId: string | null | undefined,
  especeId: string,
  annee: number,
  userId?: string | null,
  tx: Tx = prisma
): Promise<RotationViolation | null> {
  if (!plancheId) return null

  const planche = await tx.planche.findFirst({
    where: {
      id: plancheId,
      ...(userId ? { userId } : {}),
    },
    select: {
      id: true,
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

  const familleParEtape = new Map<number, string>()
  for (const detail of rotation.details) {
    const famille = detail.itp?.espece?.familleId
    if (detail.annee != null && famille) familleParEtape.set(detail.annee, famille)
  }
  if (familleParEtape.size === 0) return null

  // Famille botanique de l'espèce demandée. Une famille inconnue ne permet
  // aucune comparaison : ne rien affirmer plutôt que signaler à tort.
  const espece = await tx.espece.findUnique({
    where: { id: especeId },
    select: { familleId: true },
  })
  const familleDemandee = espece?.familleId ?? null
  if (!familleDemandee) return null

  const cultures = await tx.culture.findMany({
    where: {
      plancheId: planche.id,
      ...(userId ? { userId } : {}),
    },
    select: { annee: true, espece: { select: { familleId: true } } },
  })
  const historique: CultureHistorique[] = cultures.map((c) => ({
    annee: c.annee,
    familleId: c.espece?.familleId ?? null,
  }))

  const cycle = etapePourAnnee(annee, nbAnnees, familleParEtape, historique)
  if (!cycle) return null

  if (familleDemandee === cycle.familleAttendue) return null

  // Succession : l'étape de l'année est déjà honorée par une culture en place.
  // Une rotation cadence UNE culture principale par an ; le second cycle
  // derrière une récolte n'a pas à rejouer la famille de l'étape. Cas prouvé
  // (QA cmsg52uzr) : C4 portait un Concombre récolté le 28/07/2026 — l'étape
  // Cucurbitaceae de 2026 était remplie — et un pourpier semé le 05/08 était
  // malgré tout annoncé « plan de rotation non respecté ».
  const etapeDejaHonoree = historique.some(
    (c) => c.annee === annee && c.familleId === cycle.familleAttendue
  )
  if (etapeDejaHonoree) return null

  return {
    rotationId: rotation.id,
    etapeAttendue: cycle.etape,
    familleAttendue: cycle.familleAttendue,
    familleDemandee,
    message:
      `La planche suit la rotation « ${rotation.id} » et attendait une espèce de la famille ` +
      `« ${cycle.familleAttendue} » à l'étape ${cycle.etape}/${nbAnnees} (${annee}). ` +
      `Vous plantez « ${familleDemandee} ». Continuer ?`,
  }
}
