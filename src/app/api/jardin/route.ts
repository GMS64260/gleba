/**
 * API Route pour le plan du jardin
 * GET /api/jardin - Récupère les planches avec positions et cultures actives
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'

// GET /api/jardin?parcelle=ID|all|none
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const parcelle = request.nextUrl.searchParams.get('parcelle')
    const currentYear = new Date().getFullYear()

    // Filtre par parcelle (optionnel)
    const where: Record<string, unknown> = { userId: session!.user.id }
    if (parcelle && parcelle !== 'all') {
      if (parcelle === 'none') {
        where.parcelleGeoId = null
      } else {
        where.parcelleGeoId = parcelle
      }
    }

    const planches = await prisma.planche.findMany({
      where,
      select: {
        id: true,
        nom: true,
        largeur: true,
        longueur: true,
        posX: true,
        posY: true,
        rotation2D: true,
        ilot: true,
        type: true,
        parcelleGeoId: true,
        cultures: {
          where: {
            OR: [
              { annee: currentYear },
              { terminee: null }
            ]
          },
          select: {
            id: true,
            nbRangs: true,
            espacement: true,
            itp: {
              select: {
                espacementRangs: true
              }
            },
            espece: {
              select: {
                id: true,
                couleur: true,
                famille: {
                  select: { couleur: true }
                }
              }
            }
          },
          orderBy: { annee: 'desc' }
        }
      },
      orderBy: { nom: 'asc' }
    })

    return NextResponse.json(planches)
  } catch (error) {
    console.error('GET /api/jardin error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du plan' },
      { status: 500 }
    )
  }
}
