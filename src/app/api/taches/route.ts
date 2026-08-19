/**
 * API Route pour les taches du jour/semaine
 * GET /api/taches?start=&end=
 *
 * Inclut automatiquement les tâches en retard (non faites, date < start)
 * avec un champ retardJours indiquant le nombre de jours de retard.
 *
 * Toute la logique vit dans `src/lib/taches-potager.ts`, partagée avec
 * l'outil assistant `get_taches` (QA cmsno8277 : l'assistant recomptait les
 * retards à sa façon et divergeait de l'écran).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getTachesPotager } from '@/lib/taches-potager'

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
    // QA Camille 2026-05-15 — Bug #2 : la query hardcodait l'année
    // courante, donc passer 2026 → 2024 dans le sélecteur n'avait
    // aucun effet sur les tâches. On lit désormais `?year=` ; fallback
    // sur année courante si absent.
    const yearParam = searchParams.get('year')
    const currentYear = new Date().getFullYear()
    const annee = yearParam ? parseInt(yearParam, 10) : currentYear
    if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) {
      return NextResponse.json({ error: 'Année invalide' }, { status: 400 })
    }

    // Un compte en consultation voit la péremption et l'auto-validation
    // calculées, mais rien n'est écrit en base pour lui.
    const data = await getTachesPotager(userId, {
      start,
      end,
      annee,
      persistAutoValidation: session!.user.peutEcrireExploitation !== false,
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/taches error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des taches', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
