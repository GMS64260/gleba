/**
 * API Tâches Verger - Tâches de la semaine pour le dashboard verger
 * GET /api/arbres/taches?start=ISO&end=ISO
 * Miroir du pattern /api/taches du potager
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const searchParams = request.nextUrl.searchParams
    const start = searchParams.get("start")
    const end = searchParams.get("end")

    if (!start || !end) {
      return NextResponse.json({ error: "Les paramètres start et end sont requis" }, { status: 400 })
    }

    const startDate = new Date(start)
    const endDate = new Date(end)

    // Opérations planifiées dans la période
    const operations = await prisma.operationArbre.findMany({
      where: {
        userId,
        datePrevue: { gte: startDate, lte: endDate },
      },
      include: {
        arbre: {
          select: { id: true, nom: true, type: true, espece: true, couleur: true },
        },
      },
      orderBy: { datePrevue: "asc" },
    })

    // Opérations en retard (avant start, non faites)
    const operationsRetard = await prisma.operationArbre.findMany({
      where: {
        userId,
        fait: false,
        datePrevue: { lt: startDate },
      },
      include: {
        arbre: {
          select: { id: true, nom: true, type: true, espece: true },
        },
      },
      orderBy: { datePrevue: "asc" },
      take: 10,
    })

    // Observations santé non résolues (gravité >= moyenne)
    const alertesSante = await prisma.observationSante.findMany({
      where: {
        userId,
        resolu: false,
        gravite: { in: ["moyenne", "grave", "critique"] },
      },
      include: {
        arbre: {
          select: { id: true, nom: true, type: true },
        },
      },
      orderBy: { date: "desc" },
      take: 10,
    })

    // Stats de la période
    const tailles = operations.filter((o) => o.type === "taille")
    const traitements = operations.filter((o) => o.type === "traitement")
    const greffes = operations.filter((o) => o.type === "greffe")
    const fertilisations = operations.filter((o) => o.type === "fertilisation")

    return NextResponse.json({
      operations: operations.map((o) => ({
        id: o.id,
        type: o.type,
        arbreId: o.arbreId,
        arbreNom: o.arbre.nom,
        arbreType: o.arbre.type,
        arbreCouleur: o.arbre.couleur,
        datePrevue: o.datePrevue,
        fait: o.fait,
        description: o.description,
        cout: o.cout,
      })),
      operationsRetard: operationsRetard.map((o) => ({
        id: o.id,
        type: o.type,
        arbreId: o.arbreId,
        arbreNom: o.arbre.nom,
        datePrevue: o.datePrevue,
        description: o.description,
      })),
      alertesSante: alertesSante.map((o) => ({
        id: o.id,
        arbreId: o.arbreId,
        arbreNom: o.arbre.nom,
        type: o.type,
        diagnostic: o.diagnostic,
        gravite: o.gravite,
        date: o.date,
      })),
      stats: {
        taillesPrevues: tailles.length,
        taillesFaites: tailles.filter((t) => t.fait).length,
        traitementsPrevus: traitements.length,
        traitementsFaits: traitements.filter((t) => t.fait).length,
        greffesPrevues: greffes.length,
        greffesFaites: greffes.filter((g) => g.fait).length,
        fertilisationsPrevues: fertilisations.length,
        fertilisationsFaites: fertilisations.filter((f) => f.fait).length,
        operationsRetard: operationsRetard.length,
        alertesSante: alertesSante.length,
      },
    })
  } catch (err) {
    console.error("GET /api/arbres/taches error:", err)
    return NextResponse.json({ error: "Erreur lors de la récupération des tâches" }, { status: 500 })
  }
}
