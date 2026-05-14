/**
 * API Routes pour une Zone de verger spécifique
 * PUT /api/arbres/zones/:id - Modifier une zone
 * DELETE /api/arbres/zones/:id - Supprimer une zone
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const zoneId = parseInt(id)
    const body = await request.json()

    // Vérifier que la zone appartient à l'utilisateur
    const existing = await prisma.zoneVerger.findFirst({
      where: { id: zoneId, userId: session!.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Zone non trouvée" }, { status: 404 })
    }

    const zone = await prisma.zoneVerger.update({
      where: { id: zoneId },
      data: {
        nom: body.nom?.trim() || existing.nom,
        type: body.type ?? existing.type,
        surface: body.surface !== undefined ? (body.surface ? parseFloat(body.surface) : null) : existing.surface,
        exposition: body.exposition !== undefined ? body.exposition : existing.exposition,
        altitude: body.altitude !== undefined ? (body.altitude ? parseInt(body.altitude) : null) : existing.altitude,
        protectionVent: body.protectionVent !== undefined ? body.protectionVent : existing.protectionVent,
        typeSol: body.typeSol !== undefined ? body.typeSol : existing.typeSol,
        irrigation: body.irrigation !== undefined ? body.irrigation : existing.irrigation,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
    })

    return NextResponse.json(zone)
  } catch (err) {
    console.error("PUT /api/arbres/zones error:", err)
    return NextResponse.json({ error: "Erreur lors de la modification de la zone" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const zoneId = parseInt(id)

    const existing = await prisma.zoneVerger.findFirst({
      where: { id: zoneId, userId: session!.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Zone non trouvée" }, { status: 404 })
    }

    // Dissocier les arbres de la zone avant suppression
    await prisma.arbre.updateMany({
      where: { zoneId: zoneId },
      data: { zoneId: null },
    })

    await prisma.zoneVerger.delete({ where: { id: zoneId } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/arbres/zones error:", err)
    return NextResponse.json({ error: "Erreur lors de la suppression de la zone" }, { status: 500 })
  }
}
