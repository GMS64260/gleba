/**
 * API Stats Comptabilité - Dashboard
 * GET /api/comptabilite/stats
 * Agrège les données financières de tous les modules
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { ventilerParModule } from '@/lib/comptabilite/modules'
import { getKpiCompta } from '@/lib/kpi'
import { construireImpayees } from '@/lib/comptabilite/impayees'

const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const COLORS = {
  oeufs: '#f59e0b',
  viande: '#ef4444',
  miel: '#d97706',
  cire: '#eab308',
  propolis: '#92400e',
  pollen: '#f59e0b',
  gelee_royale: '#fbbf24',
  autre_ruche: '#b45309',
  produits_ruche: '#d97706',
  fruits: '#22c55e',
  legumes: '#84cc16',
  bois: '#92400e',
  service: '#3b82f6',
  autre: '#6b7280',
  soins: '#ef4444',
  aliments: '#f97316',
  operations: '#8b5cf6',
  fertilisation: '#22c55e',
  achats: '#0ea5e9',
  materiel: '#64748b',
  carburant: '#f59e0b',
  main_oeuvre: '#ec4899',
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    const userId = session.user.id
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)
    const startOfPrevYear = new Date(year - 1, 0, 1)
    const endOfPrevYear = new Date(year - 1, 11, 31, 23, 59, 59)
    const asOf = new Date()

    // Source unique de vérité : revenus, dépenses, bénéfice, N-1 YTD.
    // Les ventilations détaillées (par catégorie, par mois, par module)
    // restent ci-dessous, mais TOUS les totaux exposés en haut de la réponse
    // proviennent désormais de `getKpiCompta`, alignant la page d'accueil
    // Compta, le module Rapports et le module Coûts de production.
    const kpiCompta = await getKpiCompta(userId, year, asOf)

    // ========================================
    // REVENUS
    // ========================================
    const [
      // Ventes elevage (VenteProduit)
      ventesElevage,
      ventesElevageParType,
      ventesElevagePrevYear,

      // Fruits vendus (RecolteArbre avec prixKg)
      recoltesArbresPrix,

      // Bois vendu (ProductionBois avec destination=vente)
      venteBois,

      // Viande vendue (Abattage avec destination=vente)
      venteAbattage,
      // Revenus élevage sans source brute réinjectée (paie lait, réservations)
      ventesElevageAutoSpeciales,

      // Récoltes potager vendues
      recoltesPotagerVendues,

      // Ventes manuelles
      ventesManuelles,
      ventesManuellesParCategorie,

      // ========================================
      // DÉPENSES
      // ========================================

      // Soins animaux
      depensesSoins,

      // Opérations arbres
      depensesOperations,

      // Consommation aliments (join)
      consommationsAliments,

      // Fertilisation (join)
      fertilisations,

      // Achats animaux (lots)
      achatsLots,

      // Achats animaux (individuels)
      achatsAnimaux,

      // Achats arbres
      achatsArbres,

      // Dépenses manuelles
      depensesManuellesParCategorie,
      depensesManuellesParModule,
      interventionsAvecCout,

      // ========================================
      // ALERTES
      // ========================================

      // Factures impayées (VenteProduit)
      facturesImpayeesElevage,

      // Factures impayées (saisies manuelles et sources sans vue brute)
      facturesImpayeesManuelles,

      // Stocks bas (Aliment)
      stocksBasAliments,

      // Stocks bas (Variete graines)
      stocksBasGraines,

      // QA 2026-05-15 — Bug #5 : commandes boutique en attente (non livrées)
      commandesEnAttenteAgg,

    ] = await Promise.all([
      // === REVENUS ===

      // Ventes elevage (audit compta 2026-06 : exclure les annulées)
      prisma.venteProduit.aggregate({
        where: { userId, date: { gte: startOfYear, lte: endOfYear }, annule: false },
        _sum: { prixTotal: true },
        _count: true,
      }),

      // Ventes elevage par type
      prisma.venteProduit.groupBy({
        by: ['type'],
        where: { userId, date: { gte: startOfYear, lte: endOfYear }, annule: false },
        _sum: { prixTotal: true },
      }),

      // Ventes elevage annee précédente
      prisma.venteProduit.aggregate({
        where: { userId, date: { gte: startOfPrevYear, lte: endOfPrevYear }, annule: false },
        _sum: { prixTotal: true },
      }),

      // Récoltes arbres avec prix (vendues uniquement)
      prisma.recolteArbre.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          prixKg: { not: null },
          statut: 'vendu',
        },
        select: { quantite: true, prixKg: true, date: true },
      }),

      // DEV3 #5 - Audit Marc : on filtre sur statut='vendu' (canonique)
      // au lieu de destination='vente'. La nouvelle nomenclature destination
      // distingue 'Vente'/'Stock interne'/'Auto-consommation'/'Don' alors
      // que statut reste binaire (en_stock|vendu|utilise). Toute ligne avec
      // prixVente renseigné est aussi captée (rétro-compat).
      prisma.productionBois.aggregate({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          prixVente: { not: null },
          OR: [
            { statut: 'vendu' },
            { destination: { in: ['vente', 'Vente'] } },
          ],
        },
        _sum: { prixVente: true },
      }),

      // Vente abattage
      prisma.abattage.aggregate({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          destination: 'vente',
          prixVente: { not: null },
          annule: false,
        },
        _sum: { prixVente: true },
      }),

      prisma.venteManuelle.aggregate({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          auto: true,
          sourceType: { in: ['paie_lait', 'reservation_elevage'] },
        },
        _sum: { montant: true },
      }),

      // Récoltes potager vendues
      prisma.recolte.findMany({
        where: {
          userId,
          statut: 'vendu',
          dateVente: { gte: startOfYear, lte: endOfYear },
          prixTotal: { not: null },
        },
        select: { quantite: true, prixKg: true, prixTotal: true, dateVente: true },
      }),

      // Ventes manuelles (exclure auto=true pour eviter double comptage).
      // QA cmswtznh2 — exception : les ventes boutique (sourceType
      // commande_boutique) n'ont AUCUNE table métier brute reprise ailleurs
      // dans la ventilation ; les exclure creusait un écart SSOT/modules qui
      // faisait crier « Incohérence détectée » au bandeau des Rapports.
      prisma.venteManuelle.aggregate({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          OR: [
            { auto: { not: true } },
            { auto: true, sourceType: 'commande_boutique' },
          ],
        },
        _sum: { montant: true },
        _count: true,
      }),

      // Ventes manuelles par categorie (même périmètre que l'agrégat ci-dessus)
      prisma.venteManuelle.groupBy({
        by: ['categorie'],
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          OR: [
            { auto: { not: true } },
            { auto: true, sourceType: 'commande_boutique' },
          ],
        },
        _sum: { montant: true },
      }),

      // === DÉPENSES ===

      // Soins animaux
      prisma.soinAnimal.aggregate({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          cout: { not: null },
          fait: true,
        },
        _sum: { cout: true },
      }),

      // Opérations arbres
      prisma.operationArbre.aggregate({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          cout: { not: null },
        },
        _sum: { cout: true },
      }),

      // Consommation aliments (avec prix)
      prisma.consommationAliment.findMany({
        where: { userId, date: { gte: startOfYear, lte: endOfYear } },
        include: {
          aliment: {
            select: {
              prix: true,
              userStocks: {
                where: { userId },
                select: { prix: true, coutUnitaire: true },
                take: 1,
              },
            },
          },
        },
      }),

      // Fertilisation (avec prix)
      prisma.fertilisation.findMany({
        where: { userId, date: { gte: startOfYear, lte: endOfYear } },
        include: { fertilisant: { select: { prix: true } } },
      }),

      // Achats lots animaux
      prisma.lotAnimaux.aggregate({
        where: {
          userId,
          dateArrivee: { gte: startOfYear, lte: endOfYear },
          prixAchatTotal: { not: null },
        },
        _sum: { prixAchatTotal: true },
      }),

      // Achats animaux individuels
      prisma.animal.aggregate({
        where: {
          userId,
          dateArrivee: { gte: startOfYear, lte: endOfYear },
          prixAchat: { not: null },
          prixAchatInclusDansLot: false,
        },
        _sum: { prixAchat: true },
      }),

      // Achats arbres (verger)
      prisma.arbre.aggregate({
        where: {
          userId,
          prixAchat: { not: null },
          OR: [
            { dateAchat: { gte: startOfYear, lte: endOfYear } },
            { datePlantation: { gte: startOfYear, lte: endOfYear }, dateAchat: null },
          ],
        },
        _sum: { prixAchat: true },
      }),

      // Dépenses manuelles par categorie (exclure auto=true)
      prisma.depenseManuelle.groupBy({
        by: ['categorie'],
        where: { userId, date: { gte: startOfYear, lte: endOfYear }, auto: { not: true } },
        _sum: { montant: true },
      }),

      // Dépenses manuelles par MODULE d'imputation (exclure auto=true).
      // Ticket cmsx69cuc — la ventilation rangeait toutes les charges
      // manuelles en « Autre » sans lire leur module : le Compte de résultat
      // annonçait « Potager 0,00 € » quand l'écran Transactions affichait
      // 3 018 € de maraîchage sur les mêmes écritures.
      prisma.depenseManuelle.groupBy({
        by: ['module'],
        where: { userId, date: { gte: startOfYear, lte: endOfYear }, auto: { not: true } },
        _sum: { montant: true },
      }),

      // Interventions culturales réalisées avec un coût. Leur miroir comptable
      // (DepenseManuelle auto) est exclu ci-dessus comme tous les miroirs, mais
      // rien ne les remplaçait dans la ventilation : la somme des modules était
      // inférieure au total SSOT de leur montant (écart de 9,50 € constaté).
      prisma.intervention.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          coutTotal: { not: null },
          NOT: { fait: false },
        },
        select: { coutTotal: true, arbreId: true },
      }),

      // === ALERTES ===

      // QA cmswunx5s / cmswuotxj — la carte des impayés agrégait les tables
      // sources brutes (avoir jamais déduit, facture manuelle invisible) et
      // ignorait l'exercice sélectionné. On charge désormais les sources
      // BORNÉES à l'exercice et on délègue au même helper que l'écran
      // Factures (construireImpayees : avoirs imputés, dédoublonnage
      // facture↔vente).
      prisma.venteProduit.findMany({
        where: { userId, paye: false, annule: false, date: { gte: startOfYear, lte: endOfYear } },
        orderBy: { date: 'asc' },
        select: { id: true, date: true, type: true, prixTotal: true, client: true, factureId: true },
      }),

      // Saisies manuelles et sources auto sans vue brute d'impayé (solde de
      // réservation, commande boutique).
      prisma.venteManuelle.findMany({
        where: {
          userId,
          paye: false,
          date: { gte: startOfYear, lte: endOfYear },
          OR: [
            { auto: { not: true } },
            { auto: true, sourceType: { in: ['reservation_elevage', 'commande_boutique'] } },
          ],
        },
        orderBy: { date: 'asc' },
        select: {
          id: true,
          date: true,
          categorie: true,
          description: true,
          montant: true,
          clientNom: true,
          sourceType: true,
        },
      }),

      // Stocks bas aliments (per-user)
      prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM user_stock_aliments
        WHERE user_id = ${userId}
          AND stock IS NOT NULL
          AND stock_min IS NOT NULL
          AND stock <= stock_min
      ` as Promise<{ count: bigint }[]>,

      // Stocks bas graines (per-user)
      prisma.userStockVariete.count({
        where: {
          userId,
          stockGraines: { lt: 100, not: null },
        },
      }),

      // QA 2026-05-15 — Bug #5 : commandes boutique non livrées de
      // l'année (nouveau/confirmee/prete). Non comptées dans les
      // revenus tant que pas matérialisées, mais reportées en
      // compteur pour expliquer l'écart "Boutique = 14, Compta = 11".
      prisma.commandeBoutique.aggregate({
        where: {
          userId,
          createdAt: { gte: startOfYear, lte: endOfYear },
          statut: { in: ['nouveau', 'confirmee', 'prete'] },
        },
        _sum: { total: true },
        _count: true,
      }),
    ])

    // Impayés de l'exercice : mêmes règles que l'écran Factures. La table
    // Facture porte les avoirs et les factures manuelles sans source métier ;
    // le helper impute les avoirs et dédoublonne facture↔vente.
    const facturesExercice = await prisma.facture.findMany({
      where: { userId, date: { gte: startOfYear, lte: endOfYear } },
      select: {
        id: true, type: true, statut: true, date: true, numero: true,
        objet: true, clientNom: true, totalTTC: true, factureOrigineId: true,
      },
    })
    const impayeesExercice = construireImpayees({
      factures: facturesExercice.map(f => ({ ...f, date: f.date.toISOString() })),
      ventes: facturesImpayeesElevage.map(v => ({ ...v, date: v.date.toISOString() })),
      ventesManuelles: facturesImpayeesManuelles.map(m => ({
        id: m.id,
        date: m.date.toISOString(),
        categorie: m.categorie,
        description: m.description,
        montant: m.montant,
        client: m.clientNom,
      })),
    })

    // ========================================
    // CALCULS AGRÉGÉS
    // ========================================

    // Revenus fruits verger (calculé)
    const revenusFruits = recoltesArbresPrix.reduce(
      (sum, r) => sum + (r.quantite * (r.prixKg || 0)),
      0
    )

    // Revenus recoltes potager (calculé)
    const revenusPotager = recoltesPotagerVendues.reduce(
      (sum, r) => sum + (r.prixTotal || (r.quantite * (r.prixKg || 0))),
      0
    )

    // Dépenses aliments (calculé)
    const depensesAliments = consommationsAliments.reduce(
      (sum, c) => {
        const prix = c.aliment.userStocks[0]?.coutUnitaire
          ?? c.aliment.userStocks[0]?.prix
          ?? c.aliment.prix
          ?? 0
        return sum + c.quantite * prix
      },
      0
    )

    // Dépenses fertilisation (calculé)
    const depensesFertilisation = fertilisations.reduce(
      (sum, f) => sum + (f.quantite * (f.fertilisant.prix || 0)),
      0
    )

    // Ventes manuelles attribuées au potager (categorie legumes OU module potager)
    const ventesManuellesPotager = ventesManuellesParCategorie
      .filter(v => v.categorie === 'legumes')
      .reduce((sum, v) => sum + (v._sum.montant || 0), 0)

    // Totaux
    const revenus = {
      elevage: (ventesElevage._sum.prixTotal || 0)
        + (venteAbattage._sum.prixVente || 0)
        + (ventesElevageAutoSpeciales._sum.montant || 0),
      verger: revenusFruits + (venteBois._sum.prixVente || 0),
      potager: revenusPotager + ventesManuellesPotager,
      autre: (ventesManuelles._sum.montant || 0) - ventesManuellesPotager,
    }
    const totalRevenus = revenus.elevage + revenus.verger + revenus.potager + revenus.autre

    // Ticket cmsx69cuc — les charges manuelles sont ventilées sur LEUR module
    // d'imputation (les valeurs hors liste tombant en « Autre »), et les
    // interventions culturales rejoignent leur module. La somme des quatre
    // postes égale ainsi le total comptable de l'écran Transactions.
    const depensesManuellesVentilees = ventilerParModule(
      depensesManuellesParModule,
      (ligne) => ligne._sum.montant || 0,
      (ligne) => ligne.module,
    )
    const interventionsVentilees = ventilerParModule(
      interventionsAvecCout,
      (i) => i.coutTotal || 0,
      (i) => (i.arbreId ? 'verger' : 'potager'),
    )
    const depenses = {
      elevage: (depensesSoins._sum.cout || 0) + depensesAliments +
               (achatsLots._sum.prixAchatTotal || 0) + (achatsAnimaux._sum.prixAchat || 0)
               + depensesManuellesVentilees.elevage + interventionsVentilees.elevage,
      verger: (depensesOperations._sum.cout || 0) + (achatsArbres._sum.prixAchat || 0)
               + depensesManuellesVentilees.verger + interventionsVentilees.verger,
      potager: depensesFertilisation
               + depensesManuellesVentilees.potager + interventionsVentilees.potager,
      autre: depensesManuellesVentilees.autre + interventionsVentilees.autre,
    }
    const totalDepenses = depenses.elevage + depenses.verger + depenses.potager + depenses.autre

    const benefice = totalRevenus - totalDepenses
    const margePercent = totalRevenus > 0 ? (benefice / totalRevenus) * 100 : 0

    // Année précédente pour comparaison
    const revenusPrevYear = ventesElevagePrevYear._sum.prixTotal || 0

    // ========================================
    // GRAPHIQUES
    // ========================================

    // Données mensuelles (requêtes raw pour revenus et dépenses par mois).
    // PERF 2026-08-11 — ces 12 agrégats étaient exécutés en séquence (awaits
    // successifs) ; ils sont indépendants, donc regroupés dans un Promise.all
    // (requêtes strictement inchangées).
    const [
      revenusParMois,
      ventesManuParMois,
      revenusElevageSpeciauxParMois,
      depensesManuParMois,
      recoltesPotagerParMois,
      soinsParMois,
      // Récoltes arbres vendues par mois (fruits)
      recoltesArbresParMois,
      // Production bois vendu par mois
      venteBoisParMois,
      // Abattages vendus par mois
      abattageParMois,
      // Consommation aliments par mois (coût = quantité × prix aliment)
      consommationAlimentsParMois,
      // Fertilisation par mois (coût = quantité × prix fertilisant)
      fertilisationParMois,
      // Opérations arbres par mois (coût direct)
      operationsArbresParMois,
    ] = (await Promise.all([
      prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM date) as mois,
          SUM(prix_total) as total
        FROM ventes_produits
        WHERE user_id = ${userId}
          AND date >= ${startOfYear}
          AND date <= ${endOfYear}
          AND annule = false
        GROUP BY EXTRACT(MONTH FROM date)
      `,
      prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM date) as mois,
          SUM(montant) as total
        FROM ventes_manuelles
        WHERE user_id = ${userId}
          AND date >= ${startOfYear}
          AND date <= ${endOfYear}
          -- QA cmswtznh2 : les ventes boutique auto n'ont pas de table brute,
          -- même périmètre que la ventilation annuelle.
          AND ((auto IS NULL OR auto = false)
            OR (auto = true AND source_type = 'commande_boutique'))
        GROUP BY EXTRACT(MONTH FROM date)
      `,
      prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM date) as mois,
          SUM(montant) as total
        FROM ventes_manuelles
        WHERE user_id = ${userId}
          AND date >= ${startOfYear}
          AND date <= ${endOfYear}
          AND auto = true
          AND source_type IN ('paie_lait', 'reservation_elevage')
        GROUP BY EXTRACT(MONTH FROM date)
      `,
      prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM date) as mois,
          SUM(montant) as total
        FROM depenses_manuelles
        WHERE user_id = ${userId}
          AND date >= ${startOfYear}
          AND date <= ${endOfYear}
          AND (auto IS NULL OR auto = false)
        GROUP BY EXTRACT(MONTH FROM date)
      `,
      prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM date_vente) as mois,
          SUM(prix_total) as total
        FROM recoltes
        WHERE user_id = ${userId}
          AND statut = 'vendu'
          AND date_vente >= ${startOfYear}
          AND date_vente <= ${endOfYear}
          AND prix_total IS NOT NULL
        GROUP BY EXTRACT(MONTH FROM date_vente)
      `,
      prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM date) as mois,
          SUM(cout) as total
        FROM soins_animaux
        WHERE user_id = ${userId}
          AND date >= ${startOfYear}
          AND date <= ${endOfYear}
          AND cout IS NOT NULL
          AND fait = true
        GROUP BY EXTRACT(MONTH FROM date)
      `,
      prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM date) as mois,
          SUM(COALESCE(prix_total, quantite * COALESCE(prix_kg, 0))) as total
        FROM recoltes_arbres
        WHERE user_id = ${userId}
          AND date >= ${startOfYear}
          AND date <= ${endOfYear}
          AND statut = 'vendu'
          AND (prix_total IS NOT NULL OR prix_kg IS NOT NULL)
        GROUP BY EXTRACT(MONTH FROM date)
      `,
      prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM date) as mois,
          SUM(prix_vente) as total
        FROM production_bois
        WHERE user_id = ${userId}
          AND date >= ${startOfYear}
          AND date <= ${endOfYear}
          AND destination = 'vente'
          AND prix_vente IS NOT NULL
        GROUP BY EXTRACT(MONTH FROM date)
      `,
      prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM date) as mois,
          SUM(prix_vente) as total
        FROM abattages
        WHERE user_id = ${userId}
          AND date >= ${startOfYear}
          AND date <= ${endOfYear}
          AND destination = 'vente'
          AND prix_vente IS NOT NULL
          AND annule = false
        GROUP BY EXTRACT(MONTH FROM date)
      `,
      prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM ca.date) as mois,
          SUM(ca.quantite * COALESCE(usa.cout_unitaire, usa.prix, a.prix, 0)) as total
        FROM consommations_aliments ca
        JOIN aliments a ON ca.aliment_id = a.aliment
        LEFT JOIN user_stock_aliments usa
          ON usa.user_id = ca.user_id AND usa.aliment_id = ca.aliment_id
        WHERE ca.user_id = ${userId}
          AND ca.date >= ${startOfYear}
          AND ca.date <= ${endOfYear}
        GROUP BY EXTRACT(MONTH FROM ca.date)
      `,
      prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM f.date) as mois,
          SUM(f.quantite * COALESCE(fe.prix, 0)) as total
        FROM fertilisations f
        JOIN fertilisants fe ON f.fertilisant = fe.fertilisant
        WHERE f.user_id = ${userId}
          AND f.date >= ${startOfYear}
          AND f.date <= ${endOfYear}
        GROUP BY EXTRACT(MONTH FROM f.date)
      `,
      prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM date) as mois,
          SUM(cout) as total
        FROM operations_arbres
        WHERE user_id = ${userId}
          AND date >= ${startOfYear}
          AND date <= ${endOfYear}
          AND cout IS NOT NULL
        GROUP BY EXTRACT(MONTH FROM date)
      `,
    ])) as { mois: number; total: number }[][]

    // Construire données mensuelles
    const mensuel = MOIS_LABELS.map((label, i) => {
      const mois = i + 1
      const rev1 = revenusParMois.find(r => Number(r.mois) === mois)?.total || 0
      const rev2 = ventesManuParMois.find(r => Number(r.mois) === mois)?.total || 0
      const rev3 = recoltesPotagerParMois.find(r => Number(r.mois) === mois)?.total || 0
      const rev4 = recoltesArbresParMois.find(r => Number(r.mois) === mois)?.total || 0
      const rev5 = venteBoisParMois.find(r => Number(r.mois) === mois)?.total || 0
      const rev6 = abattageParMois.find(r => Number(r.mois) === mois)?.total || 0
      const rev7 = revenusElevageSpeciauxParMois.find(r => Number(r.mois) === mois)?.total || 0
      const dep1 = depensesManuParMois.find(d => Number(d.mois) === mois)?.total || 0
      const dep2 = soinsParMois.find(d => Number(d.mois) === mois)?.total || 0
      const dep3 = consommationAlimentsParMois.find(d => Number(d.mois) === mois)?.total || 0
      const dep4 = fertilisationParMois.find(d => Number(d.mois) === mois)?.total || 0
      const dep5 = operationsArbresParMois.find(d => Number(d.mois) === mois)?.total || 0

      const revenus = Number(rev1) + Number(rev2) + Number(rev3) + Number(rev4) + Number(rev5) + Number(rev6) + Number(rev7)
      const depenses = Number(dep1) + Number(dep2) + Number(dep3) + Number(dep4) + Number(dep5)

      return {
        mois: label,
        revenus,
        depenses,
        benefice: revenus - depenses,
      }
    })

    // Revenus par categorie
    const revenusParCategorie = [
      ...ventesElevageParType.map(v => ({
        categorie: v.type === 'oeufs' ? 'Oeufs' :
                   v.type === 'viande' ? 'Viande' :
                   v.type === 'animal_vivant' ? 'Animaux' :
                   v.type === 'miel' ? 'Miel' :
                   v.type === 'cire' ? 'Cire' :
                   v.type === 'propolis' ? 'Propolis' :
                   v.type === 'pollen' ? 'Pollen' :
                   v.type === 'gelee_royale' ? 'Gelée royale' :
                   v.type === 'autre_ruche' ? 'Autre produit de la ruche' : v.type,
        montant: v._sum.prixTotal || 0,
        couleur: COLORS[v.type as keyof typeof COLORS] || COLORS.autre,
      })),
      { categorie: 'Fruits', montant: revenusFruits, couleur: COLORS.fruits },
      { categorie: 'Légumes (récoltes)', montant: revenusPotager, couleur: COLORS.legumes },
      { categorie: 'Bois', montant: venteBois._sum.prixVente || 0, couleur: COLORS.bois },
      ...ventesManuellesParCategorie.map(v => ({
        categorie: v.categorie === 'legumes' ? 'Légumes' :
                   v.categorie === 'service' ? 'Services' :
                   v.categorie === 'produits_ruche' ? 'Produits de la ruche' :
                   v.categorie.charAt(0).toUpperCase() + v.categorie.slice(1),
        montant: v._sum.montant || 0,
        couleur: COLORS[v.categorie as keyof typeof COLORS] || COLORS.autre,
      })),
    ].filter(r => r.montant > 0)

    // Dépenses par categorie
    const depensesParCategorie = [
      { categorie: 'Soins animaux', montant: depensesSoins._sum.cout || 0, couleur: COLORS.soins },
      { categorie: 'Aliments', montant: depensesAliments, couleur: COLORS.aliments },
      { categorie: 'Opérations arbres', montant: depensesOperations._sum.cout || 0, couleur: COLORS.operations },
      { categorie: 'Fertilisation', montant: depensesFertilisation, couleur: COLORS.fertilisation },
      { categorie: 'Achats animaux', montant: (achatsLots._sum.prixAchatTotal || 0) + (achatsAnimaux._sum.prixAchat || 0), couleur: COLORS.achats },
      { categorie: 'Achats arbres', montant: achatsArbres._sum.prixAchat || 0, couleur: '#15803d' },
      ...depensesManuellesParCategorie.map(d => ({
        categorie: d.categorie === 'materiel' ? 'Matériel' :
                   d.categorie === 'carburant' ? 'Carburant' :
                   d.categorie === 'main_oeuvre' ? 'Main d\'oeuvre' :
                   d.categorie.charAt(0).toUpperCase() + d.categorie.slice(1),
        montant: d._sum.montant || 0,
        couleur: COLORS[d.categorie as keyof typeof COLORS] || COLORS.autre,
      })),
    ].filter(d => d.montant > 0)

    // Par module
    const parModule = [
      { module: 'Maraîchage', revenus: revenus.potager, depenses: depenses.potager, benefice: revenus.potager - depenses.potager },
      { module: 'Verger', revenus: revenus.verger, depenses: depenses.verger, benefice: revenus.verger - depenses.verger },
      { module: 'Élevage', revenus: revenus.elevage, depenses: depenses.elevage, benefice: revenus.elevage - depenses.elevage },
      { module: 'Autre', revenus: revenus.autre, depenses: depenses.autre, benefice: revenus.autre - depenses.autre },
    ]

    // ========================================
    // ACTIVITÉ
    // ========================================

    // Dernières transactions
    const [dernieresVentes, dernieresDepenses, dernieresRecoltesPotager] = await Promise.all([
      prisma.venteProduit.findMany({
        where: { userId, annule: false },
        orderBy: { date: 'desc' },
        take: 5,
        select: { id: true, date: true, type: true, prixTotal: true, paye: true },
      }),
      prisma.depenseManuelle.findMany({
        where: { userId, auto: { not: true } },
        orderBy: { date: 'desc' },
        take: 5,
        select: { id: true, date: true, categorie: true, description: true, montant: true },
      }),
      prisma.recolte.findMany({
        where: { userId, statut: 'vendu', prixTotal: { not: null } },
        orderBy: { dateVente: 'desc' },
        take: 5,
        select: { id: true, dateVente: true, date: true, prixTotal: true, especeId: true },
      }),
    ])

    const dernieresTransactions = [
      ...dernieresVentes.map(v => ({
        id: v.id,
        type: 'revenu' as const,
        date: v.date.toISOString(),
        description: v.type === 'oeufs' ? 'Vente oeufs' : `Vente ${v.type}`,
        montant: v.prixTotal,
        module: 'elevage',
        paye: v.paye,
        source: 'vente_produit',
      })),
      ...dernieresRecoltesPotager.map(r => ({
        id: r.id,
        type: 'revenu' as const,
        date: (r.dateVente || r.date).toISOString(),
        description: `Vente ${r.especeId}`,
        montant: r.prixTotal || 0,
        module: 'potager',
        paye: true,
        source: 'recolte',
      })),
      ...dernieresDepenses.map(d => ({
        id: d.id,
        type: 'depense' as const,
        date: d.date.toISOString(),
        description: d.description,
        montant: d.montant,
        module: 'autre',
        paye: true,
        source: 'depense_manuelle',
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)

    // Factures impayées detail — même source que la carte (helper partagé),
    // donc même total, mêmes pièces, avoirs imputés et numéro exposé.
    const facturesImpayees = impayeesExercice.items.slice(0, 10).map(i => ({
      id: i.id,
      type: i.type,
      date: i.date,
      client: i.client || 'Non renseigné',
      montant: i.montant,
      source: i.source,
      description: i.description,
      numero: i.numero ?? null,
    }))

    // Alertes stock (per-user)
    const alertesStockAliments = await prisma.userStockAliment.findMany({
      where: {
        userId,
        stock: { not: null },
        stockMin: { not: null },
      },
      include: {
        aliment: { select: { id: true, nom: true } },
      },
    })

    const alertesStock = alertesStockAliments
      .filter(a => a.stock !== null && a.stockMin !== null && a.stock! <= a.stockMin!)
      .map(a => ({
        id: a.aliment.id,
        nom: a.aliment.nom,
        stock: a.stock!,
        stockMin: a.stockMin!,
        module: 'elevage',
      }))

    // BUG #2 (audit compta 2026-05-15) — Audit de cohérence entre la SSOT
    // `getKpiCompta` (qui inclut TOUTES les VenteManuelle/DepenseManuelle,
    // payées ou non — comptabilité d'engagement) et la ventilation par
    // module recalculée ci-dessus. Si écart > 0,01 €, l'UI affichera un
    // bandeau d'alerte. Pas de masquage silencieux.
    const sumRevenusModules = totalRevenus
    const sumDepensesModules = totalDepenses
    // QA cmsw9dcrd (2026-08-16) — l'écart structurel connu entre SSOT (nette
    // d'avoirs) et ventilation par module (factures brutes) est exposé pour
    // que le bandeau d'alerte puisse le nommer au lieu de le laisser passer
    // pour une anomalie (convention déjà tranchée EVOLUTION_PRODUIT le
    // 2026-08-10 : « avoir non affiché en liste »).
    const avoirsAgg = await prisma.facture.aggregate({
      where: {
        userId,
        type: 'avoir',
        date: { gte: startOfYear, lte: endOfYear },
        statut: { notIn: ['annulee', 'brouillon'] },
      },
      _sum: { totalTTC: true },
    })
    // Ticket cmsx69cuc — l'écart résiduel entre le total comptable et la
    // ventilation par module est, par construction, la VALORISATION INTERNE :
    // soins, consommations d'aliments et fertilisations sont des coûts
    // analytiques, jamais des charges comptables. On l'expose au centime pour
    // que le bandeau puisse le nommer au lieu d'en parler en général.
    const depensesAnalytiques =
      Math.round(((depensesSoins._sum.cout || 0) + depensesAliments + depensesFertilisation) * 100) / 100

    const coherenceCheck = {
      revenusSsot: kpiCompta.revenusYtd,
      revenusSommeModules: Math.round(sumRevenusModules * 100) / 100,
      revenusEcart: Math.round((kpiCompta.revenusYtd - sumRevenusModules) * 100) / 100,
      depensesSsot: kpiCompta.depensesYtd,
      depensesSommeModules: Math.round(sumDepensesModules * 100) / 100,
      depensesEcart: Math.round((kpiCompta.depensesYtd - sumDepensesModules) * 100) / 100,
      avoirsExercice: Math.round((avoirsAgg._sum.totalTTC ?? 0) * 100) / 100,
      depensesAnalytiques,
    }

    return NextResponse.json({
      stats: {
        // Totaux issus de la SSOT (cf. src/lib/kpi/compta.ts) — alignés sur
        // /comptabilite, /comptabilite/rapports et /comptabilite/couts-production.
        revenus: kpiCompta.revenusYtd,
        depenses: kpiCompta.depensesYtd,
        benefice: kpiCompta.beneficeYtd,
        margePercent: Math.round(kpiCompta.margePercentYtd * 10) / 10,
        // BUG #2 — sous-totaux non payés exposés pour l'UI (badge info).
        // Ce sont des INFOS, pas des exclusions ; le total `depenses` les
        // inclut (compta engagement).
        depensesNonPayees: kpiCompta.depensesNonPayeesYtd,
        nbDepensesNonPayees: kpiCompta.nbDepensesNonPayees,
        revenusNonPayes: kpiCompta.revenusNonPayesYtd,
        nbRevenusNonPayes: kpiCompta.nbRevenusNonPayes,
        // BUG #2 — diagnostic de cohérence pour bannière UI éventuelle.
        coherenceCheck,
        // Ventilations par module : conservées pour les graphiques. Leur somme
        // peut, transitoirement, ne pas correspondre exactement au total
        // ci-dessus si une vente est saisie hors VenteManuelle/Facture — c'est
        // la SSOT (revenus, depenses) qui fait foi.
        revenusParModule: revenus,
        depensesParModule: depenses,
        // YTD vs YTD année dernière (et non plus année N-1 complète qui
        // faussait les variations mid-year).
        revenusAnneePrecedente: kpiCompta.revenusN1Ytd,
        revenusAnneePrecedenteTotal: kpiCompta.revenusN1Total,
        depensesAnneePrecedente: kpiCompta.depensesN1Ytd,
        depensesAnneePrecedenteTotal: kpiCompta.depensesN1Total,
        comparisonMode: "ytd-vs-ytd-n-1",
        facturesImpayees: impayeesExercice.items.length,
        facturesImpayeesTotal: impayeesExercice.total,
        stocksBas: Number(stocksBasAliments[0]?.count || 0) + stocksBasGraines,
        // QA 2026-05-15 — Bug #5 : commandes boutique en attente de
        // livraison (statuts nouveau/confirmée/prête). Elles n'ont pas
        // de VenteManuelle tant que pas livrées (règle métier : on ne
        // remonte pas en compta tant que c'est pas matérialisé), mais
        // on les rend visibles via un compteur pour éviter "Boutique
        // 14 commandes / Compta 11 commandes" sans explication.
        commandesEnAttente: commandesEnAttenteAgg._count,
        commandesEnAttenteTotal: commandesEnAttenteAgg._sum.total || 0,
      },
      charts: {
        mensuel,
        revenusParCategorie,
        depensesParCategorie,
        parModule,
      },
      activity: {
        dernieresTransactions,
        facturesImpayees,
        alertesStock,
      },
      meta: {
        year,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('GET /api/comptabilite/stats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des stats', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
