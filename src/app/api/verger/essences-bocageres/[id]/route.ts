/**
 * PUT    /api/verger/essences-bocageres/[id] — modifier une essence bocagère.
 * DELETE /api/verger/essences-bocageres/[id] — supprimer une essence bocagère.
 *
 * Réservé à l'auteur d'une entrée perso (ou à un admin) — 403 sinon. L'auteur
 * d'un perso peut basculer « proposer à la communauté » via partageCommunaute.
 * Harmonisé sur src/app/api/especes/[id]/route.ts.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import {
  masquerEntree,
  peutEditerReferentiel,
  whereReferentielCible,
} from "@/lib/referentiel-communaute"

type RouteParams = { params: Promise<{ id: string }> }

// PUT
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === "ADMIN"

  try {
    const { id } = await params
    const body = await request.json()

    // Entrée privée d'un autre compte = entrée inexistante (404), jamais 403.
    const existing = await prisma.essenceBocagere.findFirst({
      where: whereReferentielCible(id, session!.user.id, isAdmin),
    })
    if (!existing) {
      return NextResponse.json(
        { error: `Essence bocagère "${id}" non trouvée` },
        { status: 404 }
      )
    }

    if (!peutEditerReferentiel(existing, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: "Vous ne pouvez modifier que vos propres essences bocagères." },
        { status: 403 }
      )
    }

    const data: Record<string, unknown> = {}
    if (typeof body.nomCommun === "string") data.nomCommun = body.nomCommun.trim()
    if (typeof body.nomLatin === "string") data.nomLatin = body.nomLatin.trim()
    if (typeof body.hauteurM === "number") data.hauteurM = body.hauteurM
    if (typeof body.croissance === "string") data.croissance = body.croissance
    if (Array.isArray(body.roles)) data.roles = body.roles
    if (body.persistant !== undefined) data.persistant = body.persistant === true
    if (body.epineux !== undefined) data.epineux = body.epineux === true
    if (body.notes !== undefined)
      data.notes = typeof body.notes === "string" ? body.notes : null

    // L'auteur d'un perso peut basculer « proposer à la communauté ».
    if (existing.userId && body.partageCommunaute !== undefined) {
      data.partageCommunaute = body.partageCommunaute === true
    }

    const essence = await prisma.essenceBocagere.update({ where: { id }, data })
    return NextResponse.json(masquerEntree(essence, session!.user.id))
  } catch (err) {
    console.error("PUT /api/verger/essences-bocageres/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'essence bocagère" },
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

    // Entrée privée d'un autre compte = entrée inexistante (404), jamais 403.
    const existing = await prisma.essenceBocagere.findFirst({
      where: whereReferentielCible(id, session!.user.id, isAdmin),
    })
    if (!existing) {
      return NextResponse.json(
        { error: `Essence bocagère "${id}" non trouvée` },
        { status: 404 }
      )
    }

    if (!peutEditerReferentiel(existing, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: "Vous ne pouvez supprimer que vos propres essences bocagères." },
        { status: 403 }
      )
    }

    await prisma.essenceBocagere.delete({ where: { id } })
    return NextResponse.json({ success: true, deleted: id })
  } catch (err) {
    console.error("DELETE /api/verger/essences-bocageres/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'essence bocagère" },
      { status: 500 }
    )
  }
}
