/**
 * POST /api/arbres/:id/generer-calendrier
 * Génère automatiquement les opérations d'entretien pour un arbre
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { findTreeCareProfile, generateCareOperations } from "@/lib/tree-care-calendar"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const arbreId = parseInt(id)
    if (isNaN(arbreId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const arbre = await prisma.arbre.findFirst({
      where: { id: arbreId, userId: session!.user.id },
    })

    if (!arbre) {
      return NextResponse.json({ error: "Arbre non trouvé" }, { status: 404 })
    }

    if (!arbre.espece) {
      return NextResponse.json(
        { error: "L'arbre n'a pas d'espèce renseignée" },
        { status: 400 }
      )
    }

    // Ticket cmsofzh0w — le type de l'arbre borne la recherche : un
    // Châtaignier FORESTIER ne doit pas recevoir le calendrier fruitier.
    const profile = findTreeCareProfile(arbre.espece, arbre.type)
    if (!profile) {
      // Message explicite quand l'espèce existe au référentiel mais que la
      // conduite de l'arbre (forestier, ornement, haie) l'exclut.
      const profilAutreConduite = findTreeCareProfile(arbre.espece)
      const message = profilAutreConduite
        ? `"${arbre.espece}" est enregistré comme arbre de type "${arbre.type}" : le calendrier ${profilAutreConduite.type} du référentiel ne s'applique pas à cette conduite`
        : `Aucun calendrier d'entretien connu pour "${arbre.espece}"`
      return NextResponse.json({ error: message }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const currentYear = new Date().getFullYear()
    const year = body.year || currentYear

    // Plancher anti-retards artificiels : sur l'année courante (défaut), ne pas
    // recréer les opérations dont la FENÊTRE est déjà refermée — elles
    // naîtraient irréalisables (retour utilisateur 2026-07-31). Une fenêtre
    // encore ouverte est bien créée, même si sa date conseillée est passée. Une
    // année explicitement demandée via body.year reste générée en entier
    // (rattrapage historique).
    let from: Date | null = null
    if (!body.year || body.year === currentYear) {
      const now = new Date()
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }

    // Supprimer les anciennes opérations auto-générées pour cette annee
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)

    await prisma.operationArbre.deleteMany({
      where: {
        arbreId,
        userId: session!.user.id,
        notes: "auto:calendrier",
        // On ne supprime que les opérations non faites : les ops
        // auto-générées déjà réalisées sont de l'historique à préserver.
        fait: false,
        // Une fenêtre soldée explicitement ne doit pas être ressuscitée par une
        // régénération : l'utilisateur a acté qu'il ne la ferait pas cette année.
        abandonneeLe: null,
        datePrevue: { gte: startOfYear, lte: endOfYear },
      },
    })

    // QA Hélène 2026-05-15 — Bug #10 : passer la variété pour caler la
    // date de récolte sur les cultivars tardifs connus.
    const operations = generateCareOperations(profile, year, arbreId, session!.user.id, arbre.variete, from)
    if (operations.length > 0) {
      await prisma.operationArbre.createMany({ data: operations })
    }

    return NextResponse.json({
      count: operations.length,
      espece: profile.espece,
      year,
      operations,
    })
  } catch (err) {
    console.error("POST /api/arbres/[id]/generer-calendrier error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la génération du calendrier" },
      { status: 500 }
    )
  }
}
