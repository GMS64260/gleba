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

      // Lots avec effectif réel > 0 (estimation collecte).
      // Bug cmp8s0izb (Marc 2026-05-16) — on filtrait sur statut='actif'
      // uniquement, donc un lot "Pondeuses 2026" mal réformé (statut=termine
      // mais cheptel non transféré) sortait du calcul et le taux de ponte
      // tombait à 0/jour → "Taux collecte sem. —". On inclut tout lot dont
      // quantiteActuelle > 0 quel que soit le statut.
      prisma.lotAnimaux.findMany({
        where: {
          userId,
          quantiteActuelle: { gt: 0 },
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
    let estimationOeufsJour = lotsActifs.reduce((sum, lot) => {
      if (lot.especeAnimale.production === 'oeufs' || lot.especeAnimale.production === 'mixte') {
        return sum + oeufsAttendusJour(lot.quantiteActuelle, lot.especeAnimale.nom, refDate)
      }
      return sum
    }, 0)

    // Bug #9 — Si on dispose d'un historique significatif (>= 14 jours
    // avec ponte), on pondère 50/50 avec la moyenne observée pour ne pas
    // afficher un attendu qui contredit la réalité du terrain. Empêche le
    // ressenti "valeur figée à 23/jour alors que je collecte 10/jour".
    const debutHistorique = new Date(now.getTime() - 60 * 86_400_000)
    const historiqueOeufs = await prisma.productionOeuf.findMany({
      where: { userId, date: { gte: debutHistorique, lte: now } },
      select: { date: true, quantite: true },
    })
    let estimationSource: 'theorique' | 'historique' | 'mixte' = 'theorique'
    if (historiqueOeufs.length > 0) {
      const datesUniques = new Set(historiqueOeufs.map(o => o.date.toISOString().split('T')[0]))
      const jours = datesUniques.size
      const moyenneObservee = historiqueOeufs.reduce((s, p) => s + p.quantite, 0) / Math.max(1, jours)
      if (jours >= 14 && estimationOeufsJour > 0) {
        estimationOeufsJour = (estimationOeufsJour + moyenneObservee) / 2
        estimationSource = 'mixte'
      } else if (estimationOeufsJour === 0 && moyenneObservee > 0) {
        estimationOeufsJour = moyenneObservee
        estimationSource = 'historique'
      }
    }

    // Bug cmp8s0izb (Marc 2026-05-16) — Fallback : si on a des collectes
    // mais aucun lot productif (effectifs à 0), on retombe sur les lots
    // qui ont produit des œufs dans la période en utilisant quantiteInitiale
    // comme proxy. Évite "Taux collecte —" alors que 76 œufs collectés.
    if (estimationOeufsJour === 0 && totalOeufs > 0) {
      const lotIdsProductifs = Array.from(
        new Set(productions.map((p) => p.lot?.id).filter((x): x is number => typeof x === 'number'))
      )
      if (lotIdsProductifs.length > 0) {
        const lotsProductifs = await prisma.lotAnimaux.findMany({
          where: { userId, id: { in: lotIdsProductifs } },
          include: { especeAnimale: { select: { ponteAnnuelle: true, production: true, nom: true } } },
        })
        estimationOeufsJour = lotsProductifs.reduce((sum, lot) => {
          if (lot.especeAnimale.production === 'oeufs' || lot.especeAnimale.production === 'mixte') {
            const effectif = lot.quantiteActuelle > 0 ? lot.quantiteActuelle : lot.quantiteInitiale
            return sum + oeufsAttendusJour(effectif, lot.especeAnimale.nom, refDate)
          }
          return sum
        }, 0)
      }
    }

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
        // Bug #9 — origine de l'estimation pour rendre la valeur lisible.
        estimationSource,
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
