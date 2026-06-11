/**
 * Calcul TVA — source unique de vérité partagée par :
 *   - /api/comptabilite/tva (déclaration CA3 + breakdown par taux)
 *   - /api/comptabilite/bilan (TVA à payer au passif)
 *
 * Audit comptable BUG #8 (2026-05-15) : avant ce helper, le Bilan
 * calculait `Σ VenteManuelle.montantTVA − Σ DepenseManuelle.montantTVA`
 * tandis que Rapports/TVA ajoutait en plus les sources brutes (ventes
 * élevage, récoltes, bois, abattages, aliments, fertilisations) avec
 * une TVA inférée. Écart constaté : 0,91 € sur la démo (arrondi par
 * ligne dans les inférences vs valeur stockée par auto-compta).
 *
 * Désormais les deux écrans appellent `computeTvaPeriode` → même
 * valeur affichée. L'arrondi se fait au moment de l'affichage
 * (chaque taux a sa propre somme arrondie à 2 décimales), pas par
 * ligne, ce qui élimine la dérive cumulée.
 */

import prisma from '@/lib/prisma'

export interface TvaParTaux {
  base: number
  tva: number
}

export interface InferencesBreakdown {
  ventesManuelles: number
  facturesAnciennes: number
  ventesElevage: number
  recoltesPotager: number
  recoltesArbres: number
  venteBois: number
  venteAbattage: number
  depensesManuelles: number
  consommationsAliments: number
  fertilisations: number
}

export interface TvaPeriode {
  collectee: {
    parTaux: Record<string, TvaParTaux>
    total: number
    baseTotal: number
  }
  deductible: {
    parTaux: Record<string, TvaParTaux>
    total: number
    baseTotal: number
  }
  solde: {
    tvaAPayer: number
    creditTVA: number
  }
  details: {
    nbVentes: number
    nbFactures: number
    nbVentesElevage: number
    nbRecoltesPotager: number
    nbRecoltesArbres: number
    nbVenteBois: number
    nbAbattages: number
    nbDepenses: number
    nbConsommationsAliments: number
    nbFertilisations: number
    nbInfereesCollectees: number
    nbInfereesDeductibles: number
    inferencesBreakdown: InferencesBreakdown
  }
}

