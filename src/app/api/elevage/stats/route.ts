/**
 * API Stats Élevage - Dashboard (multi-tenancy)
 * GET /api/elevage/stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { calculerStockOeufs } from '@/lib/stocks-helpers'
import { computeStockOeufsParLots } from '@/lib/elevage/stock-oeufs-lots'
import { fenetrePonteGlissante, tauxPonteAttenduPeriode } from '@/lib/elevage/taux-ponte'
import { reconstituerEffectifsLots } from '@/lib/elevage/effectif'
import { ageEntreePonteJours, calculerTetesNonPondeuses, effectifPondeuses, nominatifPondeur } from '@/lib/elevage/pondeuses'
import {
  aUneActiviteOeufsDashboard,
  agregerProductionsLaitieresDashboard,
  agregerVentesDashboard,
  construireProductionsDashboard,
} from '@/lib/elevage/dashboard-productions'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const anneeBrute = searchParams.get('annee') || String(new Date().getFullYear())
    const annee = Number(anneeBrute)
    if (!/^\d{4}$/.test(anneeBrute) || annee < 2000 || annee > 2200) return NextResponse.json({ error: 'Année invalide' }, { status: 400 })

    const userId = session.user.id
    const startOfYear = new Date(annee, 0, 1)
    const endOfYear = new Date(annee, 11, 31, 23, 59, 59, 999)
    const startOfPrevYear = new Date(annee - 1, 0, 1)
    const endOfPrevYear = new Date(annee - 1, 11, 31, 23, 59, 59, 999)

    // Lots de ponte : une seule lecture, partagée par le stock physique et les
    // statuts (commercialisables, bloqués véto).
    const stockOeufsLotsPromise = computeStockOeufsParLots(userId)

    // Stats animaux
    const [
      animauxActifs,
      animauxHorsLot,
      animauxParType,
      lotsActifs,
      productionOeufsAnnee,
      productionOeufsAnneePrecedente,
      productionOeufsMois,
      ventesAnnee,
      ventesAnneePrecedente,
      ventesParCategorie,
      abattagesAnnee,
      alimentsStockBas,
      stockOeufs,
      stockOeufsLots,
      mortaliteAnnee,
      nominatifsPondeursHorsLot,
      lotsPondeusesDetail,
      totalConsommationAliments,
    ] = await Promise.all([
      // Animaux actifs
      prisma.animal.count({
        where: { userId, statut: 'actif' },
      }),

      // Comme le stock de cheptel : seules les fiches d'un lot ACTIF sont
      // déjà comprises dans l'effectif de ce lot. Une fiche restée active
      // dans un lot terminé reste une tête présente.
      prisma.animal.count({
        where: { userId, statut: 'actif', OR: [{ lotId: null }, { lot: { statut: { not: 'actif' } } }] },
      }),

      // Animaux par type d'espece — individuels uniquement à ce stade,
      // les lots sont mergés plus bas (BUG #7).
      prisma.animal.groupBy({
        by: ['especeAnimaleId'],
        where: { userId, statut: 'actif' },
        _count: true,
      }),

      // Lots actifs — on récupère les lignes brutes pour reconstituer un
      // effectif prudent reconstitué (le _sum de quantiteActuelle dérive : abattages
      // non décrémentés, cf. bug cmpmr3837). Voir reconstituerEffectifsLots.
      prisma.lotAnimaux.findMany({
        where: { userId, statut: 'actif' },
        select: { id: true, especeAnimaleId: true, quantiteInitiale: true, quantiteActuelle: true },
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
          EXTRACT(MONTH FROM date AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris') as mois,
          SUM(quantite) as total
        FROM production_oeufs
        WHERE user_id = ${userId}
          AND date >= ${startOfYear}
          AND date <= ${endOfYear}
        GROUP BY EXTRACT(MONTH FROM date AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')
        ORDER BY mois
      ` as Promise<{ mois: number; total: bigint }[]>,

      // Ventes annee (montant total) — exclure les annulées, comme le
      // GET /ventes, sinon le KPI Dashboard diverge de l'onglet Ventes
      // dès la première annulation.
      prisma.venteProduit.aggregate({
        where: {
          userId,
          annule: false,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { prixTotal: true },
        _count: true,
      }),

      // Ventes annee précédente (N-1)
      prisma.venteProduit.aggregate({
        where: {
          userId,
          annule: false,
          date: { gte: startOfPrevYear, lte: endOfPrevYear },
        },
        _sum: { prixTotal: true },
        _count: true,
      }),

      agregerVentesDashboard(prisma, userId, startOfYear, endOfYear),

      // Abattages annee — même règle : les abattages annulés ne comptent pas.
      prisma.abattage.aggregate({
        where: {
          userId,
          annule: false,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { quantite: true, poidsCarcasse: true },
        _count: true,
      }),

      // QA 2026-10-19 — le compteur « soins à planifier » ne vit plus ici : il
      // comptait les retards parmi les soins « prévus dans les 30 prochains
      // jours ». La tuile lit `stats.echeancesSoins` de `/api/elevage/taches`,
      // calculé sur les lignes mêmes de la liste « Soins à faire ».

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

      // Stock œufs : physique (QA cmv29bm4o — même chiffre que Production >
      // Œufs, calculé une seule fois et partagé avec la ligne suivante).
      stockOeufsLotsPromise.then((lots) => calculerStockOeufs(userId, lots)),

      // QA cmsw97cn5 (2026-08-16) — statuts par lot (SSOT partagée avec
      // Production > Œufs et l'assistant) : le dashboard annonçait
      // « disponibles » un stock physique intégralement DCR dépassée/bloqué
      // véto, et son seuil d'alerte portait sur le physique.
      stockOeufsLotsPromise,

      // Mortalité annee (animaux morts cette annee)
      prisma.animal.count({
        where: {
          userId,
          statut: 'mort',
          dateSortie: { gte: startOfYear, lte: endOfYear },
        },
      }),

      // Les pondeuses suivies individuellement hors lot actif ne sont pas
      // dans l'effectif reconstitué des lots. Même règle d'âge et de sexe.
      prisma.animal.findMany({
        where: {
          userId,
          statut: 'actif',
          OR: [{ lotId: null }, { lot: { statut: { not: 'actif' } } }],
          especeAnimale: { production: { in: ['oeufs', 'mixte'] } },
        },
        select: { sexe: true, dateNaissance: true, especeAnimale: { select: { nom: true, dureeElevage: true } } },
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
          id: true,
          quantiteInitiale: true,
          quantiteActuelle: true,
          especeAnimale: { select: { nom: true, dureeElevage: true } },
        },
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

    // QA cmsp5lzye — l'effectif des pondeuses lisait `quantiteActuelle` brut
    // alors que l'écran Lots affiche l'effectif reconstitué (fiches nominatives
    // rattachées incluses) : « 29 pondeuses » au dénominateur du taux de ponte
    // contre « Actuel 30 » dans les lots. Un seul appel au helper sert les
    // usages (répartition par espèce, total en lots, pondeuses), les lots
    // pondeurs actifs étant un sous-ensemble des lots actifs.
    const effectifsLots = await reconstituerEffectifsLots(userId, lotsActifs)

    // Récupérer les noms des especes pour les stats — on inclut les ids
    // venant des LOTS aussi (BUG #7) pour ne pas perdre l'étiquette des
    // espèces présentes uniquement en lot.
    const especeIds = Array.from(
      new Set([
        ...animauxParType.map(a => a.especeAnimaleId),
        ...lotsActifs.map(l => l.especeAnimaleId),
      ])
    )
    const especes = await prisma.especeAnimale.findMany({
      where: { id: { in: especeIds } },
      select: { id: true, nom: true, couleur: true, production: true, productions: true },
    })

    const especeMap = new Map(especes.map(e => [e.id, e]))

    // BUG #7 — Fusion individuels + lots par espèce pour le PieChart.
    const animauxParTypeMerged = new Map<string, number>()
    for (const a of animauxParType) {
      animauxParTypeMerged.set(a.especeAnimaleId, (animauxParTypeMerged.get(a.especeAnimaleId) ?? 0) + a._count)
    }
    // BUG #7 — les lots actifs entrent dans la répartition (PieChart
    // « Répartition par espèce »), sinon un troupeau tenu en lots la laissait
    // vide. Revue 2026-10-20 — pour leur part collective reconstituée
    // (effectif de l'écran Lots moins les fiches rattachées, déjà comptées
    // ci-dessus sur leur propre espèce), comme les ateliers de
    // /api/elevage/analyse-couts, et non plus au compteur stocké
    // `quantiteActuelle`, qui dérive (la mort d'une fiche rattachée ne le
    // décrémente pas).
    for (const l of lotsActifs) {
      const e = effectifsLots.get(l.id)
      const n = e ? e.effectifCollectif : l.quantiteActuelle
      if (n > 0) {
        animauxParTypeMerged.set(l.especeAnimaleId, (animauxParTypeMerged.get(l.especeAnimaleId) ?? 0) + n)
      }
    }

    // Review caprin 2026-07-21 — profil du CHEPTEL (pas de la production
    // enregistrée) : sert à orienter l'UI (onglet Production par défaut). Un
    // éleveur de chèvres qui n'a pas encore saisi de collecte doit quand même
    // être reconnu comme laitier. On regarde les espèces réellement détenues.
    const profil = { lait: false, oeufs: false, viande: false }
    for (const [especeId, count] of animauxParTypeMerged) {
      if (count <= 0) continue
      const e = especeMap.get(especeId)
      if (!e) continue
      // Normalise la ligature « œ » → « oe » : sinon 'œufs'.includes('oeuf') est
      // faux (U+0153) et une espèce dont la production ne serait qu'en multivalué
      // 'Œufs' ne lèverait pas profil.oeufs.
      const prods = [e.production, ...(e.productions || [])].map((p) => (p || '').toLowerCase().replace(/œ/g, 'oe'))
      if (prods.some((p) => p.includes('lait') || p.includes('mixte'))) profil.lait = true
      if (prods.some((p) => p.includes('oeuf') || p.includes('ponte') || p.includes('mixte'))) profil.oeufs = true
      if (prods.some((p) => p.includes('viande'))) profil.viande = true
    }

    // Métriques calculées (effectif reconstitué : `effectifsLots` plus haut).
    // QA cmv5jfsol — les poussins nés dans le lot (et les fiches mâles ou trop
    // jeunes) ne pondent pas : retranchés de l'effectif pondeur, donc du taux
    // observé et de l'attendu (helper partagé avec /lots et /taches).
    // Âge des jeunes lu à la même borne que la fenêtre de ponte plus bas :
    // aujourd'hui pour l'année courante, fin d'année pour une année passée.
    const referencePonte = annee === new Date().getFullYear() ? new Date() : endOfYear
    const tetesNonPondeuses = await calculerTetesNonPondeuses(userId, lotsPondeusesDetail, referencePonte)
    const effectifLotPondeur = (lot: { id: number; quantiteActuelle: number }) =>
      effectifPondeuses(
        effectifsLots.get(lot.id)?.effectifCalcule ?? lot.quantiteActuelle,
        tetesNonPondeuses.get(lot.id),
      )
    const pondeusesIndividuelles = nominatifsPondeursHorsLot.filter((animal) =>
      nominatifPondeur(animal, ageEntreePonteJours(animal.especeAnimale), referencePonte),
    )
    const nbPondeuses = lotsPondeusesDetail.reduce(
      (somme, lot) => somme + effectifLotPondeur(lot),
      pondeusesIndividuelles.length,
    )
    const nbOeufsAnnee = productionOeufsAnnee._sum.quantite || 0
    const nbOeufsAnneePrecedente = productionOeufsAnneePrecedente._sum.quantite || 0
    const ventesTotal = ventesAnnee._sum.prixTotal || 0
    const ventesTotalPrecedente = ventesAnneePrecedente._sum.prixTotal || 0
    const consoAlimentsKg = totalConsommationAliments._sum.quantite || 0
    const poidsCarcasseTotal = abattagesAnnee._sum.poidsCarcasse || 0
    const activiteOeufs = aUneActiviteOeufsDashboard({
      animauxPondeursActifs: nominatifsPondeursHorsLot.length,
      // Le contrat produit parle d'un lot pondeur actif, indépendamment de son
      // effectif courant. `lotsPondeusesDetail` contient aussi les lots à zéro.
      lotsPondeursActifs: lotsPondeusesDetail.length,
      oeufsProduitsAnnee: nbOeufsAnnee,
    })

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
    // QA cmswwvsoj — la fenêtre est bornée au JOUR CIVIL, pas à l'heure courante :
    // sinon la collecte du 7ᵉ jour (datée à minuit) sortait du numérateur tandis
    // que le dénominateur comptait 7 jours, et le taux portait en réalité sur 6.
    const fenetre = fenetrePonteGlissante(annee === now.getFullYear() ? now : endOfYear)
    const periodStart = fenetre.debut
    const periodEnd = fenetre.fin

    // Taux observé sur 7 j glissants : œufs collectés / (pondeuses × jours).
    const productionOeufs7j = await prisma.productionOeuf.aggregate({
      where: { userId, date: { gte: periodStart, lte: periodEnd } },
      _sum: { quantite: true },
    })
    const nbOeufs7j = productionOeufs7j._sum.quantite || 0
    const tauxObserve7j =
      nbPondeuses > 0 ? (nbOeufs7j / (nbPondeuses * fenetre.jours)) * 100 : 0

    // Taux attendu pondéré par espèce (chaque lot tire son propre coef).
    let sommeAttenduPondere = 0
    let effectifPondeur = 0
    for (const lot of lotsPondeusesDetail) {
      const q = effectifLotPondeur(lot)
      if (q <= 0) continue
      const tx = tauxPonteAttenduPeriode(lot.especeAnimale.nom, periodStart, periodEnd)
      sommeAttenduPondere += q * tx
      effectifPondeur += q
    }
    for (const animal of pondeusesIndividuelles) {
      sommeAttenduPondere += tauxPonteAttenduPeriode(animal.especeAnimale.nom, periodStart, periodEnd)
      effectifPondeur += 1
    }
    const tauxPonteAttendu =
      effectifPondeur > 0 ? Math.round((sommeAttenduPondere / effectifPondeur) * 10) / 10 : null

    const tauxPonte = nbPondeuses > 0 ? Math.round(tauxObserve7j * 10) / 10 : null

    // Compat : `tauxPonteRatio` (observé / attendu) reste utile pour les
    // anciens écrans qui comparent ratio plutôt qu'écart.
    const tauxPonteRatio =
      tauxPonte !== null && tauxPonteAttendu && tauxPonteAttendu > 0
        ? Math.round((tauxPonte / tauxPonteAttendu) * 100) / 100
        : null

    const animauxEnLots = Array.from(effectifsLots.values()).reduce(
      (sum, e) => sum + e.effectifCalcule,
      0,
    )
    const lotsActifsCount = lotsActifs.length
    // QA caprin cms1v227a / cms1vcvc5 — effectif physique réel : effectif des
    // lots (fiches rattachées incluses) + fiches hors lot. Avant : animauxActifs
    // + animauxEnLots comptait deux fois chaque fiche rattachée à un lot
    // (+25 % d'effectif fantôme sur la démo, faux inventaire PAC/registre).
    const animauxRattachesLots = animauxActifs - animauxHorsLot
    const animauxTotal = animauxHorsLot + animauxEnLots

    // FCR = kg aliment / kg carcasse
    const fcr = poidsCarcasseTotal > 0 ? consoAlimentsKg / poidsCarcasseTotal : null

    // Taux de mortalité
    const totalAnimauxEver = animauxTotal + mortaliteAnnee
    const tauxMortalite = totalAnimauxEver > 0
      ? (mortaliteAnnee / totalAnimauxEver) * 100
      : 0

    // PROMPT 17 — KPI lait
    const fenetreLait = fenetrePonteGlissante(new Date(), 30)
    const borneStockLait = new Date(Math.min(endOfYear.getTime(), fenetreLait.fin.getTime()))
    const [productionsLaitieres, laitNonAffecte, laitJ30] = await Promise.all([
      agregerProductionsLaitieresDashboard({
        collecteLait: { aggregate: (args) => prisma.collecteLait.aggregate(args) },
        lotFromage: { aggregate: (args) => prisma.lotFromage.aggregate(args) },
      }, userId, startOfYear, endOfYear),
      prisma.collecteLait.aggregate({
        where: { userId, lotFromageId: null, ecarteAttente: false, date: { gte: startOfYear, lte: borneStockLait } },
        _sum: { quantiteLitres: true },
      }),
      prisma.collecteLait.aggregate({
        where: { userId, date: { gte: fenetreLait.debut, lte: fenetreLait.fin } },
        _sum: { quantiteLitres: true },
      }),
    ])
    const laitTotalAnnee = productionsLaitieres.laitLitres
    const laitNonAffecteL = Number(laitNonAffecte._sum.quantiteLitres ?? 0)
    const laitJ30L = Number(laitJ30._sum.quantiteLitres ?? 0)
    const laitMoyenJourJ30 = Math.round((laitJ30L / 30) * 100) / 100
    const productions = construireProductionsDashboard({
      oeufs: nbOeufsAnnee,
      laitLitres: laitTotalAnnee,
      fromagePieces: productionsLaitieres.fromagePieces,
      fromageKg: productionsLaitieres.fromageKg,
      viandeKg: poidsCarcasseTotal,
    })

    // BUG #8 (audit Julien 15/05/2026) — Avant : la carte « Animaux actifs »
    // affichait juste le COUNT(Animal statut='actif'), avec un sous-titre
    // « + N lots » qui faisait croire à l'éleveur qu'il avait perdu son
    // troupeau en lot (6 individus + 3 lots = panique alors que les lots
    // contenaient 63 bêtes). Désormais on expose les deux compteurs et le
    // total cheptel pour que l'UI puisse afficher « 69 animaux · 6 individus
    // · 63 en lots (3 lots) ».


    return NextResponse.json({
      stats: {
        animauxActifs,
        animauxHorsLot,
        animauxRattachesLots,
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
        alimentsStockBas,
        stockOeufs: stockOeufs.stockNet,
        stockOeufsDetail: stockOeufs.detail,
        // QA cmsw97cn5 — part réellement vendable du stock physique.
        stockOeufsCommercialisables: stockOeufsLots.stats.commercialisables,
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
        activiteOeufs,
        nbOeufsPeriode7j: nbOeufs7j,
        fcr: fcr !== null ? Math.round(fcr * 100) / 100 : null,
        consoAlimentsKg: Math.round(consoAlimentsKg * 10) / 10,
        // PROMPT 17 — KPI Lait
        laitTotalAnnee: Math.round(laitTotalAnnee * 100) / 100,
        laitMoyenJourJ30,
        laitStockTransformable: Math.round(laitNonAffecteL * 100) / 100,
        nbCollectesAnnee: productionsLaitieres.nbCollectes,
        // Profil du cheptel (pour l'UI : onglet Production par défaut, etc.)
        profil,
      },
      // BUG #7 : la répartition par espèce additionne les fiches actives (sur
      // leur espèce) et la part collective reconstituée des lots actifs.
      animauxParType: Array.from(animauxParTypeMerged.entries()).map(([especeAnimaleId, count]) => ({
        especeAnimaleId,
        nom: especeMap.get(especeAnimaleId)?.nom || especeAnimaleId,
        couleur: especeMap.get(especeAnimaleId)?.couleur,
        count,
      })),
      ventesParCategorie,
      productionOeufsMois: productionOeufsMois.map(p => ({
        mois: Number(p.mois),
        total: Number(p.total),
      })),
      productions,
    })
  } catch (error) {
    console.error('GET /api/elevage/stats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des stats', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
