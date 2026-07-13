/**
 * PUT    /api/verger/essences-forestieres/[id] — modifier une essence forestière.
 * DELETE /api/verger/essences-forestieres/[id] — supprimer une essence forestière.
 *
 * Réservé à l'auteur d'une entrée perso (ou à un admin) — 403 sinon. L'auteur
 * d'un perso peut basculer « proposer à la communauté » via partageCommunaute.
 * Harmonisé sur src/app/api/especes/[id]/route.ts.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { peutEditerReferentiel } from "@/lib/referentiel-communaute"

type RouteParams = { params: Promise<{ id: string }> }

// PUT
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === "ADMIN"

  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.essenceForestiere.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: `Essence forestière "${id}" non trouvée` },
        { status: 404 }
      )
    }

    if (!peutEditerReferentiel(existing, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: "Vous ne pouvez modifier que vos propres essences forestières." },
        { status: 403 }
      )
    }

    const data: Record<string, unknown> = {}
    if (typeof body.nom === "string") data.nom = body.nom.trim()
    if (typeof body.nomLatin === "string") data.nomLatin = body.nomLatin.trim()
    if (typeof body.categorie === "string") data.categorie = body.categorie
    if (Array.isArray(body.usages)) data.usages = body.usages
    if (body.densitesParHa !== undefined) data.densitesParHa = body.densitesParHa as object
    if (typeof body.croissance === "string") data.croissance = body.croissance
    if (Array.isArray(body.sols)) data.sols = body.sols
    if (Array.isArray(body.expositions)) data.expositions = body.expositions
    if (body.cycleAnsRecolte !== undefined)
      data.cycleAnsRecolte =
        typeof body.cycleAnsRecolte === "number" ? body.cycleAnsRecolte : null
    if (body.conseils !== undefined)
      data.conseils = typeof body.conseils === "string" ? body.conseils : null

    // L'auteur d'un perso peut basculer « proposer à la communauté ».
    if (existing.userId && body.partageCommunaute !== undefined) {
      data.partageCommunaute = body.partageCommunaute === true
    }

    const essence = await prisma.essenceForestiere.update({ where: { id }, data })
    return NextResponse.json(essence)
  } catch (err) {
    console.error("PUT /api/verger/essences-forestieres/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'essence forestière" },
      { status: 500 }
    )
  }
}

// DELETE
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === "ADMIN"

  try {
    const { id } = await params

    const existing = await prisma.essenceForestiere.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: `Essence forestière "${id}" non trouvée` },
        { status: 404 }
      )
    }

    if (!peutEditerReferentiel(existing, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: "Vous ne pouvez supprimer que vos propres essences forestières." },
        { status: 403 }
      )
    }

    await prisma.essenceForestiere.delete({ where: { id } })
    return NextResponse.json({ success: true, deleted: id })
  } catch (err) {
    console.error("DELETE /api/verger/essences-forestieres/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'essence forestière" },
      { status: 500 }
    )
  }
}
