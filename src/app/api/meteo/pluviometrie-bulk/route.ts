/**
 * API Route - Pluviométrie en bulk pour plusieurs planches
 * GET /api/meteo/pluviometrie-bulk?ids=id1,id2,id3
 *
 * Retourne uniquement le total 7j et le statut sousAbri pour chaque planche.
 * Optimisé pour le tableau des cultures (une seule requête pour N planches).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { fetchOpenMeteoHistory } from '@/lib/meteo'

const TYPES_SOUS_ABRI = ['Serre', 'Tunnel', 'Châssis', 'Chassis']

export interface PluviometrieBulkItem {
  plancheId: string
  sousAbri: boolean
  total7j: number | null  // null si pas de coordonnées GPS
  joursSansPluie: number | null
}

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')

    if (!idsParam) {
      return NextResponse.json({ error: 'Paramètre ids requis' }, { status: 400 })
    }

    const ids = idsParam.split(',').filter(Boolean).slice(0, 50) // max 50 planches

    // Récupérer les planches avec leurs coordonnées
    const planches = await prisma.planche.findMany({
      where: { id: { in: ids }, userId },
      select: {
        id: true,
        type: true,
        parcelleGeo: {
          select: { centroidLat: true, centroidLng: true },
        },
      },
    })

    // Coordonnées fallback (première parcelle de l'utilisateur)
    let fallbackLat: number | null = null
    let fallbackLng: number | null = null
    const hasPlancheWithoutCoords = planches.some(p => !p.parcelleGeo?.centroidLat)
    if (hasPlancheWithoutCoords) {
      const parcelleFallback = await prisma.parcelleGeo.findFirst({
        where: { userId, centroidLat: { not: null }, centroidLng: { not: null } },
        select: { centroidLat: true, centroidLng: true },
        orderBy: { createdAt: 'desc' },
      })
      fallbackLat = parcelleFallback?.centroidLat ?? null
      fallbackLng = parcelleFallback?.centroidLng ?? null
    }

    // Regrouper les planches par coordonnées pour minimiser les appels API
    const coordsMap = new Map<string, { lat: number; lng: number; plancheIds: string[] }>()

    for (const planche of planches) {
      if (TYPES_SOUS_ABRI.includes(planche.type ?? '')) continue // sous abri, pas besoin

      const lat = planche.parcelleGeo?.centroidLat ?? fallbackLat
      const lng = planche.parcelleGeo?.centroidLng ?? fallbackLng
      if (!lat || !lng) continue

      const key = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`
      if (!coordsMap.has(key)) {
        coordsMap.set(key, { lat, lng, plancheIds: [] })
      }
      coordsMap.get(key)!.plancheIds.push(planche.id)
    }

    // Fetch historique pour chaque groupe de coordonnées unique
    const today = new Date()
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const pluieParCoords = new Map<string, { total7j: number; joursSansPluie: number }>()

    await Promise.all(
      Array.from(coordsMap.entries()).map(async ([key, { lat, lng }]) => {
        try {
          const historique = await fetchOpenMeteoHistory(
            lat, lng,
            sevenDaysAgo.toISOString().split('T')[0],
            yesterday.toISOString().split('T')[0]
          )
          const total7j = historique.reduce((sum, d) => sum + d.precipitation, 0)

          let joursSansPluie = 0
          for (let i = historique.length - 1; i >= 0; i--) {
            if (historique[i].precipitation < 1) {
              joursSansPluie++
            } else {
              break
            }
          }

          pluieParCoords.set(key, {
            total7j: Math.round(total7j * 10) / 10,
            joursSansPluie,
          })
        } catch {
          // Ignorer les erreurs individuelles
        }
      })
    )

    // Construire la réponse
    const result: PluviometrieBulkItem[] = planches.map(planche => {
      const sousAbri = TYPES_SOUS_ABRI.includes(planche.type ?? '')
      if (sousAbri) {
        return { plancheId: planche.id, sousAbri: true, total7j: null, joursSansPluie: null }
      }

      const lat = planche.parcelleGeo?.centroidLat ?? fallbackLat
      const lng = planche.parcelleGeo?.centroidLng ?? fallbackLng
      if (!lat || !lng) {
        return { plancheId: planche.id, sousAbri: false, total7j: null, joursSansPluie: null }
      }

      const key = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`
      const pluie = pluieParCoords.get(key)
      return {
        plancheId: planche.id,
        sousAbri: false,
        total7j: pluie?.total7j ?? null,
        joursSansPluie: pluie?.joursSansPluie ?? null,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/meteo/pluviometrie-bulk error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des données de pluviométrie' },
      { status: 500 }
    )
  }
}
