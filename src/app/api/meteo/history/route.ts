/**
 * API Route Météo - Historique
 * GET /api/meteo/history?parcelleId=X&start=YYYY-MM-DD&end=YYYY-MM-DD
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getMeteoHistorique } from '@/lib/meteo'
import { calculerBilanHydrique, calculerDegreJours, calculerEnsoleillement } from '@/lib/meteo-agro'
import { jourCivilLocalISO } from '@/lib/irrigation-meteo-decision'

/** Premier jour de l'archive Open-Meteo (ERA5). */
const DEBUT_ARCHIVE = '1940-01-01'

/**
 * Horodatage UTC d'un jour `AAAA-MM-JJ` qui existe au calendrier, sinon null.
 * `new Date()` seul accepte « 2026-7-1 », du texte libre, et reporte un
 * 31 février au 3 mars.
 */
function jourCivilStrict(valeur: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null
  const t = Date.parse(`${valeur}T00:00:00Z`)
  if (Number.isNaN(t)) return null
  return new Date(t).toISOString().slice(0, 10) === valeur ? t : null
}

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const parcelleId = searchParams.get('parcelleId')
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!parcelleId || !start || !end) {
      return NextResponse.json(
        { error: 'Paramètres parcelleId, start et end requis' },
        { status: 400 }
      )
    }

    // Jours civils stricts : les deux bornes partent telles quelles vers
    // Open-Meteo et dans la clé de cache. « 2026-7-1 », une date avec heure ou
    // un 31 février passaient `new Date()` et finissaient en 500.
    const debut = jourCivilStrict(start)
    const fin = jourCivilStrict(end)
    if (debut === null || fin === null) {
      return NextResponse.json(
        { error: 'Format de date invalide (YYYY-MM-DD attendu)' },
        { status: 400 }
      )
    }

    const aujourdhui = jourCivilLocalISO(new Date())
    if (fin < debut) {
      return NextResponse.json(
        { error: 'La date de fin précède la date de début' },
        { status: 400 }
      )
    }
    if (start < DEBUT_ARCHIVE || start > aujourdhui) {
      return NextResponse.json(
        { error: `Période hors de l'archive météo (du ${DEBUT_ARCHIVE} à aujourd'hui)` },
        { status: 400 }
      )
    }

    // Limiter à 1 an max
    const diffDays = (fin - debut) / 86400000
    if (diffDays > 365) {
      return NextResponse.json(
        { error: 'Période limitée à 365 jours maximum' },
        { status: 400 }
      )
    }

    // L'archive ne connaît pas l'avenir : une fin future est ramenée à
    // aujourd'hui au lieu de faire échouer toute la période.
    const finBornee = end > aujourdhui ? aujourdhui : end

    const historique = await getMeteoHistorique(parcelleId, userId, start, finBornee)

    if (!historique) {
      return NextResponse.json(
        { error: 'Parcelle non trouvée ou sans coordonnées GPS' },
        { status: 404 }
      )
    }

    // Calculs agronomiques
    const bilanHydrique = calculerBilanHydrique(historique.donnees)
    const degreJours = calculerDegreJours(historique.donnees)
    const ensoleillement = calculerEnsoleillement(historique.donnees)

    return NextResponse.json({
      ...historique,
      bilanHydrique,
      degreJours,
      ensoleillement,
    })
  } catch (err) {
    console.error('GET /api/meteo/history error:', err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'historique météo" },
      { status: 500 }
    )
  }
}
