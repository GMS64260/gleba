/**
 * API Registre Phytosanitaire
 * GET /api/tracabilite/registre-phyto?annee=2026
 * Genere le registre phytosanitaire a partir des Intervention de type
 * "traitement_phyto" et des observations Santé du verger. Conforme Cerphyto.
 * Le calcul vit dans src/lib/tracabilite/registre-phyto.ts (SSOT partagée
 * avec l'outil assistant `get_registre_phyto`) — lot assistant 2026-08-11.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { genererRegistrePhyto } from '@/lib/tracabilite/registre-phyto'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    const registre = await genererRegistrePhyto(session!.user.id, annee)

    return NextResponse.json({
      ...registre,
      meta: {
        annee,
        generatedAt: new Date().toISOString(),
        type: 'registre_phytosanitaire',
      },
    })
  } catch (err) {
    console.error('GET /api/tracabilite/registre-phyto error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la generation du registre phytosanitaire' },
      { status: 500 }
    )
  }
}
