/**
 * API TVA - Résumé pour déclaration
 * GET /api/comptabilite/tva
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const trimestre = searchParams.get('trimestre') // 1, 2, 3, 4 ou null pour année complète

    const userId = session.user.id

    // Calculer les dates
    let startDate: Date, endDate: Date
    if (trimestre) {
      const t = parseInt(trimestre)
      startDate = new Date(year, (t - 1) * 3, 1)
      endDate = new Date(year, t * 3, 0, 23, 59, 59)
    } else {
      startDate = new Date(year, 0, 1)
      endDate = new Date(year, 11, 31, 23, 59, 59)
    }

    // TVA Collectée (sur les ventes)
    const [ventesManuelles, factures, ventesElevage, recoltesPotager, recoltesArbres, venteBois, venteAbattage] = await Promise.all([
      prisma.venteManuelle.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
        },
      }),

      prisma.facture.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
          statut: { not: 'annulee' },
        },
      }),

      // VenteProduit (élevage) - pas de champ TVA, on applique 5.5% par défaut
      prisma.venteProduit.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
        },
        select: { prixTotal: true },
      }),

      // Recolte potager vendues - pas de champ TVA, on applique 5.5% par défaut
      prisma.recolte.findMany({
        where: {
          userId,
          statut: 'vendu',
          dateVente: { gte: startDate, lte: endDate },
          prixTotal: { not: null },
        },
        select: { prixTotal: true },
      }),

      // RecolteArbre vendues (fruits) - TVA 5.5% produits agricoles
      prisma.recolteArbre.findMany({
        where: {
          userId,
          statut: 'vendu',
          dateVente: { gte: startDate, lte: endDate },
          prixKg: { not: null },
        },
        select: { quantite: true, prixKg: true },
      }),

      // ProductionBois vendu (bois de chauffage) - TVA 10%
      prisma.productionBois.findMany({
        where: {
          userId,
          dateVente: { gte: startDate, lte: endDate },
          prixVente: { not: null },
        },
        select: { prixVente: true },
      }),

      // Abattage avec vente (viande) - TVA 5.5%
      prisma.abattage.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
          prixVente: { not: null },
        },
        select: { prixVente: true },
      }),
    ])

    // TVA Déductible (sur les achats)
    const [depensesManuelles, consommationsAliments, fertilisations] = await Promise.all([
      prisma.depenseManuelle.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
        },
      }),

      // ConsommationAliment - TVA 10% (aliments pour animaux)
      prisma.consommationAliment.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
        },
        select: {
          quantite: true,
          aliment: {
            select: {
              prix: true,
              userStocks: {
                where: { userId },
                select: { prix: true },
                take: 1,
              },
            },
          },
        },
      }),

      // Fertilisation - TVA 20% (engrais, amendements)
      prisma.fertilisation.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
        },
        select: {
          quantite: true,
          fertilisant: {
            select: {
              prix: true,
              userStocks: {
                where: { userId },
                select: { prix: true },
                take: 1,
              },
            },
          },
        },
      }),
    ])

    // Calculer TVA par taux
    const tvaCollectee: Record<string, { base: number; tva: number }> = {
      '5.5': { base: 0, tva: 0 },
      '10': { base: 0, tva: 0 },
      '20': { base: 0, tva: 0 },
    }

    const tvaDeductible: Record<string, { base: number; tva: number }> = {
      '5.5': { base: 0, tva: 0 },
      '10': { base: 0, tva: 0 },
      '20': { base: 0, tva: 0 },
    }

    // Ventes manuelles
    ventesManuelles.forEach(v => {
      const taux = String(v.tauxTVA || 5.5)
      const ht = v.montantHT || (v.montant / (1 + (v.tauxTVA || 5.5) / 100))
      const tva = v.montantTVA || (v.montant - ht)

      if (tvaCollectee[taux]) {
        tvaCollectee[taux].base += ht
        tvaCollectee[taux].tva += tva
      }
    })

    // Factures
    factures.forEach(f => {
      if (f.type === 'avoir') {
        // Les avoirs diminuent la TVA collectée
        // Simplification: on met tout en 5.5%
        tvaCollectee['5.5'].base -= f.totalHT
        tvaCollectee['5.5'].tva -= f.totalTVA
      } else {
        // Simplification pour l'instant
        tvaCollectee['5.5'].base += f.totalHT
        tvaCollectee['5.5'].tva += f.totalTVA
      }
    })

    // Ventes élevage (VenteProduit) - TVA 5.5% produits agricoles
    ventesElevage.forEach(v => {
      const ttc = v.prixTotal
      const ht = ttc / (1 + 5.5 / 100)
      const tva = ttc - ht
      tvaCollectee['5.5'].base += ht
      tvaCollectee['5.5'].tva += tva
    })

    // Récoltes potager vendues - TVA 5.5% produits agricoles
    recoltesPotager.forEach(r => {
      const ttc = r.prixTotal || 0
      if (ttc > 0) {
        const ht = ttc / (1 + 5.5 / 100)
        const tva = ttc - ht
        tvaCollectee['5.5'].base += ht
        tvaCollectee['5.5'].tva += tva
      }
    })

    // Récoltes arbres vendues (fruits) - TVA 5.5% produits agricoles
    recoltesArbres.forEach(r => {
      const ttc = r.quantite * (r.prixKg || 0)
      if (ttc > 0) {
        const ht = ttc / (1 + 5.5 / 100)
        const tva = ttc - ht
        tvaCollectee['5.5'].base += ht
        tvaCollectee['5.5'].tva += tva
      }
    })

    // Vente bois (bois de chauffage) - TVA 10%
    venteBois.forEach(b => {
      const ttc = b.prixVente || 0
      if (ttc > 0) {
        const ht = ttc / (1 + 10 / 100)
        const tva = ttc - ht
        tvaCollectee['10'].base += ht
        tvaCollectee['10'].tva += tva
      }
    })

    // Abattage avec vente (viande) - TVA 5.5%
    venteAbattage.forEach(a => {
      const ttc = a.prixVente || 0
      if (ttc > 0) {
        const ht = ttc / (1 + 5.5 / 100)
        const tva = ttc - ht
        tvaCollectee['5.5'].base += ht
        tvaCollectee['5.5'].tva += tva
      }
    })

    // Dépenses manuelles (TVA déductible)
    depensesManuelles.forEach(d => {
      const taux = String(d.tauxTVA || 20)
      const ht = d.montantHT || (d.montant / (1 + (d.tauxTVA || 20) / 100))
      const tva = d.montantTVA || (d.montant - ht)

      if (tvaDeductible[taux]) {
        tvaDeductible[taux].base += ht
        tvaDeductible[taux].tva += tva
      }
    })

    // Consommation aliments (TVA déductible 10% - aliments pour animaux)
    consommationsAliments.forEach(c => {
      const userPrix = c.aliment.userStocks?.[0]?.prix ?? c.aliment.prix
      const ttc = c.quantite * (userPrix || 0)
      if (ttc > 0) {
        const ht = ttc / (1 + 10 / 100)
        const tva = ttc - ht
        tvaDeductible['10'].base += ht
        tvaDeductible['10'].tva += tva
      }
    })

    // Fertilisation (TVA déductible 20% - engrais, amendements)
    fertilisations.forEach(f => {
      const userPrix = f.fertilisant.userStocks?.[0]?.prix ?? f.fertilisant.prix
      const ttc = f.quantite * (userPrix || 0)
      if (ttc > 0) {
        const ht = ttc / (1 + 20 / 100)
        const tva = ttc - ht
        tvaDeductible['20'].base += ht
        tvaDeductible['20'].tva += tva
      }
    })

    // Totaux
    const totalCollectee = Object.values(tvaCollectee).reduce((sum, t) => sum + t.tva, 0)
    const totalDeductible = Object.values(tvaDeductible).reduce((sum, t) => sum + t.tva, 0)
    const tvaAPayer = totalCollectee - totalDeductible

    return NextResponse.json({
      periode: {
        annee: year,
        trimestre: trimestre ? parseInt(trimestre) : null,
        debut: startDate.toISOString(),
        fin: endDate.toISOString(),
      },
      collectee: {
        parTaux: tvaCollectee,
        total: totalCollectee,
        baseTotal: Object.values(tvaCollectee).reduce((sum, t) => sum + t.base, 0),
      },
      deductible: {
        parTaux: tvaDeductible,
        total: totalDeductible,
        baseTotal: Object.values(tvaDeductible).reduce((sum, t) => sum + t.base, 0),
      },
      solde: {
        tvaAPayer: tvaAPayer > 0 ? tvaAPayer : 0,
        creditTVA: tvaAPayer < 0 ? Math.abs(tvaAPayer) : 0,
      },
      details: {
        nbVentes: ventesManuelles.length,
        nbVentesElevage: ventesElevage.length,
        nbRecoltesPotager: recoltesPotager.length,
        nbRecoltesArbres: recoltesArbres.length,
        nbVenteBois: venteBois.length,
        nbAbattages: venteAbattage.length,
        nbFactures: factures.length,
        nbDepenses: depensesManuelles.length,
        nbConsommationsAliments: consommationsAliments.length,
        nbFertilisations: fertilisations.length,
      },
    })
  } catch (error) {
    console.error('GET /api/comptabilite/tva error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
