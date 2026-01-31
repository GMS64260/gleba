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
          },
        },
        variete: {
          select: {
            id: true,
          },
        },
      },
      orderBy: [
        { planche: { ilot: 'asc' } },
        { planche: { id: 'asc' } },
      ],
    })

    // Grouper par ilot
    const parIlot: Record<string, typeof cultures> = {}
    for (const culture of cultures) {
      const ilot = culture.planche?.ilot || 'Sans ilot'
      if (!parIlot[ilot]) {
        parIlot[ilot] = []
      }
      parIlot[ilot].push(culture)
    }

    return NextResponse.json({
      data: cultures,
      parIlot,
      stats: {
        total: cultures.length,
        nbIlots: Object.keys(parIlot).length,
      },
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
