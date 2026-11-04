import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { stockRestantLotOeufs } from "@/lib/elevage/stock-oeufs"
import { computeStockOeufsParLots } from "@/lib/elevage/stock-oeufs-lots"

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
  // Revue du 2026-11-04 — une « vente » saisie ici décrémentait le lot sans
  // créer ni vente, ni recette, ni TVA ; saisie aussi dans Ventes, elle
  // sortait deux fois les mêmes œufs. Une vente passe par Ventes
  // (`/api/elevage/ventes`), qui sort le stock en FIFO, applique les délais
  // d'attente et la limite de J+21, et écrit la recette. Même règle que la
  // ruche et la cave.
  if (input.type === "vente") {
    return NextResponse.json(
      {
        error: "Une vente d'œufs se saisit dans Élevage > Ventes : elle sort les œufs du stock et enregistre la recette. La sortie manuelle sert aux consommations, dons, casses et ajustements.",
        champ: "type",
      },
      { status: 400 },
    )
  }
  return prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:stock-oeufs:${session.user.id}`}))`
  const production = await tx.productionOeuf.findFirst({
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
  const data = await tx.mouvementStockOeuf.create({
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
  })
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 })
  const existing = await prisma.mouvementStockOeuf.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, notes: true },
  })
  if (!existing) return NextResponse.json({ error: "Mouvement introuvable" }, { status: 404 })
  if (/^\[vente-produit:\d+\]/.test(existing.notes ?? '')) {
    return NextResponse.json({ error: 'Cette sortie vient d’une vente : annulez ou modifiez la vente dans Production > Ventes.' }, { status: 409 })
  }
  if (await prisma.mouvementStockCommercial.count({ where: { userId: session.user.id, mouvementOeufId: id } })) return NextResponse.json({ error: 'Cette sortie est liée à un document commercial. Utilisez Retour en stock sur le bon ou la facture.' }, { status: 409 })
  await prisma.mouvementStockOeuf.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
