/**
 * GET /api/verger/essences-disponibles?type=<TypeFormation>
 *
 * Retourne la liste contextuelle d'essences à proposer dans l'Assistant
 * Plantation (étape 3) selon le `typeFormation` choisi à l'étape 1.
 *
 * Bug PROMPT 09 corrigé : avant ce endpoint, l'assistant proposait UNIQUEMENT
 * des essences forestières quelle que soit la sélection, même pour "Verger
 * fruitier" ou "Haie / Bocage" — alors que les fruitiers et bocagères existent
 * désormais dans le référentiel (PROMPT 08).
 *
 * Sources par type :
 *   forestier_futaie      → ESSENCES_FORESTIERES filtrées (futaie)
 *   forestier_taillis     → ESSENCES_FORESTIERES filtrées (taillis)
 *   bosquet               → ESSENCES_FORESTIERES + EssenceBocagere mellifères
 *   agroforesterie        → mix forestières + fruitiers + bocagères
 *   haie                  → EssenceBocagere (table Prisma)
 *   verger                → Espece WHERE type IN ('arbre_fruitier','petit_fruit')
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import {
  ESSENCES_FORESTIERES,
  getEssencesByType,
  type TypeFormation,
} from "@/data/essences-forestieres"

export type EssenceItem = {
  source: "forestiere" | "fruitier" | "bocagere"
  id: string // forestière.id | espece.id | essence_bocagere.id
  nom: string
  nomLatin: string
  croissance?: string
  conseils?: string
  // Pour fruitiers : indique si des porte-greffes existent en base.
  porteGreffeRequis?: boolean
}

const TYPES_VALIDES: ReadonlyArray<TypeFormation> = [
  "verger",
  "haie",
  "agroforesterie",
  "forestier_futaie",
  "forestier_taillis",
  "bosquet",
  "miscanthus",
]

export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") as TypeFormation | null

  if (!type || !TYPES_VALIDES.includes(type)) {
    return NextResponse.json(
      { error: `Paramètre 'type' requis (valeurs : ${TYPES_VALIDES.join(", ")})` },
      { status: 400 }
    )
  }

  const out: EssenceItem[] = []

  // 1) Source "forestière" — seulement pour les types compatibles.
  if (type === "forestier_futaie" || type === "forestier_taillis" || type === "bosquet" || type === "agroforesterie") {
    const forest = getEssencesByType(type)
    for (const e of forest) {
      out.push({
        source: "forestiere",
        id: `forestiere::${e.id}`,
        nom: e.nom,
        nomLatin: e.nomLatin,
        croissance: e.croissance,
        conseils: e.conseils,
      })
    }
  }

  // 2) Source "fruitier" — Espece WHERE type IN ('arbre_fruitier','petit_fruit').
  if (type === "verger" || type === "agroforesterie") {
    const fruitiers = await prisma.espece.findMany({
      where: { type: { in: ["arbre_fruitier", "petit_fruit"] } },
      select: {
        id: true,
        nomLatin: true,
        _count: { select: { portesGreffe: true } },
      },
      orderBy: { id: "asc" },
    })
    for (const f of fruitiers) {
      out.push({
        source: "fruitier",
        id: `fruitier::${f.id}`,
        nom: f.id,
        nomLatin: f.nomLatin ?? "",
        porteGreffeRequis: f._count.portesGreffe > 0,
      })
    }
  }

  // 3) Source "bocagère" — table EssenceBocagere.
  if (type === "haie" || type === "agroforesterie" || type === "bosquet") {
    const bocageres = await prisma.essenceBocagere.findMany({
      where: type === "bosquet" ? { roles: { has: "mellifère" } } : {},
      select: { id: true, nomCommun: true, nomLatin: true, croissance: true },
      orderBy: { nomCommun: "asc" },
    })
    for (const b of bocageres) {
      out.push({
        source: "bocagere",
        id: `bocagere::${b.id}`,
        nom: b.nomCommun,
        nomLatin: b.nomLatin,
        croissance: b.croissance,
      })
    }
  }

  // miscanthus : aucune source automatique, l'utilisateur saisit en libre.

  return NextResponse.json({ data: out, count: out.length, type })
}

// Export des objets statiques pour usage interne éventuel.
export { ESSENCES_FORESTIERES }
