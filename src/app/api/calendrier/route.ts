/**
 * API Route pour le calendrier
 * GET /api/calendrier?start=&end=
 * Retourne les événements (semis, plantations, récoltes, irrigations) pour une période
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const startStr = searchParams.get('start')
    const endStr = searchParams.get('end')

    if (!startStr || !endStr) {
      return NextResponse.json(
        { error: 'Dates start et end requises' },
        { status: 400 }
      )
    }

    const start = new Date(startStr)
    const end = new Date(endStr)

    // Récupérer toutes les cultures avec des dates dans la période
    const [culturesAvecSemis, culturesAvecPlantation, culturesAvecRecolte, irrigationsPlanifiees] = await Promise.all([
      // Semis
      prisma.culture.findMany({
        where: {
          userId,
          dateSemis: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          especeId: true,
          varieteId: true,
          dateSemis: true,
          semisFait: true,
          espece: {
            select: { couleur: true },
          },
          planche: {
            select: { nom: true, ilot: true },
          },
        },
      }),
      // Plantations
      prisma.culture.findMany({
        where: {
          userId,
          datePlantation: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          especeId: true,
          varieteId: true,
          datePlantation: true,
          plantationFaite: true,
          espece: {
            select: { couleur: true },
          },
          planche: {
            select: { nom: true, ilot: true },
          },
        },
      }),
      // Récoltes
      prisma.culture.findMany({
        where: {
          userId,
          dateRecolte: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          especeId: true,
          varieteId: true,
          dateRecolte: true,
          recolteFaite: true,
          espece: {
            select: { couleur: true },
          },
          planche: {
            select: { nom: true, ilot: true },
          },
        },
      }),
      // Irrigations planifiées
      prisma.irrigationPlanifiee.findMany({
        where: {
          userId,
          datePrevue: {
            gte: start,
            lte: end,
          },
        },
        include: {
          culture: {
            select: {
              id: true,
              especeId: true,
              varieteId: true,
              espece: {
                select: { couleur: true },
              },
              planche: {
                select: { nom: true, ilot: true },
              },
            },
          },
        },
      }),
    ])

    // Formater les événements
    const events = [
      ...culturesAvecSemis.map(c => ({
        id: c.id,
        type: 'semis' as const,
        especeId: c.especeId,
        varieteId: c.varieteId || null,
        plancheName: c.planche?.nom || null,
        ilot: c.planche?.ilot || null,
        date: c.dateSemis?.toISOString() || '',
        fait: c.semisFait,
        couleur: c.espece?.couleur || null,
      })),
      ...culturesAvecPlantation.map(c => ({
        id: c.id,
        type: 'plantation' as const,
        especeId: c.especeId,
        varieteId: c.varieteId || null,
        plancheName: c.planche?.nom || null,
        ilot: c.planche?.ilot || null,
        date: c.datePlantation?.toISOString() || '',
        fait: c.plantationFaite,
        couleur: c.espece?.couleur || null,
      })),
      ...culturesAvecRecolte.map(c => ({
        id: c.id,
        type: 'recolte' as const,
        especeId: c.especeId,
        varieteId: c.varieteId || null,
        plancheName: c.planche?.nom || null,
        ilot: c.planche?.ilot || null,
        date: c.dateRecolte?.toISOString() || '',
        fait: c.recolteFaite,
        couleur: c.espece?.couleur || null,
      })),
      ...irrigationsPlanifiees.map(i => ({
        id: i.id, // ID de l'irrigation, pas de la culture
        type: 'irrigation' as const,
        especeId: i.culture.especeId,
        varieteId: i.culture.varieteId || null,
        plancheName: i.culture.planche?.nom || null,
        ilot: i.culture.planche?.ilot || null,
        date: i.datePrevue.toISOString(),
        fait: i.fait,
        couleur: i.culture.espece?.couleur || null,
        cultureId: i.culture.id, // Ajouter l'ID de culture pour référence
      })),
    ]

    // Trier par date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return NextResponse.json({
      events,
      stats: {
        semis: culturesAvecSemis.length,
        plantations: culturesAvecPlantation.length,
        recoltes: culturesAvecRecolte.length,
        irrigations: irrigationsPlanifiees.length,
        total: events.length,
      },
    })
  } catch (error) {
    console.error('GET /api/calendrier error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du calendrier', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
