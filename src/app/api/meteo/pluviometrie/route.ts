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
import { fetchOpenMeteoForecast, fetchOpenMeteoHistory, resumerPluie } from '@/lib/meteo'
import { jourCivilLocalISO } from '@/lib/irrigation-meteo-decision'
import { estSousAbri } from '@/lib/irrigation/abri'

export interface PluviometriePlancheResponse {
  plancheId: string
  plancheNom: string
  parcelleId: string | null
  parcelleNom: string | null
  typePlanche: string | null
  sousAbri: boolean
  pluviometrie: {
    previsions: { date: string; mm: number; proba: number }[]  // 7 prochains jours
    historique: { date: string; mm: number }[]    // jours mesurés des 30 derniers jours
    total7j: number | null    // null : archive en panne ou pas encore publiée
    total30j: number | null
    /** Aucun jour mesuré : les cumuls sont inconnus, pas nuls. */
    historiqueIndisponible?: boolean
    joursSansPluie: number    // jours mesurés consécutifs sans pluie (< 1 mm) jusqu'à hier
    prochainePluie: string | null  // date ISO de la prochaine pluie prévue >= 5mm
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
            id: true,
            nom: true,
            centroidLat: true,
            centroidLng: true,
          },
        },
      },
    })

    if (!planche) {
      return NextResponse.json({ error: 'Planche non trouvée' }, { status: 404 })
    }

    const sousAbri = estSousAbri(planche.type)

    // Si sous abri, on retourne directement sans données météo
    if (sousAbri) {
      return NextResponse.json({
        plancheId: planche.id,
        plancheNom: planche.nom,
        parcelleId: planche.parcelleGeo?.id ?? null,
        parcelleNom: planche.parcelleGeo?.nom ?? null,
        typePlanche: planche.type,
        sousAbri: true,
        pluviometrie: null,
      } satisfies PluviometriePlancheResponse)
    }

    // La pluie est une donnée de la parcelle liée à la planche. Ne jamais
    // emprunter les coordonnées d'une autre parcelle : cela attribuerait un
    // contexte pluviométrique trompeur à la sélection.
    const lat = planche.parcelleGeo?.centroidLat
    const lng = planche.parcelleGeo?.centroidLng

    if (!lat || !lng) {
      return NextResponse.json({
        plancheId: planche.id,
        plancheNom: planche.nom,
        parcelleId: planche.parcelleGeo?.id ?? null,
        parcelleNom: planche.parcelleGeo?.nom ?? null,
        typePlanche: planche.type,
        sousAbri: false,
        pluviometrie: null,
      } satisfies PluviometriePlancheResponse)
    }

    // Bornes en jours civils du serveur : en jours UTC, la fenêtre glissait
    // d'un jour entre minuit et 1 h ou 2 h du matin.
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Archive et prévisions ensemble. Une panne d'archive ne coupe pas les
    // prévisions, mais elle est dite : `null` et non une liste vide, qui se
    // lisait « 0 mm sur 30 jours ».
    const [historiqueRaw, forecast] = await Promise.all([
      fetchOpenMeteoHistory(lat, lng, jourCivilLocalISO(thirtyDaysAgo), jourCivilLocalISO(yesterday))
        .catch(() => null),
      fetchOpenMeteoForecast(lat, lng),
    ])
    const previsions = forecast.daily

    // Seuls les jours publiés par l'archive comptent : rangés à 0 mm, les
    // jours en attente passaient pour des jours secs.
    const mesures = (historiqueRaw ?? []).filter(d => !d.precipitationInconnue)
    const historiqueIndisponible = mesures.length === 0
    const historique = mesures.map(d => ({
      date: d.date,
      mm: Math.round(d.precipitation * 10) / 10,
    }))

    // Formater les prévisions (garder seulement date, mm, proba)
    const previsionsFmt = previsions.map(d => ({
      date: d.date,
      mm: Math.round(d.precipitation * 10) / 10,
      proba: (d as typeof d & { precipitationProba?: number }).precipitationProba ?? 0,
    }))

    // Cumuls sur les jours civils demandés, pas sur les « 7 derniers éléments »
    // (qui remontaient plus loin dès qu'un jour récent manquait).
    const debut7j = new Date(today)
    debut7j.setDate(debut7j.getDate() - 7)
    const borne7j = jourCivilLocalISO(debut7j)
    const total7j = historique.filter(d => d.date >= borne7j).reduce((sum, d) => sum + d.mm, 0)
    const total30j = historique.reduce((sum, d) => sum + d.mm, 0)
    const { joursSansPluie } = resumerPluie(mesures)

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
      parcelleId: planche.parcelleGeo?.id ?? null,
      parcelleNom: planche.parcelleGeo?.nom ?? null,
      typePlanche: planche.type,
      sousAbri: false,
      pluviometrie: {
        historique,
        previsions: previsionsFmt,
        total7j: historiqueIndisponible ? null : Math.round(total7j * 10) / 10,
        total30j: historiqueIndisponible ? null : Math.round(total30j * 10) / 10,
        joursSansPluie,
        ...(historiqueIndisponible ? { historiqueIndisponible: true } : {}),
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
