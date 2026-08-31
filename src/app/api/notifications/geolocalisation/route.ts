/**
 * GET /api/notifications/geolocalisation
 *
 * Dit si l'exploitation possède une parcelle GÉOLOCALISÉE, c'est-à-dire portant
 * un centroïde. C'est le pré-requis silencieux de deux types d'alertes.
 *
 * Constaté le 2026-08-26 sur le seul compte de la base ayant activé ses
 * notifications : il avait coché « Alertes météo », et ne pouvait
 * structurellement en recevoir aucune. Son carnet porte 5 cultures et 210
 * arrosages planifiés, mais ni parcelle ni planche — or `lib/meteo.ts` sort
 * sans rien faire quand `centroidLat`/`centroidLng` manquent, et
 * `lib/notifications/queries.ts` ne retient que les parcelles
 * `centroidLat: { not: null }`. Résultat : une case cochée, aucune alerte, et
 * aucun message pour l'expliquer. Un réglage qui ne peut pas produire d'effet
 * doit le dire au moment où on l'active.
 *
 * Le compte est le locataire (l'exploitation), comme partout ailleurs pour les
 * données métier : les parcelles appartiennent à l'exploitation, pas à la
 * personne connectée.
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const [parcelles, geolocalisees] = await Promise.all([
      prisma.parcelleGeo.count({ where: { userId: session!.user.id } }),
      prisma.parcelleGeo.count({
        where: {
          userId: session!.user.id,
          centroidLat: { not: null },
          centroidLng: { not: null },
        },
      }),
    ])

    return NextResponse.json({
      parcelles,
      parcellesGeolocalisees: geolocalisees,
      meteoDisponible: geolocalisees > 0,
    })
  } catch (err) {
    console.error('GET /api/notifications/geolocalisation error:', err)
    return NextResponse.json({ error: 'Erreur lors de la vérification' }, { status: 500 })
  }
}
