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
import { fetchEcowittData, fetchOpenMeteoForecast, fetchWundergroundData } from '@/lib/meteo'
import { chargerMeteoBilan, jourLocalIso, JOURS_HISTORIQUE_BILAN, type MeteoBilan } from '@/lib/irrigation/meteo-bilan'
import { whereArrosageNote } from '@/lib/irrigation/arrosages-notes'
import { genererRecommandationIrrigation } from '@/lib/meteo-agro'
import { irrigationCache, irrigationCacheKey } from '@/lib/irrigation-cache'
import { cultureIrrigationDemarreeWhere } from '@/lib/irrigation-eligibility'
import { whereCulturesEnPlace } from '@/lib/irrigation-conseil'
import { grouperRecommandationsParPlanche } from '@/lib/irrigation-planche'
import { etatCulture } from '@/lib/cultures/etat'
import type { MeteoJournaliere } from '@/lib/meteo'
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

    const cacheKey = irrigationCacheKey(userId, parcelleId)

    // Vérifier le cache (sauf si refresh forcé) AVANT tout appel externe :
    // un hit de cache ne doit pas payer la requête station météo.
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

    const station = await prisma.stationMeteo.findFirst({ where: { userId, active: true } })
    let stationToday: MeteoJournaliere | null = null
    if (station?.provider === 'ecowitt' && station.appKey && station.apiKey) {
      stationToday = await fetchEcowittData(station.appKey, station.apiKey, station.stationId)
    } else if (station?.provider === 'wunderground' && station.apiKey) {
      stationToday = await fetchWundergroundData(station.apiKey, station.stationId)
    } else if (station?.provider === 'open-meteo-reference' && station.lat && station.lng) {
      stationToday = (await fetchOpenMeteoForecast(station.lat, station.lng)).daily[0] ?? null
    }

    // Récupérer les cultures actives (non terminées) avec leurs planches et parcelles
    // Mêmes cultures que les lignes « à arroser » (revue du 2026-10-10) : une
    // culture finie non clôturée ne doit pas sortir « critique » ici.
    const whereClause: Prisma.CultureWhereInput = {
      userId,
      terminee: null,
      AND: [cultureIrrigationDemarreeWhere, whereCulturesEnPlace(new Date().getFullYear())],
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
        variete: { select: { nom: true, isPlaceholder: true } },
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

    // Arrosages notés des 30 derniers jours (même source que le conseil des tâches).
    const traces = await prisma.irrigationPlanifiee.findMany({
      where: {
        userId,
        cultureId: { in: cultures.map((c) => c.id) },
        AND: [whereArrosageNote(), { dateEffective: { gte: new Date(Date.now() - (JOURS_HISTORIQUE_BILAN + 1) * 86_400_000) } }],
      },
      select: { cultureId: true, dateEffective: true },
    })
    const joursArroses = new Map<number, string[]>()
    for (const t of traces) {
      if (!t.dateEffective) continue
      joursArroses.set(t.cultureId, [...(joursArroses.get(t.cultureId) ?? []), jourLocalIso(t.dateEffective)])
    }

    const recommandationsCultures = []

    for (const [, group] of parCoords) {
      // Même série que le moteur des tâches : 30 jours d'archive, aujourd'hui, 7 jours prévus.
      let meteo: MeteoBilan | null
      try {
        meteo = await chargerMeteoBilan(group.lat, group.lng)
      } catch {
        meteo = null
      }
      if (!meteo) continue
      // Station de l'exploitation : sa pluie du jour prime sur le modèle.
      if (stationToday && stationToday.date === meteo.aujourdhui.date) {
        meteo = { ...meteo, aujourdhui: { ...meteo.aujourdhui, pluie: stationToday.precipitation } }
      }

      for (const culture of group.cultures) {
        const sousAbri = TYPES_SOUS_ABRI.includes(culture.planche?.type ?? '')
        const debut = culture.datePlantation ?? culture.dateSemis
        const reco = genererRecommandationIrrigation(
          meteo,
          {
            id: culture.id,
            espece: culture.espece.nom || culture.especeId,
            besoinEau: culture.espece.besoinEau ?? 3,
            debut,
            finCycle: culture.finRecolte ?? culture.dateRecolte,
            derniereIrrigation: culture.derniereIrrigation,
            joursArroses: joursArroses.get(culture.id) ?? [],
          },
          {
            nom: culture.planche!.nom,
            surface: culture.planche!.surface ?? 10,
            retentionEau: culture.planche!.retentionEau,
            typeSol: culture.planche!.typeSol,
            irrigation: culture.planche!.irrigation,
          },
          sousAbri,
        )

        recommandationsCultures.push({
          ...reco,
          plancheId: culture.planche!.id,
          // Variété de repli « Non spécifiée » : le drapeau du référentiel fait foi.
          varietyName: culture.variete?.isPlaceholder ? null : culture.variete?.nom ?? null,
          // QA cmv2eg99z — même état que la liste des cultures : une culture
          // récoltée s'affichait « Semée » (cascade recopiée sans `recolteFaite`).
          etatCulture: etatCulture(culture),
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
