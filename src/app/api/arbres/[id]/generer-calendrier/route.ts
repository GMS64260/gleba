/**
 * POST /api/arbres/:id/generer-calendrier
 * Génère automatiquement les opérations d'entretien pour un arbre
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { findTreeCareProfile } from "@/lib/tree-care-calendar"
import { jourDePlantation, planCalendrierEntretien } from "@/lib/verger/creation-arbre"

/** Bornes d'une année demandée explicitement (rattrapage ou anticipation). */
const ANNEE_MIN = 1900
const ECART_ANNEE_MAX = 5

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
    const anneeDemandee = body?.year === undefined || body?.year === null ? null : Number(body.year)
    const anneeMax = new Date().getFullYear() + ECART_ANNEE_MAX
    if (
      anneeDemandee !== null &&
      (!Number.isInteger(anneeDemandee) || anneeDemandee < ANNEE_MIN || anneeDemandee > anneeMax)
    ) {
      return NextResponse.json(
        { error: `Année invalide : choisissez une année entre ${ANNEE_MIN} et ${anneeMax}.`, champ: "year" },
        { status: 400 }
      )
    }

    // Même règle que la création (`planCalendrierEntretien`) : plancher
    // « aujourd'hui » sur l'année courante (défaut), aucune opération avant la
    // plantation, pas de récolte sur un arbre non productif ; une autre année
    // demandée via body.year reste générée en entier (rattrapage historique).
    // QA Hélène 2026-05-15, bug #10 : la variété cale la date de récolte.
    const { annee: year, operations } = planCalendrierEntretien(
      profile,
      arbre,
      session!.user.id,
      { annee: anneeDemandee },
    )

    // Supprimer les anciennes opérations auto-générées pour cette année, et,
    // toutes années confondues, celles qui précèdent la plantation : une date
    // de plantation corrigée après coup (le PUT de l'arbre ne touche pas au
    // calendrier) laissait dans « À faire » des gestes antérieurs à la mise en
    // terre (revue du 2026-10-25).
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)
    const plantation = jourDePlantation(arbre.datePlantation)

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
        OR: [
          { datePrevue: { gte: startOfYear, lte: endOfYear } },
          ...(plantation ? [{ datePrevue: { lt: plantation } }] : []),
        ],
      },
    })

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
