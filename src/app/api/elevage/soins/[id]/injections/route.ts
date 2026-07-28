import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { ajouterJours, derniereInjectionActive } from "@/lib/elevage/injections"
import { ciblesAffectees, resyncEcartementLait } from "@/lib/elevage/attente-lait"
import { createDepenseFromSoinAnimal } from "@/lib/auto-compta"
import { invalidateKpi } from "@/lib/kpi"

const patchSchema = z.object({
  injectionId: z.string().min(1),
  statut: z.enum(["a_faire", "realisee", "annulee"]),
  dateRealisee: z.coerce.date().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const parsed = patchSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 })
  }
  const soinId = Number((await params).id)
  if (!Number.isInteger(soinId)) return NextResponse.json({ error: "Soin invalide" }, { status: 400 })

  const soin = await prisma.soinAnimal.findFirst({ where: { id: soinId, userId: session.user.id } })
  if (!soin) return NextResponse.json({ error: "Soin introuvable" }, { status: 404 })
  const injection = await prisma.$queryRaw<Array<{
    id: string; numero: number; datePrevue: Date; dateRealisee: Date | null; statut: string
  }>>`
    SELECT id, numero, date_prevue AS "datePrevue", date_realisee AS "dateRealisee", statut
    FROM injections_soins
    WHERE id = ${parsed.data.injectionId} AND soin_id = ${soinId} AND user_id = ${session.user.id}
  `
  if (injection.length === 0) {
    return NextResponse.json({ error: "Injection introuvable" }, { status: 404 })
  }

  const beforeMax = soin.finAttenteLait
  try {
    const result = await prisma.$transaction(async (tx) => {
    const dateRealisee = parsed.data.statut === "realisee"
      ? parsed.data.dateRealisee ?? new Date()
      : null
    await tx.$executeRaw`
      UPDATE injections_soins
      SET statut = ${parsed.data.statut}, date_realisee = ${dateRealisee}, updated_at = NOW()
      WHERE id = ${parsed.data.injectionId} AND soin_id = ${soinId} AND user_id = ${session.user.id}
    `
    const injections = await tx.$queryRaw<Array<{
      id: string; numero: number; datePrevue: Date; dateRealisee: Date | null; statut: string
    }>>`
      SELECT id, numero, date_prevue AS "datePrevue", date_realisee AS "dateRealisee", statut
      FROM injections_soins WHERE soin_id = ${soinId} AND user_id = ${session.user.id}
      ORDER BY numero
    `
    const commence = injections.some((i) => i.statut === "realisee")
    const derniere = derniereInjectionActive(injections)
    let quantitePreleveeStock = soin.quantitePreleveeStock
    if (commence && !soin.fait && soin.stockMedicamentId && quantitePreleveeStock <= 0) {
      const quantite = soin.quantite ?? 0
      if (quantite <= 0) throw new Error("QUANTITE_MEDICAMENT_REQUISE")
      const decremente = await tx.stockMedicamentElevage.updateMany({
        where: {
          id: soin.stockMedicamentId,
          userId: session.user.id,
          quantite: { gte: quantite },
          OR: [
            { datePeremption: null },
            { datePeremption: { gte: dateRealisee ?? soin.date } },
          ],
        },
        data: { quantite: { decrement: quantite } },
      })
      if (decremente.count !== 1) throw new Error("STOCK_MEDICAMENT_INDISPONIBLE")
      quantitePreleveeStock = quantite
    } else if (!commence && soin.fait && soin.stockMedicamentId && quantitePreleveeStock > 0) {
      await tx.stockMedicamentElevage.update({
        where: { id: soin.stockMedicamentId },
        data: { quantite: { increment: quantitePreleveeStock } },
      })
      quantitePreleveeStock = 0
    }
    const updated = await tx.soinAnimal.update({
      where: { id: soinId },
      data: {
        fait: commence,
        finAttenteLait: commence && derniere ? ajouterJours(derniere, soin.tempsAttenteLaitJ) : null,
        finAttenteViande: commence && derniere ? ajouterJours(derniere, soin.tempsAttenteViandeJ) : null,
        quantitePreleveeStock,
      },
    })
    const cibles = await ciblesAffectees(tx, session.user.id, soin.animalId, soin.lotId)
    const dates = [soin.date, beforeMax, updated.finAttenteLait].filter((d): d is Date => d != null)
    if (dates.length > 0) {
      const min = new Date(Math.min(...dates.map((d) => d.getTime())))
      const max = new Date(Math.max(...dates.map((d) => d.getTime())))
      await resyncEcartementLait(tx, session.user.id, cibles, min, max)
    }
    await createDepenseFromSoinAnimal(session.user.id, {
      id: updated.id,
      type: updated.type,
      cout: updated.cout,
      date: updated.date,
      fait: updated.fait,
    }, tx)
    return { ...updated, injections }
    })
    invalidateKpi(session.user.id)
    return NextResponse.json({ data: result })
  } catch (transactionError) {
    if (transactionError instanceof Error && transactionError.message === "QUANTITE_MEDICAMENT_REQUISE") {
      return NextResponse.json(
        { error: "Renseignez la quantité de médicament avant de réaliser l'injection." },
        { status: 422 },
      )
    }
    if (transactionError instanceof Error && transactionError.message === "STOCK_MEDICAMENT_INDISPONIBLE") {
      return NextResponse.json(
        { error: "Le lot de pharmacie est épuisé, insuffisant ou périmé." },
        { status: 422 },
      )
    }
    console.error("PATCH /api/elevage/soins/[id]/injections error:", transactionError)
    return NextResponse.json({ error: "Mise à jour impossible" }, { status: 500 })
  }
}
