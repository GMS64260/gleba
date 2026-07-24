/**
 * API Délais d'attente en cours — remise en vente (feedback éleveur 2026-07-24).
 * GET /api/elevage/attentes
 *
 * Liste les soins réalisés dont le délai d'attente lait et/ou viande est encore
 * actif, avec la DATE DE REMISE EN VENTE (lait / viande). Le lait de la journée
 * de fin d'attente est encore écarté (cf. attente-lait) → remise en vente au
 * lendemain. Même convention prudente appliquée à la viande.
 */

import { NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { chargerAttentesConsolidees } from '@/lib/elevage/attentes-query'
import { remiseVente } from '@/lib/elevage/attentes'

function floorDayUTC(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

export async function GET() {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id
    const today = floorDayUTC(new Date())

    // Une échéance CONSOLIDÉE par (cible + traitement), ancrée sur la dernière
    // injection — plus de doublons (QA #9) ni de fenêtre depuis la 1re
    // injection (QA #2).
    const attentes = await chargerAttentesConsolidees(userId, today)

    const data = attentes.map((a) => ({
      soinId: a.soinIds[0],
      key: a.key,
      soinIds: a.soinIds,
      date: a.derniereInjection.toISOString(),
      traitement: a.traitement,
      cible: a.cible,
      lait: a.finAttenteLait
        ? { finAttente: a.finAttenteLait.toISOString(), remiseVente: remiseVente(a.finAttenteLait)!.toISOString() }
        : null,
      viande: a.finAttenteViande
        ? { finAttente: a.finAttenteViande.toISOString(), remiseVente: remiseVente(a.finAttenteViande)!.toISOString() }
        : null,
    }))

    // Dates de remise en vente les plus proches (utile pour un résumé)
    const prochaineLait =
      data
        .filter((d) => d.lait)
        .map((d) => d.lait!.remiseVente)
        .sort()[0] ?? null
    const prochaineViande =
      data
        .filter((d) => d.viande)
        .map((d) => d.viande!.remiseVente)
        .sort()[0] ?? null

    return NextResponse.json({
      data,
      stats: {
        nbLait: data.filter((d) => d.lait).length,
        nbViande: data.filter((d) => d.viande).length,
        prochaineRemiseLait: prochaineLait,
        prochaineRemiseViande: prochaineViande,
      },
    })
  } catch (err) {
    console.error('GET /api/elevage/attentes error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
