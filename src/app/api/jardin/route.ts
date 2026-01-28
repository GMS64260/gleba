/**
 * API Route pour le plan du jardin
 * GET /api/jardin - Récupère les planches avec positions et cultures actives
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/jardin
export async function GET(request: NextRequest) {
  try {
    const currentYear = new Date().getFullYear()

    const planches = await prisma.planche.findMany({
      select: {
        id: true,
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
          take: 1,
          orderBy: { annee: 'desc' }
        }
      },
      orderBy: { id: 'asc' }
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
