/**
 * API Etapes d'une campagne
 * GET - Liste des etapes
 * POST - Ajouter une etape
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const { id } = await params
  const campagneId = parseInt(id, 10)
  if (isNaN(campagneId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 })
  }

  const campagne = await prisma.campagnePlantation.findFirst({
    where: { id: campagneId, userId: session!.user.id },
    select: { id: true },
  })
  if (!campagne) {
    return NextResponse.json({ error: "Campagne non trouvée" }, { status: 404 })
  }

  const etapes = await prisma.etapeCampagne.findMany({
    where: { campagneId, userId: session!.user.id },
    orderBy: [{ ordre: "asc" }, { datePrevue: "asc" }],
  })
  return NextResponse.json(etapes)
}

export async function POST(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const { id } = await params
  const campagneId = parseInt(id, 10)
  if (isNaN(campagneId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 })
  }

  const campagne = await prisma.campagnePlantation.findFirst({
    where: { id: campagneId, userId: session!.user.id },
    select: { id: true },
  })
  if (!campagne) {
    return NextResponse.json({ error: "Campagne non trouvée" }, { status: 404 })
  }

  const body = await request.json()
  if (!body.type) {
    return NextResponse.json({ error: "Le type est requis" }, { status: 400 })
  }

  const lastOrdre = await prisma.etapeCampagne.findFirst({
    where: { campagneId },
    orderBy: { ordre: "desc" },
    select: { ordre: true },
  })

  const etape = await prisma.etapeCampagne.create({
    data: {
      userId: session!.user.id,
      campagneId,
      type: body.type,
      ordre: body.ordre ?? (lastOrdre ? lastOrdre.ordre + 1 : 0),
      description: body.description || null,
      datePrevue: body.datePrevue ? new Date(body.datePrevue) : null,
      dateRealisation: body.dateRealisation ? new Date(body.dateRealisation) : null,
      fait: body.fait || false,
      cout: body.cout ? parseFloat(body.cout) : null,
      dureeMinutes: body.dureeMinutes ? parseInt(body.dureeMinutes) : null,
      nbPersonnes: body.nbPersonnes ? parseInt(body.nbPersonnes) : null,
      produit: body.produit || null,
      quantite: body.quantite ? parseFloat(body.quantite) : null,
      unite: body.unite || null,
      notes: body.notes || null,
    },
  })

  return NextResponse.json(etape, { status: 201 })
}
