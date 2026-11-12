/**
 * API Route Météo - Alertes
 * GET /api/meteo/alerts → alertes météo pour toutes les parcelles de l'utilisateur
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { fetchOpenMeteoForecast, fetchOpenMeteoHistory } from '@/lib/meteo'
import { genererAlertesMeteo } from '@/lib/meteo-agro'
import { jourCivilLocalISO } from '@/lib/irrigation-meteo-decision'

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

    // Un point météo par centième de degré (environ 1 km) : les parcelles
    // voisines partagent les mêmes prévisions, donc les mêmes alertes.
    type ParcelleRef = { id: string; nom: string }
    const points = new Map<string, { lat: number; lng: number; parcelles: ParcelleRef[] }>()
    for (const parcelle of parcelles) {
      const lat = parcelle.centroidLat!
      const lng = parcelle.centroidLng!
      const key = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`
      const point = points.get(key)
      const ref = { id: parcelle.id, nom: parcelle.nom }
      if (point) point.parcelles.push(ref)
      else points.set(key, { lat, lng, parcelles: [ref] })
    }

    // Bornes d'archive en jours civils du serveur : en jours UTC, la fenêtre
    // glissait d'un jour entre minuit et 1 h ou 2 h du matin.
    const maintenant = new Date()
    const debutArchive = new Date(maintenant)
    debutArchive.setDate(debutArchive.getDate() - 8)
    const hier = new Date(maintenant)
    hier.setDate(hier.getDate() - 1)
    const start = jourCivilLocalISO(debutArchive)
    const end = jourCivilLocalISO(hier)

    // Les points sont interrogés ensemble : en série, une exploitation
    // dispersée attendait la somme des délais.
    const resultats = await Promise.all(
      [...points.values()].map(async (point) => {
        try {
          const [{ daily }, historique] = await Promise.all([
            fetchOpenMeteoForecast(point.lat, point.lng),
            // L'archive ne sert qu'à l'alerte sécheresse : sa panne ne doit pas
            // faire perdre les alertes de prévision.
            fetchOpenMeteoHistory(point.lat, point.lng, start, end).catch(() => []),
          ])
          return { point, alertes: genererAlertesMeteo(daily, historique) }
        } catch {
          return { point, alertes: null }
        }
      })
    )

    // Une panne météo ne doit pas se lire « aucune alerte ».
    const parcellesSansMeteo = resultats
      .filter((r) => r.alertes === null)
      .flatMap((r) => r.point.parcelles)
    if (parcellesSansMeteo.length === parcelles.length) {
      return NextResponse.json(
        { error: 'Prévisions météo momentanément indisponibles' },
        { status: 503 }
      )
    }

    // Une alerte par événement et par point : `parcelle` (première concernée)
    // reste pour les clients existants, `parcelles` les liste toutes.
    const alertesUniques = resultats.flatMap((r) =>
      (r.alertes ?? []).map((alerte) => ({
        ...alerte,
        parcelle: r.point.parcelles[0],
        parcelles: r.point.parcelles,
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
      ...(parcellesSansMeteo.length > 0 ? { parcellesSansMeteo } : {}),
    })
  } catch (err) {
    console.error('GET /api/meteo/alerts error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des alertes météo' },
      { status: 500 }
    )
  }
}
