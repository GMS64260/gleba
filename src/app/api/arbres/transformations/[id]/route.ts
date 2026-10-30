/**
 * DELETE /api/arbres/transformations/:id
 *
 * Annule une transformation jamais livrée : les fruits reviennent dans leurs
 * lots. Un produit livré ou facturé est conservé (`annulerLotTransforme`).
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { ErreurVerger } from "@/lib/verger/erreur"
import { ErreurReglement } from "@/lib/comptabilite/monnaie"
import { annulerLotTransforme } from "@/lib/verger/transformation"

interface Params {
  params: Promise<{ id: string }>
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  try {
    const { id } = await params
    return NextResponse.json(await annulerLotTransforme(session!.user.id, Number(id)))
  } catch (err) {
    if (err instanceof ErreurVerger || err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("DELETE /api/arbres/transformations/[id] error:", err)
    return NextResponse.json({ error: "Erreur lors de l’annulation de la transformation" }, { status: 500 })
  }
}
