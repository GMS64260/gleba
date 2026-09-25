/**
 * API Export des données
 * GET /api/export?format=json — potager + référentiels (format relu par l'import partiel)
 * GET /api/export?format=csv  — archive ZIP, un CSV par table de toutes les données du compte
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'
import { refusSiPasProprietaire } from '@/lib/exploitation/garde-session'
import { exporterDonneesTabulaires } from '@/lib/export-tabulaire'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const userId = session!.user.id

    // Format CSV : une vraie archive ZIP, un CSV par table de TOUTES les données
    // du compte (élevage, verger, gestion… et plus seulement le potager).
    // Signalement 2026-09-25 : on renvoyait du JSON que l'écran enregistrait
    // sous `.zip`, fichier refusé par l'Utilitaire d'archive de macOS.
    if (format === 'csv') {
      // Comme la sauvegarde complète, l'export emporte toute l'exploitation.
      const refus = refusSiPasProprietaire(session)
      if (refus) return refus
      const { archive } = await exporterDonneesTabulaires(userId)
      const filename = `gleba_export_tableur_${new Date().toISOString().split('T')[0]}.zip`
      return new NextResponse(new Uint8Array(archive), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    // Référentiels communautaires : on n'exporte que ce que CET utilisateur a le
    // droit de voir. Les `findMany` étaient nus sous un commentaire « partagés
    // entre tous les utilisateurs » qui n'est vrai que du catalogue officiel :
    // les espèces, variétés et ITP PRIVÉS des autres membres partaient dans le
    // fichier téléchargé, avec leur `user_id`. La règle est la même que celle
    // des écrans (src/lib/referentiel-communaute.ts).
    const visible = visibiliteReferentiel(userId)

    // Récupérer toutes les données
    const [
      // Référentiels communautaires (catalogue officiel + partagés + les miens)
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
      prisma.espece.findMany({ where: visible, orderBy: { id: 'asc' } }),
      prisma.variete.findMany({ where: visible, orderBy: { id: 'asc' } }),
      prisma.iTP.findMany({ where: visible, orderBy: { id: 'asc' } }),
      prisma.rotation.findMany({ orderBy: { id: 'asc' } }),
      prisma.rotationDetail.findMany({ orderBy: { id: 'asc' } }),
      prisma.fertilisant.findMany({ orderBy: { id: 'asc' } }),
      prisma.association.findMany({ orderBy: { nom: 'asc' } }),
      prisma.associationDetail.findMany({ orderBy: { id: 'asc' } }),
      // Données utilisateur
      prisma.planche.findMany({ where: { userId }, orderBy: { nom: 'asc' } }),
      prisma.culture.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      prisma.recolte.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      prisma.fertilisation.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      prisma.analyseSol.findMany({ where: { userId }, orderBy: { nom: 'asc' } }),
      prisma.objetJardin.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      prisma.arbre.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
    ])

    // Nettoyer les données utilisateur (supprimer le champ userId pour l'export)
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

    return NextResponse.json({ error: 'Format non supporté. Utilisez json ou csv.' }, { status: 400 })
  } catch (error) {
    console.error('Erreur export:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'export", details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
