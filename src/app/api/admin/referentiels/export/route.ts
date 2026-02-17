/**
 * API Admin - Export référentiels
 * GET /api/admin/referentiels/export?type=especes|all
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdminApi } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAdminApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'

    let data: any = {}

    // Fonction helper pour récupérer un référentiel
    const getRef = async (refType: string) => {
      switch (refType) {
        case 'familles':
          return await prisma.famille.findMany({ orderBy: { id: 'asc' } })
        case 'fournisseurs':
          return await prisma.fournisseur.findMany({ orderBy: { id: 'asc' } })
        case 'especes':
          return await prisma.espece.findMany({ orderBy: { id: 'asc' } })
        case 'varietes':
          return await prisma.variete.findMany({ orderBy: { id: 'asc' } })
        case 'itps':
          return await prisma.iTP.findMany({ orderBy: { id: 'asc' } })
        case 'fertilisants':
          return await prisma.fertilisant.findMany({ orderBy: { id: 'asc' } })
        case 'associations':
          const assocs = await prisma.association.findMany({
            include: { details: true },
            orderBy: { id: 'asc' },
          })
          return assocs.map(a => ({
            ...a,
            details: a.details.map(d => ({
              id: d.id,
              associationId: d.associationId,
              especeId: d.especeId,
              familleId: d.familleId,
              groupe: d.groupe,
              requise: d.requise,
              notes: d.notes,
            })),
          }))
        case 'rotations':
          const rots = await prisma.rotation.findMany({
            include: { details: true },
            orderBy: { id: 'asc' },
          })
          return rots.map(r => ({
            ...r,
            details: r.details.map(d => ({
              id: d.id,
              rotationId: d.rotationId,
              itpId: d.itpId,
              annee: d.annee,
            })),
          }))
        default:
          return []
      }
    }

    if (type === 'all') {
      // Export complet
      data = {
        familles: await getRef('familles'),
        fournisseurs: await getRef('fournisseurs'),
        especes: await getRef('especes'),
        varietes: await getRef('varietes'),
        itps: await getRef('itps'),
        fertilisants: await getRef('fertilisants'),
        associations: await getRef('associations'),
        rotations: await getRef('rotations'),
        exportDate: new Date().toISOString(),
        version: '1.0.0',
      }
    } else {
      // Export d'un seul type
      data = {
        [type]: await getRef(type),
        exportDate: new Date().toISOString(),
        version: '1.0.0',
      }
    }

    const json = JSON.stringify(data, null, 2)
    const buffer = Buffer.from(json, 'utf-8')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${type}_${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (error) {
    console.error('GET /api/admin/referentiels/export error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'export' },
      { status: 500 }
    )
  }
}
