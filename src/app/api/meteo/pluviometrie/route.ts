/**
 * API Route - Pluviométrie par planche
 * GET /api/meteo/pluviometrie?plancheId=X
 *
 * Retourne l'historique 30j et les prévisions 7j de précipitations pour une planche.
 * Les planches de type Serre, Tunnel ou Châssis sont marquées "sousAbri" et
 * ne reçoivent pas de précipitations directes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { fetchOpenMeteoForecast, fetchOpenMeteoHistory } from '@/lib/meteo'

// Types de planches considérés comme "sous abri" (pas de pluie directe)
const TYPES_SOUS_ABRI = ['Serre', 'Tunnel', 'Châssis', 'Chassis']

export interface PluviometriePlancheResponse {
  plancheId: string
  plancheNom: string
  typePlanche: string | null
  sousAbri: boolean
  pluviometrie: {
    historique: { date: string; mm: number }[]    // 30 derniers jours
    previsions: { date: string; mm: number; proba: number }[]  // 7 prochains jours
    total7j: number
    total30j: number
    joursSansPluie: number    // jours consécutifs sans pluie (< 1mm) jusqu'à aujourd'hui
    prochainePluie: string | null  // date ISO de la prochaine pluie prevue >= 5mm
    prochaineQuantite: number
  } | null
}

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)
    const plancheId = searchParams.get('plancheId')

    if (!plancheId) {
      return NextResponse.json({ error: 'Paramètre plancheId requis' }, { status: 400 })
    }

    // Récupérer la planche avec sa parcelle géographique
    const planche = await prisma.planche.findFirst({
      where: { id: plancheId, userId },
      select: {
        id: true,
        nom: true,
        type: true,
        parcelleGeo: {
          select: {
            centroidLat: true,
            centroidLng: true,
          },
        },
      },
    })

    if (!planche) {
      return NextResponse.json({ error: 'Planche non trouvée' }, { status: 404 })
    }

    const sousAbri = TYPES_SOUS_ABRI.includes(planche.type ?? '')

    // Si sous abri, on retourne directement sans données météo
    if (sousAbri) {
      return NextResponse.json({
        plancheId: planche.id,
        plancheNom: planche.nom,
        typePlanche: planche.type,
        sousAbri: true,
        pluviometrie: null,
      } satisfies PluviometriePlancheResponse)
    }

    // Obtenir les coordonnées GPS
    let lat = planche.parcelleGeo?.centroidLat
    let lng = planche.parcelleGeo?.centroidLng

    // Fallback : première parcelle cadastrale de l'utilisateur
    if (!lat || !lng) {
      const parcelleFallback = await prisma.parcelleGeo.findFirst({
        where: { userId, centroidLat: { not: null }, centroidLng: { not: null } },
        select: { centroidLat: true, centroidLng: true },
        orderBy: { createdAt: 'desc' },
      })
      lat = parcelleFallback?.centroidLat ?? null
      lng = parcelleFallback?.centroidLng ?? null
    }

    if (!lat || !lng) {
      return NextResponse.json({
        plancheId: planche.id,
        plancheNom: planche.nom,
        typePlanche: planche.type,
        sousAbri: false,
        pluviometrie: null,
      } satisfies PluviometriePlancheResponse)
    }

    // Historique 30 jours
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    let historiqueRaw: Awaited<ReturnType<typeof fetchOpenMeteoHistory>> = []
    try {
      historiqueRaw = await fetchOpenMeteoHistory(
        lat, lng,
        thirtyDaysAgo.toISOString().split('T')[0],
        yesterday.toISOString().split('T')[0]
      )
    } catch { /* ignore */ }

    // Prévisions 7 jours
    const forecast = await fetchOpenMeteoForecast(lat, lng)
    const previsions = forecast.daily

    // Formater l'historique
    const historique = historiqueRaw.map(d => ({
      date: d.date,
      mm: Math.round(d.precipitation * 10) / 10,
    }))

    // Formater les prévisions (garder seulement date, mm, proba)
    const previsionsFmt = previsions.map(d => ({
      date: d.date,
      mm: Math.round(d.precipitation * 10) / 10,
      proba: (d as typeof d & { precipitationProba?: number }).precipitationProba ?? 0,
    }))

    // Calculs
    const total7j = historique.slice(-7).reduce((sum, d) => sum + d.mm, 0)
    const total30j = historique.reduce((sum, d) => sum + d.mm, 0)

    // Jours consécutifs sans pluie (depuis aujourd'hui en remontant)
    let joursSansPluie = 0
    for (let i = historique.length - 1; i >= 0; i--) {
      if (historique[i].mm < 1) {
        joursSansPluie++
      } else {
        break
      }
    }

    // Prochaine pluie >= 5mm
    let prochainePluie: string | null = null
    let prochaineQuantite = 0
    for (const p of previsionsFmt) {
      if (p.mm >= 5) {
        prochainePluie = p.date
        prochaineQuantite = p.mm
        break
      }
    }

    return NextResponse.json({
      plancheId: planche.id,
      plancheNom: planche.nom,
      typePlanche: planche.type,
      sousAbri: false,
      pluviometrie: {
        historique,
        previsions: previsionsFmt,
        total7j: Math.round(total7j * 10) / 10,
        total30j: Math.round(total30j * 10) / 10,
        joursSansPluie,
        prochainePluie,
        prochaineQuantite,
      },
    } satisfies PluviometriePlancheResponse)
  } catch (err) {
    console.error('GET /api/meteo/pluviometrie error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des données de pluviométrie' },
      { status: 500 }
    )
  }
}
