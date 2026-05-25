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
    include: {
      details: {
        orderBy: { id: "asc" },
        include: { espece: { select: { id: true } } },
      },
    },
  })

  const data = associations.flatMap((a) => {
    // Audit Marc 2026-05-14 — Bug 19 : on lit le champ DB plutôt que de
    // parser le nom. Migration 20260514370000 a hydraté `type` à partir
    // de l'historique. Conversion "incompatible"/"neutre" → "defavorable"
    // pour préserver le contrat UI (qui distingue favorable/defavorable).
    const type: "favorable" | "defavorable" =
      a.type === "incompatible" ? "defavorable" : "favorable"
    // Feedback Marc 2026-05-16 — Bug 03 : pour les règles "groupe"
    // (ex: « Poireau + » = Poireau favorable avec Artichaut/Asperge/
    // Moutarde/Tomate), le sujet est UN détail (le premier inséré) et
    // les autres sont SES partenaires. Quand on consulte la fiche
    // Tomate, on ne doit donc PAS afficher Artichaut/Asperge/Moutarde
    // comme partenaires de Tomate — seul Poireau l'est.
    //
    // Règle générale :
    //   - subject = premier détail (orderBy id asc)
    //   - si subject ∈ aliases du queried espece ⇒ tous les autres
    //     détails sont des partenaires de notre espèce.
    //   - sinon ⇒ seul le subject est le partenaire de notre espèce
    //     (notre espèce figure dans la liste mais n'est pas sujet).
    const detailsEspece = a.details.filter((d) => d.especeId)
    const subject = detailsEspece[0]?.especeId ?? null
    const subjectIsOurs = subject != null && aliases.includes(subject)
    const partenaires: string[] = subjectIsOurs
      ? detailsEspece
          .filter((d) => d.especeId && !aliases.includes(d.especeId))
          .map((d) => d.especeId as string)
      : subject
        ? [subject]
        : []
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
