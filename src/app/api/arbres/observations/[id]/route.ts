/**
 * API Routes pour une Observation de santé spécifique
 * PUT /api/arbres/observations/:id - Modifier (toggle résolu, etc.)
 * DELETE /api/arbres/observations/:id - Supprimer
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const obsId = parseInt(id)
    const body = await request.json()

    const existing = await prisma.observationSante.findFirst({
      where: { id: obsId, userId: session!.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Observation non trouvée" }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.type !== undefined) data.type = body.type
    if (body.symptome !== undefined) data.symptome = body.symptome
    if (body.diagnostic !== undefined) data.diagnostic = body.diagnostic
    if (body.gravite !== undefined) data.gravite = body.gravite
    if (body.organe !== undefined) data.organe = body.organe
    if (body.traitement !== undefined) data.traitement = body.traitement
    if (body.methodeTraitement !== undefined) data.methodeTraitement = body.methodeTraitement
    if (body.produit !== undefined) data.produit = body.produit
    if (body.doseAppliquee !== undefined) data.doseAppliquee = body.doseAppliquee ? parseFloat(body.doseAppliquee) : null
    if (body.uniteDose !== undefined) data.uniteDose = body.uniteDose
    if (body.dar !== undefined) data.dar = body.dar ? parseInt(body.dar) : null
    if (body.numAMM !== undefined) data.numAMM = body.numAMM
    if (body.notes !== undefined) data.notes = body.notes
    // PROMPT 11 LOT D — PBI
    if (body.stadeBBCH !== undefined) data.stadeBBCH = body.stadeBBCH || null
    if (body.pctOrganesTouches !== undefined) data.pctOrganesTouches = body.pctOrganesTouches == null ? null : parseInt(body.pctOrganesTouches)
    if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl || null
    if (body.resolu !== undefined) {
      data.resolu = body.resolu
      if (body.resolu && !existing.dateResolution) {
        data.dateResolution = new Date()
      }
      if (!body.resolu) {
        data.dateResolution = null
      }
    }

    const observation = await prisma.observationSante.update({
      where: { id: obsId },
      data,
      include: {
        arbre: { select: { id: true, nom: true, type: true } },
      },
    })

    return NextResponse.json(observation)
  } catch (err) {
    console.error("PUT /api/arbres/observations error:", err)
    return NextResponse.json({ error: "Erreur lors de la modification de l'observation" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const obsId = parseInt(id)

    const existing = await prisma.observationSante.findFirst({
      where: { id: obsId, userId: session!.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Observation non trouvée" }, { status: 404 })
    }

    await prisma.observationSante.delete({ where: { id: obsId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/arbres/observations error:", err)
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 })
  }
}
