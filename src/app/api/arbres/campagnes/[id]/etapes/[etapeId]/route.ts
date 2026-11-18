/**
 * API Etape individuelle d'une campagne
 * PUT - Marquer fait, modifier
 * DELETE - Supprimer
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { createDepenseFromCampagnePlantation } from "@/lib/auto-compta"
import { invalidateKpi } from "@/lib/kpi/cache"
import { verrouillerReglements } from "@/lib/comptabilite/verrou-reglements"
import { ErreurReglement } from "@/lib/comptabilite/monnaie"
import { resoudrePlantationEtape } from "@/lib/verger/plantation-etape"

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
  const userId = session!.user.id
  try {
    const { etape, miroirRegenere } = await prisma.$transaction(async (tx) => {
      // COM-05 : même ordre que les règlements et le PUT campagne. Relire
      // après verrouillage : la première lecture ne prouve que l'existence.
      await verrouillerReglements(tx, userId)
      await tx.$queryRaw`SELECT id FROM campagnes_plantation WHERE id = ${campagneId} AND user_id = ${userId} FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM etapes_campagne WHERE id = ${eId} AND campagne_id = ${campagneId} AND user_id = ${userId} FOR UPDATE`
      const courante = await tx.etapeCampagne.findFirst({ where: { id: eId, campagneId, userId } })
      const campagne = await tx.campagnePlantation.findFirst({
        where: { id: campagneId, userId },
        select: { statut: true, datePlantationReelle: true },
      })
      if (!courante || !campagne) return { etape: null, miroirRegenere: false }
      const plantation = resoudrePlantationEtape(courante, campagne, {
        type: body.type,
        fait: body.fait,
        dateRealisation: body.dateRealisation !== undefined ? (body.dateRealisation ? new Date(body.dateRealisation) : null) : undefined,
      })
      const etape = await tx.etapeCampagne.update({
        where: { id: eId, campagneId, userId },
        data: {
          type: body.type !== undefined ? body.type : undefined,
          ordre: body.ordre !== undefined ? body.ordre : undefined,
          description: body.description !== undefined ? (body.description || null) : undefined,
          datePrevue: body.datePrevue !== undefined ? (body.datePrevue ? new Date(body.datePrevue) : null) : undefined,
          dateRealisation: plantation.dateRealisation,
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

      if (!plantation.campagne) return { etape, miroirRegenere: false }
      const source = await tx.campagnePlantation.update({
        where: { id: campagneId, userId },
        data: plantation.campagne,
      })
      // COM-05 : la dépense miroir du coût de la campagne est datée par la
      // plantation réelle, sinon prévue, sinon la création. Sans cette
      // régénération, le FEC et les indicateurs gardaient l'ancienne date,
      // parfois sur un autre exercice. Règle de TVA inchangée.
      await createDepenseFromCampagnePlantation(userId, {
        id: source.id,
        nom: source.nom,
        coutReel: source.coutReel,
        datePlantationReelle: source.datePlantationReelle,
        datePlantationPrevue: source.datePlantationPrevue,
        createdAt: source.createdAt,
      }, tx)
      return { etape, miroirRegenere: true }
    }, { isolationLevel: "ReadCommitted" })
    if (!etape) return NextResponse.json({ error: "Étape non trouvée" }, { status: 404 })
    if (miroirRegenere) invalidateKpi(userId)
    return NextResponse.json(etape)
  } catch (err) {
    if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }
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
