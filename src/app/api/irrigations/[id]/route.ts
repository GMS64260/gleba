/**
 * API Routes pour une irrigation spécifique
 * GET /api/irrigations/[id] - Détails
 * PATCH /api/irrigations/[id] - Mettre à jour
 * DELETE /api/irrigations/[id] - Supprimer
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { enregistrerArrosageCultures } from '@/lib/irrigation-recording'
import { masquerReferentielsEmbarques } from '@/lib/referentiel-embarque'
import { corpsObjet, dateLisible, entierPositif } from '@/lib/irrigation/validation-requete'
import type { Prisma } from '@prisma/client'

// GET /api/irrigations/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { id: idStr } = await params
    const id = entierPositif(idStr)
    if (id === null) return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 })

    const irrigation = await prisma.irrigationPlanifiee.findFirst({
      where: { id, userId },
      include: {
        culture: {
          include: {
            espece: true,
          },
        },
      },
    })

    if (!irrigation) {
      return NextResponse.json(
        { error: 'Irrigation non trouvée' },
        { status: 404 }
      )
    }

    // Espèce embarquée : jamais l'id de l'auteur d'une entrée partagée par un
    // autre compte (revue 2026-10-20).
    return NextResponse.json(masquerReferentielsEmbarques(irrigation, userId))
  } catch (error) {
    console.error('GET /api/irrigations/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'irrigation" },
      { status: 500 }
    )
  }
}

// PATCH /api/irrigations/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { id: idStr } = await params
    const id = entierPositif(idStr)
    if (id === null) return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 })
    const body = await corpsObjet(request)
    if (!body) return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })

    // Entrées lues avant toute écriture : une date illisible donnait une
    // « Invalid Date » que Prisma refuse (500). La date effective s'efface
    // (valeur vide), la date prévue non.
    const { fait } = body
    const dateEffective = body.dateEffective ? dateLisible(body.dateEffective) : null
    const datePrevue = body.datePrevue === undefined ? null : dateLisible(body.datePrevue)
    if (body.dateEffective && !dateEffective) {
      return NextResponse.json({ error: 'dateEffective invalide' }, { status: 400 })
    }
    if (body.datePrevue !== undefined && !datePrevue) {
      return NextResponse.json({ error: 'datePrevue invalide' }, { status: 400 })
    }
    if (body.notes != null && typeof body.notes !== 'string') {
      return NextResponse.json({ error: 'notes invalides' }, { status: 400 })
    }
    // `undefined` : champ absent, notes inchangées ; `null` : notes effacées.
    const notes = typeof body.notes === 'string' ? body.notes : body.notes === null ? null : undefined

    // Vérifier que l'irrigation appartient à l'utilisateur
    const existing = await prisma.irrigationPlanifiee.findFirst({
      where: { id, userId },
      include: {
        culture: {
          select: { plancheId: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Irrigation non trouvée' },
        { status: 404 }
      )
    }

    const updateData: Prisma.IrrigationPlanifieeUpdateManyMutationInput = {}

    if (typeof fait === 'boolean') {
      updateData.fait = fait
      // Cocher UNE ligne précise est un geste délibéré (« j'ai bien arrosé ce
      // jour-là ») : il rouvre un passage abandonné, contrairement au balayage
      // en masse qui, lui, ne rattrape plus rien au-delà d'un cycle.
      // `fait` et `perimee` s'excluent : les laisser vrais tous les deux
      // rendrait le passage à la fois réalisé et abandonné.
      updateData.perimee = false
      // Si on marque comme fait et pas de date effective, utiliser aujourd'hui
      if (fait && !dateEffective && !existing.dateEffective) {
        updateData.dateEffective = new Date()
      }
    }

    if (body.dateEffective !== undefined) {
      updateData.dateEffective = dateEffective
    }

    if (datePrevue) {
      updateData.datePrevue = datePrevue
    }

    if (notes !== undefined) {
      updateData.notes = notes
    }

    // Une ligne du calendrier représente désormais un passage par planche et
    // par jour. Répercuter la modification sur les anciennes lignes
    // culture-par-culture évite qu'un doublon réapparaisse après un déplacement
    // ou une validation.
    const debutJour = new Date(existing.datePrevue)
    debutJour.setHours(0, 0, 0, 0)
    const finJour = new Date(existing.datePrevue)
    finJour.setHours(23, 59, 59, 999)

    const irrigationsDuPassage = existing.culture.plancheId
      ? await prisma.irrigationPlanifiee.findMany({
          where: {
            userId,
            datePrevue: { gte: debutJour, lte: finJour },
            culture: {
              plancheId: existing.culture.plancheId,
            },
          },
          select: { id: true },
        })
      : [{ id }]
    const irrigationIds = irrigationsDuPassage.map((item) => item.id)

    await prisma.irrigationPlanifiee.updateMany({
      where: {
        userId,
        id: { in: irrigationIds },
      },
      data: updateData,
    })

    const irrigation = await prisma.irrigationPlanifiee.findUniqueOrThrow({
      where: { id },
      include: {
        culture: {
          include: {
            espece: true,
          },
        },
      },
    })

    // Cocher une irrigation planifiée signifie qu'un passage réel a eu lieu.
    // On réconcilie donc aussi la date du dernier arrosage, les éventuelles
    // cultures voisines sur la même planche et les tâches dues en doublon.
    const impactArrosage = fait === true
      ? await enregistrerArrosageCultures({
          userId,
          cultureIds: [existing.cultureId],
          dateEffective: irrigation.dateEffective ?? new Date(),
        })
      : null

    return NextResponse.json({
      ...masquerReferentielsEmbarques(irrigation, userId),
      irrigationIds,
      impactArrosage,
    })
  } catch (error) {
    console.error('PATCH /api/irrigations/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'irrigation" },
      { status: 500 }
    )
  }
}

// DELETE /api/irrigations/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { id: idStr } = await params
    const id = entierPositif(idStr)
    if (id === null) return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 })

    // Vérifier que l'irrigation appartient à l'utilisateur
    const existing = await prisma.irrigationPlanifiee.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Irrigation non trouvée' },
        { status: 404 }
      )
    }

    await prisma.irrigationPlanifiee.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/irrigations/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'irrigation" },
      { status: 500 }
    )
  }
}
