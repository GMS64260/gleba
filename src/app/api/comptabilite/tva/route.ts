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
    const trimestre = searchParams.get('trimestre') // 1, 2, 3, 4 ou null pour annee complète

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
      // Exclure auto=true pour eviter double comptage avec sources brutes ci-dessous
      prisma.venteManuelle.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
          auto: { not: true },
        },
      }),

      prisma.facture.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
          statut: { not: 'annulee' },
        },
      }),

      // VenteProduit (elevage) - pas de champ TVA, on applique 5.5% par défaut
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
      // Exclure auto=true pour eviter double comptage avec sources brutes ci-dessous
      prisma.depenseManuelle.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
          auto: { not: true },
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

    // Calculer TVA par taux. On utilise toutes les clés présentes
    // dans les données (saisie), avec garde-fou sur les taux standards FR.
    const tvaCollectee: Record<string, { base: number; tva: number }> = {
      '0': { base: 0, tva: 0 },
      '2.1': { base: 0, tva: 0 },
      '5.5': { base: 0, tva: 0 },
      '10': { base: 0, tva: 0 },
      '20': { base: 0, tva: 0 },
    }

    const tvaDeductible: Record<string, { base: number; tva: number }> = {
      '0': { base: 0, tva: 0 },
      '2.1': { base: 0, tva: 0 },
      '5.5': { base: 0, tva: 0 },
      '10': { base: 0, tva: 0 },
      '20': { base: 0, tva: 0 },
    }

    // PROMPT 15A — on suit les transactions sans inférence quand le taux est saisi.
    // Compteurs d'audit pour signaler à l'UI le périmètre des inférences.
    let nbInfereesCollectees = 0
    let nbInfereesDeductibles = 0

    function addCollectee(taux: string, ht: number, tva: number) {
      if (!tvaCollectee[taux]) tvaCollectee[taux] = { base: 0, tva: 0 }
      tvaCollectee[taux].base += ht
      tvaCollectee[taux].tva += tva
    }
    function addDeductible(taux: string, ht: number, tva: number) {
      if (!tvaDeductible[taux]) tvaDeductible[taux] = { base: 0, tva: 0 }
      tvaDeductible[taux].base += ht
      tvaDeductible[taux].tva += tva
    }

    // Ventes manuelles : utilise strictement les valeurs saisies
    ventesManuelles.forEach(v => {
      const taux = String(v.tauxTVA ?? 5.5)
      const ht = v.montantHT ?? (v.montant / (1 + (v.tauxTVA ?? 5.5) / 100))
      const tva = v.montantTVA ?? (v.montant - ht)
      addCollectee(taux, ht, tva)
      if (v.tvaInferee) nbInfereesCollectees++
    })

    // Factures : utilise totauxParTauxTva si présent (PROMPT 14C),
    // sinon fallback sur totaux globaux à 5.5% (factures pré-14C).
    factures.forEach(f => {
      const sign = f.type === 'avoir' ? -1 : 1
      const totaux = f.totauxParTauxTva as Record<string, { ht: number; tva: number }> | null
      if (totaux && Object.keys(totaux).length > 0) {
        for (const [taux, t] of Object.entries(totaux)) {
          addCollectee(taux, sign * (t.ht || 0), sign * (t.tva || 0))
        }
      } else {
        // Fallback pour factures antérieures à 14C
        addCollectee('5.5', sign * f.totalHT, sign * f.totalTVA)
        nbInfereesCollectees++
      }
    })

    // Sources brutes (élevage, récoltes, bois, abattages) : ces transactions
    // génèrent automatiquement des VenteManuelle (auto=true) via auto-compta.ts,
    // mais on les exclut ci-dessus (auto != true) pour éviter le double-comptage.
    // En l'absence de taux TVA saisi sur ces sources, on infère depuis la nature
    // du produit. À terme : faire saisir le taux à la source (cf. PROMPT 15A).
    ventesElevage.forEach(v => {
      const ttc = v.prixTotal
      const ht = ttc / (1 + 5.5 / 100)
      addCollectee('5.5', ht, ttc - ht)
      nbInfereesCollectees++
    })
    recoltesPotager.forEach(r => {
      const ttc = r.prixTotal || 0
      if (ttc > 0) {
        const ht = ttc / (1 + 5.5 / 100)
        addCollectee('5.5', ht, ttc - ht)
        nbInfereesCollectees++
      }
    })
    recoltesArbres.forEach(r => {
      const ttc = r.quantite * (r.prixKg || 0)
      if (ttc > 0) {
        const ht = ttc / (1 + 5.5 / 100)
        addCollectee('5.5', ht, ttc - ht)
        nbInfereesCollectees++
      }
    })
    venteBois.forEach(b => {
      const ttc = b.prixVente || 0
      if (ttc > 0) {
        const ht = ttc / (1 + 10 / 100)
        addCollectee('10', ht, ttc - ht)
        nbInfereesCollectees++
      }
    })
    venteAbattage.forEach(a => {
      const ttc = a.prixVente || 0
      if (ttc > 0) {
        const ht = ttc / (1 + 5.5 / 100)
        addCollectee('5.5', ht, ttc - ht)
        nbInfereesCollectees++
      }
    })

    // Dépenses manuelles (TVA déductible) — strictement les valeurs saisies
    depensesManuelles.forEach(d => {
      const taux = String(d.tauxTVA ?? 20)
      const ht = d.montantHT ?? (d.montant / (1 + (d.tauxTVA ?? 20) / 100))
      const tva = d.montantTVA ?? (d.montant - ht)
      addDeductible(taux, ht, tva)
      if (d.tvaInferee) nbInfereesDeductibles++
    })

    // Consommation aliments (déductible 10%) — inférence en attendant taux à la source
    consommationsAliments.forEach(c => {
      const userPrix = c.aliment.userStocks?.[0]?.prix ?? c.aliment.prix
      const ttc = c.quantite * (userPrix || 0)
      if (ttc > 0) {
        const ht = ttc / (1 + 10 / 100)
        addDeductible('10', ht, ttc - ht)
        nbInfereesDeductibles++
      }
    })

    // Fertilisation (déductible 20%) — inférence en attendant taux à la source
    fertilisations.forEach(f => {
      const userPrix = f.fertilisant.userStocks?.[0]?.prix ?? f.fertilisant.prix
      const ttc = f.quantite * (userPrix || 0)
      if (ttc > 0) {
        const ht = ttc / (1 + 20 / 100)
        addDeductible('20', ht, ttc - ht)
        nbInfereesDeductibles++
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
        nbInfereesCollectees,
        nbInfereesDeductibles,
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
