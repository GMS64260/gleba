/**
 * API Route pour les taches du jour/semaine
 * GET /api/taches?start=&end=
 *
 * Inclut automatiquement les tâches en retard (non faites, date < start)
 * avec un champ retardJours indiquant le nombre de jours de retard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { fetchOpenMeteoForecast, fetchOpenMeteoHistory } from '@/lib/meteo'

const CULTURE_SELECT = {
  id: true,
  especeId: true,
  varieteId: true,
  plancheId: true,
  dateSemis: true,
  datePlantation: true,
  dateRecolte: true,
  semisFait: true,
  plantationFaite: true,
  recolteFaite: true,
  espece: { select: { couleur: true } },
  planche: { select: { nom: true } },
} as const

function joursRetard(dateTask: Date, refDate: Date): number {
  return Math.max(0, Math.floor((refDate.getTime() - dateTask.getTime()) / 86_400_000))
}

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
    const annee = new Date().getFullYear()

    // ── Tâches de la semaine + tâches en retard (non faites, date passée) ──

    // Semis : cette semaine OU en retard
    const [semisSemaine, semisRetard] = await Promise.all([
      prisma.culture.findMany({
        where: { userId, annee, dateSemis: { gte: start, lte: end } },
        select: CULTURE_SELECT,
        orderBy: { dateSemis: 'asc' },
      }),
      prisma.culture.findMany({
        where: { userId, annee, semisFait: false, dateSemis: { lt: start, not: null } },
        select: CULTURE_SELECT,
        orderBy: { dateSemis: 'asc' },
      }),
    ])

    // Plantations : cette semaine OU en retard
    const [plantationsSemaine, plantationsRetard] = await Promise.all([
      prisma.culture.findMany({
        where: { userId, annee, datePlantation: { gte: start, lte: end } },
        select: CULTURE_SELECT,
        orderBy: { datePlantation: 'asc' },
      }),
      prisma.culture.findMany({
        where: { userId, annee, plantationFaite: false, datePlantation: { lt: start, not: null } },
        select: CULTURE_SELECT,
        orderBy: { datePlantation: 'asc' },
      }),
    ])

    // Récoltes : cette semaine OU en retard
    const [recoltesSemaine, recoltesRetard] = await Promise.all([
      prisma.culture.findMany({
        where: { userId, annee, dateRecolte: { gte: start, lte: end } },
        select: CULTURE_SELECT,
        orderBy: { dateRecolte: 'asc' },
      }),
      prisma.culture.findMany({
        where: { userId, annee, recolteFaite: false, dateRecolte: { lt: start, not: null } },
        select: CULTURE_SELECT,
        orderBy: { dateRecolte: 'asc' },
      }),
    ])

    // Irrigations : cette semaine OU en retard
    const irrigationInclude = {
      culture: {
        select: {
          id: true,
          especeId: true,
          plancheId: true,
          espece: { select: { couleur: true } },
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
    } as const

    const [irrigationsSemaine, irrigationsRetard] = await Promise.all([
      prisma.irrigationPlanifiee.findMany({
        where: { userId, fait: false, datePrevue: { gte: start, lte: end } },
        include: irrigationInclude,
        orderBy: { datePrevue: 'asc' },
      }),
      prisma.irrigationPlanifiee.findMany({
        where: { userId, fait: false, datePrevue: { lt: start } },
        include: irrigationInclude,
        orderBy: { datePrevue: 'asc' },
      }),
    ])

    // ── Prévisions météo pour les irrigations ──
    const allIrrigations = [...irrigationsSemaine, ...irrigationsRetard]

    // Coordonnées : d'abord depuis la parcelle de la planche, sinon fallback user
    let fallbackCoords: { lat: number; lng: number } | null = null
    if (allIrrigations.length > 0) {
      // Chercher les coordonnées depuis les parcelles des planches
      let hasDirectCoords = false
      for (const irr of allIrrigations) {
        const lat = irr.culture.planche?.parcelleGeo?.centroidLat
        const lng = irr.culture.planche?.parcelleGeo?.centroidLng
        if (lat && lng) { hasDirectCoords = true; break }
      }

      // Si aucune planche n'a de parcelle liée, fallback sur la première parcelle de l'utilisateur
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

    // Regrouper par coordonnées uniques
    const coordsMap = new Map<string, { lat: number; lng: number }>()
    for (const irr of allIrrigations) {
      const lat = irr.culture.planche?.parcelleGeo?.centroidLat ?? fallbackCoords?.lat
      const lng = irr.culture.planche?.parcelleGeo?.centroidLng ?? fallbackCoords?.lng
      if (!lat || !lng) continue
      const key = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`
      if (!coordsMap.has(key)) coordsMap.set(key, { lat, lng })
    }

    // Fetch prévisions + historique récent pour chaque jeu de coordonnées unique
    const precipByCoordAndDate = new Map<string, Map<string, number>>()
    const pluieRecente3jByCoord = new Map<string, number>() // Pluie cumulée 3 derniers jours + aujourd'hui

    await Promise.all(
      Array.from(coordsMap.entries()).map(async ([coordKey, { lat, lng }]) => {
        try {
          const forecast = await fetchOpenMeteoForecast(lat, lng)
          const dateMap = new Map<string, number>()
          for (const day of forecast.daily) {
            dateMap.set(day.date, day.precipitation)
          }
          precipByCoordAndDate.set(coordKey, dateMap)

          // Historique 3 derniers jours
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
          // En cas d'erreur météo, on n'enrichit pas (pas bloquant)
        }
      })
    )

    // Helper : obtenir la pluie prevue pour une irrigation + check pluie récente
    const SEUIL_PLUIE_RECENTE = 5 // mm en 3j pour considérer le sol encore humide
    const JOURS_COUVERTURE_PLUIE = 3 // jours après une pluie significative où le sol reste humide

    function getIrrigationMeteo(irr: typeof allIrrigations[number]): {
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

      // Pluie récente : si > seuil et l'irrigation est dans les N jours, probablement inutile
      const pluieRecente = pluieRecente3jByCoord.get(coordKey) ?? 0
      const joursAvant = Math.floor((irr.datePrevue.getTime() - Date.now()) / 86_400_000)

      const inutileParPluieRecente = pluieRecente >= SEUIL_PLUIE_RECENTE && joursAvant <= JOURS_COUVERTURE_PLUIE
      const inutileParPrevision = pluiePrevueJour !== null && pluiePrevueJour >= 5

      return {
        pluiePrevue: pluiePrevueJour,
        probablementInutile: inutileParPluieRecente || inutileParPrevision,
      }
    }

    // ── Formatter ──

    function formatSemis(c: typeof semisSemaine[number], retard: number) {
      return {
        id: c.id,
        type: 'semis' as const,
        especeId: c.especeId,
        varieteId: c.varieteId,
        plancheId: c.planche?.nom || null,
        date: c.dateSemis?.toISOString() || '',
        fait: c.semisFait,
        couleur: c.espece?.couleur || null,
        retardJours: retard,
      }
    }

    function formatPlantation(c: typeof plantationsSemaine[number], retard: number) {
      return {
        id: c.id,
        type: 'plantation' as const,
        especeId: c.especeId,
        varieteId: c.varieteId,
        plancheId: c.planche?.nom || null,
        date: c.datePlantation?.toISOString() || '',
        fait: c.plantationFaite,
        couleur: c.espece?.couleur || null,
        retardJours: retard,
      }
    }

    function formatRecolte(c: typeof recoltesSemaine[number], retard: number) {
      return {
        id: c.id,
        type: 'recolte' as const,
        especeId: c.especeId,
        varieteId: c.varieteId,
        plancheId: c.planche?.nom || null,
        date: c.dateRecolte?.toISOString() || '',
        fait: c.recolteFaite,
        couleur: c.espece?.couleur || null,
        retardJours: retard,
      }
    }

    // Auto-valider les irrigations passées ou du jour couvertes par la pluie récente
    const autoValidIds: number[] = []
    for (const irr of allIrrigations) {
      if (irr.fait) continue
      const meteo = getIrrigationMeteo(irr)
      const joursAvant = Math.floor((irr.datePrevue.getTime() - Date.now()) / 86_400_000)
      if (joursAvant <= 0 && meteo.probablementInutile) {
        autoValidIds.push(irr.id)
        irr.fait = true
      }
    }
    if (autoValidIds.length > 0) {
      await prisma.irrigationPlanifiee.updateMany({
        where: { id: { in: autoValidIds } },
        data: { fait: true, notes: 'Auto-validée (pluie suffisante)' },
      })
    }

    // Tâches en retard en premier, puis tâches de la semaine
    const semis = [
      ...semisRetard.map(c => formatSemis(c, joursRetard(c.dateSemis!, start))),
      ...semisSemaine.map(c => formatSemis(c, 0)),
    ]

    const plantations = [
      ...plantationsRetard.map(c => formatPlantation(c, joursRetard(c.datePlantation!, start))),
      ...plantationsSemaine.map(c => formatPlantation(c, 0)),
    ]

    const recoltes = [
      ...recoltesRetard.map(c => formatRecolte(c, joursRetard(c.dateRecolte!, start))),
      ...recoltesSemaine.map(c => formatRecolte(c, 0)),
    ]

    function formatIrrigation(i: typeof irrigationsSemaine[number], retard: number) {
      const meteo = getIrrigationMeteo(i)
      return {
        id: i.id,
        cultureId: i.culture.id,
        especeId: i.culture.especeId,
        plancheId: i.culture.planche?.nom || null,
        ilot: i.culture.planche?.ilot || null,
        datePrevue: i.datePrevue.toISOString(),
        fait: i.fait,
        couleur: i.culture.espece?.couleur || null,
        retardJours: retard,
        pluiePrevue: meteo.pluiePrevue !== null ? Math.round(meteo.pluiePrevue * 10) / 10 : null,
        probablementInutile: meteo.probablementInutile,
      }
    }

    const irrigation = [
      ...irrigationsRetard.map(i => formatIrrigation(i, joursRetard(i.datePrevue, start))),
      ...irrigationsSemaine.map(i => formatIrrigation(i, 0)),
    ]

    const enRetardTotal =
      semisRetard.length + plantationsRetard.length + recoltesRetard.length + irrigationsRetard.length

    return NextResponse.json({
      semis,
      plantations,
      recoltes,
      irrigation,
      stats: {
        semisPrevus: semis.length,
        semisFaits: semis.filter(s => s.fait).length,
        plantationsPrevues: plantations.length,
        plantationsFaites: plantations.filter(p => p.fait).length,
        recoltesPrevues: recoltes.length,
        recoltesFaites: recoltes.filter(r => r.fait).length,
        aIrriguer: irrigation.length,
        enRetard: enRetardTotal,
      },
    })
  } catch (error) {
    console.error('GET /api/taches error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des taches', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
