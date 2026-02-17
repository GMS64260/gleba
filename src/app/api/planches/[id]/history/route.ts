/**
 * API Historique d'une planche
 * GET /api/planches/[id]/history
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { PlancheHistory, CultureHistory, FertilisationHistory } from '@/lib/rotation'
import { requireAuthApi } from '@/lib/auth-utils'

interface Params {
  params: Promise<{ id: string }>
}

// Calculer l'état d'une culture
function getCultureEtat(culture: {
  semisFait: boolean
  plantationFaite: boolean
  recolteFaite: boolean
  terminee: string | null
}): string {
  if (culture.terminee === 'x') return 'Terminée'
  if (culture.terminee === 'v') return 'Vivace'
  if (culture.terminee === 'NS') return 'Non significative'
  if (culture.recolteFaite) return 'En récolte'
  if (culture.plantationFaite) return 'Plantée'
  if (culture.semisFait) return 'Semée'
  return 'Planifiée'
}

export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const plancheId = decodeURIComponent(id)

    const { searchParams } = new URL(request.url)
    const years = parseInt(searchParams.get('years') || '10', 10)
    const includeFertilisations = searchParams.get('includeFertilisations') !== 'false'

    const currentYear = new Date().getFullYear()
    const minYear = currentYear - years

    // Vérifier que la planche existe et appartient à l'utilisateur (URL param is nom)
    const planche = await prisma.planche.findUnique({
      where: {
        nom_userId: {
          nom: plancheId,
          userId: session!.user.id,
        },
      },
    })

    if (!planche) {
      return NextResponse.json({ error: 'Planche non trouvée' }, { status: 404 })
    }

    // Récupérer les cultures (use the real PK id)
    const cultures = await prisma.culture.findMany({
      where: {
        plancheId: planche.id,
        userId: session!.user.id,
        annee: { gte: minYear },
      },
      include: {
        espece: {
          include: {
            famille: true,
          },
        },
        variete: true,
        recoltes: {
          orderBy: { date: 'desc' },
        },
      },
      orderBy: [{ annee: 'desc' }, { datePlantation: 'desc' }],
    })

    // Transformer les cultures
    const culturesHistory: CultureHistory[] = cultures.map((c) => {
      const totalRecolte = c.recoltes.reduce((sum, r) => sum + r.quantite, 0)
      return {
        id: c.id,
        annee: c.annee || currentYear,
        especeId: c.especeId,
        especeNom: c.especeId,
        familleId: c.espece.familleId,
        familleNom: c.espece.famille?.id || null,
        familleCouleur: c.espece.famille?.couleur || null,
        dateSemis: c.dateSemis,
        datePlantation: c.datePlantation,
        dateRecolte: c.dateRecolte,
        terminee: c.terminee,
        etat: getCultureEtat(c),
        recoltes: c.recoltes.map((r) => ({
          date: r.date,
          quantite: r.quantite,
        })),
        totalRecolte,
      }
    })

    // Récupérer les fertilisations si demandé
    let fertilisationsHistory: FertilisationHistory[] = []
    if (includeFertilisations) {
      const fertilisations = await prisma.fertilisation.findMany({
        where: {
          plancheId: planche.id,
          userId: session!.user.id,
          date: { gte: new Date(minYear, 0, 1) },
        },
        include: {
          fertilisant: true,
        },
        orderBy: { date: 'desc' },
      })

      fertilisationsHistory = fertilisations.map((f) => ({
        id: f.id,
        date: f.date,
        fertilisantId: f.fertilisantId,
        fertilisantNom: f.fertilisantId,
        quantite: f.quantite,
        n: f.fertilisant.n,
        p: f.fertilisant.p,
        k: f.fertilisant.k,
      }))
    }

    // Années disponibles
    const yearsAvailable = [...new Set(culturesHistory.map((c) => c.annee))].sort(
      (a, b) => b - a
    )

    const response: PlancheHistory = {
      plancheId: planche.nom,
      cultures: culturesHistory,
      fertilisations: fertilisationsHistory,
      yearsAvailable,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Erreur GET history:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'historique' },
      { status: 500 }
    )
  }
}
