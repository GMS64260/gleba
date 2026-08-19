import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import {
  statutLotOeufs,
  stockRestantLotOeufs,
} from "@/lib/elevage/stock-oeufs"
import { blocagesVetoPontes, computeStockOeufsParLots } from "@/lib/elevage/stock-oeufs-lots"

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
  // Le calcul vit dans src/lib/elevage/stock-oeufs-lots.ts (SSOT partagée
  // avec l'outil assistant `get_stock_oeufs`) — lot assistant 2026-08-11.
  return NextResponse.json(await computeStockOeufsParLots(session.user.id))
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
  if (input.type === "vente") {
    // Ticket cmsoeyhs5 — des œufs pondus pendant le délai d'attente vétérinaire
    // d'un soin fait (finAttenteOeufs) couvrant le lot/l'animal ne sont JAMAIS
    // commercialisables : même règle que l'écran et l'assistant
    // (src/lib/elevage/stock-oeufs-lots.ts).
    const blocages = await blocagesVetoPontes(prisma, session.user.id, [{
      id: production.id,
      date: production.date,
      lotId: production.lotId,
      animalId: production.animalId,
    }])
    const blocage = blocages.get(production.id)
    if (blocage) {
      return NextResponse.json(
        {
          error: `Vente interdite : ces œufs ont été pondus pendant un délai d'attente vétérinaire. Seules les pontes à partir du ${blocage.remiseEnVente.toLocaleDateString("fr-FR", { timeZone: "UTC" })} seront commercialisables.`,
        },
        { status: 400 },
      )
    }
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
