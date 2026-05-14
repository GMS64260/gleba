/**
 * API Mortalites Elevage - Agregation par cause et par mois
 * GET /api/elevage/mortalites?annee=2026
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())
    const userId = session.user.id
    const startOfYear = new Date(annee, 0, 1)
    const endOfYear = new Date(annee, 11, 31, 23, 59, 59)

    // Animaux morts cette annee
    const mortalites = await prisma.animal.findMany({
      where: {
        userId,
        statut: 'mort',
        dateSortie: { gte: startOfYear, lte: endOfYear },
      },
      select: {
        id: true,
        nom: true,
        identifiant: true,
        causeSortie: true,
        dateSortie: true,
        especeAnimale: { select: { id: true, nom: true } },
        lot: { select: { id: true, nom: true } },
      },
      orderBy: { dateSortie: 'desc' },
    })

    // Agreger par cause
    const parCause: Record<string, number> = {}
    mortalites.forEach(m => {
      const cause = m.causeSortie || 'inconnu'
      parCause[cause] = (parCause[cause] || 0) + 1
    })

    // Agreger par mois
    const parMois: Record<number, number> = {}
    mortalites.forEach(m => {
      if (m.dateSortie) {
        const mois = new Date(m.dateSortie).getMonth() + 1
        parMois[mois] = (parMois[mois] || 0) + 1
      }
    })

    // Agreger par espece
    const parEspece: Record<string, { nom: string; count: number }> = {}
    mortalites.forEach(m => {
      const id = m.especeAnimale.id
      if (!parEspece[id]) parEspece[id] = { nom: m.especeAnimale.nom, count: 0 }
      parEspece[id].count++
    })

    // Taux de mortalite global
    const totalActifs = await prisma.animal.count({
      where: { userId, statut: 'actif' },
    })
    const totalMorts = mortalites.length
    const tauxMortalite = (totalActifs + totalMorts) > 0
      ? (totalMorts / (totalActifs + totalMorts)) * 100
      : 0

    return NextResponse.json({
      data: mortalites,
      stats: {
        total: totalMorts,
        tauxMortalite: Math.round(tauxMortalite * 10) / 10,
        parCause: Object.entries(parCause).map(([cause, count]) => ({ cause, count })),
        parMois: Array.from({ length: 12 }, (_, i) => ({
          mois: i + 1,
          count: parMois[i + 1] || 0,
        })),
        parEspece: Object.values(parEspece),
      },
    })
  } catch (error) {
    console.error('GET /api/elevage/mortalites error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des mortalites', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
