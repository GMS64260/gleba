/**
 * API Agenda élevage — échéances à venir, agrégées depuis les données déjà en
 * base (GAP P0 « agenda quotidien unifié », review caprin 2026-07-22).
 *
 * GET /api/elevage/agenda?jours=21
 * Regroupe ce qu'un éleveur doit anticiper mais qui était dispersé dans plusieurs
 * onglets : mises-bas attendues, tarissements, diagnostics de gestation à faire,
 * fins de délai d'attente lait/viande (contrainte sanitaire), soins planifiés /
 * en retard, aliments à réapprovisionner. Aucun modèle nouveau.
 *
 * Tout est scopé userId (multi-tenant).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { chargerAgendaElevage } from '@/lib/elevage/agenda.server'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const horizonJours = Math.min(90, Math.max(1, parseInt(searchParams.get('jours') || '21', 10) || 21))
    // Toute la composition vit dans `src/lib/elevage/agenda.server.ts`,
    // partagée avec l'accueil v2 (2026-10-09).
    const resultat = await chargerAgendaElevage(session.user.id, {
      horizonJours,
      filiere: searchParams.get('filiere'),
    })
    return NextResponse.json(resultat)
  } catch (err) {
    console.error('GET /api/elevage/agenda error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
