/**
 * API Export des données
 * GET /api/export?format=json|csv
 * Exporte uniquement les données de l'utilisateur connecté
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const userId = session!.user.id

    // Récupérer toutes les données de l'utilisateur
    const [
      // Référentiels globaux
      familles,
      especes,
      varietes,
      rotations,
      rotationDetails,
      itps,
      fertilisants,
      fournisseurs,
      // Données utilisateur
      planches,
      cultures,
      recoltes,
      fertilisations,
      analyses,
      objetsJardin,
      arbres,
    ] = await Promise.all([
      // Référentiels globaux (partagés)
      prisma.famille.findMany(),
      prisma.espece.findMany(),
      prisma.variete.findMany(),
      prisma.rotation.findMany(),
      prisma.rotationDetail.findMany(),
      prisma.iTP.findMany(),
      prisma.fertilisant.findMany(),
      prisma.fournisseur.findMany(),
      // Données utilisateur (filtrées)
      prisma.planche.findMany({ where: { userId } }),
      prisma.culture.findMany({ where: { userId } }),
      prisma.recolte.findMany({ where: { userId } }),
      prisma.fertilisation.findMany({ where: { userId } }),
      prisma.analyseSol.findMany({ where: { userId } }),
      prisma.objetJardin.findMany({ where: { userId } }),
      prisma.arbre.findMany({ where: { userId } }),
    ])

    const data = {
      exportDate: new Date().toISOString(),
      version: '1.1',
      userId,
      // Référentiels
      familles,
      especes,
      varietes,
      rotations,
      rotationDetails,
      itps,
      fertilisants,
      fournisseurs,
      // Données utilisateur
      planches,
      cultures,
      recoltes,
      fertilisations,
      analyses,
      objetsJardin,
      arbres,
    }

    if (format === 'json') {
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="potaleger_export_${new Date().toISOString().split('T')[0]}.json"`,
        },
      })
    }

    // Format CSV - créer un fichier avec plusieurs CSV
    if (format === 'csv') {
      const csvData: Record<string, string> = {}

      // Fonction pour convertir un tableau d'objets en CSV
      const toCSV = (arr: Record<string, unknown>[]): string => {
        if (arr.length === 0) return ''
        const headers = Object.keys(arr[0])
        const rows = arr.map((obj) =>
          headers
            .map((h) => {
              const val = obj[h]
              if (val === null || val === undefined) return ''
              if (typeof val === 'object') return JSON.stringify(val).replace(/"/g, '""')
              return String(val).replace(/"/g, '""')
            })
            .map((v) => `"${v}"`)
            .join(',')
        )
        return [headers.join(','), ...rows].join('\n')
      }

      if (familles.length) csvData['familles.csv'] = toCSV(familles as Record<string, unknown>[])
      if (especes.length) csvData['especes.csv'] = toCSV(especes as Record<string, unknown>[])
      if (varietes.length) csvData['varietes.csv'] = toCSV(varietes as Record<string, unknown>[])
      if (planches.length) csvData['planches.csv'] = toCSV(planches as Record<string, unknown>[])
      if (cultures.length) csvData['cultures.csv'] = toCSV(cultures as Record<string, unknown>[])
      if (recoltes.length) csvData['recoltes.csv'] = toCSV(recoltes as Record<string, unknown>[])
      if (fertilisations.length) csvData['fertilisations.csv'] = toCSV(fertilisations as Record<string, unknown>[])
      if (objetsJardin.length) csvData['objets_jardin.csv'] = toCSV(objetsJardin as Record<string, unknown>[])
      if (arbres.length) csvData['arbres.csv'] = toCSV(arbres as Record<string, unknown>[])

      return new NextResponse(JSON.stringify(csvData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="potaleger_export_${new Date().toISOString().split('T')[0]}_csv.json"`,
        },
      })
    }

    return NextResponse.json({ error: 'Format non supporté' }, { status: 400 })
  } catch (error) {
    console.error('Erreur export:', error)
    return NextResponse.json({ error: "Erreur lors de l'export" }, { status: 500 })
  }
}
