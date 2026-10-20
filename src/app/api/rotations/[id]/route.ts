/**
 * API Routes pour une Rotation specifique
 * GET /api/rotations/[id] - Detail d'une rotation
 * PUT /api/rotations/[id] - Modifier une rotation
 * DELETE /api/rotations/[id] - Supprimer une rotation
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateRotationSchema } from '@/lib/validations'
import { requireAuthApi, requireAdminApi } from '@/lib/auth-utils'
import { etapesRotationInvalides, messageEtapesInvalides } from '@/lib/rotations/itp-etapes'
import { messageRefusSuppressionRotation } from '@/lib/rotations/suppression'
import { masquerReferentielsEmbarques } from '@/lib/referentiel-embarque'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/rotations/[id]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const userId = session!.user.id

    // Bug #6 (testeur Marc) : les rotations sont un référentiel partagé (pas de
    // userId). Sans filtre, planches + _count agrégeaient les planches de TOUS
    // les comptes → compteur « 4 planche(s) » faux (3 réelles pour ce user).
    const rotation = await prisma.rotation.findUnique({
      where: { id },
      include: {
        details: {
          include: {
            itp: {
              include: {
                espece: {
                  include: {
                    famille: true,
                  },
                },
              },
            },
          },
          orderBy: { annee: 'asc' },
        },
        planches: {
          where: { userId },
          select: {
            id: true,
            ilot: true,
            longueur: true,
            largeur: true,
          },
        },
        _count: {
          select: {
            planches: { where: { userId } },
          },
        },
      },
    })

    if (!rotation) {
      return NextResponse.json(
        { error: `Rotation « ${id} » introuvable` },
        { status: 404 }
      )
    }

    // ITP et espèce de chaque étape : jamais l'id de l'auteur d'une entrée
    // partagée par un autre compte (revue 2026-10-20).
    return NextResponse.json(masquerReferentielsEmbarques(rotation, userId))
  } catch (error) {
    console.error('GET /api/rotations/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la rotation' },
      { status: 500 }
    )
  }
}

// PUT /api/rotations/[id]
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAdminApi()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()

    // Validation
    const validationResult = updateRotationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Verifier existence
    const existing = await prisma.rotation.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `Rotation « ${id} » introuvable` },
        { status: 404 }
      )
    }

    const { details, ...rotationData } = validationResult.data

    // Même contrôle qu'à la création : une étape ne peut pointer qu'un
    // itinéraire exploitable (cf. src/lib/rotations/itp-etapes.ts).
    const etapesInvalides = await etapesRotationInvalides(prisma, session!.user.id, details)
    if (etapesInvalides.length > 0) {
      return NextResponse.json(
        { error: messageEtapesInvalides(etapesInvalides), etapes: etapesInvalides },
        { status: 400 }
      )
    }

    // PROMPT DEV 2 Bug #1 — Cross-check si `active` passe à true sans envoyer
    // `details`. Le superRefine du schema valide uniquement le payload reçu :
    // si le client met active=true sans toucher au plan, on doit charger les
    // détails existants pour vérifier que le plan est complet.
    if (rotationData.active === true && !details) {
      const existingDetails = await prisma.rotationDetail.findMany({
        where: { rotationId: id },
        select: { annee: true, itpId: true },
      })
      const plancheCount = await prisma.planche.count({ where: { rotationId: id } })
      if (existingDetails.length === 0) {
        return NextResponse.json(
          { error: "Une rotation Active doit avoir un plan complet. Ajoutez au moins une étape." },
          { status: 400 }
        )
      }
      if (existingDetails.every((d) => !d.itpId)) {
        return NextResponse.json(
          { error: "Une rotation Active doit avoir au moins une étape avec un ITP." },
          { status: 400 }
        )
      }
      const effectiveCycle = rotationData.nbAnnees ?? existing.nbAnnees ?? existingDetails.length
      if (effectiveCycle !== existingDetails.length) {
        return NextResponse.json(
          { error: `Le cycle déclaré (${effectiveCycle} ans) doit correspondre au nombre d'étapes (${existingDetails.length}).` },
          { status: 400 }
        )
      }
      // Note: pas de planche rattachée n'est PAS bloquant (banner UI à la place).
      void plancheCount
    }

    // Calculer nbAnnees si des details sont fournis
    const nbAnnees = details && details.length > 0
      ? Math.max(...details.map(d => d.annee))
      : rotationData.nbAnnees

    // Mise a jour avec transaction pour gerer les details
    const rotation = await prisma.$transaction(async (tx) => {
      // Si des details sont fournis, supprimer les anciens et creer les nouveaux
      if (details) {
        await tx.rotationDetail.deleteMany({
          where: { rotationId: id },
        })

        for (const detail of details) {
          await tx.rotationDetail.create({
            data: {
              rotationId: id,
              annee: detail.annee,
              itpId: detail.itpId,
            },
          })
        }
      }

      // Mise a jour de la rotation
      return tx.rotation.update({
        where: { id },
        data: {
          ...rotationData,
          nbAnnees,
        },
        include: {
          details: {
            include: {
              itp: {
                include: {
                  espece: true,
                },
              },
            },
            orderBy: { annee: 'asc' },
          },
        },
      })
    })

    return NextResponse.json(masquerReferentielsEmbarques(rotation, session!.user.id))
  } catch (error) {
    console.error('PUT /api/rotations/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la rotation' },
      { status: 500 }
    )
  }
}

// DELETE /api/rotations/[id]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAdminApi()
  if (error) return error

  try {
    const { id } = await params
    const userId = session!.user.id

    // Vérifier existence et dépendances. La rotation est un référentiel
    // GLOBAL : le refus compte les planches de tous les comptes, mais ne nomme
    // que celles du compte (les écrans n'en voient pas d'autres).
    const rotation = await prisma.rotation.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            planches: true,
          },
        },
      },
    })

    if (!rotation) {
      return NextResponse.json(
        { error: `Rotation « ${id} » introuvable` },
        { status: 404 }
      )
    }

    // La route porte la règle et son message ; les écrans l'affichent tel
    // quel (2026-10-20 : ils refusaient seuls, d'après les planches du compte).
    if (rotation._count.planches > 0) {
      const planchesDuCompte = await prisma.planche.findMany({
        where: { rotationId: id, userId },
        select: { nom: true },
        orderBy: { nom: 'asc' },
      })
      const usage = {
        planchesDuCompte: planchesDuCompte.map((p) => p.nom),
        planchesAutresComptes: Math.max(0, rotation._count.planches - planchesDuCompte.length),
      }
      return NextResponse.json(
        {
          error: messageRefusSuppressionRotation(id, usage),
          details: {
            planches: rotation._count.planches,
            planchesDuCompte: usage.planchesDuCompte.length,
            planchesAutresComptes: usage.planchesAutresComptes,
          },
        },
        { status: 409 }
      )
    }

    // Suppression (les étapes partent en cascade)
    await prisma.rotation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error('DELETE /api/rotations/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la rotation' },
      { status: 500 }
    )
  }
}
