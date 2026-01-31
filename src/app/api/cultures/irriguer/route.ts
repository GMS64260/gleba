/**
 * API Route pour les cultures a irriguer
 * GET /api/cultures/irriguer
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
    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    // Recuperer les cultures actives qui ont besoin d'irrigation
    // Criteres:
    // - Culture non terminee
    // - aIrriguer = true OU espece avec besoin eau >= 3
    const cultures = await prisma.culture.findMany({
      where: {
        userId,
        annee,
        terminee: null,
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
      select: {
        id: true,
        especeId: true,
        varieteId: true,
        plancheId: true,
        aIrriguer: true,
        derniereIrrigation: true,
        plantationFaite: true,
        semisFait: true,
        dateSemis: true,
        datePlantation: true,
        nbRangs: true,
        longueur: true,
        espece: {
          select: {
            id: true,
            couleur: true,
            besoinEau: true,
            irrigation: true,
          },
        },
        planche: {
          select: {
            id: true,
            ilot: true,
            type: true,
            irrigation: true,
            surface: true,
            largeur: true,
            longueur: true,
          },
        },
        variete: {
          select: {
            id: true,
          },
        },
        irrigationsPlanifiees: {
          where: {
            fait: false,
            datePrevue: {
              gte: new Date(),
              lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
            },
          },
          select: {
            datePrevue: true,
          },
          orderBy: {
            datePrevue: 'asc',
          },
        },
      },
      orderBy: [
        { planche: { ilot: 'asc' } },
        { planche: { id: 'asc' } },
      ],
    })

    // Calculer l'urgence et l'âge, puis trier
    const now = Date.now()
    const culturesAvecUrgence = cultures.map(c => {
      let joursSansEau = null
      if (c.derniereIrrigation) {
        joursSansEau = Math.floor((now - new Date(c.derniereIrrigation).getTime()) / (1000 * 60 * 60 * 24))
      }

      // Calculer l'âge en jours depuis plantation (ou semis si pas encore plantée)
      const dateReference = c.datePlantation || c.dateSemis
      let ageJours = null
      let isJeune = false
      if (dateReference) {
        ageJours = Math.floor((now - new Date(dateReference).getTime()) / (1000 * 60 * 60 * 24))
        isJeune = ageJours < 14 // Moins de 2 semaines = jeune pousse
      }

      // Estimation consommation eau (litres/semaine)
      const surface = c.nbRangs && c.longueur && c.planche?.largeur
        ? (c.nbRangs * c.longueur * c.planche.largeur)
        : (c.planche?.surface || 0)

      const besoinEau = c.espece?.besoinEau || 3
      // Estimation: 5-15L/m²/semaine selon besoin
      const consommationSemaine = surface * (besoinEau >= 4 ? 15 : besoinEau >= 3 ? 10 : 5)

      return {
        ...c,
        joursSansEau,
        ageJours,
        isJeune,
        urgence: joursSansEau === null ? 999 : joursSansEau >= 4 ? 'critique' : joursSansEau >= 3 ? 'haute' : joursSansEau >= 2 ? 'moyenne' : 'faible',
        consommationEauSemaine: Math.round(consommationSemaine * 10) / 10,
        prochainesIrrigations: c.irrigationsPlanifiees.length,
      }
    })

    // Trier par urgence (critique → jamais arrosé → haute → moyenne → faible)
    culturesAvecUrgence.sort((a, b) => {
      const urgenceOrder: Record<string, number> = { critique: 0, haute: 1, moyenne: 2, faible: 3 }
      if (a.joursSansEau === null && b.joursSansEau === null) return 0
      if (a.joursSansEau === null) return -1
      if (b.joursSansEau === null) return 1
      return urgenceOrder[a.urgence] - urgenceOrder[b.urgence]
    })

    // Grouper par ilot (gardant le tri par urgence)
    const parIlot: Record<string, typeof culturesAvecUrgence> = {}
    for (const culture of culturesAvecUrgence) {
      const ilot = culture.planche?.ilot || 'Sans ilot'
      if (!parIlot[ilot]) {
        parIlot[ilot] = []
      }
      parIlot[ilot].push(culture)
    }

    // Grouper par type d'irrigation
    const parTypeIrrigation: Record<string, typeof culturesAvecUrgence> = {}
    for (const culture of culturesAvecUrgence) {
      const type = culture.planche?.irrigation || 'Non défini'
      if (!parTypeIrrigation[type]) {
        parTypeIrrigation[type] = []
      }
      parTypeIrrigation[type].push(culture)
    }

    // Stats enrichies
    const stats = {
      total: cultures.length,
      nbIlots: Object.keys(parIlot).length,
      critique: culturesAvecUrgence.filter(c => c.urgence === 'critique').length,
      haute: culturesAvecUrgence.filter(c => c.urgence === 'haute').length,
      jamaisArrose: culturesAvecUrgence.filter(c => c.joursSansEau === null).length,
      prochainesIrrigations7j: culturesAvecUrgence.reduce((sum, c) => sum + c.prochainesIrrigations, 0),
      consommationTotaleEstimee: Math.round(culturesAvecUrgence.reduce((sum, c) => sum + c.consommationEauSemaine, 0)),
      parTypeIrrigation: Object.entries(parTypeIrrigation).map(([type, cultures]) => ({
        type,
        count: cultures.length,
      })),
    }

    return NextResponse.json({
      data: culturesAvecUrgence,
      parIlot,
      parTypeIrrigation,
      stats,
      annee,
    })
  } catch (error) {
    console.error('GET /api/cultures/irriguer error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des cultures a irriguer', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/cultures/irriguer - Met a jour le statut d'irrigation ou note un arrosage
 */
export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const body = await request.json()
    const { cultureId, cultureIds, aIrriguer, marquerArrosage } = body

    // Arrosage multiple (groupe par ilot)
    if (marquerArrosage && cultureIds && Array.isArray(cultureIds)) {
      const now = new Date()
      await prisma.culture.updateMany({
        where: {
          id: { in: cultureIds },
          userId,
        },
        data: { derniereIrrigation: now },
      })
      return NextResponse.json({ success: true, date: now })
    }

    // Arrosage simple ou toggle aIrriguer
    if (typeof cultureId !== 'number') {
      return NextResponse.json(
        { error: 'ID de culture requis' },
        { status: 400 }
      )
    }

    // Verifier que la culture appartient a l'utilisateur
    const culture = await prisma.culture.findFirst({
      where: { id: cultureId, userId },
    })

    if (!culture) {
      return NextResponse.json(
        { error: 'Culture non trouvee' },
        { status: 404 }
      )
    }

    // Noter l'arrosage
    if (marquerArrosage) {
      const now = new Date()
      const updated = await prisma.culture.update({
        where: { id: cultureId },
        data: { derniereIrrigation: now },
      })
      return NextResponse.json({ success: true, data: updated, date: now })
    }

    // Toggle aIrriguer
    const updated = await prisma.culture.update({
      where: { id: cultureId },
      data: { aIrriguer },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /api/cultures/irriguer error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour', details: String(error) },
      { status: 500 }
    )
  }
}
