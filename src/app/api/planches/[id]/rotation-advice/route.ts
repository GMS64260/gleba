/**
 * API Conseils de rotation pour une planche
 * GET /api/planches/[id]/rotation-advice
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateRotationAdvice } from '@/lib/rotation'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const plancheId = decodeURIComponent(id)

    const { searchParams } = new URL(request.url)
    const targetYear = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10)
    const especeId = searchParams.get('especeId')

    // Vérifier que la planche existe
    const planche = await prisma.planche.findUnique({
      where: { id: plancheId },
    })

    if (!planche) {
      return NextResponse.json({ error: 'Planche non trouvée' }, { status: 404 })
    }

    // Récupérer les cultures des 10 dernières années
    const minYear = targetYear - 10
    const cultures = await prisma.culture.findMany({
      where: {
        plancheId,
        annee: { gte: minYear },
      },
      include: {
        espece: {
          include: {
            famille: true,
          },
        },
      },
    })

    // Récupérer toutes les familles
    const allFamilies = await prisma.famille.findMany()

    // Préparer les données pour l'algorithme
    const culturesData = cultures.map((c) => ({
      annee: c.annee || targetYear,
      especeId: c.especeId,
      espece: {
        id: c.especeId,
        familleId: c.espece.familleId,
        famille: c.espece.famille
          ? {
              id: c.espece.famille.id,
              intervalle: c.espece.famille.intervalle ?? 4,
              couleur: c.espece.famille.couleur,
            }
          : null,
        besoinN: c.espece.besoinN,
        besoinP: c.espece.besoinP,
        besoinK: c.espece.besoinK,
      },
    }))

    const familiesData = allFamilies.map((f) => ({
      id: f.id,
      intervalle: f.intervalle ?? 4,
      couleur: f.couleur,
    }))

    // Préparer l'espèce à vérifier si demandée
    let especeToCheck = undefined
    if (especeId) {
      const espece = await prisma.espece.findUnique({
        where: { id: especeId },
      })
      if (espece) {
        especeToCheck = {
          id: espece.id,
          familleId: espece.familleId,
          besoinN: espece.besoinN,
        }
      }
    }

    // Calculer les conseils
    const advice = calculateRotationAdvice({
      plancheId,
      targetYear,
      cultures: culturesData,
      allFamilies: familiesData,
      especeToCheck,
    })

    return NextResponse.json(advice)
  } catch (error) {
    console.error('Erreur GET rotation-advice:', error)
    return NextResponse.json(
      { error: 'Erreur lors du calcul des conseils de rotation' },
      { status: 500 }
    )
  }
}
