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
import { fetchOpenMeteoForecast, fetchOpenMeteoHistory } from '@/lib/meteo'
import { genererRecommandationIrrigation } from '@/lib/meteo-agro'
import { irrigationCache, irrigationCacheKey } from '@/lib/irrigation-cache'
import type { MeteoJournaliere, MeteoPrevision } from '@/lib/meteo'

const TYPES_SOUS_ABRI = ['Serre', 'Tunnel', 'Châssis', 'Chassis']

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)
    const parcelleId = searchParams.get('parcelleId')
    const forceRefresh = searchParams.get('refresh') === '1'

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
    const whereClause: any = {
      userId,
      terminee: null,
      planche: { isNot: null },
    }

    if (parcelleId) {
      whereClause.planche = { ...whereClause.planche, parcelleGeoId: parcelleId }
    }

    const cultures = await prisma.culture.findMany({
      where: whereClause,
      include: {
        espece: {
          select: { id: true, besoinEau: true },
        },
        planche: {
          select: {
            nom: true,
            type: true,
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

    const recommandations = []

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
            espece: culture.especeId,
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
          reco.conseilMessage = reco.conseilMessage
            .replace(/\d+mm de pluie prévus[^.]*\./g, '')
            .replace(/Pluie prevue le [^.]+\./g, '')
            .replace(/\d+ jours sans pluie\./g, '')
            .replace(/Déficit hydrique de [^.]+\./g, '')
            .trim()
          if (reco.conseilMessage && !reco.conseilMessage.endsWith('.')) {
            reco.conseilMessage += '.'
          }
          reco.conseilMessage = `Sous abri — pas de pluie directe. ${reco.conseilMessage}`.trim()
          reco.pluiePrevue48h = 0
          reco.prochainePluie = null
          reco.joursSansPluie = 0
        }

        recommandations.push(reco)
      }
    }

    // Trier par urgence
    const ordreUrgence = { critique: 0, haute: 1, moyenne: 2, faible: 3, aucune: 4 }
    recommandations.sort((a, b) =>
      ordreUrgence[a.urgence] - ordreUrgence[b.urgence]
    )

    const result = {
      recommandations,
      total: recommandations.length,
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
