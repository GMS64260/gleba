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

    // Récupérer l'annee depuis les parametres de requête
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
      // Feedback Marc 2026-05-16 — Bug 07 : un arbre ne peut pas être
      // « productif » s'il n'a pas de date de plantation valide (passé).
      // Les 22 arbres seed étaient tous productif=true mais 20 sans
      // date et 1 daté 2099 → KPI faussé. On compte désormais ceux
      // qui sont productif=true ET datePlantation passée.
      prisma.arbre.count({
        where: {
          userId,
          productif: true,
          datePlantation: { not: null, lte: new Date() },
          type: { in: ["fruitier", "petit_fruit"] },
        },
      }),
    ])

    // Bug #6 — Surface verger : somme des parcelles ayant au moins un
    // arbre. Feedback Marc 2026-05-16 : la valeur affichée était 0 ha
    // alors que la parcelle Demo-V Verger fait 0.08 ha. Cause : le
    // champ Prisma `parcelleGeo.surface` est mappé sur la colonne
    // `surface_ha` (hectares déjà), mais le code divisait par 10000
    // (×0.0001) en croyant traiter des m². On lit donc directement en
    // hectares et on dérive les m² (×10000).
    const parcellesAvecArbres = await prisma.parcelleGeo.findMany({
      where: { userId, arbres: { some: {} } },
      select: { surface: true },
    })
    const surfaceVergerHaBrut = parcellesAvecArbres.reduce(
      (s, p) => s + (p.surface || 0),
      0
    )
    const surfaceVergerHa = Math.round(surfaceVergerHaBrut * 100) / 100
    const surfaceVergerM2 = Math.round(surfaceVergerHaBrut * 10000)

    // Bug #6 — Pyramide d'âge : count d'arbres par tranche, basée sur
    // datePlantation.
    const arbresAvecDates = await prisma.arbre.findMany({
      where: { userId, type: { in: ["fruitier", "petit_fruit"] }, datePlantation: { not: null } },
      select: { datePlantation: true },
    })
    const now = new Date()
    const pyramideAge = { age_0_5: 0, age_5_15: 0, age_15_30: 0, age_30_plus: 0, sansDate: 0 }
    const arbresFruitsTotal = arbresFruitiers + arbresPetitsFruits
    for (const a of arbresAvecDates) {
      if (!a.datePlantation) continue
      const ageMs = now.getTime() - new Date(a.datePlantation).getTime()
      const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25)
      if (ageYears < 5) pyramideAge.age_0_5++
      else if (ageYears < 15) pyramideAge.age_5_15++
      else if (ageYears < 30) pyramideAge.age_15_30++
      else pyramideAge.age_30_plus++
    }
    pyramideAge.sansDate = Math.max(0, arbresFruitsTotal - arbresAvecDates.length)

    // Bug #6 — Top 5 espèces par nombre d'arbres.
    // Bug cmp8sbgi1 (Marc 2026-05-16) — auparavant on tronquait à 5 sans
    // regroupement, donc Figuier (1 arbre) disparaissait et la somme du
    // donut ≠ total fruitiers. On regroupe l'éventuel reliquat en
    // "Autres" pour conserver la cohérence visuelle.
    const especesRaw = await prisma.arbre.groupBy({
      by: ["espece"],
      where: { userId, type: { in: ["fruitier", "petit_fruit"] }, espece: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { espece: "desc" } },
    })
    const especesSorted = especesRaw.map((r) => ({ espece: r.espece ?? "—", count: r._count._all }))
    const topEspeces = especesSorted.slice(0, 5)
    if (especesSorted.length > 5) {
      const autresCount = especesSorted.slice(5).reduce((s, e) => s + e.count, 0)
      if (autresCount > 0) topEspeces.push({ espece: "Autres", count: autresCount })
    }

    // Récoltes de fruits de l'annee
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

    // Production de bois de l'annee
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

    // Top 10 recoltes par arbre
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

    // Récoltes annee précédente (comparaison)
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
        // Bug #6 — Nouveaux KPI Verger (audit Marc 2026-05-14).
        surfaceVergerHa,
        surfaceVergerM2,
        pyramideAge,
        topEspeces,
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
