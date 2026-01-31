/**
 * API Route pour les taches du jour/semaine
 * GET /api/taches?start=&end=
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
    const annee = new Date().getFullYear()

    // Cultures avec semis prevu cette semaine
    const culturesAvecSemis = await prisma.culture.findMany({
      where: {
        userId,
        annee,
        dateSemis: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        especeId: true,
        varieteId: true,
        plancheId: true,
        dateSemis: true,
        semisFait: true,
        espece: {
          select: { couleur: true },
        },
      },
      orderBy: { dateSemis: 'asc' },
    })

    // Cultures avec plantation prevue cette semaine
    const culturesAvecPlantation = await prisma.culture.findMany({
      where: {
        userId,
        annee,
        datePlantation: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        especeId: true,
        varieteId: true,
        plancheId: true,
        datePlantation: true,
        plantationFaite: true,
        espece: {
          select: { couleur: true },
        },
      },
      orderBy: { datePlantation: 'asc' },
    })

    // Cultures avec recolte prevue cette semaine
    const culturesAvecRecolte = await prisma.culture.findMany({
      where: {
        userId,
        annee,
        dateRecolte: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        especeId: true,
        varieteId: true,
        plancheId: true,
        dateRecolte: true,
        recolteFaite: true,
        espece: {
          select: { couleur: true },
        },
      },
      orderBy: { dateRecolte: 'asc' },
    })

    // Irrigations planifiées cette semaine
    const irrigationsPlanifiees = await prisma.irrigationPlanifiee.findMany({
      where: {
        userId,
        fait: false,
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
            plancheId: true,
            espece: {
              select: { couleur: true },
            },
            planche: {
              select: { ilot: true },
            },
          },
        },
      },
      orderBy: { datePrevue: 'asc' },
    })

    // Formatter les donnees
    const semis = culturesAvecSemis.map(c => ({
      id: c.id,
      type: 'semis' as const,
      especeId: c.especeId,
      varieteId: c.varieteId,
      plancheId: c.plancheId,
      date: c.dateSemis?.toISOString() || '',
      fait: c.semisFait,
      couleur: c.espece?.couleur || null,
    }))

    const plantations = culturesAvecPlantation.map(c => ({
      id: c.id,
      type: 'plantation' as const,
      especeId: c.especeId,
      varieteId: c.varieteId,
      plancheId: c.plancheId,
      date: c.datePlantation?.toISOString() || '',
      fait: c.plantationFaite,
      couleur: c.espece?.couleur || null,
    }))

    const recoltes = culturesAvecRecolte.map(c => ({
      id: c.id,
      type: 'recolte' as const,
      especeId: c.especeId,
      varieteId: c.varieteId,
      plancheId: c.plancheId,
      date: c.dateRecolte?.toISOString() || '',
      fait: c.recolteFaite,
      couleur: c.espece?.couleur || null,
    }))

    const irrigation = irrigationsPlanifiees.map(i => ({
      id: i.id, // ID de l'irrigation planifiée
      cultureId: i.culture.id,
      especeId: i.culture.especeId,
      plancheId: i.culture.plancheId,
      ilot: i.culture.planche?.ilot || null,
      datePrevue: i.datePrevue.toISOString(),
      fait: i.fait,
      couleur: i.culture.espece?.couleur || null,
    }))

    return NextResponse.json({
      semis,
      plantations,
      recoltes,
      irrigation,
      stats: {
        semisPrevus: semis.length,
        semisFaits: semis.filter(s => s.fait).length,
        plantationsPrevues: plantations.length,
        plantationsFaites: plantations.filter(p => p.fait).length,
        recoltesPrevues: recoltes.length,
        recoltesFaites: recoltes.filter(r => r.fait).length,
        aIrriguer: irrigation.length,
      },
    })
  } catch (error) {
    console.error('GET /api/taches error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des taches', details: String(error) },
      { status: 500 }
    )
  }
}
