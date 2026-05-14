/**
 * API Route Météo - Alertes
 * GET /api/meteo/alerts → alertes météo pour toutes les parcelles de l'utilisateur
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { fetchOpenMeteoForecast, fetchOpenMeteoHistory } from '@/lib/meteo'
import { genererAlertesMeteo } from '@/lib/meteo-agro'

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)

    // Récupérer toutes les parcelles avec coordonnées
    const parcelles = await prisma.parcelleGeo.findMany({
      where: {
        userId,
        centroidLat: { not: null },
        centroidLng: { not: null },
      },
      select: {
        id: true,
        nom: true,
        centroidLat: true,
        centroidLng: true,
      },
    })

    if (parcelles.length === 0) {
      return NextResponse.json({
        alertes: [],
        message: 'Aucune parcelle géoréférencée trouvée',
      })
    }

    // Éviter les appels API redondants pour les parcelles proches
    // Map: coordKey → alertes déjà calculées pour ce point
    const alertesParCoords = new Map<string, ReturnType<typeof genererAlertesMeteo>>()
    const toutesAlertes: Array<{
      parcelle: { id: string; nom: string }
      alertes: ReturnType<typeof genererAlertesMeteo>
    }> = []

    for (const parcelle of parcelles) {
      const lat = parcelle.centroidLat!
      const lng = parcelle.centroidLng!
      const key = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`

      if (alertesParCoords.has(key)) {
        // Réutiliser les alertes déjà calculées pour ces coordonnées
        toutesAlertes.push({
          parcelle: { id: parcelle.id, nom: parcelle.nom },
          alertes: alertesParCoords.get(key)!,
        })
        continue
      }

      try {
        const { daily } = await fetchOpenMeteoForecast(lat, lng)

        // Historique pour la sécheresse
        const today = new Date()
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 8)
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        let historique: Awaited<ReturnType<typeof fetchOpenMeteoHistory>> = []
        try {
          historique = await fetchOpenMeteoHistory(
            lat, lng,
            weekAgo.toISOString().split('T')[0],
            yesterday.toISOString().split('T')[0]
          )
        } catch { /* ignore */ }

        const alertes = genererAlertesMeteo(daily, historique)

        alertesParCoords.set(key, alertes)
        toutesAlertes.push({
          parcelle: { id: parcelle.id, nom: parcelle.nom },
          alertes,
        })
      } catch {
        // Parcelle inaccessible, on continue
      }
    }

    // Aplatir et dédupliquer les alertes
    const alertesUniques = toutesAlertes.flatMap(a =>
      a.alertes.map(alerte => ({
        ...alerte,
        parcelle: a.parcelle,
      }))
    )

    // Trier par niveau de danger puis par date
    const ordreNiveau = { danger: 0, attention: 1, info: 2 }
    alertesUniques.sort((a, b) =>
      ordreNiveau[a.niveau] - ordreNiveau[b.niveau] || a.date.localeCompare(b.date)
    )

    return NextResponse.json({
      alertes: alertesUniques,
      total: alertesUniques.length,
      dangers: alertesUniques.filter(a => a.niveau === 'danger').length,
    })
  } catch (err) {
    console.error('GET /api/meteo/alerts error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des alertes météo' },
      { status: 500 }
    )
  }
}
