/**
 * API Taches Elevage - Vue calendrier hebdomadaire
 * GET /api/elevage/taches?start=ISO&end=ISO
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { oeufsAttendusJour } from '@/lib/elevage/taux-ponte'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const startStr = searchParams.get('start')
    const endStr = searchParams.get('end')

    const userId = session.user.id
    const now = new Date()

    // Defaut : semaine courante
    const start = startStr ? new Date(startStr) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1)
    const end = endStr ? new Date(endStr) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)

    const [soins, productions, consommations, lotsActifs] = await Promise.all([
      // Soins prevus ou faits dans la periode
      prisma.soinAnimal.findMany({
        where: {
          userId,
          OR: [
            { datePrevue: { gte: start, lte: end } },
            { date: { gte: start, lte: end } },
          ],
        },
        include: {
          animal: { select: { id: true, nom: true, identifiant: true } },
          lot: { select: { id: true, nom: true } },
        },
        orderBy: { date: 'asc' },
      }),

      // Productions oeufs de la periode
      prisma.productionOeuf.findMany({
        where: {
          userId,
          date: { gte: start, lte: end },
        },
        include: {
          lot: { select: { id: true, nom: true } },
        },
        orderBy: { date: 'asc' },
      }),

      // Consommations aliments de la periode
      prisma.consommationAliment.findMany({
        where: {
          userId,
          date: { gte: start, lte: end },
        },
        include: {
          aliment: { select: { id: true, nom: true } },
          lot: { select: { id: true, nom: true } },
        },
        orderBy: { date: 'asc' },
      }),

      // Lots actifs (pour estimation collecte)
      prisma.lotAnimaux.findMany({
        where: {
          userId,
          statut: 'actif',
        },
        include: {
          especeAnimale: {
            select: { ponteAnnuelle: true, production: true, nom: true },
          },
        },
      }),
    ])

    // Stats de la periode
    const soinsFaits = soins.filter(s => s.fait).length
    const soinsTotal = soins.length
    const totalOeufs = productions.reduce((s, p) => s + p.quantite, 0)
    const totalConsoKg = consommations.reduce((s, c) => s + c.quantite, 0)

    // Estimation production quotidienne attendue — BUG #3 (audit Julien
    // 15/05/2026) : avant on faisait simplement `ponteAnnuelle / 365 ×
    // effectif` ce qui donnait « ~14/jour » figé en hiver comme en été
    // pour 29 Marans. On utilise désormais le référentiel saisonnier
    // (lib/elevage/taux-ponte.ts) qui ajuste au mois courant et à la race
    // (Marans, Sussex, etc.).
    const refDate = end < now ? end : now
    const estimationOeufsJour = lotsActifs.reduce((sum, lot) => {
      if (lot.especeAnimale.production === 'oeufs' || lot.especeAnimale.production === 'mixte') {
        return sum + oeufsAttendusJour(lot.quantiteActuelle, lot.especeAnimale.nom, refDate)
      }
      return sum
    }, 0)

    return NextResponse.json({
      soins: soins.map(s => ({
        id: s.id,
        date: s.datePrevue || s.date,
        dateReelle: s.date,
        type: s.type,
        description: s.description,
        produit: s.produit,
        cout: s.cout,
        fait: s.fait,
        animal: s.animal,
        lot: s.lot,
      })),
      productions: productions.map(p => ({
        id: p.id,
        date: p.date,
        quantite: p.quantite,
        casses: p.casses,
        lot: p.lot,
      })),
      consommations: consommations.map(c => ({
        id: c.id,
        date: c.date,
        quantite: c.quantite,
        aliment: c.aliment,
        lot: c.lot,
      })),
      stats: {
        soinsTotal,
        soinsFaits,
        soinsRestants: soinsTotal - soinsFaits,
        totalOeufs,
        totalConsoKg: Math.round(totalConsoKg * 10) / 10,
        estimationOeufsJour: Math.round(estimationOeufsJour),
        nbLotsPondeuses: lotsActifs.filter(l =>
          l.especeAnimale.production === 'oeufs' || l.especeAnimale.production === 'mixte'
        ).length,
      },
    })
  } catch (error) {
    console.error('GET /api/elevage/taches error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des taches', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
