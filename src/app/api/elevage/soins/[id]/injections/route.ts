import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { ajouterJours, derniereInjectionActive } from "@/lib/elevage/injections"
import { ciblesAffectees, resyncEcartementLait } from "@/lib/elevage/attente-lait"

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
    const updated = await tx.soinAnimal.update({
      where: { id: soinId },
      data: {
        fait: commence,
        finAttenteLait: commence && derniere ? ajouterJours(derniere, soin.tempsAttenteLaitJ) : null,
        finAttenteViande: commence && derniere ? ajouterJours(derniere, soin.tempsAttenteViandeJ) : null,
      },
    })
    const cibles = await ciblesAffectees(tx, session.user.id, soin.animalId, soin.lotId)
    const dates = [soin.date, beforeMax, updated.finAttenteLait].filter((d): d is Date => d != null)
    if (dates.length > 0) {
      const min = new Date(Math.min(...dates.map((d) => d.getTime())))
      const max = new Date(Math.max(...dates.map((d) => d.getTime())))
      await resyncEcartementLait(tx, session.user.id, cibles, min, max)
    }
    return { ...updated, injections }
  })
  return NextResponse.json({ data: result })
}
