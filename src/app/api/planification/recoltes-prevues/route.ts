/**
 * API Route pour les recoltes prevues
 * GET /api/planification/recoltes-prevues
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getRecoltesPrevuesDetail } from '@/lib/planification'
import { getRecoltesAnneeAggregat } from '@/lib/kpi/recoltes-annee'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())
    const groupBy = (searchParams.get('groupBy') || 'mois') as 'mois' | 'semaine'

    // BUG-03 : projection détaillée (utilisée pour le tableau par mois/sem
    // avec breakdown par espèce) + agrégat unifié (réalisé + projection)
    // utilisé par les 3 écrans Planif / Calendrier / Récoltes.
    const [detailPrevues, aggregat] = await Promise.all([
      getRecoltesPrevuesDetail(userId, annee, groupBy),
      getRecoltesAnneeAggregat(userId, annee),
    ])
    const recoltesPrevues = detailPrevues.periodes

    // Clé technique : especeId peut être un cuid opaque pour une espèce perso.
    // On résout un nom lisible (espece.nom ?? id) pour l'affichage, sans toucher
    // especeId (conservé comme clé de groupement / de rendu React). Additif.
    const especeIds = [
      ...new Set(recoltesPrevues.flatMap(r => r.especes.map(e => e.especeId))),
    ]
    const especeNomRows = especeIds.length
      ? await prisma.espece.findMany({
          where: { id: { in: especeIds } },
          select: { id: true, nom: true },
        })
      : []
    const especeNomMap = new Map(especeNomRows.map(e => [e.id, e.nom ?? e.id]))
    const data = recoltesPrevues.map(r => ({
      ...r,
      especes: r.especes.map(e => ({
        ...e,
        especeNom: especeNomMap.get(e.especeId) ?? e.especeId,
      })),
    }))

    const projectionAnnee = recoltesPrevues.reduce((sum, r) => sum + r.totalKg, 0)
    const surfaceTotale = recoltesPrevues.reduce((sum, r) => sum + r.totalSurface, 0)

    // Trouver les mois/semaines avec le plus de recoltes
    const meilleurePeriode = recoltesPrevues.reduce((max, r) =>
      r.totalKg > max.totalKg ? r : max,
      { periode: '', totalKg: 0 }
    )

    // QA cmswxpaer — l'en-tête et les cartes ignoraient les cultures suggérées
    // par les rotations, que le tableau projette pourtant : 2028 annonçait
    // « 0,0 kg attendu » avec 361,9 kg en juillet. Le total couvre désormais ce
    // que l'écran montre, en nommant la part encore à créer.
    const arrondi = (n: number) => Math.round(n * 100) / 100
    const projectionRotationsKg = detailPrevues.projectionSuggestionsKg
    const projectionKg = arrondi(aggregat.projectionKg + projectionRotationsKg)
    const totalAttenduKg = arrondi(aggregat.realiseesKg + projectionKg)

    return NextResponse.json({
      data,
      stats: {
        // Compat ancien front : totalAnnee = projection pure (champ déjà utilisé).
        totalAnnee: Math.round(projectionAnnee * 100) / 100,
        // BUG-03 : nouveaux champs unifiés (alignés avec Dashboard/Calendrier).
        realiseesKg: aggregat.realiseesKg,
        projectionKg,
        projectionRotationsKg,
        totalAttenduKg,
        surfaceTotale: Math.round(surfaceTotale * 100) / 100,
        meilleurePeriode: meilleurePeriode.periode,
        meilleureQuantite: Math.round(meilleurePeriode.totalKg * 100) / 100,
      },
      annee,
      groupBy,
    })
  } catch (error) {
    console.error('GET /api/planification/recoltes-prevues error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des recoltes prevues', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
