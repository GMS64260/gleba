/**
 * API Export des données
 * GET /api/export?format=json|csv
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    // Récupérer toutes les données
    const [
      familles,
      especes,
      varietes,
      planches,
      rotations,
      rotationDetails,
      itps,
      cultures,
      recoltes,
      fertilisants,
      fertilisations,
      fournisseurs,
      analyses,
      objetsJardin,
    ] = await Promise.all([
      prisma.famille.findMany(),
      prisma.espece.findMany(),
      prisma.variete.findMany(),
      prisma.planche.findMany(),
      prisma.rotation.findMany(),
      prisma.rotationDetail.findMany(),
      prisma.iTP.findMany(),
      prisma.culture.findMany(),
      prisma.recolte.findMany(),
      prisma.fertilisant.findMany(),
      prisma.fertilisation.findMany(),
      prisma.fournisseur.findMany(),
      prisma.analyseSol.findMany(),
      prisma.objetJardin.findMany(),
    ])

    const data = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      familles,
      especes,
      varietes,
      planches,
      rotations,
      rotationDetails,
      itps,
      cultures,
      recoltes,
      fertilisants,
      fertilisations,
      fournisseurs,
      analyses,
      objetsJardin,
    }

    if (format === 'json') {
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="potaleger_export_${new Date().toISOString().split('T')[0]}.json"`,
        },
      })
    }

    // Format CSV - créer un fichier ZIP avec plusieurs CSV
    if (format === 'csv') {
      // Pour simplifier, on retourne un JSON avec les données en format CSV-ready
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

      // Retourner comme JSON contenant les CSV (le vrai ZIP nécessiterait une lib)
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