export async function computeTvaPeriode(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<TvaPeriode> {
  // ─── Sources collectées ─────────────────────────────────────────────
  const [
    ventesManuelles,
    factures,
    ventesElevage,
    recoltesPotager,
    recoltesArbres,
    venteBois,
    venteAbattage,
  ] = await Promise.all([
    prisma.venteManuelle.findMany({
      where: { userId, date: { gte: startDate, lte: endDate }, auto: { not: true } },
    }),
    // Audit compta 2026-06 : mêmes filtres anti-double-comptage que le FEC
    // (export/fec/route.ts) — une source facturée est comptée via sa Facture
    // (factureId: null), les brouillons et annulés sont exclus.
    prisma.facture.findMany({
      where: { userId, date: { gte: startDate, lte: endDate }, statut: { notIn: ['annulee', 'brouillon'] } },
    }),
    prisma.venteProduit.findMany({
      where: { userId, date: { gte: startDate, lte: endDate }, factureId: null, annule: false },
      select: { prixTotal: true },
    }),
    prisma.recolte.findMany({
      where: { userId, statut: 'vendu', dateVente: { gte: startDate, lte: endDate }, prixTotal: { not: null }, factureId: null },
      select: { prixTotal: true },
    }),
    prisma.recolteArbre.findMany({
      where: { userId, statut: 'vendu', dateVente: { gte: startDate, lte: endDate }, prixKg: { not: null }, factureId: null },
      select: { quantite: true, prixKg: true },
    }),
    prisma.productionBois.findMany({
      where: { userId, dateVente: { gte: startDate, lte: endDate }, prixVente: { not: null }, factureId: null },
      select: { prixVente: true },
    }),
    prisma.abattage.findMany({
      where: { userId, date: { gte: startDate, lte: endDate }, prixVente: { not: null }, factureId: null, annule: false, destination: 'vente' },
      select: { prixVente: true },
    }),
  ])

  // ─── Sources déductibles ───────────────────────────────────────────
  const [depensesManuelles, consommationsAliments, fertilisations] = await Promise.all([
    prisma.depenseManuelle.findMany({
      where: { userId, date: { gte: startDate, lte: endDate }, auto: { not: true } },
    }),
    prisma.consommationAliment.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      select: {
        quantite: true,
        aliment: {
          select: {
            prix: true,
            userStocks: { where: { userId }, select: { prix: true }, take: 1 },
          },
        },
      },
    }),
    prisma.fertilisation.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      select: {
        quantite: true,
        fertilisant: {
          select: {
            prix: true,
            userStocks: { where: { userId }, select: { prix: true }, take: 1 },
          },
        },
      },
    }),
  ])

  // Buckets par taux (clés stables 0 / 2.1 / 5.5 / 10 / 20)
  const TAUX_KEYS = ['0', '2.1', '5.5', '10', '20'] as const
  const tvaCollectee: Record<string, TvaParTaux> = Object.fromEntries(TAUX_KEYS.map(k => [k, { base: 0, tva: 0 }]))
  const tvaDeductible: Record<string, TvaParTaux> = Object.fromEntries(TAUX_KEYS.map(k => [k, { base: 0, tva: 0 }]))

  let nbInfereesCollectees = 0
  let nbInfereesDeductibles = 0
  const inferencesBreakdown: InferencesBreakdown = {
    ventesManuelles: 0,
    facturesAnciennes: 0,
    ventesElevage: 0,
    recoltesPotager: 0,
    recoltesArbres: 0,
    venteBois: 0,
    venteAbattage: 0,
    depensesManuelles: 0,
    consommationsAliments: 0,
    fertilisations: 0,
  }

  const addC = (taux: string, ht: number, tva: number) => {
    if (!tvaCollectee[taux]) tvaCollectee[taux] = { base: 0, tva: 0 }
    tvaCollectee[taux].base += ht
    tvaCollectee[taux].tva += tva
  }
  const addD = (taux: string, ht: number, tva: number) => {
    if (!tvaDeductible[taux]) tvaDeductible[taux] = { base: 0, tva: 0 }
    tvaDeductible[taux].base += ht
    tvaDeductible[taux].tva += tva
  }

  // Ventes manuelles : valeurs saisies
  for (const v of ventesManuelles) {
    const taux = String(v.tauxTVA ?? 5.5)
    const ht = v.montantHT ?? (v.montant / (1 + (v.tauxTVA ?? 5.5) / 100))
    const tva = v.montantTVA ?? (v.montant - ht)
    addC(taux, ht, tva)
    if (v.tvaInferee) {
      nbInfereesCollectees++
      inferencesBreakdown.ventesManuelles++
    }
  }

  // Factures : totaux par taux si présent, sinon fallback 5,5 %
  for (const f of factures) {
    const sign = f.type === 'avoir' ? -1 : 1
    const totaux = f.totauxParTauxTva as Record<string, { ht: number; tva: number }> | null
    if (totaux && Object.keys(totaux).length > 0) {
      for (const [taux, t] of Object.entries(totaux)) {
        addC(taux, sign * (t.ht || 0), sign * (t.tva || 0))
      }
    } else {
      addC('5.5', sign * f.totalHT, sign * f.totalTVA)
      nbInfereesCollectees++
      inferencesBreakdown.facturesAnciennes++
    }
  }

  // Sources brutes — TVA inférée
  for (const v of ventesElevage) {
    const ttc = v.prixTotal
    const ht = ttc / 1.055
    addC('5.5', ht, ttc - ht)
    nbInfereesCollectees++
    inferencesBreakdown.ventesElevage++
  }
  for (const r of recoltesPotager) {
    const ttc = r.prixTotal || 0
    if (ttc > 0) {
      const ht = ttc / 1.055
      addC('5.5', ht, ttc - ht)
      nbInfereesCollectees++
      inferencesBreakdown.recoltesPotager++
    }
  }
  for (const r of recoltesArbres) {
    const ttc = r.quantite * (r.prixKg || 0)
    if (ttc > 0) {
      const ht = ttc / 1.055
      addC('5.5', ht, ttc - ht)
      nbInfereesCollectees++
      inferencesBreakdown.recoltesArbres++
    }
  }
  for (const b of venteBois) {
    const ttc = b.prixVente || 0
    if (ttc > 0) {
      const ht = ttc / 1.10
      addC('10', ht, ttc - ht)
      nbInfereesCollectees++
      inferencesBreakdown.venteBois++
    }
  }
  for (const a of venteAbattage) {
    const ttc = a.prixVente || 0
    if (ttc > 0) {
      const ht = ttc / 1.055
      addC('5.5', ht, ttc - ht)
      nbInfereesCollectees++
      inferencesBreakdown.venteAbattage++
    }
  }

  // Dépenses manuelles : valeurs saisies
  for (const d of depensesManuelles) {
    const taux = String(d.tauxTVA ?? 20)
    const ht = d.montantHT ?? (d.montant / (1 + (d.tauxTVA ?? 20) / 100))
    const tva = d.montantTVA ?? (d.montant - ht)
    addD(taux, ht, tva)
    if (d.tvaInferee) {
      nbInfereesDeductibles++
      inferencesBreakdown.depensesManuelles++
    }
  }

  for (const c of consommationsAliments) {
    const userPrix = c.aliment.userStocks?.[0]?.prix ?? c.aliment.prix
    const ttc = c.quantite * (userPrix || 0)
    if (ttc > 0) {
      const ht = ttc / 1.10
      addD('10', ht, ttc - ht)
      nbInfereesDeductibles++
      inferencesBreakdown.consommationsAliments++
    }
  }

  for (const f of fertilisations) {
    const userPrix = f.fertilisant.userStocks?.[0]?.prix ?? f.fertilisant.prix
    const ttc = f.quantite * (userPrix || 0)
    if (ttc > 0) {
      const ht = ttc / 1.20
      addD('20', ht, ttc - ht)
      nbInfereesDeductibles++
      inferencesBreakdown.fertilisations++
    }
  }

  // Totaux : arrondi GLOBAL par taux puis somme (pas d'arrondi par ligne).
  // Cela élimine la dérive 0,91 € identifiée par l'audit comptable.
  for (const k of TAUX_KEYS) {
    tvaCollectee[k] = {
      base: Math.round(tvaCollectee[k].base * 100) / 100,
      tva: Math.round(tvaCollectee[k].tva * 100) / 100,
    }
    tvaDeductible[k] = {
      base: Math.round(tvaDeductible[k].base * 100) / 100,
      tva: Math.round(tvaDeductible[k].tva * 100) / 100,
    }
  }

  const totalCollectee = Object.values(tvaCollectee).reduce((s, t) => s + t.tva, 0)
  const totalDeductible = Object.values(tvaDeductible).reduce((s, t) => s + t.tva, 0)
  const baseCollectee = Object.values(tvaCollectee).reduce((s, t) => s + t.base, 0)
  const baseDeductible = Object.values(tvaDeductible).reduce((s, t) => s + t.base, 0)
  const solde = Math.round((totalCollectee - totalDeductible) * 100) / 100

  return {
    collectee: {
      parTaux: tvaCollectee,
      total: Math.round(totalCollectee * 100) / 100,
      baseTotal: Math.round(baseCollectee * 100) / 100,
    },
    deductible: {
      parTaux: tvaDeductible,
      total: Math.round(totalDeductible * 100) / 100,
      baseTotal: Math.round(baseDeductible * 100) / 100,
    },
    solde: {
      tvaAPayer: solde > 0 ? solde : 0,
      creditTVA: solde < 0 ? Math.abs(solde) : 0,
    },
    details: {
      nbVentes: ventesManuelles.length,
      nbFactures: factures.length,
      nbVentesElevage: ventesElevage.length,
      nbRecoltesPotager: recoltesPotager.length,
      nbRecoltesArbres: recoltesArbres.length,
      nbVenteBois: venteBois.length,
      nbAbattages: venteAbattage.length,
      nbDepenses: depensesManuelles.length,
      nbConsommationsAliments: consommationsAliments.length,
      nbFertilisations: fertilisations.length,
      nbInfereesCollectees,
      nbInfereesDeductibles,
      inferencesBreakdown,
    },
  }
}
