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

    // Agréger par mois
    const monthlyHarvest: { mois: string; quantite: number }[] = []
    const moisNoms = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]
    const monthData: number[] = new Array(12).fill(0)

    recoltesParMois.forEach((r) => {
      const month = new Date(r.date).getMonth()
      monthData[month] += r._sum.quantite || 0
    })

    moisNoms.forEach((nom, i) => {
      monthlyHarvest.push({
        mois: nom,
        quantite: Math.round(monthData[i] * 100) / 100,
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

    // Récupérer les couleurs des espèces
    const especeIds = recoltesParEspece.map((r) => r.especeId)
    const especesData = await prisma.espece.findMany({
      where: { id: { in: especeIds } },
      select: { id: true, couleur: true, familleId: true, famille: { select: { couleur: true } } },
    })

    const especeColorMap = new Map(
      especesData.map((e) => [e.id, e.couleur || e.famille?.couleur || "#22c55e"])
    )

    const harvestBySpecies = recoltesParEspece.map((r) => ({
      espece: r.especeId,
      quantite: Math.round((r._sum.quantite || 0) * 100) / 100,
      couleur: especeColorMap.get(r.especeId) || "#22c55e",
    }))

    // Cultures par famille (année en cours)
    const culturesByFamily = await prisma.culture.groupBy({
      by: ["especeId"],
      where: { userId, annee: currentYear },
      _count: { _all: true },
    })

    // Récupérer les familles
    const allEspeceIds = culturesByFamily.map((c) => c.especeId)
    const allEspecesData = await prisma.espece.findMany({
      where: { id: { in: allEspeceIds } },
      select: { id: true, familleId: true, famille: { select: { couleur: true } } },
    })

    const especeFamilyMap = new Map(
      allEspecesData.map((e) => [e.id, { famille: e.familleId || "Autre", couleur: e.famille?.couleur || "#9ca3af" }])
    )

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

    // Rendement par planche
    const recoltesParPlanche = await prisma.$queryRaw<
      { plancheId: string; totalKg: number }[]
    >`
      SELECT c.planche as "plancheId", SUM(r.quantite) as "totalKg"
      FROM recoltes r
      JOIN cultures c ON r.culture = c.id
      WHERE r.user_id = ${userId}
        AND r.date >= ${startOfYear}
        AND r.date <= ${endOfYear}
        AND c.planche IS NOT NULL
      GROUP BY c.planche
      ORDER BY "totalKg" DESC
      LIMIT 10
    `

    // Récupérer les surfaces des planches
    const plancheIds = recoltesParPlanche.map((r) => r.plancheId)
    const planchesData = await prisma.planche.findMany({
      where: { id: { in: plancheIds } },
      select: { id: true, surface: true },
    })

    const plancheSurfaceMap = new Map(planchesData.map((p) => [p.id, p.surface || 1]))

    const yieldByPlanche = recoltesParPlanche.map((r) => ({
      planche: r.plancheId,
      totalKg: Math.round(Number(r.totalKg) * 100) / 100,
      surface: plancheSurfaceMap.get(r.plancheId) || 1,
      rendement: Math.round((Number(r.totalKg) / (plancheSurfaceMap.get(r.plancheId) || 1)) * 100) / 100,
    }))

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
