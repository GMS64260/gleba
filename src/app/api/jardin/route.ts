/**
 * API Route pour le plan du jardin
 * GET /api/jardin - Récupère les planches avec positions et cultures actives
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'

// GET /api/jardin
export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const currentYear = new Date().getFullYear()

    const planches = await prisma.planche.findMany({
      where: { userId: session!.user.id },
      select: {
        id: true,
        nom: true,
        largeur: true,
        longueur: true,
        posX: true,
        posY: true,
        rotation2D: true,
        ilot: true,
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
