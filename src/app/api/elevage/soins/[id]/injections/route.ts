import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { daterInjection } from "@/lib/elevage/injections-protocole"
import { createDepenseFromSoinAnimal } from "@/lib/auto-compta"

// Tickets vigie2cc83585 / cmupz9djj (2026-10-01) : une injection déjà
// acquittée doit pouvoir être redatée depuis l'écran — `statut` devient
// facultatif (simple redatation) et `dateRealisee` est honorée telle quelle.
const patchSchema = z.object({
  injectionId: z.string().min(1),
  statut: z.enum(["a_faire", "realisee", "annulee"]).optional(),
  dateRealisee: z.coerce.date().nullable().optional(),
}).refine((d) => d.statut !== undefined || d.dateRealisee !== undefined, {
  message: "Indiquez un statut ou une date réelle.",
  path: ["statut"],
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

  try {
    const resultat = await daterInjection(session.user.id, soinId, {
      injectionId: parsed.data.injectionId,
      statut: parsed.data.statut,
      dateRealisee: parsed.data.dateRealisee,
    }, { gererStock: true })
    if (!resultat.ok) return NextResponse.json({ error: resultat.error }, { status: resultat.status })
    const soin = resultat.soin
    await createDepenseFromSoinAnimal(session.user.id, {
      id: soin.id,
      type: soin.type,
      cout: soin.cout,
      date: soin.date,
      fait: soin.fait,
    }, prisma)
    return NextResponse.json({ data: soin })
  } catch (transactionError) {
    console.error("PATCH /api/elevage/soins/[id]/injections error:", transactionError)
    return NextResponse.json({ error: "Mise à jour impossible" }, { status: 500 })
  }
}
