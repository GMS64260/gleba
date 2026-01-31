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

    // Cultures a irriguer (besoin eau eleve, pas arrosees depuis 2+ jours)
    const deuxJoursAvant = new Date()
    deuxJoursAvant.setDate(deuxJoursAvant.getDate() - 2)

    const culturesIrrigation = await prisma.culture.findMany({
      where: {
        userId,
        annee,
        terminee: null,
        plantationFaite: true,
        AND: [
          {
            OR: [
              { aIrriguer: true },
              {
                espece: {
                  OR: [
                    { besoinEau: { gte: 3 } },
                    { irrigation: 'Eleve' },
                  ],
                },
              },
            ],
          },
          {
            OR: [
              { derniereIrrigation: null },
              { derniereIrrigation: { lt: deuxJoursAvant } },
            ],
          },
        ],
      },
      select: {
        id: true,
        especeId: true,
        plancheId: true,
        derniereIrrigation: true,
        espece: {
          select: { couleur: true },
        },
        planche: {
          select: { ilot: true },
        },
      },
      orderBy: [
        { derniereIrrigation: 'asc' },
        { planche: { ilot: 'asc' } },
      ],
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

    const irrigation = culturesIrrigation.map(c => {
      const joursDepuis = c.derniereIrrigation
        ? Math.floor((Date.now() - c.derniereIrrigation.getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        id: c.id,
        especeId: c.especeId,
        plancheId: c.plancheId,
        ilot: c.planche?.ilot || null,
        derniereIrrigation: c.derniereIrrigation?.toISOString() || null,
        joursDepuis,
        couleur: c.espece?.couleur || null,
      }
    })

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
