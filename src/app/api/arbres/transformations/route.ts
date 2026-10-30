/**
 * Produits transformés du verger (2026-10-30, retour FB-8CXUUN)
 * GET  /api/arbres/transformations - Lots transformés, avec leurs fruits d'origine
 * POST /api/arbres/transformations - Transformer des fruits en un produit en stock
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { ErreurVerger } from "@/lib/verger/erreur"
import { creerLotTransforme, listerLotsTransformes } from "@/lib/verger/transformation"

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error
  try {
    return NextResponse.json(await listerLotsTransformes(session!.user.id))
  } catch (err) {
    console.error("GET /api/arbres/transformations error:", err)
    return NextResponse.json({ error: "Erreur lors de la récupération des produits transformés" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  try {
    return NextResponse.json(await creerLotTransforme(session!.user.id, await request.json()), { status: 201 })
  } catch (err) {
    if (err instanceof ErreurVerger) return NextResponse.json({ error: err.message, champ: err.champ }, { status: err.status })
    console.error("POST /api/arbres/transformations error:", err)
    return NextResponse.json({ error: "Erreur lors de l’enregistrement de la transformation" }, { status: 500 })
  }
}
