/**
 * PROMPT 12 — Endpoint dédié pour gérer les planches rattachées à une rotation.
 *
 * PUT /api/rotations/[id]/planches  body { plancheIds: string[] }
 *   Remplace l'ensemble des planches rattachées à la rotation.
 *   - Les planches absentes de la liste sont détachées (rotationId=null).
 *   - Les planches présentes sont attachées (rotationId=<id>).
 *   Limité aux planches du user authentifié.
 *
 * PUT /api/rotations/[id]/planches  body { ajouts: string[], retraits: string[] }
 *   N'applique que les cases changées depuis l'ouverture de l'écran. Remplacer
 *   toute la liste faisait détacher par un onglet resté ouvert la planche qu'un
 *   autre venait de rattacher (équipe debug, D158). L'écran envoie cette forme ;
 *   `plancheIds` reste lu pour les appelants qui remplacent tout.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const { id: rotationId } = await params
  const body = await request.json().catch(() => null)
  const identifiants = (valeur: unknown): string[] =>
    Array.isArray(valeur) ? valeur.filter((v): v is string => typeof v === "string") : []
  const parDifference = Array.isArray(body?.ajouts) || Array.isArray(body?.retraits)
  const ajouts = identifiants(body?.ajouts)
  const retraits = identifiants(body?.retraits).filter((id) => !ajouts.includes(id))
  const plancheIds = identifiants(body?.plancheIds)

  const rotation = await prisma.rotation.findUnique({ where: { id: rotationId } })
  if (!rotation) {
    return NextResponse.json({ error: "Rotation introuvable" }, { status: 404 })
  }

  const userId = session!.user.id

  const aucuneEcriture = prisma.planche.updateMany({ where: { id: "__noop__" }, data: {} })
  if (parDifference) {
    await prisma.$transaction([
      // Un retrait ne détache que de CETTE rotation : la planche qu'un autre
      // écran a déjà passée à une autre rotation n'est pas touchée.
      retraits.length > 0
        ? prisma.planche.updateMany({ where: { userId, rotationId, id: { in: retraits } }, data: { rotationId: null } })
        : aucuneEcriture,
      ajouts.length > 0
        ? prisma.planche.updateMany({ where: { userId, id: { in: ajouts } }, data: { rotationId } })
        : aucuneEcriture,
    ])
  } else await prisma.$transaction([
    // Détache toutes les planches actuellement liées (du même user uniquement).
    prisma.planche.updateMany({
      where: { userId, rotationId },
      data: { rotationId: null },
    }),
    // Attache les nouvelles planches demandées (uniquement celles du user).
    plancheIds.length > 0
      ? prisma.planche.updateMany({
          where: { userId, id: { in: plancheIds } },
          data: { rotationId },
        })
      : aucuneEcriture,
  ])

  const planches = await prisma.planche.findMany({
    where: { userId, rotationId },
    select: { id: true, nom: true, ilot: true, longueur: true, largeur: true },
    orderBy: { nom: "asc" },
  })

  return NextResponse.json({ planches, count: planches.length })
}
