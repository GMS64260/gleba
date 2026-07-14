/**
 * API Route pour les besoins en semences
 * GET /api/planification/semences
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getBesoinsSemences } from '@/lib/planification'
import { computeManquantsBreakdown } from '@/lib/semences/manquants'

const STOCK_STALE_DAYS = 30

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    const besoins = await getBesoinsSemences(userId, annee)

    // Résolution du NOM lisible par id : pour les entrées perso, la FK
    // especeId/varieteId est un cuid opaque ; le nom affichable vit dans
    // `nom` (= id pour l'officiel). On construit une Map id→nom sur les ids
    // présents, puis on expose especeNom/varieteNom (= nom ?? id) sur chaque
    // item. especeId/varieteId restent inchangés (clés/filtres/groupBy/URL).
    const especeIds = [...new Set(besoins.map(b => b.especeId).filter(Boolean))] as string[]
    const varieteIds = [...new Set(besoins.map(b => b.varieteId).filter((v): v is string => !!v))]
    const [especesNoms, varietesNoms] = await Promise.all([
      prisma.espece.findMany({ where: { id: { in: especeIds } }, select: { id: true, nom: true } }),
      prisma.variete.findMany({ where: { id: { in: varieteIds } }, select: { id: true, nom: true } }),
    ])
    const especeNomMap = new Map(especesNoms.map(e => [e.id, e.nom]))
    const varieteNomMap = new Map(varietesNoms.map(v => [v.id, v.nom]))
    const data = besoins.map(b => ({
      ...b,
      especeNom: especeNomMap.get(b.especeId) ?? b.especeId,
      varieteNom: b.varieteId ? (varieteNomMap.get(b.varieteId) ?? b.varieteId) : null,
    }))

    // Filtres dérivés (modes/totaux pour l'UI à 3 onglets).
    const graineDirecte = besoins.filter(b => b.mode === 'graine_directe' && b.statut !== 'IGNORE')
    const plantRepique = besoins.filter(b => b.mode === 'plant_repique' && b.statut !== 'IGNORE')
    const bulbeCaieu   = besoins.filter(b => b.mode === 'bulbe_caieu' && b.statut !== 'IGNORE')

    const totalGraines = besoins
      .filter(b => b.mode === 'graine_directe' || b.mode === 'plant_repique')
      .reduce((sum, b) => sum + b.grainesNecessaires, 0)
    const totalACommanderG = besoins.reduce((sum, b) => sum + b.aCommander, 0)
    const totalCaieux = bulbeCaieu.reduce((sum, b) => sum + b.besoinCaieux, 0)
    const totalCaieuxACommander = bulbeCaieu.reduce((sum, b) => sum + b.caieuxACommander, 0)

    const nbMissing = besoins.filter(b => b.statut === 'MISSING').length
    const nbLow     = besoins.filter(b => b.statut === 'LOW').length

    // BUG-15 : breakdown par mode (graines/plants vs caïeux) — le header
    // « 8 manquant » contredisait la liste « 6 graines » : les 2 caïeux
    // n'étaient pas remontés au même endroit.
    const breakdown = computeManquantsBreakdown(besoins)
    const { nbMissingGraines, nbMissingCaieux, nbLowGraines, nbLowCaieux } = breakdown

    // Alerte stock obsolète : la dernière `dateStock` la plus récente parmi
    // les variétés portant un besoin. Si > 30 jours, on prévient l'UI.
    const maxDateMaj = besoins
      .map(b => (b.stockDateMaj ? new Date(b.stockDateMaj).getTime() : 0))
      .reduce((m, v) => Math.max(m, v), 0)
    const stockObsolete =
      maxDateMaj > 0 &&
      Date.now() - maxDateMaj > STOCK_STALE_DAYS * 24 * 3600 * 1000

    return NextResponse.json({
      data,
      stats: {
        nbEspeces: new Set(besoins.map(b => b.especeId)).size,
        totalPlants: besoins.reduce((sum, b) => sum + b.nbPlants, 0),
        totalGraines,
        totalACommander: totalACommanderG,
        totalCaieux,
        totalCaieuxACommander,
        especesSansStock: nbMissing + nbLow,
        nbMissing,
        nbLow,
        nbMissingGraines,
        nbMissingCaieux,
        nbLowGraines,
        nbLowCaieux,
        nbGraineDirecte: graineDirecte.length,
        nbPlantRepique: plantRepique.length,
        nbBulbeCaieu: bulbeCaieu.length,
        stockObsolete,
        stockObsoleteSeuilJours: STOCK_STALE_DAYS,
        derniereMajStockISO: maxDateMaj > 0 ? new Date(maxDateMaj).toISOString() : null,
      },
      annee,
    })
  } catch (error) {
    console.error('GET /api/planification/semences error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des besoins en semences', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
