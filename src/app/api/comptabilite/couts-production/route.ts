/**
 * API Coûts de Production
 * GET /api/comptabilite/couts-production
 * Agrège TOUTES les données des modules pour calculer la rentabilité
 * Sources : cultures, recoltes, interventions, fertilisations, depenses manuelles,
 *           operations arbres, ventes produits, abattages
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { getKpiCompta } from '@/lib/kpi'

interface CultureCost {
  cultureId: number
  especeId: string
  especeNom: string
  variete: string | null
  plancheNom: string | null
  surface: number
  production: number
  revenus: number
  quantiteVendue: number
  coutSemences: number
  coutIntrants: number
  coutFertilisation: number
  coutMainOeuvre: number
  coutTotal: number
  margeBrute: number
  margePercent: number
  coutKg: number
  prixMoyenKg: number
  heuresTravaillees: number
  rendement: number
}

interface EspeceAgg {
  especeId: string
  especeNom: string
  nbCultures: number
  surface: number
  production: number
  revenus: number
  quantiteVendue: number
  coutSemences: number
  coutIntrants: number
  coutFertilisation: number
  coutMainOeuvre: number
  coutTotal: number
  margeBrute: number
  margePercent: number
  coutKg: number
  prixMoyenKg: number
  heuresTravaillees: number
  rendement: number
}

function round2(n: number) { return Math.round(n * 100) / 100 }

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())
    const module = searchParams.get('module') || 'all'

    const userId = session.user.id
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)
    const dateRange = { gte: startOfYear, lte: endOfYear }

    // ============================================================
    // 1. POTAGER : Cultures + Récoltes + Interventions + Fertilisations
    // ============================================================
    const cultures = await prisma.culture.findMany({
      where: {
        userId,
        OR: [
          { annee: year },
          { recoltes: { some: { date: dateRange } } },
          { dateSemis: dateRange },
          { datePlantation: dateRange },
        ],
      },
      include: {
        espece: true,
        variete: true,
        planche: { select: { id: true, nom: true, surface: true, largeur: true, longueur: true } },
        recoltes: { where: { date: dateRange } },
      },
    })

    const cultureIds = cultures.map(c => c.id)
    const plancheIds = [...new Set(cultures.map(c => c.plancheId).filter(Boolean))] as string[]

    // Toutes les interventions manuelles liées aux cultures/planches
    const interventions = await prisma.intervention.findMany({
      where: {
        userId,
        date: dateRange,
        OR: [
          ...(cultureIds.length > 0 ? [{ cultureId: { in: cultureIds } }] : []),
          ...(plancheIds.length > 0 ? [{ plancheId: { in: plancheIds } }] : []),
          // Interventions sans lien spécifique (attribuées au module général)
          { cultureId: null, plancheId: null, arbreId: null },
        ],
      },
    })

    // Fertilisations sur les planches
    const fertilisations = plancheIds.length > 0 ? await prisma.fertilisation.findMany({
      where: { userId, date: dateRange, plancheId: { in: plancheIds } },
      include: { fertilisant: { select: { prix: true } } },
    }) : []

    // Dépenses manuelles catégorisées potager
    const depensesPotager = await prisma.depenseManuelle.findMany({
      where: {
        userId,
        date: dateRange,
        OR: [
          { module: 'potager' },
          { categorie: { in: ['semences', 'plants', 'graines'] } },
        ],
      },
    })

    // Index interventions par culture et planche
    const intByCulture = new Map<number, typeof interventions>()
    const intByPlanche = new Map<string, typeof interventions>()
    for (const i of interventions) {
      if (i.cultureId) {
        const list = intByCulture.get(i.cultureId) || []
        list.push(i)
        intByCulture.set(i.cultureId, list)
      }
      if (i.plancheId && !i.cultureId) {
        const list = intByPlanche.get(i.plancheId) || []
        list.push(i)
        intByPlanche.set(i.plancheId, list)
      }
    }

    // Index fertilisations par planche
    const fertByPlanche = new Map<string, typeof fertilisations>()
    for (const f of fertilisations) {
      const list = fertByPlanche.get(f.plancheId) || []
      list.push(f)
      fertByPlanche.set(f.plancheId, list)
    }

    // Index dépenses semences par espece (via description matching)
    const depSemencesTotal = depensesPotager
      .filter(d => ['semences', 'plants', 'graines'].includes(d.categorie))
      .reduce((sum, d) => sum + d.montant, 0)

    // Calcul coûts par culture
    const cultureCosts: CultureCost[] = []

    for (const culture of cultures) {
      const production = culture.recoltes.reduce((sum, r) => sum + r.quantite, 0)
      // BUG-07 : on n'inclut dans le « CA moyen kg » que les lignes vendues
      // qui ont effectivement un prix (sinon prixMoyenKg = 0,19 €/kg sur 90 kg).
      const recoltesVendues = culture.recoltes.filter(
        (r) =>
          r.statut === 'vendu' &&
          ((r.prixKg ?? 0) > 0 || (r.prixTotal ?? 0) > 0)
      )
      const revenus = recoltesVendues.reduce((sum, r) => sum + (r.prixTotal || (r.quantite * (r.prixKg || 0))), 0)
      const quantiteVendue = recoltesVendues.reduce((sum, r) => sum + r.quantite, 0)

      const plancheSurface = culture.planche?.surface || ((culture.planche?.largeur || 0) * (culture.planche?.longueur || 0))
      const surface = plancheSurface || 0

      // Coût semences : depuis variete ou part des dépenses semences
      let coutSemences = 0
      if (culture.variete?.prixGraine && surface > 0) {
        coutSemences = culture.variete.prixGraine * surface * 0.01
      } else if (depSemencesTotal > 0 && cultures.length > 0) {
        // Distribuer les dépenses de semences proportionnellement à la surface
        const totalSurface = cultures.reduce((s, c) => {
          const ps = c.planche?.surface || ((c.planche?.largeur || 0) * (c.planche?.longueur || 0))
          return s + (ps || 1)
        }, 0)
        coutSemences = depSemencesTotal * ((surface || 1) / totalSurface)
      }

      // Interventions directes sur la culture
      const cultureInts = intByCulture.get(culture.id) || []

      // Interventions sur la planche (partagées entre cultures)
      const culturesOnPlanche = cultures.filter(c => c.plancheId === culture.plancheId).length
      const plancheShare = culturesOnPlanche > 0 ? 1 / culturesOnPlanche : 1
      const plancheInts = culture.plancheId ? (intByPlanche.get(culture.plancheId) || []) : []

      let coutIntrants = 0
      let coutMainOeuvre = 0
      let dureeMinutes = 0

      for (const int of cultureInts) {
        coutIntrants += int.intrantCout || 0
        coutMainOeuvre += int.coutMainOeuvre || 0
        if (int.coutTotal && !int.intrantCout && !int.coutMainOeuvre) {
          coutIntrants += int.coutTotal
        }
        dureeMinutes += (int.dureeMinutes || 0) * (int.nbPersonnes || 1)
      }
      for (const int of plancheInts) {
        coutIntrants += (int.intrantCout || 0) * plancheShare
        coutMainOeuvre += (int.coutMainOeuvre || 0) * plancheShare
        if (int.coutTotal && !int.intrantCout && !int.coutMainOeuvre) {
          coutIntrants += int.coutTotal * plancheShare
        }
        dureeMinutes += (int.dureeMinutes || 0) * (int.nbPersonnes || 1) * plancheShare
      }

      // Fertilisation
      let coutFertilisation = 0
      if (culture.plancheId) {
        const ferts = fertByPlanche.get(culture.plancheId) || []
        for (const f of ferts) {
          coutFertilisation += (f.quantite * (f.fertilisant.prix || 0)) * plancheShare
        }
      }

      const coutTotal = coutSemences + coutIntrants + coutFertilisation + coutMainOeuvre
      const margeBrute = revenus - coutTotal
      const margePercent = revenus > 0 ? (margeBrute / revenus) * 100 : (coutTotal > 0 ? -100 : 0)

      cultureCosts.push({
        cultureId: culture.id,
        especeId: culture.especeId,
        // Nom lisible : pour une espèce perso, especeId est un cuid opaque ;
        // le nom affiché vit dans espece.nom (= id pour l'officiel).
        especeNom: culture.espece?.nom ?? culture.especeId,
        variete: culture.varieteId || null,
        plancheNom: culture.planche?.nom || null,
        surface: round2(surface),
        production: round2(production),
        revenus: round2(revenus),
        quantiteVendue: round2(quantiteVendue),
        coutSemences: round2(coutSemences),
        coutIntrants: round2(coutIntrants),
        coutFertilisation: round2(coutFertilisation),
        coutMainOeuvre: round2(coutMainOeuvre),
        coutTotal: round2(coutTotal),
        margeBrute: round2(margeBrute),
        margePercent: Math.round(margePercent * 10) / 10,
        coutKg: round2(production > 0 ? coutTotal / production : 0),
        prixMoyenKg: round2(quantiteVendue > 0 ? revenus / quantiteVendue : 0),
        heuresTravaillees: Math.round(dureeMinutes / 60 * 10) / 10,
        rendement: round2(surface > 0 ? production / surface : 0),
      })
    }

    // ============================================================
    // 2. VERGER : Arbres + Récoltes arbres + Opérations + Bois
    // ============================================================
    const [recoltesArbres, opsArbres, ventesArbres, depensesVerger] = await Promise.all([
      prisma.recolteArbre.findMany({
        where: { userId, date: dateRange },
        include: { arbre: { select: { nom: true, espece: true, especeId: true } } },
      }),
      prisma.operationArbre.findMany({
        where: { userId, date: dateRange },
        include: { arbre: { select: { nom: true, espece: true, especeId: true } } },
      }),
      prisma.productionBois.findMany({
        where: { userId, date: dateRange, statut: 'vendu' },
      }),
      prisma.depenseManuelle.findMany({
        // Lot 5 : les OperationArbre ont désormais une écriture auto module
        // verger — on l'exclut car opsArbres est déjà sommé en brut ci-dessous.
        // Les autres écritures auto verger (campagnes de plantation,
        // interventions) restent : elles n'ont pas de source brute comptée ici.
        where: {
          userId,
          date: dateRange,
          module: 'verger',
          NOT: { auto: true, sourceType: 'operation_arbre' },
        },
      }),
    ])

    // Agrégation verger par espece d'arbre
    const vergerRevenus = recoltesArbres
      .filter((r) => r.statut === 'vendu' && ((r.prixKg ?? 0) > 0 || (r.prixTotal ?? 0) > 0))
      .reduce((sum, r) => sum + (r.prixTotal || (r.quantite * (r.prixKg || 0))), 0)
      + ventesArbres.reduce((sum, v) => sum + (v.prixVente || 0), 0)
    const vergerProduction = recoltesArbres.reduce((sum, r) => sum + r.quantite, 0)
    const vergerCouts = opsArbres.reduce((sum, o) => sum + (o.cout || 0), 0)
      + depensesVerger.reduce((sum, d) => sum + d.montant, 0)
    const vergerHeures = opsArbres.reduce((sum, o) => sum + ((o as any).dureeMinutes || 0), 0) / 60

    // ============================================================
    // 3. ELEVAGE : Ventes produits + Abattages + Coûts alimentation + Soins
    // ============================================================
    const [venteProduits, abattages, consoAliments, soins, depensesElevage] = await Promise.all([
      // Audit compta 2026-06 : exclure les ventes/abattages annulés
      prisma.venteProduit.findMany({
        where: { userId, date: dateRange, annule: false },
      }),
      prisma.abattage.findMany({
        where: { userId, date: dateRange, annule: false },
      }),
      prisma.consommationAliment.findMany({
        where: { userId, date: dateRange },
        include: {
          aliment: {
            select: {
              prix: true,
              nom: true,
              // Lot 5 / audit M4 : valorisation au prix per-user comme la
              // liste Dépenses et l'auto-compta (avant : prix global seul)
              userStocks: { where: { userId }, select: { prix: true, coutUnitaire: true }, take: 1 },
            },
          },
        },
      }),
      prisma.soinAnimal.findMany({
        where: { userId, date: dateRange },
      }),
      prisma.depenseManuelle.findMany({
        // Lot 5 : consommations et soins ont désormais des écritures auto —
        // exclues ici car leurs sources brutes sont déjà sommées ci-dessous.
        // Les achats de lots/animaux (auto) restent comptés via ces écritures.
        where: {
          userId,
          date: dateRange,
          module: 'elevage',
          NOT: { auto: true, sourceType: { in: ['consommation_aliment', 'soin_animal'] } },
        },
      }),
    ])

    const elevageRevenus = venteProduits.reduce((sum, v) => sum + v.prixTotal, 0)
      + abattages.filter(a => a.destination === 'vente').reduce((sum, a) => sum + (a.prixVente || 0), 0)
    const elevageCoutAlim = consoAliments.reduce((sum, c) => {
      const prixUnitaire = c.aliment.userStocks?.[0]?.coutUnitaire ?? c.aliment.userStocks?.[0]?.prix ?? c.aliment.prix ?? 0
      return sum + c.quantite * prixUnitaire
    }, 0)
    const elevageCoutSoins = soins.reduce((sum, s) => sum + (s.cout || 0), 0)
    const elevageCoutAutre = depensesElevage.reduce((sum, d) => sum + d.montant, 0)
    const elevageCoutsTotal = elevageCoutAlim + elevageCoutSoins + elevageCoutAutre

    // ============================================================
    // 4. DÉPENSES GÉNÉRALES (non affectées à un module)
    // ============================================================
    const depensesGenerales = await prisma.depenseManuelle.findMany({
      where: {
        userId,
        date: dateRange,
        OR: [
          { module: 'general' },
          { module: null },
        ],
        auto: false, // Exclure les auto-générées (déjà comptées via interventions)
      },
    })
    const coutsGeneraux = depensesGenerales.reduce((sum, d) => sum + d.montant, 0)

    // ============================================================
    // AGGREGATION PAR ESPECE (potager)
    // ============================================================
    const especeMap = new Map<string, CultureCost[]>()
    for (const cost of cultureCosts) {
      const list = especeMap.get(cost.especeId) || []
      list.push(cost)
      especeMap.set(cost.especeId, list)
    }

    const parEspece: EspeceAgg[] = []
    for (const [especeId, costs] of especeMap) {
      const surface = costs.reduce((s, c) => s + c.surface, 0)
      const production = costs.reduce((s, c) => s + c.production, 0)
      const revenus = costs.reduce((s, c) => s + c.revenus, 0)
      const quantiteVendue = costs.reduce((s, c) => s + c.quantiteVendue, 0)
      const coutSemences = costs.reduce((s, c) => s + c.coutSemences, 0)
      const coutIntrants = costs.reduce((s, c) => s + c.coutIntrants, 0)
      const coutFertilisation = costs.reduce((s, c) => s + c.coutFertilisation, 0)
      const coutMainOeuvre = costs.reduce((s, c) => s + c.coutMainOeuvre, 0)
      const coutTotal = coutSemences + coutIntrants + coutFertilisation + coutMainOeuvre
      const margeBrute = revenus - coutTotal
      const margePercent = revenus > 0 ? (margeBrute / revenus) * 100 : (coutTotal > 0 ? -100 : 0)
      const heuresTravaillees = costs.reduce((s, c) => s + c.heuresTravaillees, 0)

      parEspece.push({
        especeId,
        // Nom lisible partagé par toutes les cultures de cette espèce (garde
        // especeId comme clé de groupement/tri/URL).
        especeNom: costs[0]?.especeNom ?? especeId,
        nbCultures: costs.length,
        surface: round2(surface),
        production: round2(production),
        revenus: round2(revenus),
        quantiteVendue: round2(quantiteVendue),
        coutSemences: round2(coutSemences),
        coutIntrants: round2(coutIntrants),
        coutFertilisation: round2(coutFertilisation),
        coutMainOeuvre: round2(coutMainOeuvre),
        coutTotal: round2(coutTotal),
        margeBrute: round2(margeBrute),
        margePercent: Math.round(margePercent * 10) / 10,
        coutKg: round2(production > 0 ? coutTotal / production : 0),
        prixMoyenKg: round2(quantiteVendue > 0 ? revenus / quantiteVendue : 0),
        heuresTravaillees: Math.round(heuresTravaillees * 10) / 10,
        rendement: round2(surface > 0 ? production / surface : 0),
      })
    }

    parEspece.sort((a, b) => b.revenus - a.revenus)

    // ============================================================
    // TOTAUX GLOBAUX (tous modules)
    // ============================================================

    // QA 2026-05-15 — Bug #4 : auparavant `potagerRevenus` = somme des
    // recoltes vendues (avec prixKg saisi). Les ventes AMAP/marché
    // saisies en VenteManuelle (module=potager) étaient ignorées →
    // l'écran affichait 17,50 € alors que Transactions montrait
    // 6 342,50 €. On agrège désormais les VenteManuelle module="potager"
    // sur l'année comme source de vérité pour le revenu maraîchage.
    // `parEspece` reste calculé sur les récoltes (pour la rentabilité
    // fine par culture), mais le TOTAL module utilise la SSOT compta.
    const ventesPotagerAgg = await prisma.venteManuelle.aggregate({
      where: {
        userId,
        module: 'potager',
        date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      },
      _sum: { montant: true },
    })
    const potagerRevenusVentes = ventesPotagerAgg._sum.montant ?? 0
    const potagerRevenusRecoltes = parEspece.reduce((s, e) => s + e.revenus, 0)
    // Le maximum couvre les deux cas : ventes saisies au niveau Recolte
    // (prixKg) OU au niveau VenteManuelle (AMAP/marché). Si les deux
    // sources existent en parallèle, on évite de doubler en gardant le
    // max — pas idéal en cas de mix mais correct pour le 90/10 des
    // exploitations qui saisissent par un seul canal.
    const potagerRevenus = Math.max(potagerRevenusVentes, potagerRevenusRecoltes)
    const potagerCouts = parEspece.reduce((s, e) => s + e.coutTotal, 0)

    // Coûts : la formule reste locale (cf. consigne PROMPT 04 — les coûts de
    // production agrègent Interventions, Stocks, fertilisations, etc. au
    // niveau culture, et ce calcul fin reste utile).
    const totalCouts = potagerCouts + vergerCouts + elevageCoutsTotal + coutsGeneraux

    // Revenus : on s'aligne sur la source unique de vérité (getKpiCompta).
    // Le revenu par culture/espèce reste affiché à partir des récoltes vendues
    // (utile pour la rentabilité fine), mais le TOTAL exposé en haut de la
    // réponse est celui de la SSOT, identique sur tous les autres écrans.
    const asOf = new Date()
    const kpiCompta = await getKpiCompta(userId, year, asOf)
    const totalRevenus = kpiCompta.revenusYtd

    const totalMarge = totalRevenus - totalCouts
    const totalMargePercent = totalRevenus > 0 ? (totalMarge / totalRevenus) * 100 : 0

    return NextResponse.json({
      parEspece,
      parCulture: cultureCosts,
      // Résumé par module
      parModule: {
        potager: {
          revenus: round2(potagerRevenus),
          couts: round2(potagerCouts),
          marge: round2(potagerRevenus - potagerCouts),
          production: round2(parEspece.reduce((s, e) => s + e.production, 0)),
          heures: Math.round(parEspece.reduce((s, e) => s + e.heuresTravaillees, 0) * 10) / 10,
        },
        verger: {
          revenus: round2(vergerRevenus),
          couts: round2(vergerCouts),
          marge: round2(vergerRevenus - vergerCouts),
          production: round2(vergerProduction),
          heures: Math.round(vergerHeures * 10) / 10,
        },
        elevage: {
          revenus: round2(elevageRevenus),
          couts: round2(elevageCoutsTotal),
          marge: round2(elevageRevenus - elevageCoutsTotal),
          detailCouts: {
            alimentation: round2(elevageCoutAlim),
            soins: round2(elevageCoutSoins),
            autres: round2(elevageCoutAutre),
          },
        },
        general: {
          couts: round2(coutsGeneraux),
        },
      },
      totaux: {
        revenus: round2(totalRevenus),
        coutTotal: round2(totalCouts),
        coutSemences: round2(parEspece.reduce((s, e) => s + e.coutSemences, 0)),
        coutIntrants: round2(parEspece.reduce((s, e) => s + e.coutIntrants, 0) + vergerCouts),
        coutFertilisation: round2(parEspece.reduce((s, e) => s + e.coutFertilisation, 0)),
        coutMainOeuvre: round2(parEspece.reduce((s, e) => s + e.coutMainOeuvre, 0)),
        coutAlimentation: round2(elevageCoutAlim),
        coutSoins: round2(elevageCoutSoins),
        coutsGeneraux: round2(coutsGeneraux),
        margeBrute: round2(totalMarge),
        margePercent: Math.round(totalMargePercent * 10) / 10,
        production: round2(parEspece.reduce((s, e) => s + e.production, 0) + vergerProduction),
        surface: round2(parEspece.reduce((s, e) => s + e.surface, 0)),
        heuresTravaillees: Math.round((parEspece.reduce((s, e) => s + e.heuresTravaillees, 0) + vergerHeures) * 10) / 10,
        nbEspeces: parEspece.length,
        nbCultures: cultureCosts.length,
      },
      meta: {
        annee: year,
        module,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('GET /api/comptabilite/couts-production error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du calcul des couts de production', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
