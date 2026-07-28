import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import {
  datesLotOeufs,
  statutLotOeufs,
  stockRestantLotOeufs,
} from "@/lib/elevage/stock-oeufs"

const sortieSchema = z.object({
  productionId: z.coerce.number().int().positive(),
  date: z.coerce.date().optional(),
  type: z.enum(["vente", "autoconsommation", "don", "destruction", "casse", "ajustement"]),
  quantite: z.coerce.number().int().positive().max(100_000),
  notes: z.string().trim().max(1000).nullable().optional(),
})

export async function GET() {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const now = new Date()
  const productions = await prisma.productionOeuf.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "asc" },
    take: 2000,
    include: {
      lot: { select: { id: true, nom: true } },
      mouvementsStock: {
        orderBy: { date: "asc" },
        select: { id: true, date: true, type: true, quantite: true, notes: true },
      },
    },
  })
  const lots = productions.map((production) => {
    const restant = stockRestantLotOeufs({
      quantite: production.quantite,
      casses: production.casses,
      sales: production.sales,
      sorties: production.mouvementsStock,
    })
    const dates = datesLotOeufs(production.date)
    return {
      id: production.id,
      datePonte: production.date,
      lot: production.lot,
      calibre: production.calibre,
      quantiteInitiale: production.quantite,
      restant,
      limiteVente: dates.limiteVente,
      dcr: dates.dcr,
      statut: statutLotOeufs(production.date, now),
      mouvements: production.mouvementsStock,
    }
  })
  const actifs = lots.filter((lot) => lot.restant > 0)
  const somme = (statut: string) => actifs
    .filter((lot) => lot.statut === statut)
    .reduce((total, lot) => total + lot.restant, 0)
  return NextResponse.json({
    data: actifs.sort((a, b) => new Date(a.dcr).getTime() - new Date(b.dcr).getTime()),
    stats: {
      commercialisables: somme("commercialisable"),
      aConsommer: somme("a_consumer"),
      perimes: somme("perime"),
      stockPhysique: actifs.reduce((total, lot) => total + lot.restant, 0),
    },
  })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const parsed = sortieSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides" }, { status: 400 })
  }
  const input = parsed.data
  const production = await prisma.productionOeuf.findFirst({
    where: { id: input.productionId, userId: session.user.id },
    include: { mouvementsStock: { select: { quantite: true } } },
  })
  if (!production) return NextResponse.json({ error: "Lot de ponte introuvable" }, { status: 404 })
  const dateSortie = input.date ?? new Date()
  if (dateSortie.getTime() < production.date.getTime()) {
    return NextResponse.json(
      { error: "La sortie ne peut pas précéder la date de ponte." },
      { status: 422 },
    )
  }
  if (input.type === "vente" && statutLotOeufs(production.date, dateSortie) !== "commercialisable") {
    return NextResponse.json(
      { error: "La vente est interdite après la date limite de vente (J+21)." },
      { status: 422 },
    )
  }
  const restant = stockRestantLotOeufs({
    quantite: production.quantite,
    casses: production.casses,
    sales: production.sales,
    sorties: production.mouvementsStock,
  })
  if (input.quantite > restant) {
    return NextResponse.json(
      { error: `Sortie impossible : ${restant} œuf(s) seulement restent dans ce lot.` },
      { status: 422 },
    )
  }
  const data = await prisma.mouvementStockOeuf.create({
    data: {
      userId: session.user.id,
      productionId: input.productionId,
      date: dateSortie,
      type: input.type,
      quantite: input.quantite,
      notes: input.notes || null,
    },
  })
  return NextResponse.json({ data }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 })
  const existing = await prisma.mouvementStockOeuf.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: "Mouvement introuvable" }, { status: 404 })
  await prisma.mouvementStockOeuf.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
