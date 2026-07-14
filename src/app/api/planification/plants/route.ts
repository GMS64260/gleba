/**
 * API Route pour les besoins en plants
 * GET /api/planification/plants
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getBesoinsPlants } from '@/lib/planification'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    const besoins = await getBesoinsPlants(userId, annee)

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

    // Calculer les totaux
    const totalPlants = besoins.reduce((sum, b) => sum + b.nbPlants, 0)
    const totalCultures = besoins.reduce((sum, b) => sum + b.cultures.length, 0)
    const totalACommander = besoins.reduce((sum, b) => sum + b.aCommander, 0)
    const besoinsSansStock = besoins.filter(b => b.aCommander > 0)

    // Grouper par semaine de plantation
    const parSemaine: Record<number, number> = {}
    for (const besoin of besoins) {
      if (besoin.semainePlantation) {
        parSemaine[besoin.semainePlantation] = (parSemaine[besoin.semainePlantation] || 0) + besoin.nbPlants
      }
    }

    return NextResponse.json({
      data,
      stats: {
        nbEspeces: besoins.length,
        totalPlants,
        totalCultures,
        totalACommander,
        especesSansStock: besoinsSansStock.length,
        parSemaine,
      },
      annee,
    })
  } catch (error) {
    console.error('GET /api/planification/plants error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des besoins en plants', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
