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
          // Audit #36 : « cultures en cours » = année courante ET non terminée.
          // L'ancien OR incluait les cultures terminées de l'année (annee=currentYear
          // matchait même avec terminee renseigné) → affichées comme en cours.
          where: {
            annee: currentYear,
            terminee: null,
          },
          select: {
            id: true,
            nbRangs: true,
            espacement: true,
            // Dates réelles : servent au « plan vivant » (croissance interpolée)
            dateSemis: true,
            datePlantation: true,
            dateRecolte: true,
            finRecolte: true,
            itp: {
              select: {
                espacementRangs: true,
                espacement: true,
                dureeCulture: true,
                dureeRecolte: true
              }
            },
            espece: {
              select: {
                id: true,
                nom: true,
                couleur: true,
                etalement: true,
                famille: {
                  select: { id: true, couleur: true }
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
