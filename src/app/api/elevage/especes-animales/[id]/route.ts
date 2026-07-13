/**
 * PUT    /api/elevage/especes-animales/[id] — modifier une espèce animale.
 * DELETE /api/elevage/especes-animales/[id] — supprimer une espèce animale.
 *
 * Réservé à l'auteur d'une entrée perso (ou à un admin) — 403 sinon. L'auteur
 * d'un perso peut basculer « proposer à la communauté » via partageCommunaute.
 * Harmonisé sur src/app/api/verger/essences-forestieres/[id]/route.ts.
 * Pas de GET détail (inutile ici, évite tout IDOR).
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { peutEditerReferentiel } from '@/lib/referentiel-communaute'

type RouteParams = { params: Promise<{ id: string }> }

// PUT
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.especeAnimale.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: `Espèce "${id}" non trouvée` }, { status: 404 })
    }

    if (!peutEditerReferentiel(existing, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: 'Vous ne pouvez modifier que vos propres espèces.' },
        { status: 403 }
      )
    }

    const data: Record<string, unknown> = {}
    if (body.nom !== undefined) data.nom = body.nom
    if (body.type !== undefined) data.type = body.type
    if (body.production !== undefined) data.production = body.production
    if (body.categorieReglementaire !== undefined)
      data.categorieReglementaire = body.categorieReglementaire ?? null
    if (body.productions !== undefined)
      data.productions = Array.isArray(body.productions) ? body.productions : []
    if (body.dureeGestation !== undefined) data.dureeGestation = body.dureeGestation
    if (body.dureeCouvaison !== undefined) data.dureeCouvaison = body.dureeCouvaison
    if (body.dureeElevage !== undefined) data.dureeElevage = body.dureeElevage
    if (body.poidsAdulte !== undefined) data.poidsAdulte = body.poidsAdulte
    if (body.rendementCarcasse !== undefined) data.rendementCarcasse = body.rendementCarcasse
    if (body.ponteAnnuelle !== undefined) data.ponteAnnuelle = body.ponteAnnuelle
    if (body.consommationJour !== undefined) data.consommationJour = body.consommationJour
    if (body.prixAchat !== undefined) data.prixAchat = body.prixAchat
    if (body.couleur !== undefined) data.couleur = body.couleur
    if (body.description !== undefined) data.description = body.description

    // L'auteur d'un perso peut basculer « proposer à la communauté ».
    if (existing.userId && body.partageCommunaute !== undefined) {
      data.partageCommunaute = body.partageCommunaute === true
    }

    const espece = await prisma.especeAnimale.update({ where: { id }, data })
    return NextResponse.json({ data: espece })
  } catch (error) {
    console.error('PUT /api/elevage/especes-animales/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification', details: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// DELETE
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

  try {
    const { id } = await params

    const existing = await prisma.especeAnimale.findUnique({
      where: { id },
      include: { _count: { select: { animaux: true, lots: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Espèce non trouvée' }, { status: 404 })
    }

    if (!peutEditerReferentiel(existing, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: 'Vous ne pouvez supprimer que vos propres espèces.' },
        { status: 403 }
      )
    }

    // Vérifier qu'aucun animal/lot ne l'utilise (contrôle de dépendances existant).
    if (existing._count.animaux > 0 || existing._count.lots > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer : ${existing._count.animaux} animaux et ${existing._count.lots} lots liés` },
        { status: 409 }
      )
    }

    await prisma.especeAnimale.delete({ where: { id } })
    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error('DELETE /api/elevage/especes-animales/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
