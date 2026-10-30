import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { fuseauValide, getLunarCalendar, getMoonPhaseToday } from '@/lib/lunar'

/**
 * GET /api/lunaire?year=2026&month=2&tz=America/Guadeloupe
 * Retourne le calendrier lunaire du mois avec les types de jours jardinage
 *
 * GET /api/lunaire?today=1&jour=2026-08-12&tz=America/Guadeloupe
 * Retourne uniquement la phase lunaire du jour (pour le widget)
 *
 * `tz` : fuseau IANA du LECTEUR, qui découpe les jours civils ; `jour` : son
 * jour civil (« aujourd'hui » du navigateur). Les instants des phases sont les
 * mêmes pour tous. Sans eux, le fuseau du serveur (Europe/Paris) : un lecteur
 * des Antilles recevait le lendemain de Paris (revue du 2026-10-28). Un
 * fuseau ou un jour illisible est refusé (400).
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const todayOnly = searchParams.get('today') === '1'

    const tz = searchParams.get('tz')
    const fuseau = tz === null ? undefined : fuseauValide(tz)
    if (fuseau === null) {
      return NextResponse.json({ error: 'Paramètre tz invalide (fuseau IANA attendu, ex. Europe/Paris)' }, { status: 400 })
    }

    // Mode widget : juste la phase du jour
    if (todayOnly) {
      const jour = searchParams.get('jour')
      if (jour !== null && !jourValide(jour)) {
        return NextResponse.json({ error: 'Paramètre jour invalide (AAAA-MM-JJ attendu)' }, { status: 400 })
      }
      const today = await getMoonPhaseToday({ jour, fuseau })
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

    const calendrier = await getLunarCalendar(year, month, fuseau)

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

/** Jour civil AAAA-MM-JJ existant (pas de 31/02), entre 2000 et 2100 comme le mois. */
function jourValide(jour: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return false
  const [a, m, j] = jour.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, j))
  return a >= 2000 && a <= 2100 && d.getUTCMonth() === m - 1 && d.getUTCDate() === j
}
