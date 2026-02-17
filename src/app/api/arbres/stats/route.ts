/**
 * API Dashboard Arbres - Statistiques pour le dashboard arboricole
 * GET /api/arbres/stats - Retourne toutes les stats des arbres
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

    // Statistiques générales des arbres
    const [
      arbresTotal,
      arbresFruitiers,
      arbresPetitsFruits,
      arbresForestiers,
      arbresProductifs,
    ] = await Promise.all([
      prisma.arbre.count({ where: { userId } }),
      prisma.arbre.count({ where: { userId, type: "fruitier" } }),
      prisma.arbre.count({ where: { userId, type: "petit_fruit" } }),
      prisma.arbre.count({ where: { userId, type: "forestier" } }),
      prisma.arbre.count({ where: { userId, productif: true, type: { in: ["fruitier", "petit_fruit"] } } }),
    ])

    // Récoltes de fruits de l'année
    const recoltesFruitsYear = await prisma.recolteArbre.aggregate({
      where: {
        userId,
        date: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { quantite: true },
      _count: { id: true },
    })

    // Récoltes par mois
    const recoltesFruitsParMois = await prisma.recolteArbre.groupBy({
      by: ["date"],
      where: {
        userId,
        date: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { quantite: true },
    })

    // Agréger par mois
    const moisNoms = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]
    const monthlyFruits: number[] = new Array(12).fill(0)

    recoltesFruitsParMois.forEach((r) => {
      const month = new Date(r.date).getMonth()
      monthlyFruits[month] += r._sum.quantite || 0
    })

    const recoltesFruitsMois = moisNoms.map((nom, i) => ({
      mois: nom,
      quantite: Math.round(monthlyFruits[i] * 100) / 100,
    }))

    // Production de bois de l'année
    const productionBoisYear = await prisma.productionBois.aggregate({
      where: {
        userId,
        date: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { volumeM3: true, poidsKg: true, prixVente: true },
      _count: { id: true },
    })

    // Production bois par mois
    const productionBoisParMois = await prisma.productionBois.groupBy({
      by: ["date"],
      where: {
        userId,
        date: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { volumeM3: true },
    })

    const monthlyBois: number[] = new Array(12).fill(0)
    productionBoisParMois.forEach((p) => {
      const month = new Date(p.date).getMonth()
      monthlyBois[month] += p._sum.volumeM3 || 0
    })

    const productionBoisMois = moisNoms.map((nom, i) => ({
      mois: nom,
      volumeM3: Math.round(monthlyBois[i] * 100) / 100,
    }))

    // Production bois par destination
    const boisParDestination = await prisma.productionBois.groupBy({
      by: ["destination"],
      where: {
        userId,
        date: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { volumeM3: true },
    })

    const destinationColors: Record<string, string> = {
      chauffage: "#f97316",
      BRF: "#22c55e",
      vente: "#3b82f6",
      construction: "#8b5cf6",
    }

    const boisParDestinationData = boisParDestination
      .filter((d) => d.destination)
      .map((d) => ({
        destination: d.destination || "Autre",
        volumeM3: Math.round((d._sum.volumeM3 || 0) * 100) / 100,
        couleur: destinationColors[d.destination || ""] || "#9ca3af",
      }))

    // Opérations en attente
    const operationsEnAttente = await prisma.operationArbre.count({
      where: {
        userId,
        fait: false,
        datePrevue: { lte: new Date() },
      },
    })

    // Prochaines opérations planifiées
    const prochainesOperations = await prisma.operationArbre.findMany({
      where: {
        userId,
        fait: false,
        datePrevue: { gte: new Date() },
      },
      select: {
        id: true,
        type: true,
        datePrevue: true,
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
          },
        },
      },
      orderBy: { datePrevue: "asc" },
      take: 5,
    })

    // Top 10 récoltes par arbre
    const recoltesParArbre = await prisma.recolteArbre.groupBy({
      by: ["arbreId"],
      where: {
        userId,
        date: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { quantite: true },
      orderBy: { _sum: { quantite: "desc" } },
      take: 10,
    })

    // Récupérer les noms des arbres
    const arbreIds = recoltesParArbre.map((r) => r.arbreId)
    const arbresData = await prisma.arbre.findMany({
      where: { id: { in: arbreIds } },
      select: { id: true, nom: true, type: true },
    })
    const arbreMap = new Map(arbresData.map((a) => [a.id, a]))

    const topRecoltesArbres = recoltesParArbre.map((r) => {
      const arbre = arbreMap.get(r.arbreId)
      return {
        arbreId: r.arbreId,
        nom: arbre?.nom || `Arbre #${r.arbreId}`,
        type: arbre?.type || "fruitier",
        quantite: Math.round((r._sum.quantite || 0) * 100) / 100,
      }
    })

    // Récoltes année précédente (comparaison)
    const lastYearStart = new Date(currentYear - 1, 0, 1)
    const lastYearEnd = new Date(currentYear - 1, 11, 31)

    const recoltesFruitsLastYear = await prisma.recolteArbre.aggregate({
      where: {
        userId,
        date: { gte: lastYearStart, lte: lastYearEnd },
      },
      _sum: { quantite: true },
    })

    // Arbres par type (pour pie chart)
    const arbresParType = [
      { type: "Fruitiers", count: arbresFruitiers, couleur: "#22c55e" },
      { type: "Petits fruits", count: arbresPetitsFruits, couleur: "#ef4444" },
      { type: "Forestiers", count: arbresForestiers, couleur: "#84cc16" },
    ].filter((t) => t.count > 0)

    // Arbres nécessitant attention (état mauvais ou mort)
    const arbresAttention = await prisma.arbre.findMany({
      where: {
        userId,
        etat: { in: ["mauvais", "moyen"] },
      },
      select: {
        id: true,
        nom: true,
        type: true,
        etat: true,
      },
      take: 5,
    })

    return NextResponse.json({
      // Stats générales
      stats: {
        arbresTotal,
        arbresFruitiers,
        arbresPetitsFruits,
        arbresForestiers,
        arbresProductifs,
        recoltesFruitsAnnee: Math.round((recoltesFruitsYear._sum.quantite || 0) * 100) / 100,
        recoltesFruitsCount: recoltesFruitsYear._count?.id || 0,
        recoltesFruitsAnneePrecedente: Math.round((recoltesFruitsLastYear._sum.quantite || 0) * 100) / 100,
        productionBoisAnnee: Math.round((productionBoisYear._sum.volumeM3 || 0) * 100) / 100,
        productionBoisKg: Math.round((productionBoisYear._sum.poidsKg || 0) * 100) / 100,
        venteBoisAnnee: Math.round((productionBoisYear._sum.prixVente || 0) * 100) / 100,
        operationsEnAttente,
      },

      // Graphiques
      charts: {
        recoltesFruitsMois,
        productionBoisMois,
        boisParDestination: boisParDestinationData,
        topRecoltesArbres,
        arbresParType,
      },

      // Activité
      activity: {
        prochainesOperations,
        arbresAttention,
      },

      // Metadata
      meta: {
        year: currentYear,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error("GET /api/arbres/stats error:", err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    const errorStack = err instanceof Error ? err.stack : undefined
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération des statistiques arbres",
        details: process.env.NODE_ENV === "development" ? errorMessage : "Erreur interne du serveur",
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 }
    )
  }
}
