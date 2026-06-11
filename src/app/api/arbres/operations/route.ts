/**
 * API Opérations Arbres
 * GET /api/arbres/operations - Liste des opérations
 * POST /api/arbres/operations - Créer une opération
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { createDepenseFromOperationArbre } from "@/lib/auto-compta"

// Types d'opérations
export const TYPES_OPERATIONS = [
  { value: "taille", label: "Taille" },
  { value: "greffe", label: "Greffe" },
  { value: "traitement", label: "Traitement" },
  { value: "fertilisation", label: "Fertilisation" },
  { value: "autre", label: "Autre" },
]

// GET /api/arbres/operations
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const searchParams = request.nextUrl.searchParams

    // Filtres
    const arbreId = searchParams.get("arbreId")
    const type = searchParams.get("type")
    const fait = searchParams.get("fait")
    const year = searchParams.get("year")

    const where: Record<string, unknown> = { userId }

    if (arbreId) {
      where.arbreId = parseInt(arbreId)
    }

    if (type) {
      where.type = type
    }

    if (fait !== null && fait !== undefined) {
      where.fait = fait === "true"
    }

    if (year) {
      const yearNum = parseInt(year)
      // Le calendrier positionne les opérations sur `datePrevue || date` :
      // on filtre donc sur les deux champs (sinon les ops planifiées sur
      // l'année N avec une `date` sur N-1/N+1 disparaissaient). Borne haute
      // exclusive (`lt` 1er janvier N+1) pour ne pas exclure le 31 décembre
      // dès qu'une heure est renseignée.
      const start = new Date(yearNum, 0, 1)
      const end = new Date(yearNum + 1, 0, 1)
      where.OR = [
        { date: { gte: start, lt: end } },
        { datePrevue: { gte: start, lt: end } },
      ]
    }

    const operations = await prisma.operationArbre.findMany({
      where,
      include: {
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
            espece: true,
          },
        },
      },
      orderBy: [
        { fait: "asc" }, // Non faites en premier
        { datePrevue: "asc" },
        { date: "desc" },
      ],
    })

    return NextResponse.json(operations)
  } catch (err) {
    console.error("GET /api/arbres/operations error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des opérations" },
      { status: 500 }
    )
  }
}

// POST /api/arbres/operations
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const body = await request.json()

    // Validation
    if (!body.arbreId) {
      return NextResponse.json(
        { error: "L'arbre est requis" },
        { status: 400 }
      )
    }

    if (!body.type) {
      return NextResponse.json(
        { error: "Le type d'opération est requis" },
        { status: 400 }
      )
    }

    // Vérifier que l'arbre appartient à l'utilisateur
    const arbre = await prisma.arbre.findFirst({
      where: { id: body.arbreId, userId },
    })

    if (!arbre) {
      return NextResponse.json(
        { error: "Arbre non trouvé" },
        { status: 404 }
      )
    }

    const operation = await prisma.operationArbre.create({
      data: {
        userId,
        arbreId: body.arbreId,
        date: body.date ? new Date(body.date) : new Date(),
        type: body.type,
        description: body.description || null,
        produit: body.produit || null,
        quantite: body.quantite || null,
        unite: body.unite || null,
        cout: body.cout != null ? parseFloat(body.cout) : null,
        datePrevue: body.datePrevue ? new Date(body.datePrevue) : null,
        fait: body.fait !== undefined ? body.fait : true,
        notes: body.notes || null,
        dureeMinutes: body.dureeMinutes ? parseInt(body.dureeMinutes) : null,
        nbPersonnes: body.nbPersonnes ? parseInt(body.nbPersonnes) : undefined,
        recurrence: body.recurrence || null,
        saisonRecommandee: body.saisonRecommandee || null,
        // DEV3 #6 — opérateur, temps, météo, matériel
        operateurId: body.operateurId || null,
        tempsHeures: body.tempsHeures != null ? parseFloat(body.tempsHeures) : null,
        temperatureC: body.temperatureC != null ? parseFloat(body.temperatureC) : null,
        ventKmh: body.ventKmh != null ? parseFloat(body.ventKmh) : null,
        hygrometriePct: body.hygrometriePct != null ? parseInt(body.hygrometriePct) : null,
        pluie24h: body.pluie24h != null ? Boolean(body.pluie24h) : null,
        pluie24hMm: body.pluie24hMm != null ? parseFloat(body.pluie24hMm) : null,
        materiel: Array.isArray(body.materiel) ? body.materiel : [],
      },
      include: {
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
          },
        },
      },
    })

    // Auto-comptabilite : creer une depense si cout > 0
    if (operation.cout && operation.cout > 0) {
      try {
        await createDepenseFromOperationArbre(userId, {
          id: operation.id,
          type: operation.type,
          description: operation.description,
          cout: operation.cout,
          date: operation.date,
          fait: operation.fait,
        })
      } catch (autoComptaError) {
        console.error('Auto-compta error (operation_arbre POST):', autoComptaError)
      }
    }

    return NextResponse.json(operation, { status: 201 })
  } catch (err) {
    console.error("POST /api/arbres/operations error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la création de l'opération" },
      { status: 500 }
    )
  }
}
