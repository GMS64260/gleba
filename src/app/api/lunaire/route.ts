import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { getLunarCalendar, getMoonPhaseToday } from '@/lib/lunar'

/**
 * GET /api/lunaire?year=2026&month=2
 * Retourne le calendrier lunaire du mois avec les types de jours jardinage
 *
 * GET /api/lunaire?today=1
 * Retourne uniquement la phase lunaire du jour (pour le widget)
 */
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const todayOnly = searchParams.get('today') === '1'

    // Mode widget : juste la phase du jour
    if (todayOnly) {
      const today = await getMoonPhaseToday()
      return NextResponse.json({ jour: today })
    }

    // Mode calendrier : tout le mois
    const now = new Date()
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()))
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: 'Paramètres year/month invalides' },
        { status: 400 }
      )
    }

    const calendrier = await getLunarCalendar(year, month)

    // Statistiques du mois
    const stats = {
      feuille: calendrier.jours.filter(j => j.typeJour === 'feuille').length,
      fruit: calendrier.jours.filter(j => j.typeJour === 'fruit').length,
      racine: calendrier.jours.filter(j => j.typeJour === 'racine').length,
      fleur: calendrier.jours.filter(j => j.typeJour === 'fleur').length,
      repos: calendrier.jours.filter(j => j.typeJour === 'repos').length,
    }

    return NextResponse.json({
      calendrier,
      stats,
    })
  } catch (err) {
    console.error('GET /api/lunaire error:', err)
    return NextResponse.json(
      { error: 'Erreur lors du calcul du calendrier lunaire' },
      { status: 500 }
    )
  }
}
