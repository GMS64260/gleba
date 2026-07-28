import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"

const querySchema = z.object({
  key: z.string().min(5).max(300),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error

  const params = new URL(request.url).searchParams
  const parsed = querySchema.safeParse({
    key: params.get("key"),
    limit: params.get("limit") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 })
  }

  const evenements = await prisma.declarationReglementaireEvenement.findMany({
    where: {
      userId: session.user.id,
      declarationKey: parsed.data.key,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: parsed.data.limit,
    select: {
      id: true,
      action: true,
      actorUserId: true,
      statutAvant: true,
      statutApres: true,
      snapshotHash: true,
      metadata: true,
      createdAt: true,
    },
  })
  const acteurs = await prisma.user.findMany({
    where: { id: { in: [...new Set(evenements.map((item) => item.actorUserId))] } },
    select: { id: true, name: true, email: true },
  })
  const acteurParId = new Map(
    acteurs.map((acteur) => [acteur.id, acteur.name || acteur.email]),
  )

  return NextResponse.json({
    data: evenements.map((evenement) => ({
      ...evenement,
      actorLabel: acteurParId.get(evenement.actorUserId) ?? evenement.actorUserId,
    })),
  })
}
