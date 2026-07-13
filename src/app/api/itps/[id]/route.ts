/**
 * API Routes pour un ITP spécifique (referentiel global)
 * GET /api/itps/[id] - Détail d'un ITP
 * PUT /api/itps/[id] - Modifier un ITP
 * DELETE /api/itps/[id] - Supprimer un ITP
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateITPSchema } from '@/lib/validations'
import { requireAuthApi, requireAdminApi } from '@/lib/auth-utils'
import { peutEditerReferentiel, visibiliteReferentiel } from '@/lib/referentiel-communaute'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/itps/[id]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  try {
    const { id } = await params

    // Audit Marc 2026-05-14 — Bug 13 : compteur cultures par tenant
    // (cf. /api/itps GET pour le détail du bug).
    // Visibilité : Gleba officiel + communauté + mes perso (jamais le perso privé d'autrui).
    let itp = await prisma.iTP.findFirst({
      where: { AND: [{ id }, visibiliteReferentiel(userId)] },
      include: {
        espece: { include: { famille: true } },
        _count: {
          select: {
            cultures: { where: { userId } },
            rotationsDetails: true,
          },
        },
      },
    })

    // BUG #9 (audit Marc 2026-05-15) : si l'URL utilise le NOM d'espèce
    // (ex. /maraichage/itps/Tomate) plutôt qu'un ID exact d'ITP, on
    // tente un fallback : premier ITP référencé pour cette espèce
    // (le plus long en durée de culture = le plus représentatif).
    // Évite un toast d'erreur frustrant quand le user devine l'URL.
    if (!itp) {
      itp = await prisma.iTP.findFirst({
        where: { AND: [{ especeId: id }, visibiliteReferentiel(userId)] },
        include: {
          espece: { include: { famille: true } },
          _count: {
            select: {
              cultures: { where: { userId } },
              rotationsDetails: true,
            },
          },
        },
        orderBy: { dureeCulture: 'desc' },
      })
    }

    if (!itp) {
      return NextResponse.json(
        { error: `ITP "${id}" non trouvé. Essayez la liste /maraichage/itps pour un identifiant exact.` },
        { status: 404 }
      )
    }

    return NextResponse.json(itp)
  } catch (error) {
    console.error('GET /api/itps/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'ITP' },
      { status: 500 }
    )
  }
}

// PUT /api/itps/[id]
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

  try {
    const { id } = await params
    const body = await request.json()

    // Validation
    const validationResult = updateITPSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Vérifier existence
    const existing = await prisma.iTP.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `ITP "${id}" non trouvé` },
        { status: 404 }
      )
    }

    // Seul l'auteur d'un ITP perso (ou un admin) peut le modifier.
    if (!peutEditerReferentiel(existing, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: 'Vous ne pouvez modifier que vos propres ITP.' },
        { status: 403 }
      )
    }

    const data = validationResult.data

    // Vérifier que l'espece existe si fournie + cohérence semis_direct
    // (Audit Marc Bug F : pas de plantation pour les semis directs)
    const especeIdEffectif = data.especeId ?? existing.especeId
    if (especeIdEffectif) {
      const espece = await prisma.espece.findUnique({
        where: { id: especeIdEffectif },
        select: { id: true, typeCultureSemis: true },
      })
      if (data.especeId && !espece) {
        return NextResponse.json(
          { error: `L'espèce "${data.especeId}" n'existe pas` },
          { status: 400 }
        )
      }
      if (espece?.typeCultureSemis === 'semis_direct' && data.semainePlantation != null) {
        return NextResponse.json(
          {
            error: `L'espèce "${especeIdEffectif}" est en semis direct. Le champ Plantation doit être vide.`,
          },
          { status: 400 }
        )
      }
    }

    // Mise à jour (l'auteur d'un perso peut basculer « proposer à la communauté »).
    const itp = await prisma.iTP.update({
      where: { id },
      data: {
        ...data,
        ...(existing.userId && body.partageCommunaute !== undefined
          ? { partageCommunaute: body.partageCommunaute === true }
          : {}),
      },
      include: {
        espece: true,
      },
    })

    return NextResponse.json(itp)
  } catch (error) {
    console.error('PUT /api/itps/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'ITP' },
      { status: 500 }
    )
  }
}

// DELETE /api/itps/[id]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

  try {
    const { id } = await params

    // Vérifier existence et dépendances
    const itp = await prisma.iTP.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            cultures: true,
            rotationsDetails: true,
          },
        },
      },
    })

    if (!itp) {
      return NextResponse.json(
        { error: `ITP "${id}" non trouvé` },
        { status: 404 }
      )
    }

    // Seul l'auteur d'un ITP perso (ou un admin) peut le supprimer.
    if (!peutEditerReferentiel(itp, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: 'Vous ne pouvez supprimer que vos propres ITP.' },
        { status: 403 }
      )
    }

    // Vérifier si des cultures ou rotations sont liées
    if (itp._count.cultures > 0 || itp._count.rotationsDetails > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer l'ITP "${id}" car il est utilisé`,
          details: {
            cultures: itp._count.cultures,
            rotations: itp._count.rotationsDetails,
          }
        },
        { status: 409 }
      )
    }

    // Suppression
    await prisma.iTP.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error('DELETE /api/itps/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'ITP' },
      { status: 500 }
    )
  }
}
