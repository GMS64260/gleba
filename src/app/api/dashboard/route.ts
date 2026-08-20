/**
 * API Dashboard - Statistiques pour les graphiques
 * GET /api/dashboard - Retourne toutes les stats du dashboard
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { getKpiMaraichage } from "@/lib/kpi"
import { getRecoltesAnneeAggregat } from "@/lib/kpi/recoltes-annee"
import { surfaceCultureM2 } from "@/lib/culture-surface"
import { projectionRecolte, type UniteQuantite } from "@/lib/recolte/projection"
import {
  ajouterQuantite,
  arrondirQuantites,
  partKg,
  type QuantiteParUnite,
} from "@/lib/recolte/quantites"
import { chargerSurchargesRendement, rendementEffectif } from "@/lib/recolte/rendement-effectif"

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id

    // Récupérer l'annee depuis les parametres de requête
    const searchParams = request.nextUrl.searchParams
    const yearParam = searchParams.get("year")
    const currentYear = yearParam ? parseInt(yearParam) : new Date().getFullYear()

    const startOfYear = new Date(currentYear, 0, 1)
    // Audit #54 : fin de journée du 31/12 (et non 00:00), sinon les récoltes
    // datées du 31 décembre tombent hors borne et disparaissent du graphique.
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999)
    const asOf = new Date()

    // Source unique de vérité pour les KPI agrégés (surface cultivée vs
    // planifiée, récoltes YTD, comparaison N-1 YTD à date égale).
    const [kpiMaraichage, recoltesAggregat] = await Promise.all([
      getKpiMaraichage(userId, currentYear, asOf),
      // Bug #3 — projection nécessaire au CalendrierTab pour afficher le
      // contexte "X kg réalisés + Y kg attendus" (sinon le total apparaît
      // comme un chiffre isolé qu'on confond avec la totalité de l'année).
      getRecoltesAnneeAggregat(userId, currentYear),
    ])

    // Compteurs purement référentiels (catalogue, pas année-dépendants)
    const [especesCount, arbresCount, recoltesCountYear] = await Promise.all([
      prisma.espece.count(),
      prisma.arbre.count({ where: { userId } }),
      prisma.recolte.count({
        where: { userId, date: { gte: startOfYear, lte: asOf } },
      }),
    ])

    // Récoltes par mois (annee en cours). Groupé AUSSI par unité : depuis le
    // 2026-08-20 une récolte peut être comptée en tiges, pièces ou bottes, et
    // sommer la colonne `quantite` sans regarder `unite` mélangerait des tiges
    // à des kilos dans le même point du graphique.
    const recoltesParMois = await prisma.recolte.groupBy({
      by: ["date", "unite"],
      where: {
        userId,
        date: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { quantite: true },
    })

    // Récoltes prévisionnelles (cultures non récoltées)
    const recoltesPrevisionnelles = await prisma.culture.findMany({
      where: {
        userId,
        annee: currentYear,
        recolteFaite: false,
        terminee: null,
        dateRecolte: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      select: {
        dateRecolte: true,
        longueur: true,
        especeId: true,
        espece: {
          select: {
            id: true,
            rendement: true,
            uniteRendement: true,
          },
        },
        planche: {
          select: {
            largeur: true,
            longueur: true,
            surface: true,
          },
        },
      },
    })

    // Rendements déclarés par la ferme : ils priment sur le catalogue, et sont
    // le seul moyen pour un membre de fixer l'unité d'une espèce officielle.
    const surchargesRendement = await chargerSurchargesRendement(
      userId,
      [...new Set(recoltesPrevisionnelles.map((c) => c.especeId).filter(Boolean))],
    )

    // Agréger par mois (recoltes réelles). Chaque mois porte la PART EN KILOS,
    // que le graphique trace, et la ventilation complète, que la légende affiche.
    const monthlyHarvest: {
      mois: string
      quantite: number
      previsionnel: number
      quantiteParUnite: QuantiteParUnite
      previsionnelParUnite: QuantiteParUnite
    }[] = []
    const moisNoms = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]
    const monthData: QuantiteParUnite[] = Array.from({ length: 12 }, () => ({}))
    const monthDataPrev: QuantiteParUnite[] = Array.from({ length: 12 }, () => ({}))

    recoltesParMois.forEach((r) => {
      const month = new Date(r.date).getMonth()
      ajouterQuantite(monthData[month], (r.unite ?? 'kg') as UniteQuantite, r._sum.quantite || 0)
    })

    // Ajouter les recoltes prévisionnelles.
    // Surface : SSOT `surfaceCultureM2` (la formule locale multipliait puis
    // divisait par nbRangs, et retombait sur la planche ENTIÈRE dès que
    // nbRangs manquait). Quantité : SSOT `projectionRecolte`, qui lit l'unité
    // du rendement au lieu de traiter kg/arbre et t/ha en kg/m², et rend
    // désormais l'unité avec le nombre.
    recoltesPrevisionnelles.forEach((c) => {
      if (!c.dateRecolte) return
      const month = new Date(c.dateRecolte).getMonth()
      const effectif = rendementEffectif(c.espece, surchargesRendement.get(c.especeId))
      const { quantite, unite } = projectionRecolte(
        surfaceCultureM2(c),
        effectif.rendement,
        effectif.uniteRendement,
      )
      ajouterQuantite(monthDataPrev[month], unite, quantite)
    })

    moisNoms.forEach((nom, i) => {
      const reel = arrondirQuantites(monthData[i])
      const prev = arrondirQuantites(monthDataPrev[i])
      monthlyHarvest.push({
        mois: nom,
        quantite: partKg(reel),
        previsionnel: partKg(prev),
        quantiteParUnite: reel,
        previsionnelParUnite: prev,
      })
    })

    // Récoltes par espece (top 10). Groupé par (espèce, unité) : une espèce
    // n'a qu'une unité à un instant donné, mais elle a pu changer en cours de
    // saison, et le classement ne doit pas additionner des tiges à des kilos.
    const recoltesParEspece = await prisma.recolte.groupBy({
      by: ["especeId", "unite"],
      where: {
        userId,
        date: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { quantite: true },
      orderBy: { _sum: { quantite: "desc" } },
      take: 10,
    })

    // Cultures par famille (annee en cours)
    const culturesByFamily = await prisma.culture.groupBy({
      by: ["especeId"],
      where: { userId, annee: currentYear },
      _count: { _all: true },
    })

    // Récupérer toutes les especes utilisées (pour recoltes ET cultures) en UNE SEULE requête
    const allEspeceIds = [
      ...new Set([
        ...recoltesParEspece.map((r) => r.especeId),
        ...culturesByFamily.map((c) => c.especeId),
      ])
    ]

    const especesData = await prisma.espece.findMany({
      where: { id: { in: allEspeceIds } },
      select: {
        id: true,
        couleur: true,
        familleId: true,
        famille: { select: { couleur: true } }
      },
    })

    // Maps pour éviter les lookups multiples
    const especeColorMap = new Map(
      especesData.map((e) => [e.id, e.couleur || e.famille?.couleur || "#22c55e"])
    )

    const especeFamilyMap = new Map(
      especesData.map((e) => [e.id, { famille: e.familleId || "Autre", couleur: e.famille?.couleur || "#9ca3af" }])
    )

    const harvestBySpecies = recoltesParEspece.map((r) => ({
      espece: r.especeId,
      quantite: Math.round((r._sum.quantite || 0) * 100) / 100,
      // L'unité voyage avec le nombre : sans elle, la barre d'une espèce en
      // tiges serait lue comme des kilos par le graphique.
      unite: (r.unite ?? 'kg') as UniteQuantite,
      couleur: especeColorMap.get(r.especeId) || "#22c55e",
    }))

    const familyCount: Record<string, { count: number; couleur: string }> = {}
    culturesByFamily.forEach((c) => {
      const info = especeFamilyMap.get(c.especeId)
      const famille = info?.famille || "Autre"
      if (!familyCount[famille]) {
        familyCount[famille] = { count: 0, couleur: info?.couleur || "#9ca3af" }
      }
      familyCount[famille].count += c._count._all
    })

    const culturesByFamilyData = Object.entries(familyCount)
      .map(([famille, data]) => ({
        famille,
        count: data.count,
        couleur: data.couleur,
      }))
      .sort((a, b) => b.count - a.count)

    // Comparaison année précédente : YTD vs YTD N-1 (cf. getKpiMaraichage).
    // L'ancien calcul utilisait l'année N-1 COMPLÈTE, ce qui faussait toute
    // variation tant que l'année N était en cours.

    // Prochains semis/plantations (ITP basés)
    const upcomingCultures = await prisma.culture.findMany({
      where: {
        userId,
        annee: currentYear,
        OR: [
          { semisFait: false, dateSemis: { not: null } },
          { plantationFaite: false, datePlantation: { not: null } },
        ],
      },
      select: {
        id: true,
        especeId: true,
        plancheId: true,
        dateSemis: true,
        datePlantation: true,
        semisFait: true,
        plantationFaite: true,
      },
      orderBy: [{ dateSemis: "asc" }, { datePlantation: "asc" }],
      take: 5,
    })

    // État des cultures (annee en cours)
    const culturesStatus = await prisma.culture.groupBy({
      by: ["terminee"],
      where: { userId, annee: currentYear },
      _count: { _all: true },
    })

    const statusData = {
      enCours: 0,
      terminees: 0,
      total: 0,
    }

    culturesStatus.forEach((s) => {
      if (s.terminee === "x" || s.terminee === "v") {
        statusData.terminees += s._count._all
      } else {
        statusData.enCours += s._count._all
      }
      statusData.total += s._count._all
    })

    // Rendement par planche - avec Prisma au lieu de SQL brut
    const recoltesAvecPlanche = await prisma.recolte.findMany({
      where: {
        userId,
        date: { gte: startOfYear, lte: endOfYear },
        culture: {
          plancheId: { not: null },
        },
      },
      select: {
        quantite: true,
        culture: {
          select: {
            plancheId: true,
            planche: {
              select: {
                id: true,
                surface: true,
              },
            },
          },
        },
      },
    })

    // Agréger par planche
    const plancheStats = new Map<string, { totalKg: number; surface: number }>()
    recoltesAvecPlanche.forEach((r) => {
      const plancheId = r.culture.plancheId
      if (!plancheId) return

      const existing = plancheStats.get(plancheId) || {
        totalKg: 0,
        surface: r.culture.planche?.surface || 1,
      }
      existing.totalKg += r.quantite
      plancheStats.set(plancheId, existing)
    })

    // Trier et limiter au top 10
    const yieldByPlanche = Array.from(plancheStats.entries())
      .map(([planche, stats]) => ({
        planche,
        totalKg: Math.round(stats.totalKg * 100) / 100,
        surface: stats.surface,
        rendement: Math.round((stats.totalKg / stats.surface) * 100) / 100,
      }))
      .sort((a, b) => b.totalKg - a.totalKg)
      .slice(0, 10)

    return NextResponse.json({
      // Stats générales (alimentées par getKpiMaraichage — source unique).
      stats: {
        culturesTotal: kpiMaraichage.culturesPlanifiees,
        culturesActives: kpiMaraichage.culturesActives,
        planches: kpiMaraichage.planchesCount,
        // Surface "Cultivée" : seules les planches portant une culture active.
        // Différente de la surface totale des planches enregistrées.
        surfaceCultivee: kpiMaraichage.surfaceCultiveeM2,
        surfacePlanifiee: kpiMaraichage.surfacePlanifieeM2,
        surfacePlanches: kpiMaraichage.planchesSurfaceM2,
        // Alias de compatibilité (anciens écrans) — = surface cultivée.
        surfaceTotale: kpiMaraichage.surfaceCultiveeM2,
        especes: especesCount,
        arbres: arbresCount,
        recoltesAnnee: kpiMaraichage.recoltesKgYtd,
        recoltesCount: recoltesCountYear,
        // Ventilations par unité (2026-08-20) : les champs en kilos qui les
        // entourent n'en sont que la part pondérale.
        recoltesAnneeParUnite: kpiMaraichage.recoltesParUniteYtd,
        recoltesAnneePrecedenteParUnite: kpiMaraichage.recoltesParUniteN1Ytd,
        // YTD vs YTD année précédente à date égale (et non plus année N-1
        // complète, qui faussait toutes les variations mid-year).
        recoltesAnneePrecedente: kpiMaraichage.recoltesKgN1Ytd,
        recoltesAnneePrecedenteTotal: kpiMaraichage.recoltesKgN1Total,
        recoltesComparisonMode: "ytd-vs-ytd-n-1",
        // Bug #3 — alignement avec PlanificationTab.
        recoltesRealiseesKg: recoltesAggregat.realiseesKg,
        recoltesProjectionKg: recoltesAggregat.projectionKg,
        recoltesTotalAttenduKg: recoltesAggregat.totalAttenduKg,
        recoltesRealiseesParUnite: recoltesAggregat.realiseesParUnite,
        recoltesProjectionParUnite: recoltesAggregat.projectionParUnite,
        recoltesTotalAttenduParUnite: recoltesAggregat.totalAttenduParUnite,
      },

      // Graphiques
      charts: {
        monthlyHarvest,
        harvestBySpecies,
        culturesByFamily: culturesByFamilyData,
        yieldByPlanche,
      },

      // Activité
      activity: {
        culturesStatus: statusData,
        upcomingTasks: upcomingCultures,
      },

      // Metadata
      meta: {
        year: currentYear,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error("GET /api/dashboard error:", err)
    // Retourner l'erreur détaillée en développement
    const errorMessage = err instanceof Error ? err.message : String(err)
    const errorStack = err instanceof Error ? err.stack : undefined
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération des statistiques",
        details: process.env.NODE_ENV === "development" ? errorMessage : "Erreur interne du serveur",
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}
