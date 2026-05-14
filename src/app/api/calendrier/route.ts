/**
 * API Route pour le calendrier
 * GET /api/calendrier?start=&end=
 * Retourne les événements (semis, plantations, recoltes, irrigations) pour une période
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { fetchOpenMeteoForecast, fetchOpenMeteoHistory } from '@/lib/meteo'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const startStr = searchParams.get('start')
    const endStr = searchParams.get('end')

    if (!startStr || !endStr) {
      return NextResponse.json(
        { error: 'Dates start et end requises' },
        { status: 400 }
      )
    }

    const start = new Date(startStr)
    const end = new Date(endStr)

    // Récupérer toutes les cultures avec des dates dans la période
    const [culturesAvecSemis, culturesAvecPlantation, culturesAvecRecolte, irrigationsPlanifiees] = await Promise.all([
      // Semis
      prisma.culture.findMany({
        where: {
          userId,
          dateSemis: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          especeId: true,
          varieteId: true,
          dateSemis: true,
          semisFait: true,
          espece: {
            select: { couleur: true },
          },
          planche: {
            select: { nom: true, ilot: true },
          },
        },
      }),
      // Plantations
      prisma.culture.findMany({
        where: {
          userId,
          datePlantation: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          especeId: true,
          varieteId: true,
          datePlantation: true,
          plantationFaite: true,
          espece: {
            select: { couleur: true },
          },
          planche: {
            select: { nom: true, ilot: true },
          },
        },
      }),
      // Récoltes
      prisma.culture.findMany({
        where: {
          userId,
          dateRecolte: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          especeId: true,
          varieteId: true,
          dateRecolte: true,
          recolteFaite: true,
          espece: {
            select: { couleur: true },
          },
          planche: {
            select: { nom: true, ilot: true },
          },
        },
      }),
      // Irrigations planifiées
      prisma.irrigationPlanifiee.findMany({
        where: {
          userId,
          datePrevue: {
            gte: start,
            lte: end,
          },
        },
        include: {
          culture: {
            select: {
              id: true,
              especeId: true,
              varieteId: true,
              espece: {
                select: { couleur: true },
              },
              planche: {
                select: {
                  nom: true,
                  ilot: true,
                  parcelleGeo: {
                    select: { centroidLat: true, centroidLng: true },
                  },
                },
              },
            },
          },
        },
      }),
    ])

    // ── Prévisions météo pour les irrigations ──
    let fallbackCoords: { lat: number; lng: number } | null = null

    if (irrigationsPlanifiees.length > 0) {
      let hasDirectCoords = false
      for (const irr of irrigationsPlanifiees) {
        const lat = irr.culture.planche?.parcelleGeo?.centroidLat
        const lng = irr.culture.planche?.parcelleGeo?.centroidLng
        if (lat && lng) { hasDirectCoords = true; break }
      }
      if (!hasDirectCoords) {
        const userParcelle = await prisma.parcelleGeo.findFirst({
          where: { userId },
          select: { centroidLat: true, centroidLng: true },
        })
        if (userParcelle?.centroidLat && userParcelle?.centroidLng) {
          fallbackCoords = { lat: userParcelle.centroidLat, lng: userParcelle.centroidLng }
        }
      }
    }

    const coordsMap = new Map<string, { lat: number; lng: number }>()
    for (const irr of irrigationsPlanifiees) {
      const lat = irr.culture.planche?.parcelleGeo?.centroidLat ?? fallbackCoords?.lat
      const lng = irr.culture.planche?.parcelleGeo?.centroidLng ?? fallbackCoords?.lng
      if (!lat || !lng) continue
      const key = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`
      if (!coordsMap.has(key)) coordsMap.set(key, { lat, lng })
    }

    const precipByCoordAndDate = new Map<string, Map<string, number>>()
    const pluieRecente3jByCoord = new Map<string, number>()

    await Promise.all(
      Array.from(coordsMap.entries()).map(async ([coordKey, { lat, lng }]) => {
        try {
          const forecast = await fetchOpenMeteoForecast(lat, lng)
          const dateMap = new Map<string, number>()
          for (const day of forecast.daily) {
            dateMap.set(day.date, day.precipitation)
          }
          precipByCoordAndDate.set(coordKey, dateMap)

          // Historique 3 derniers jours pour évaluer la pluie récente
          const today = new Date()
          const j3 = new Date(today)
          j3.setDate(j3.getDate() - 3)
          const yesterday = new Date(today)
          yesterday.setDate(yesterday.getDate() - 1)

          const historique = await fetchOpenMeteoHistory(
            lat, lng,
            j3.toISOString().split('T')[0],
            yesterday.toISOString().split('T')[0]
          )
          const pluieHisto = historique.reduce((s, d) => s + d.precipitation, 0)
          const pluieAujourdhui = forecast.daily[0]?.precipitation ?? 0
          pluieRecente3jByCoord.set(coordKey, pluieHisto + pluieAujourdhui)
        } catch {
          // pas bloquant
        }
      })
    )

    const SEUIL_PLUIE_RECENTE = 5
    const JOURS_COUVERTURE_PLUIE = 3

    function getIrrigationMeteo(irr: typeof irrigationsPlanifiees[number]): {
      pluiePrevue: number | null
      probablementInutile: boolean
    } {
      const lat = irr.culture.planche?.parcelleGeo?.centroidLat ?? fallbackCoords?.lat
      const lng = irr.culture.planche?.parcelleGeo?.centroidLng ?? fallbackCoords?.lng
      if (!lat || !lng) return { pluiePrevue: null, probablementInutile: false }
      const coordKey = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`

      const dateMap = precipByCoordAndDate.get(coordKey)
      const dateStr = irr.datePrevue.toISOString().split('T')[0]
      const pluiePrevueJour = dateMap?.get(dateStr) ?? null

      const pluieRecente = pluieRecente3jByCoord.get(coordKey) ?? 0
      const joursAvant = Math.floor((irr.datePrevue.getTime() - Date.now()) / 86_400_000)

      const inutileParPluieRecente = pluieRecente >= SEUIL_PLUIE_RECENTE && joursAvant <= JOURS_COUVERTURE_PLUIE
      const inutileParPrevision = pluiePrevueJour !== null && pluiePrevueJour >= 5

      return {
        pluiePrevue: pluiePrevueJour,
        probablementInutile: inutileParPluieRecente || inutileParPrevision,
      }
    }

    // Auto-valider les irrigations passées ou du jour couvertes par la pluie récente
    const autoValidIds: number[] = []
    for (const irr of irrigationsPlanifiees) {
      if (irr.fait) continue
      const meteo = getIrrigationMeteo(irr)
      const joursAvant = Math.floor((irr.datePrevue.getTime() - Date.now()) / 86_400_000)
      // Auto-valider si : date passée ou aujourd'hui + pluie récente suffisante
      if (joursAvant <= 0 && meteo.probablementInutile) {
        autoValidIds.push(irr.id)
        irr.fait = true // Marquer localement pour l'affichage
      }
    }
    if (autoValidIds.length > 0) {
      await prisma.irrigationPlanifiee.updateMany({
        where: { id: { in: autoValidIds } },
        data: { fait: true, notes: 'Auto-validée (pluie suffisante)' },
      })
    }

    // Formater les événements
    const events = [
      ...culturesAvecSemis.map(c => ({
        id: c.id,
        type: 'semis' as const,
        especeId: c.especeId,
        varieteId: c.varieteId || null,
        plancheName: c.planche?.nom || null,
        ilot: c.planche?.ilot || null,
        date: c.dateSemis?.toISOString() || '',
        fait: c.semisFait,
        couleur: c.espece?.couleur || null,
      })),
      ...culturesAvecPlantation.map(c => ({
        id: c.id,
        type: 'plantation' as const,
        especeId: c.especeId,
        varieteId: c.varieteId || null,
        plancheName: c.planche?.nom || null,
        ilot: c.planche?.ilot || null,
        date: c.datePlantation?.toISOString() || '',
        fait: c.plantationFaite,
        couleur: c.espece?.couleur || null,
      })),
      ...culturesAvecRecolte.map(c => ({
        id: c.id,
        type: 'recolte' as const,
        especeId: c.especeId,
        varieteId: c.varieteId || null,
        plancheName: c.planche?.nom || null,
        ilot: c.planche?.ilot || null,
        date: c.dateRecolte?.toISOString() || '',
        fait: c.recolteFaite,
        couleur: c.espece?.couleur || null,
      })),
      ...irrigationsPlanifiees.map(i => {
        const meteo = getIrrigationMeteo(i)
        return {
          id: i.id,
          type: 'irrigation' as const,
          especeId: i.culture.especeId,
          varieteId: i.culture.varieteId || null,
          plancheName: i.culture.planche?.nom || null,
          ilot: i.culture.planche?.ilot || null,
          date: i.datePrevue.toISOString(),
          fait: i.fait,
          couleur: i.culture.espece?.couleur || null,
          cultureId: i.culture.id,
          pluiePrevue: meteo.pluiePrevue !== null ? Math.round(meteo.pluiePrevue * 10) / 10 : null,
          probablementInutile: meteo.probablementInutile,
        }
      }),
    ]

    // Trier par date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return NextResponse.json({
      events,
      stats: {
        semis: culturesAvecSemis.length,
        plantations: culturesAvecPlantation.length,
        recoltes: culturesAvecRecolte.length,
        irrigations: irrigationsPlanifiees.length,
        total: events.length,
      },
    })
  } catch (error) {
    console.error('GET /api/calendrier error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du calendrier', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
