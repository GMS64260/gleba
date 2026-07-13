/**
 * PUT    /api/elevage/races/[id] — modifier une race animale.
 * DELETE /api/elevage/races/[id] — supprimer une race animale (+ ses avis).
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

    const existing = await prisma.raceAnimale.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: `Race "${id}" non trouvée` }, { status: 404 })
    }

    if (!peutEditerReferentiel(existing, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: 'Vous ne pouvez modifier que vos propres races.' },
        { status: 403 }
      )
    }

    const data: Record<string, unknown> = {}
    if (typeof body.nom === 'string') data.nom = body.nom.trim()
    if (body.origine !== undefined) data.origine = body.origine || null
    if (Array.isArray(body.aptitudes)) data.aptitudes = body.aptitudes
    if (body.rusticite !== undefined)
      data.rusticite = typeof body.rusticite === 'number' ? body.rusticite : null
    if (body.description !== undefined) data.description = body.description || null

    // L'auteur d'un perso peut basculer « proposer à la communauté ».
    if (existing.userId && body.partageCommunaute !== undefined) {
      data.partageCommunaute = body.partageCommunaute === true
    }

    const race = await prisma.raceAnimale.update({ where: { id }, data })
    return NextResponse.json({ data: race })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Cette race existe déjà pour cette espèce' }, { status: 409 })
    }
    console.error('PUT /api/elevage/races/[id] error:', err)
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

    const existing = await prisma.raceAnimale.findUnique({
      where: { id },
      include: { _count: { select: { animaux: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: `Race "${id}" non trouvée` }, { status: 404 })
    }

    if (!peutEditerReferentiel(existing, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: 'Vous ne pouvez supprimer que vos propres races.' },
        { status: 403 }
      )
    }

    if (existing._count.animaux > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer : ${existing._count.animaux} animal(aux) référencent cette race.` },
        { status: 409 }
      )
    }

    // Nettoyage best-effort des avis liés (pas de FK polymorphe).
    await prisma.avis.deleteMany({ where: { refType: 'RACE', refId: id } })
    await prisma.raceAnimale.delete({ where: { id } })
    return NextResponse.json({ success: true, deleted: id })
  } catch (err) {
    console.error('DELETE /api/elevage/races/[id] error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
