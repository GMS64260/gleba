/**
 * API Route pour les recoltes prevues
 * GET /api/planification/recoltes-prevues
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getRecoltesPrevuesDetail } from '@/lib/planification'
import { getRecoltesAnneeAggregat } from '@/lib/kpi/recoltes-annee'
import { arrondirQuantites, fusionnerQuantites, type QuantiteParUnite } from '@/lib/recolte/quantites'

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

    // Ventilation par unité (2026-08-20) : une projection en tiges ou en bottes
    // ne s'additionne pas aux kilos, mais elle ne doit pas non plus disparaître
    // de l'en-tête — c'était le cas d'un compte tout en fleurs coupées, qui
    // lisait « 0,0 kg attendu » au-dessus d'un tableau plein.
    const projectionAnneeParUnite = arrondirQuantites(
      fusionnerQuantites(...recoltesPrevues.map((r) => r.totalParUnite)),
    )

    // Trouver les mois/semaines avec le plus de recoltes. Le critère est le
    // volume toutes unités confondues : c'est un ORDRE, pas un total affiché.
    const volume = (v: QuantiteParUnite) =>
      Object.values(v).reduce((somme, valeur) => somme + (valeur ?? 0), 0)
    const meilleurePeriode = recoltesPrevues.reduce(
      (max, r) => (volume(r.totalParUnite) > volume(max.totalParUnite) ? r : max),
      { periode: '', totalKg: 0, totalParUnite: {} as QuantiteParUnite }
    )

    // QA cmswxpaer — l'en-tête et les cartes ignoraient les cultures suggérées
    // par les rotations, que le tableau projette pourtant : 2028 annonçait
    // « 0,0 kg attendu » avec 361,9 kg en juillet. Le total couvre désormais ce
    // que l'écran montre, en nommant la part encore à créer.
    //
    // La projection doit venir du MÊME calcul que le tableau affiché juste en
    // dessous : `aggregat.projectionKg` porte sur une autre population (les
    // cultures non récoltées de l'année, quelle que soit leur planche) et
    // rendait « 0,0 kg attendu » en en-tête au-dessus d'un tableau annonçant
    // 36,0 kg en juillet et 21,6 kg en août. `projectionCreeesKg` est calculé
    // sur exactement les lignes du tableau — il était produit puis jeté.
    const arrondi = (n: number) => Math.round(n * 100) / 100
    const projectionRotationsKg = detailPrevues.projectionSuggestionsKg
    const projectionKg = arrondi(detailPrevues.projectionCreeesKg + projectionRotationsKg)
    const totalAttenduKg = arrondi(aggregat.realiseesKg + projectionKg)
    const projectionParUnite = arrondirQuantites(
      fusionnerQuantites(
        detailPrevues.projectionCreeesParUnite,
        detailPrevues.projectionSuggestionsParUnite,
      ),
    )
    const totalAttenduParUnite = arrondirQuantites(
      fusionnerQuantites(aggregat.realiseesParUnite, projectionParUnite),
    )

    return NextResponse.json({
      data,
      stats: {
        // Compat ancien front : totalAnnee = projection pure (champ déjà utilisé).
        totalAnnee: Math.round(projectionAnnee * 100) / 100,
        totalAnneeParUnite: projectionAnneeParUnite,
        // BUG-03 : nouveaux champs unifiés (alignés avec Dashboard/Calendrier).
        realiseesKg: aggregat.realiseesKg,
        projectionKg,
        projectionRotationsKg,
        totalAttenduKg,
        // Mêmes trois valeurs, toutes unités comprises.
        realiseesParUnite: aggregat.realiseesParUnite,
        projectionParUnite,
        projectionRotationsParUnite: detailPrevues.projectionSuggestionsParUnite,
        totalAttenduParUnite,
        surfaceTotale: Math.round(surfaceTotale * 100) / 100,
        meilleurePeriode: meilleurePeriode.periode,
        meilleureQuantite: Math.round(meilleurePeriode.totalKg * 100) / 100,
        meilleureQuantiteParUnite: arrondirQuantites(meilleurePeriode.totalParUnite),
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
