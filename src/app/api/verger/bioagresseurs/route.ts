/**
 * GET /api/verger/bioagresseurs[?type=Maladie|Ravageur|Adventice][?especeId=...]
 *
 * PROMPT DEV 2 Bug #4 — Sous-référentiel bioagresseurs.
 *
 * Retourne tous les bioagresseurs du référentiel verger avec leurs espèces
 * cibles. Filtres optionnels : type (Maladie/Ravageur/Adventice), especeId.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  const sp = request.nextUrl.searchParams
  const type = sp.get("type")
  const especeId = sp.get("especeId")

  const where: Record<string, unknown> = {}
  if (type) where.type = type
  if (especeId) {
    where.especes = { some: { especeId } }
  } else {
    // Bug cmp8rdt33 (Marc 2026-05-16) — le référentiel Verger affichait
    // tous les bioagresseurs (y compris Doryphore, Mildiou tomate, etc.).
    // On ne garde que ceux dont au moins une espèce cible est un arbre
    // fruitier ou un petit fruit. Les bioagresseurs sans cible (adventices
    // génériques type Chiendent/Liseron) restent hors du référentiel verger.
    where.especes = {
      some: {
        espece: {
          type: { in: ["arbre_fruitier", "petit_fruit"] },
        },
      },
    }
  }

  const bioagresseurs = await prisma.bioagresseur.findMany({
    where,
    select: {
      id: true,
      nomCommun: true,
      nomLatin: true,
      type: true,
      organeCible: true,
      periodePression: true,
      methodesPbi: true,
      seuilNuisibilite: true,
      notes: true,
      especes: {
        select: {
          especeId: true,
          espece: { select: { type: true } },
        },
      },
    },
    orderBy: [{ type: "asc" }, { nomCommun: "asc" }],
  })

  // Pour les bioagresseurs mixtes (ex: Pourriture grise sur Fraisier + Tomate),
  // on n'expose que les cibles pertinentes au module verger.
  const flat = bioagresseurs.map((b) => ({
    id: b.id,
    nomCommun: b.nomCommun,
    nomLatin: b.nomLatin,
    type: b.type,
    organeCible: b.organeCible,
    periodePression: b.periodePression,
    methodesPbi: b.methodesPbi,
    seuilNuisibilite: b.seuilNuisibilite,
    notes: b.notes,
    especesCibles: b.especes
      .filter((e) => ["arbre_fruitier", "petit_fruit"].includes(e.espece?.type ?? ""))
      .map((e) => e.especeId),
  }))

  return NextResponse.json({ data: flat, count: flat.length })
}
