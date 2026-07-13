/**
 * PUT    /api/verger/porte-greffes/[id] — modifier un porte-greffe.
 * DELETE /api/verger/porte-greffes/[id] — supprimer un porte-greffe.
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

    const existing = await prisma.porteGreffe.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: `Porte-greffe "${id}" non trouvé` },
        { status: 404 }
      )
    }

    if (!peutEditerReferentiel(existing, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: "Vous ne pouvez modifier que vos propres porte-greffes." },
        { status: 403 }
      )
    }

    const data: Record<string, unknown> = {}
    if (typeof body.nom === "string") {
      const nom = body.nom.trim()
      // `nom` est unique : refuser un renommage vers un nom déjà pris.
      if (nom && nom !== existing.nom) {
        const clash = await prisma.porteGreffe.findUnique({ where: { nom } })
        if (clash) {
          return NextResponse.json(
            { error: `Le porte-greffe "${nom}" existe déjà.` },
            { status: 409 }
          )
        }
        data.nom = nom
      }
    }
    if (typeof body.vigueur === "number") data.vigueur = body.vigueur
    if (typeof body.precocite === "number") data.precocite = body.precocite
    if (Array.isArray(body.sensibilites)) data.sensibilites = body.sensibilites
    if (body.drageonnement !== undefined) data.drageonnement = body.drageonnement === true
    if (body.notes !== undefined)
      data.notes = typeof body.notes === "string" ? body.notes : null

    // L'auteur d'un perso peut basculer « proposer à la communauté ».
    if (existing.userId && body.partageCommunaute !== undefined) {
      data.partageCommunaute = body.partageCommunaute === true
    }

    const porteGreffe = await prisma.porteGreffe.update({ where: { id }, data })
    return NextResponse.json(porteGreffe)
  } catch (err) {
    console.error("PUT /api/verger/porte-greffes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du porte-greffe" },
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

    const existing = await prisma.porteGreffe.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: `Porte-greffe "${id}" non trouvé` },
        { status: 404 }
      )
    }

    if (!peutEditerReferentiel(existing, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: "Vous ne pouvez supprimer que vos propres porte-greffes." },
        { status: 403 }
      )
    }

    await prisma.porteGreffe.delete({ where: { id } })
    return NextResponse.json({ success: true, deleted: id })
  } catch (err) {
    console.error("DELETE /api/verger/porte-greffes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression du porte-greffe" },
      { status: 500 }
    )
  }
}
