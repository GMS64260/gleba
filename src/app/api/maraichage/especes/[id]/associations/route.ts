/**
 * Associations d'une espèce (PROMPT 23 §1).
 * GET /api/maraichage/especes/[id]/associations
 *   → { data: [{ associationId, nom, description, notes, type, partenaire }] }
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { getEspeceAliases } from "@/lib/especes/aliases"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requireAuthApi()
  if (error) return error
  const { id } = await params
  const especeId = decodeURIComponent(id)

  // Audit Marc 2026-05-14 — Bug 09 : les règles d'asso sont indexées
  // sur les noms génériques ("Pois", "Haricot", "Chou"). On élargit la
  // query à tous les alias connus pour que "Petit pois" remonte les
  // règles "Pois".
  const aliases = getEspeceAliases(especeId)

  const associations = await prisma.association.findMany({
    where: {
      details: { some: { especeId: { in: aliases } } },
    },
    include: { details: { include: { espece: { select: { id: true } } } } },
  })

  const data = associations.flatMap((a) => {
    // Audit Marc 2026-05-14 — Bug 19 : on lit le champ DB plutôt que de
    // parser le nom. Migration 20260514370000 a hydraté `type` à partir
    // de l'historique. Conversion "incompatible"/"neutre" → "defavorable"
    // pour préserver le contrat UI (qui distingue favorable/defavorable).
    const type: "favorable" | "defavorable" =
      a.type === "incompatible" ? "defavorable" : "favorable"
    // Un partenaire = tout détail qui n'est pas un alias de l'espèce
    // demandée (sinon on afficherait "Petit pois × Pois").
    const partenaires = a.details
      .filter((d) => d.especeId && !aliases.includes(d.especeId))
      .map((d) => d.especeId as string)
    const familles = a.details
      .filter((d) => d.familleId)
      .map((d) => d.familleId as string)
    const targets = partenaires.length > 0 ? partenaires : familles
    return targets.map((p) => ({
      associationId: a.id,
      nom: a.nom,
      description: a.description,
      notes: a.notes,
      type,
      partenaire: p,
      niveau: a.details.find((d) => d.especeId === p)?.groupe || "Espèce",
    }))
  })

  return NextResponse.json({ data })
}
