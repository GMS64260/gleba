/**
 * API Stats Élevage - Dashboard (multi-tenancy)
 * GET /api/elevage/stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { calculerStockOeufs } from '@/lib/stocks-helpers'
import { tauxPonteSaisonnalise } from '@/lib/lait'
import { tauxPonteAttenduPeriode } from '@/lib/elevage/taux-ponte'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    const userId = session.user.id
    const startOfYear = new Date(annee, 0, 1)
    const endOfYear = new Date(annee, 11, 31, 23, 59, 59)
    const startOfPrevYear = new Date(annee - 1, 0, 1)
    const endOfPrevYear = new Date(annee - 1, 11, 31, 23, 59, 59)

    // Stats animaux
    const [
      animauxActifs,
      animauxParType,
      lotsActifs,
      productionOeufsAnnee,
      productionOeufsAnneePrecedente,
      productionOeufsMois,
      ventesAnnee,
      ventesAnneePrecedente,
      ventesParType,
      abattagesAnnee,
      soinsAPlanifier,
      alimentsStockBas,
      stockOeufs,
      mortaliteAnnee,
      totalPondeuses,
      lotsPondeusesDetail,
      lotsParType,
      totalConsommationAliments,
    ] = await Promise.all([
      // Animaux actifs
      prisma.animal.count({
        where: { userId, statut: 'actif' },
      }),

      // Animaux par type d'espece — individuels uniquement à ce stade,
      // les lots sont mergés plus bas (BUG #7).
      prisma.animal.groupBy({
        by: ['especeAnimaleId'],
        where: { userId, statut: 'actif' },
        _count: true,
      }),

      // Lots actifs (count + somme effectifs pour BUG #8)
      prisma.lotAnimaux.aggregate({
        where: { userId, statut: 'actif' },
        _count: true,
        _sum: { quantiteActuelle: true },
      }),

      // Production œufs annee
      prisma.productionOeuf.aggregate({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { quantite: true },
      }),

      // Production œufs annee précédente (N-1)
      prisma.productionOeuf.aggregate({
        where: {
          userId,
          date: { gte: startOfPrevYear, lte: endOfPrevYear },
        },
        _sum: { quantite: true },
      }),

      // Production œufs par mois
      prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM date) as mois,
          SUM(quantite) as total
        FROM production_oeufs
        WHERE user_id = ${userId}
          AND date >= ${startOfYear}
          AND date <= ${endOfYear}
        GROUP BY EXTRACT(MONTH FROM date)
        ORDER BY mois
      ` as Promise<{ mois: number; total: bigint }[]>,

      // Ventes annee (montant total)
      prisma.venteProduit.aggregate({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { prixTotal: true },
        _count: true,
      }),

      // Ventes annee précédente (N-1)
      prisma.venteProduit.aggregate({
        where: {
          userId,
          date: { gte: startOfPrevYear, lte: endOfPrevYear },
        },
        _sum: { prixTotal: true },
        _count: true,
      }),

      // Ventes par type
      prisma.venteProduit.groupBy({
        by: ['type'],
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { prixTotal: true },
        _count: true,
      }),

      // Abattages annee
      prisma.abattage.aggregate({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { quantite: true, poidsCarcasse: true },
        _count: true,
      }),

      // Soins à planifier (non faits)
      prisma.soinAnimal.count({
        where: {
          userId,
          fait: false,
          datePrevue: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 jours
        },
      }),

      // Aliments en stock bas (via UserStockAliment per-user)
      prisma.userStockAliment.count({
        where: {
          userId,
          stock: { not: null },
          stockMin: { not: null },
          AND: [
            { stock: { gt: 0 } },
          ],
        },
      }).then(async () => {
        // Count those where stock <= stockMin
        const lowStock = await prisma.userStockAliment.findMany({
          where: {
            userId,
            stock: { not: null },
            stockMin: { not: null },
          },
          select: { stock: true, stockMin: true },
        })
        return lowStock.filter(a => a.stock !== null && a.stockMin !== null && a.stock <= a.stockMin).length
      }),

      // Stock œufs calculé
      calculerStockOeufs(userId),

      // Mortalité annee (animaux morts cette annee)
      prisma.animal.count({
        where: {
          userId,
          statut: 'mort',
          dateSortie: { gte: startOfYear, lte: endOfYear },
        },
      }),

      // Total pondeuses actives (lots volaille actifs, somme quantiteActuelle)
      prisma.lotAnimaux.aggregate({
        where: {
          userId,
          statut: 'actif',
          especeAnimale: { production: { in: ['oeufs', 'mixte'] } },
        },
        _sum: { quantiteActuelle: true },
      }),

      // BUG #5 — Lots pondeuses détaillés (espèce + effectif) pour le
      // calcul du taux attendu pondéré par race. Marans et Sussex ont
      // des saisonnalités différentes ; on ne peut pas se contenter
      // d'un coef global pour tout le cheptel.
      prisma.lotAnimaux.findMany({
        where: {
          userId,
          statut: 'actif',
          especeAnimale: { production: { in: ['oeufs', 'mixte'] } },
        },
        select: {
          quantiteActuelle: true,
          especeAnimale: { select: { nom: true } },
        },
      }),

      // BUG #7 — Lots actifs groupés par espèce pour merger dans
      // `animauxParType` (PieChart « Répartition par espèce »). Avant,
      // seuls les animaux individuels étaient comptés, donc l'éleveur
      // qui gérait son troupeau exclusivement en LotAnimaux voyait un
      // PieChart vide.
      prisma.lotAnimaux.groupBy({
        by: ['especeAnimaleId'],
        where: { userId, statut: 'actif' },
        _sum: { quantiteActuelle: true },
      }),

      // Total consommation aliments annee (kg)
      prisma.consommationAliment.aggregate({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { quantite: true },
      }),
    ])

    // Récupérer les noms des especes pour les stats — on inclut les ids
    // venant des LOTS aussi (BUG #7) pour ne pas perdre l'étiquette des
    // espèces présentes uniquement en lot.
    const especeIds = Array.from(
      new Set([
        ...animauxParType.map(a => a.especeAnimaleId),
        ...lotsParType.map(l => l.especeAnimaleId),
      ])
    )
    const especes = await prisma.especeAnimale.findMany({
      where: { id: { in: especeIds } },
      select: { id: true, nom: true, couleur: true },
    })

    const especeMap = new Map(especes.map(e => [e.id, e]))

    // BUG #7 — Fusion individuels + lots par espèce pour le PieChart.
    const animauxParTypeMerged = new Map<string, number>()
    for (const a of animauxParType) {
      animauxParTypeMerged.set(a.especeAnimaleId, (animauxParTypeMerged.get(a.especeAnimaleId) ?? 0) + a._count)
    }
    for (const l of lotsParType) {
      const n = l._sum.quantiteActuelle ?? 0
      if (n > 0) {
        animauxParTypeMerged.set(l.especeAnimaleId, (animauxParTypeMerged.get(l.especeAnimaleId) ?? 0) + n)
      }
    }

    // Métriques calculées
    const nbPondeuses = totalPondeuses._sum.quantiteActuelle || 0
    const nbOeufsAnnee = productionOeufsAnnee._sum.quantite || 0
    const nbOeufsAnneePrecedente = productionOeufsAnneePrecedente._sum.quantite || 0
    const ventesTotal = ventesAnnee._sum.prixTotal || 0
    const ventesTotalPrecedente = ventesAnneePrecedente._sum.prixTotal || 0
    const consoAlimentsKg = totalConsommationAliments._sum.quantite || 0
    const poidsCarcasseTotal = abattagesAnnee._sum.poidsCarcasse || 0

    // BUG #5 (audit Julien 15/05/2026) — Avant : « attendu période = 8 % »
    // en mai pour des Marans, à cause de la formule absurde
    //   `attenduMoyen × 100 × 0.0027 × 365 / 12`
    // qui multipliait un coefficient saisonnier (0.55–1.35) par des
    // facteurs n'ayant aucune unité cohérente.
    //
    // Désormais on raisonne directement en % pondeuses qui pondent par
    // jour. La fenêtre de référence est glissante 7 jours (DoD : « Période
    // par défaut : 7 derniers jours glissants »). Le taux attendu est
    // pondéré par espèce car Marans et Sussex n'ont pas la même
    // saisonnalité.
    const now = new Date()
    const periodEnd = annee === now.getFullYear() ? now : endOfYear
    const periodStart = new Date(periodEnd.getTime() - 6 * 86_400_000)

    // Taux observé sur 7 j glissants : œufs collectés / (pondeuses × jours).
    const productionOeufs7j = await prisma.productionOeuf.aggregate({
      where: { userId, date: { gte: periodStart, lte: periodEnd } },
      _sum: { quantite: true },
    })
    const nbOeufs7j = productionOeufs7j._sum.quantite || 0
    const tauxObserve7j =
      nbPondeuses > 0 ? (nbOeufs7j / (nbPondeuses * 7)) * 100 : 0

    // Taux attendu pondéré par espèce (chaque lot tire son propre coef).
    let sommeAttenduPondere = 0
    let effectifPondeur = 0
    for (const lot of lotsPondeusesDetail) {
      const q = lot.quantiteActuelle ?? 0
      if (q <= 0) continue
      const tx = tauxPonteAttenduPeriode(lot.especeAnimale.nom, periodStart, periodEnd)
      sommeAttenduPondere += q * tx
      effectifPondeur += q
    }
    const tauxPonteAttendu =
      effectifPondeur > 0 ? Math.round((sommeAttenduPondere / effectifPondeur) * 10) / 10 : null

    const tauxPonte = nbPondeuses > 0 ? Math.round(tauxObserve7j * 10) / 10 : null

    // Compat : `tauxPonteRatio` (observé / attendu) reste utile pour les
    // anciens écrans qui comparent ratio plutôt qu'écart. On garde aussi
    // `ponteSais` pour la rétro-compat des consommateurs API existants.
    const tauxPonteRatio =
      tauxPonte !== null && tauxPonteAttendu && tauxPonteAttendu > 0
        ? Math.round((tauxPonte / tauxPonteAttendu) * 100) / 100
        : null
    const ponteSais = tauxPonteSaisonnalise(nbOeufsAnnee, nbPondeuses, startOfYear, periodEnd)

    // FCR = kg aliment / kg carcasse
    const fcr = poidsCarcasseTotal > 0 ? consoAlimentsKg / poidsCarcasseTotal : null

    // Taux de mortalité
    const totalAnimauxEver = animauxActifs + mortaliteAnnee
    const tauxMortalite = totalAnimauxEver > 0
      ? (mortaliteAnnee / totalAnimauxEver) * 100
      : 0

    // PROMPT 17 — KPI lait
    const [laitAggAnnee, laitNonAffecte, laitJ30] = await Promise.all([
      prisma.collecteLait.aggregate({
        where: { userId, date: { gte: startOfYear, lte: endOfYear } },
        _sum: { quantiteLitres: true },
        _count: true,
      }),
      prisma.collecteLait.aggregate({
        where: { userId, lotFromageId: null, ecarteAttente: false, date: { gte: startOfYear, lte: endOfYear } },
        _sum: { quantiteLitres: true },
      }),
      prisma.collecteLait.aggregate({
        where: { userId, date: { gte: new Date(Date.now() - 30 * 86_400_000) } },
        _sum: { quantiteLitres: true },
      }),
    ])
    const laitTotalAnnee = Number(laitAggAnnee._sum.quantiteLitres ?? 0)
    const laitNonAffecteL = Number(laitNonAffecte._sum.quantiteLitres ?? 0)
    const laitJ30L = Number(laitJ30._sum.quantiteLitres ?? 0)
    const laitMoyenJourJ30 = Math.round((laitJ30L / 30) * 100) / 100

    // BUG #8 (audit Julien 15/05/2026) — Avant : la carte « Animaux actifs »
    // affichait juste le COUNT(Animal statut='actif'), avec un sous-titre
    // « + N lots » qui faisait croire à l'éleveur qu'il avait perdu son
    // troupeau en lot (6 individus + 3 lots = panique alors que les lots
    // contenaient 63 bêtes). Désormais on expose les deux compteurs et le
    // total cheptel pour que l'UI puisse afficher « 69 animaux · 6 individus
    // · 63 en lots (3 lots) ».
    const animauxEnLots = lotsActifs._sum.quantiteActuelle ?? 0
    const lotsActifsCount = lotsActifs._count
    const animauxTotal = animauxActifs + animauxEnLots

    return NextResponse.json({
      stats: {
        animauxActifs,
        lotsActifs: lotsActifsCount,
        animauxEnLots,
        animauxTotal,
        productionOeufsAnnee: nbOeufsAnnee,
        productionOeufsAnneePrecedente: nbOeufsAnneePrecedente,
        ventesAnnee: ventesTotal,
        ventesAnneePrecedente: ventesTotalPrecedente,
        nbVentes: ventesAnnee._count,
        abattagesAnnee: abattagesAnnee._sum.quantite || 0,
        poidsCarcasseAnnee: poidsCarcasseTotal,
        soinsAPlanifier,
        alimentsStockBas,
        stockOeufs: stockOeufs.stockNet,
        stockOeufsDetail: stockOeufs.detail,
        // Nouvelles métriques
        mortaliteAnnee,
        tauxMortalite: Math.round(tauxMortalite * 10) / 10,
        tauxPonte: tauxPonte !== null ? Math.round(tauxPonte * 10) / 10 : null,
        // BUG #5 — tauxPonteAttendu désormais en % de pondeuses qui pondent
        // (cohérent avec tauxPonte), calculé sur fenêtre 7 j glissants
        // et pondéré par espèce.
        tauxPonteSaisonAttendu: tauxPonteAttendu,
        tauxPonteRatio,
        nbPondeuses,
        nbOeufsPeriode7j: nbOeufs7j,
        fcr: fcr !== null ? Math.round(fcr * 100) / 100 : null,
        consoAlimentsKg: Math.round(consoAlimentsKg * 10) / 10,
        // PROMPT 17 — KPI Lait
        laitTotalAnnee: Math.round(laitTotalAnnee * 100) / 100,
        laitMoyenJourJ30,
        laitStockTransformable: Math.round(laitNonAffecteL * 100) / 100,
        nbCollectesAnnee: laitAggAnnee._count,
      },
      // BUG #7 : la répartition par espèce additionne désormais les
      // animaux individuels + ceux comptés en LotAnimaux.quantiteActuelle.
      animauxParType: Array.from(animauxParTypeMerged.entries()).map(([especeAnimaleId, count]) => ({
        especeAnimaleId,
        nom: especeMap.get(especeAnimaleId)?.nom || especeAnimaleId,
        couleur: especeMap.get(especeAnimaleId)?.couleur,
        count,
      })),
      ventesParType: ventesParType.map(v => ({
        type: v.type,
        total: v._sum.prixTotal || 0,
        count: v._count,
      })),
      productionOeufsMois: productionOeufsMois.map(p => ({
        mois: Number(p.mois),
        total: Number(p.total),
      })),
    })
  } catch (error) {
    console.error('GET /api/elevage/stats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des stats', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
