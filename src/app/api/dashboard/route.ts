/**
 * API Dashboard - Statistiques pour les graphiques
 * GET /api/dashboard - Retourne toutes les stats du dashboard
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id

    // Récupérer l'année depuis les paramètres de requête
    const searchParams = request.nextUrl.searchParams
    const yearParam = searchParams.get("year")
    const currentYear = yearParam ? parseInt(yearParam) : new Date().getFullYear()

    const startOfYear = new Date(currentYear, 0, 1)
    const endOfYear = new Date(currentYear, 11, 31)

    // Statistiques générales
    const [
      culturesCount,
      culturesActives,
      planchesCount,
      especesCount,
      arbresCount,
    ] = await Promise.all([
      prisma.culture.count({ where: { userId } }),
      prisma.culture.count({ where: { userId, annee: currentYear, terminee: null } }),
      prisma.planche.count({ where: { userId } }),
      prisma.espece.count(),
      prisma.arbre.count({ where: { userId } }),
    ])

    // Surface totale des planches
    const planchesSurface = await prisma.planche.aggregate({
      where: { userId },
      _sum: { surface: true },
    })

    // Récoltes totales de l'année
    const recoltesYear = await prisma.recolte.aggregate({
      where: {
        userId,
        date: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { quantite: true },
      _count: { id: true },
    })

    // Récoltes par mois (année en cours)
    const recoltesParMois = await prisma.recolte.groupBy({
      by: ["date"],
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
        nbRangs: true,
        longueur: true,
        espece: {
          select: {
            rendement: true,
          },
        },
        planche: {
          select: {
            largeur: true,
            surface: true,
          },
        },
      },
    })

    // Agréger par mois (récoltes réelles)
    const monthlyHarvest: { mois: string; quantite: number; previsionnel: number }[] = []
    const moisNoms = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]
    const monthData: number[] = new Array(12).fill(0)
    const monthDataPrev: number[] = new Array(12).fill(0)

    recoltesParMois.forEach((r) => {
      const month = new Date(r.date).getMonth()
      monthData[month] += r._sum.quantite || 0
    })

    // Ajouter les récoltes prévisionnelles
    recoltesPrevisionnelles.forEach((c) => {
      if (!c.dateRecolte) return
      const month = new Date(c.dateRecolte).getMonth()

      // Estimer la quantité : surface × rendement
      let surface = 0
      if (c.nbRangs && c.longueur && c.planche?.largeur) {
        surface = (c.nbRangs * c.longueur * c.planche.largeur) / (c.nbRangs || 1)
      } else {
        surface = c.planche?.surface || 0
      }

      const rendement = c.espece?.rendement || 0
      const quantitePrevue = surface * rendement

      monthDataPrev[month] += quantitePrevue
    })

    moisNoms.forEach((nom, i) => {
      monthlyHarvest.push({
        mois: nom,
        quantite: Math.round(monthData[i] * 100) / 100,
        previsionnel: Math.round(monthDataPrev[i] * 100) / 100,
      })
    })

    // Récoltes par espèce (top 10)
    const recoltesParEspece = await prisma.recolte.groupBy({
      by: ["especeId"],
      where: {
        userId,
        date: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { quantite: true },
      orderBy: { _sum: { quantite: "desc" } },
      take: 10,
    })

    // Cultures par famille (année en cours)
    const culturesByFamily = await prisma.culture.groupBy({
      by: ["especeId"],
      where: { userId, annee: currentYear },
      _count: { _all: true },
    })

    // Récupérer toutes les espèces utilisées (pour récoltes ET cultures) en UNE SEULE requête
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

    // Comparaison année précédente
    const lastYearStart = new Date(currentYear - 1, 0, 1)
    const lastYearEnd = new Date(currentYear - 1, 11, 31)

    const recoltesLastYear = await prisma.recolte.aggregate({
      where: {
        userId,
        date: { gte: lastYearStart, lte: lastYearEnd },
      },
      _sum: { quantite: true },
    })

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

    // État des cultures (année en cours)
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
      // Stats générales
      stats: {
        culturesTotal: culturesCount,
        culturesActives,
        planches: planchesCount,
        surfaceTotale: Math.round((planchesSurface._sum.surface || 0) * 100) / 100,
        especes: especesCount,
        arbres: arbresCount,
        recoltesAnnee: Math.round((recoltesYear._sum.quantite || 0) * 100) / 100,
        recoltesCount: recoltesYear._count?.id || 0,
        recoltesAnneePrecedente: Math.round((recoltesLastYear._sum.quantite || 0) * 100) / 100,
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
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}
