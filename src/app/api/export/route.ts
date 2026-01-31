/**
 * API Export des données
 * GET /api/export?format=json
 * Exporte les données de l'utilisateur connecté + référentiels globaux
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

    // Récupérer toutes les données
    const [
      // Référentiels globaux (partagés entre tous les utilisateurs)
      familles,
      fournisseurs,
      especes,
      varietes,
      itps,
      rotations,
      rotationDetails,
      fertilisants,
      associations,
      associationDetails,
      // Données utilisateur (filtrées par userId)
      planches,
      cultures,
      recoltes,
      fertilisations,
      analyses,
      objetsJardin,
      arbres,
    ] = await Promise.all([
      // Référentiels globaux
      prisma.famille.findMany({ orderBy: { id: 'asc' } }),
      prisma.fournisseur.findMany({ orderBy: { id: 'asc' } }),
      prisma.espece.findMany({ orderBy: { id: 'asc' } }),
      prisma.variete.findMany({ orderBy: { id: 'asc' } }),
      prisma.iTP.findMany({ orderBy: { id: 'asc' } }),
      prisma.rotation.findMany({ orderBy: { id: 'asc' } }),
      prisma.rotationDetail.findMany({ orderBy: { id: 'asc' } }),
      prisma.fertilisant.findMany({ orderBy: { id: 'asc' } }),
      prisma.association.findMany({ orderBy: { nom: 'asc' } }),
      prisma.associationDetail.findMany({ orderBy: { id: 'asc' } }),
      // Données utilisateur
      prisma.planche.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      prisma.culture.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      prisma.recolte.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      prisma.fertilisation.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      prisma.analyseSol.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      prisma.objetJardin.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      prisma.arbre.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
    ])

    // Nettoyer les données utilisateur (supprimer le champ odonnées utilisateur (supprimer le champ odonnées utilisateur (supprimer le champ userId pour l'export)
    const cleanPlanches = planches.map(({ userId: _, ...rest }) => rest)
    const cleanCultures = cultures.map(({ userId: _, createdAt: __, updatedAt: ___, ...rest }) => rest)
    const cleanRecoltes = recoltes.map(({ userId: _, createdAt: __, ...rest }) => rest)
    const cleanFertilisations = fertilisations.map(({ userId: _, createdAt: __, ...rest }) => rest)
    const cleanAnalyses = analyses.map(({ userId: _, ...rest }) => rest)
    const cleanObjetsJardin = objetsJardin.map(({ userId: _, createdAt: __, ...rest }) => rest)
    const cleanArbres = arbres.map(({ userId: _, createdAt: __, updatedAt: ___, ...rest }) => rest)

    const data = {
      exportDate: new Date().toISOString(),
      version: '1.2',
      // Référentiels globaux
      familles,
      fournisseurs,
      especes,
      varietes,
      itps,
      rotations,
      rotationDetails,
      fertilisants,
      associations,
      associationDetails,
      // Données utilisateur
      planches: cleanPlanches,
      cultures: cleanCultures,
      recoltes: cleanRecoltes,
      fertilisations: cleanFertilisations,
      analyses: cleanAnalyses,
      objetsJardin: cleanObjetsJardin,
      arbres: cleanArbres,
    }

    // Statistiques
    const stats = {
      familles: familles.length,
      fournisseurs: fournisseurs.length,
      especes: especes.length,
      varietes: varietes.length,
      itps: itps.length,
      rotations: rotations.length,
      rotationDetails: rotationDetails.length,
      fertilisants: fertilisants.length,
      associations: associations.length,
      associationDetails: associationDetails.length,
      planches: planches.length,
      cultures: cultures.length,
      recoltes: recoltes.length,
      fertilisations: fertilisations.length,
      analyses: analyses.length,
      objetsJardin: objetsJardin.length,
      arbres: arbres.length,
    }

    if (format === 'json') {
      const filename = `gleba_export_${new Date().toISOString().split('T')[0]}.json`

      return new NextResponse(JSON.stringify({ ...data, stats }, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // Format CSV - créer un objet avec chaque table en CSV
    if (format === 'csv') {
      // Fonction pour convertir un tableau d'objets en CSV
      const toCSV = (arr: Record<string, unknown>[]): string => {
        if (arr.length === 0) return ''
        const headers = Object.keys(arr[0])
        const rows = arr.map((obj) =>
          headers
            .map((h) => {
              const val = obj[h]
              if (val === null || val === undefined) return ''
              if (val instanceof Date) return val.toISOString()
              if (typeof val === 'object') return JSON.stringify(val).replace(/"/g, '""')
              return String(val).replace(/"/g, '""')
            })
            .map((v) => `"${v}"`)
            .join(',')
        )
        return [headers.join(','), ...rows].join('\n')
      }

      const csvFiles: Record<string, string> = {}

      if (familles.length) csvFiles['familles.csv'] = toCSV(familles as Record<string, unknown>[])
      if (fournisseurs.length) csvFiles['fournisseurs.csv'] = toCSV(fournisseurs as Record<string, unknown>[])
      if (especes.length) csvFiles['especes.csv'] = toCSV(especes as Record<string, unknown>[])
      if (varietes.length) csvFiles['varietes.csv'] = toCSV(varietes as Record<string, unknown>[])
      if (itps.length) csvFiles['itps.csv'] = toCSV(itps as Record<string, unknown>[])
      if (rotations.length) csvFiles['rotations.csv'] = toCSV(rotations as Record<string, unknown>[])
      if (rotationDetails.length) csvFiles['rotation_details.csv'] = toCSV(rotationDetails as Record<string, unknown>[])
      if (fertilisants.length) csvFiles['fertilisants.csv'] = toCSV(fertilisants as Record<string, unknown>[])
      if (associations.length) csvFiles['associations.csv'] = toCSV(associations as Record<string, unknown>[])
      if (associationDetails.length) csvFiles['association_details.csv'] = toCSV(associationDetails as Record<string, unknown>[])
      if (cleanPlanches.length) csvFiles['planches.csv'] = toCSV(cleanPlanches as Record<string, unknown>[])
      if (cleanCultures.length) csvFiles['cultures.csv'] = toCSV(cleanCultures as Record<string, unknown>[])
      if (cleanRecoltes.length) csvFiles['recoltes.csv'] = toCSV(cleanRecoltes as Record<string, unknown>[])
      if (cleanFertilisations.length) csvFiles['fertilisations.csv'] = toCSV(cleanFertilisations as Record<string, unknown>[])
      if (cleanAnalyses.length) csvFiles['analyses_sol.csv'] = toCSV(cleanAnalyses as Record<string, unknown>[])
      if (cleanObjetsJardin.length) csvFiles['objets_jardin.csv'] = toCSV(cleanObjetsJardin as Record<string, unknown>[])
      if (cleanArbres.length) csvFiles['arbres.csv'] = toCSV(cleanArbres as Record<string, unknown>[])

      // Retourner un JSON contenant tous les CSV (le client peut les séparer)
      const filename = `gleba_export_csv_${new Date().toISOString().split('T')[0]}.json`

      return new NextResponse(JSON.stringify({ files: csvFiles, stats }, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    return NextResponse.json({ error: 'Format non supporté. Utilisez json ou csv.' }, { status: 400 })
  } catch (error) {
    console.error('Erreur export:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'export", details: String(error) },
      { status: 500 }
    )
  }
}
