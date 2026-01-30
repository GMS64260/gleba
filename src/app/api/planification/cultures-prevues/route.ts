/**
 * API Route pour les cultures prevues
 * GET /api/planification/cultures-prevues
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getCulturesPrevues } from '@/lib/planification'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())
    const groupBy = searchParams.get('groupBy') || 'espece'
    const especeId = searchParams.get('especeId') || undefined
    const ilot = searchParams.get('ilot') || undefined
    const plancheId = searchParams.get('plancheId') || undefined

    const culturesPrevues = await getCulturesPrevues(userId, annee, {
      especeId,
      ilot,
      plancheId,
    })

    // Grouper selon le parametre
    let data = culturesPrevues
    const stats = {
      total: culturesPrevues.length,
      existantes: culturesPrevues.filter(c => c.existante).length,
      aCreer: culturesPrevues.filter(c => !c.existante).length,
      surfaceTotale: culturesPrevues.reduce((sum, c) => sum + c.surface, 0),
      parEspece: {} as Record<string, number>,
      parIlot: {} as Record<string, number>,
    }

    // Calculer les stats par espece et ilot
    for (const culture of culturesPrevues) {
      if (culture.especeId) {
        stats.parEspece[culture.especeId] = (stats.parEspece[culture.especeId] || 0) + 1
      }
      const ilotKey = culture.ilot || 'Sans ilot'
      stats.parIlot[ilotKey] = (stats.parIlot[ilotKey] || 0) + 1
    }

    // Trier selon le groupement
    if (groupBy === 'espece') {
      data = [...culturesPrevues].sort((a, b) => {
        const especeCompare = (a.especeId || '').localeCompare(b.especeId || '')
        if (especeCompare !== 0) return especeCompare
        return a.plancheId.localeCompare(b.plancheId)
      })
    } else if (groupBy === 'ilot') {
      data = [...culturesPrevues].sort((a, b) => {
        const ilotCompare = (a.ilot || '').localeCompare(b.ilot || '')
        if (ilotCompare !== 0) return ilotCompare
        return a.plancheId.localeCompare(b.plancheId)
      })
    } else if (groupBy === 'planche') {
      data = [...culturesPrevues].sort((a, b) => a.plancheId.localeCompare(b.plancheId))
    }

    return NextResponse.json({
      data,
      stats,
      annee,
      groupBy,
    })
  } catch (error) {
    console.error('GET /api/planification/cultures-prevues error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des cultures prevues', details: String(error) },
      { status: 500 }
    )
  }
}
