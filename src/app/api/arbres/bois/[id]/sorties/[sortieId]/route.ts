/**
 * DELETE /api/arbres/bois/:id/sorties/:sortieId
 *
 * Annule un usage interne de bois enregistré depuis Productions. Revue du
 * 2026-10-29 : une sortie physique n'était plus réversible, et le lot restait
 * figé. Verrous, contrôle et reprise réseau :
 * `annulerSortieVerger`.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { annulerSortieVerger } from "@/lib/verger/sortie-stock"
import { ErreurVerger } from "@/lib/verger/erreur"
import { ErreurReglement } from "@/lib/comptabilite/monnaie"

interface Params {
  params: Promise<{ id: string; sortieId: string }>
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  try {
    const { id, sortieId } = await params
    return NextResponse.json(await annulerSortieVerger('bois', session!.user.id, Number(id), sortieId))
  } catch (err) {
    if (err instanceof ErreurVerger || err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('DELETE /api/arbres/bois/[id]/sorties/[sortieId] error:', err)
    return NextResponse.json({ error: 'Erreur lors de l’annulation de la sortie' }, { status: 500 })
  }
}
