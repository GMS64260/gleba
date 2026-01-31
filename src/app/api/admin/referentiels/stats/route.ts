/**
 * API Admin - Stats référentiels
 * GET /api/admin/referentiels/stats
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  // Vérifier que l'utilisateur est admin
  if (session!.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès refusé - Admin requis' }, { status: 403 })
  }

  try {
    const [
      familles,
      fournisseurs,
      especes,
      varietes,
      itps,
      fertilisants,
      associations,
      rotations,
    ] = await Promise.all([
      prisma.famille.count(),
      prisma.fournisseur.count(),
      prisma.espece.count(),
      prisma.variete.count(),
      prisma.iTP.count(),
      prisma.fertilisant.count(),
      prisma.association.count(),
      prisma.rotation.count(),
    ])

    return NextResponse.json({
      familles,
      fournisseurs,
      especes,
      varietes,
      itps,
      fertilisants,
      associations,
      rotations,
    })
  } catch (error) {
    console.error('GET /api/admin/referentiels/stats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
