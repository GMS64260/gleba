/**
 * API Mortalites Elevage - Agregation par cause et par mois
 * GET /api/elevage/mortalites?annee=2026
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

const currentYear = () => new Date().getUTCFullYear()
const yearSchema = z.coerce.number().int().min(1990).max(currentYear() + 1)

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const parsedYear = yearSchema.safeParse(
      searchParams.get('annee') || String(currentYear()),
    )
    if (!parsedYear.success) {
      return NextResponse.json({ error: 'Année invalide' }, { status: 400 })
    }
    const annee = parsedYear.data
    const userId = session.user.id
    const startOfYear = new Date(Date.UTC(annee, 0, 1))
    const endOfYear = new Date(Date.UTC(annee + 1, 0, 1))

    // Animaux morts cette annee
    const mortalites = await prisma.animal.findMany({
      where: {
        userId,
        statut: 'mort',
        dateSortie: { gte: startOfYear, lt: endOfYear },
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
