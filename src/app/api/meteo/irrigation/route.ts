/**
 * API Route Météo - Recommandations d'irrigation intelligentes
 * GET /api/meteo/irrigation → recommandations pour toutes les cultures actives
 * GET /api/meteo/irrigation?parcelleId=X → filtré par parcelle
 * GET /api/meteo/irrigation?refresh=1 → force le recalcul (ignore le cache)
 *
 * Cache en mémoire TTL 1h — recalcul automatique à la première connexion après expiration.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { fetchEcowittData, fetchOpenMeteoForecast, fetchOpenMeteoHistory, fetchWundergroundData } from '@/lib/meteo'
import { adapterConseilSousAbri, genererRecommandationIrrigation } from '@/lib/meteo-agro'
import { irrigationCache, irrigationCacheKey } from '@/lib/irrigation-cache'
import { cultureIrrigationDemarreeWhere } from '@/lib/irrigation-eligibility'
import { grouperRecommandationsParPlanche } from '@/lib/irrigation-planche'
import type { MeteoJournaliere, MeteoPrevision } from '@/lib/meteo'
import type { Prisma } from '@prisma/client'

const TYPES_SOUS_ABRI = ['Serre', 'Tunnel', 'Châssis', 'Chassis']

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)
    const parcelleId = searchParams.get('parcelleId')
    const forceRefresh = searchParams.get('refresh') === '1'

    const station = await prisma.stationMeteo.findFirst({ where: { userId, active: true } })
    let stationToday: MeteoJournaliere | null = null
    if (station?.provider === 'ecowitt' && station.appKey && station.apiKey) {
      stationToday = await fetchEcowittData(station.appKey, station.apiKey, station.stationId)
    } else if (station?.provider === 'wunderground' && station.apiKey) {
      stationToday = await fetchWundergroundData(station.apiKey, station.stationId)
    } else if (station?.provider === 'open-meteo-reference' && station.lat && station.lng) {
      stationToday = (await fetchOpenMeteoForecast(station.lat, station.lng)).daily[0] ?? null
    }

    const cacheKey = irrigationCacheKey(userId, parcelleId)

    // Vérifier le cache (sauf si refresh forcé)
    if (!forceRefresh) {
      const cached = irrigationCache.get(cacheKey) as {
        data: unknown; cachedAt: Date; ageSeconds: number
      } | null
      if (cached) {
        const payload = cached.data as Record<string, unknown>
        return NextResponse.json({
          ...payload,
          cached: true,
          cachedAt: cached.cachedAt.toISOString(),
          cacheAgeMinutes: Math.floor(cached.ageSeconds / 60),
        })
      }
    }

    // ── Calcul complet ──────────────────────────────────────────

    // Récupérer les cultures actives (non terminées) avec leurs planches et parcelles
    const whereClause: Prisma.CultureWhereInput = {
      userId,
      terminee: null,
      AND: [cultureIrrigationDemarreeWhere],
      planche: parcelleId
        ? { is: { parcelleGeoId: parcelleId } }
        : { isNot: null },
    }

    const cultures = await prisma.culture.findMany({
      where: whereClause,
      include: {
        espece: {
          select: { id: true, nom: true, besoinEau: true },
        },
        variete: { select: { nom: true } },
        planche: {
          select: {
            id: true,
            nom: true,
            type: true,
            irrigation: true,
            surface: true,
            retentionEau: true,
            typeSol: true,
            parcelleGeo: {
              select: {
                id: true,
                centroidLat: true,
                centroidLng: true,
              },
            },
          },
        },
      },
    })

    if (cultures.length === 0) {
      const result = { recommandations: [], total: 0, urgentes: 0, message: 'Aucune culture active trouvée' }
      irrigationCache.set(cacheKey, result)
      return NextResponse.json({ ...result, cached: false, cachedAt: new Date().toISOString(), cacheAgeMinutes: 0 })
    }

    // Fallback coords : première parcelle géo de l'utilisateur
    let fallbackLat: number | null = null
    let fallbackLng: number | null = null
    const premiereParcelle = await prisma.parcelleGeo.findFirst({
      where: { userId, centroidLat: { not: null }, centroidLng: { not: null } },
      select: { centroidLat: true, centroidLng: true },
    })
    if (premiereParcelle?.centroidLat && premiereParcelle?.centroidLng) {
      fallbackLat = premiereParcelle.centroidLat
      fallbackLng = premiereParcelle.centroidLng
    }

    // Regrouper les cultures par coordonnées de parcelle (évite les appels API redondants)
    const parCoords = new Map<string, {
      lat: number
      lng: number
      cultures: typeof cultures
    }>()

    for (const culture of cultures) {
      const lat = culture.planche?.parcelleGeo?.centroidLat ?? fallbackLat
      const lng = culture.planche?.parcelleGeo?.centroidLng ?? fallbackLng
      if (!lat || !lng) continue

      const key = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`
      if (!parCoords.has(key)) {
        parCoords.set(key, { lat, lng, cultures: [] })
      }
      parCoords.get(key)!.cultures.push(culture)
    }

    const recommandationsCultures = []

    for (const [, group] of parCoords) {
      let historique7j: MeteoJournaliere[]
      let previsions: MeteoPrevision[]

      try {
        const today = new Date()
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 8)
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        historique7j = await fetchOpenMeteoHistory(
          group.lat, group.lng,
          weekAgo.toISOString().split('T')[0],
          yesterday.toISOString().split('T')[0]
        )

        const forecast = await fetchOpenMeteoForecast(group.lat, group.lng)
        previsions = forecast.daily
        if (stationToday && previsions[0]?.date === stationToday.date) {
          previsions[0] = {
            ...previsions[0],
            precipitation: stationToday.precipitation,
            tempMin: stationToday.tempMin,
            tempMax: stationToday.tempMax,
            windSpeedMax: stationToday.windSpeedMax,
          }
        }
      } catch {
        continue
      }

      for (const culture of group.cultures) {
        const sousAbri = TYPES_SOUS_ABRI.includes(culture.planche?.type ?? '')

        // Sous abri : neutraliser les précipitations extérieures dans le calcul
        const historiquePourCalcul: MeteoJournaliere[] = sousAbri
          ? historique7j.map(d => ({ ...d, precipitation: 0 }))
          : historique7j
        const previsionsPourCalcul = sousAbri
          ? previsions.map(d => ({ ...d, precipitation: 0 }))
          : previsions

        const reco = genererRecommandationIrrigation(
          historiquePourCalcul,
          previsionsPourCalcul,
          {
            id: culture.id,
            espece: culture.espece.nom || culture.especeId,
            besoinEau: culture.espece.besoinEau ?? 3,
            dateSemis: culture.dateSemis,
            derniereIrrigation: culture.derniereIrrigation,
          },
          {
            nom: culture.planche!.nom,
            surface: culture.planche!.surface ?? 10,
            retentionEau: culture.planche!.retentionEau,
            typeSol: culture.planche!.typeSol,
          }
        )

        if (sousAbri) {
          reco.conseilMessage = adapterConseilSousAbri(reco.conseilMessage)
          reco.pluiePrevue48h = 0
          reco.prochainePluie = null
          reco.joursSansPluie = 0
        }

        recommandationsCultures.push({
          ...reco,
          plancheId: culture.planche!.id,
          varietyName: culture.variete?.nom ?? null,
          etatCulture: culture.plantationFaite ? 'Plantée' : 'Semée',
          derniereIrrigation: culture.derniereIrrigation?.toISOString() ?? null,
          irrigationSysteme: culture.planche?.irrigation ?? null,
        })
      }
    }

    // Une action d'arrosage concerne la planche entière. Sur une planche
    // multiculture, une seule alerte est affichée et le besoin le plus
    // exigeant pilote la recommandation.
    const recommandations = grouperRecommandationsParPlanche(recommandationsCultures)

    // Trier par urgence
    const ordreUrgence = { critique: 0, haute: 1, moyenne: 2, faible: 3, aucune: 4 }
    recommandations.sort((a, b) =>
      ordreUrgence[a.urgence] - ordreUrgence[b.urgence]
    )

    const result = {
      recommandations,
      total: recommandations.length,
      totalCultures: recommandationsCultures.length,
      urgentes: recommandations.filter(r => r.urgence === 'critique' || r.urgence === 'haute').length,
    }

    // Stocker en cache
    irrigationCache.set(cacheKey, result)

    return NextResponse.json({
      ...result,
      cached: false,
      cachedAt: new Date().toISOString(),
      cacheAgeMinutes: 0,
    })
  } catch (err) {
    console.error('GET /api/meteo/irrigation error:', err)
    return NextResponse.json(
      { error: "Erreur lors du calcul des recommandations d'irrigation" },
      { status: 500 }
    )
  }
}
