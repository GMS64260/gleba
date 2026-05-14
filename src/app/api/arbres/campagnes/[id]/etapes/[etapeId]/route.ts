/**
 * API Etape individuelle d'une campagne
 * PUT - Marquer fait, modifier
 * DELETE - Supprimer
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

interface Params {
  params: Promise<{ id: string; etapeId: string }>
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const { id, etapeId } = await params
  const campagneId = parseInt(id, 10)
  const eId = parseInt(etapeId, 10)
  if (isNaN(campagneId) || isNaN(eId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 })
  }

  const existing = await prisma.etapeCampagne.findFirst({
    where: { id: eId, campagneId, userId: session!.user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Étape non trouvée" }, { status: 404 })
  }

  const body = await request.json()

  const etape = await prisma.etapeCampagne.update({
    where: { id: eId },
    data: {
      type: body.type !== undefined ? body.type : undefined,
      ordre: body.ordre !== undefined ? body.ordre : undefined,
      description: body.description !== undefined ? (body.description || null) : undefined,
      datePrevue: body.datePrevue !== undefined ? (body.datePrevue ? new Date(body.datePrevue) : null) : undefined,
      dateRealisation: body.dateRealisation !== undefined ? (body.dateRealisation ? new Date(body.dateRealisation) : null) : undefined,
      fait: body.fait !== undefined ? body.fait : undefined,
      cout: body.cout !== undefined ? (body.cout ? parseFloat(body.cout) : null) : undefined,
      dureeMinutes: body.dureeMinutes !== undefined ? (body.dureeMinutes ? parseInt(body.dureeMinutes) : null) : undefined,
      nbPersonnes: body.nbPersonnes !== undefined ? (body.nbPersonnes ? parseInt(body.nbPersonnes) : null) : undefined,
      produit: body.produit !== undefined ? (body.produit || null) : undefined,
      quantite: body.quantite !== undefined ? (body.quantite ? parseFloat(body.quantite) : null) : undefined,
      unite: body.unite !== undefined ? (body.unite || null) : undefined,
      notes: body.notes !== undefined ? (body.notes || null) : undefined,
    },
  })
  return NextResponse.json(etape)
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const { id, etapeId } = await params
  const campagneId = parseInt(id, 10)
  const eId = parseInt(etapeId, 10)
  if (isNaN(campagneId) || isNaN(eId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 })
  }

  const existing = await prisma.etapeCampagne.findFirst({
    where: { id: eId, campagneId, userId: session!.user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Étape non trouvée" }, { status: 404 })
  }

  await prisma.etapeCampagne.delete({ where: { id: eId } })
  return NextResponse.json({ success: true })
}
