/**
 * Associations d'une espèce (PROMPT 23 §1).
 * GET /api/maraichage/especes/[id]/associations
 *   → { data: [{ associationId, nom, description, notes, type, partenaire,
 *                partenaireId, niveau }] }
 *
 * Une ligne par partenaire. La règle du pivot, le classement et la priorité
 * de l'incompatible sont ceux des alertes (`associations-alertes.ts`) : la
 * fiche et les alertes ne doivent pas se contredire.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { getEspeceAliases } from "@/lib/especes/aliases"
import { classeAssociation, justificationPaire, partenairesSelonPivot } from "@/lib/associations-alertes"
import { estVisibleReferentiel } from "@/lib/referentiel-communaute"

interface Params {
  params: Promise<{ id: string }>
}

type LignePartenaire = {
  associationId: string
  nom: string
  description: string | null
  notes: string | null
  type: "favorable" | "defavorable"
  partenaire: string
  partenaireId: string | null
  niveau: string
}

/** Un identifiant contenant « % » n'est pas une séquence d'échappement valide. */
function decoderId(id: string): string {
  try {
    return decodeURIComponent(id)
  } catch {
    return id
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const { id } = await params
  const especeId = decoderId(id)

  // Audit Marc 2026-05-14 — Bug 09 : les règles d'asso sont indexées
  // sur les noms génériques ("Pois", "Haricot", "Chou"). On élargit la
  // query à tous les alias connus pour que "Petit pois" remonte les
  // règles "Pois".
  const aliases = getEspeceAliases(especeId)
  const estSujet = (candidat: string) => aliases.includes(candidat)

  try {
    const associations = await prisma.association.findMany({
      where: {
        details: { some: { especeId: { in: aliases } } },
      },
      include: {
        details: {
          orderBy: { id: "asc" },
          include: {
            espece: { select: { id: true, nom: true, userId: true, partageCommunaute: true } },
          },
        },
      },
      orderBy: { id: "asc" },
    })

    // Une ligne par partenaire : le référentiel porte des doublons et une
    // contradiction (groseillier ↔ haricot). L'incompatible l'emporte, puis la
    // règle de plus petit identifiant, comme dans les alertes.
    const parPartenaire = new Map<string, LignePartenaire>()
    const retenir = (cle: string, ligne: LignePartenaire) => {
      const existante = parPartenaire.get(cle)
      if (existante && (existante.type === "defavorable" || ligne.type !== "defavorable")) return
      parPartenaire.set(cle, ligne)
    }

    const triees = [...associations].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    for (const a of triees) {
      // Le champ `type` fait foi (migration 20260514370000). Une association
      // neutre n'est ni un compagnon ni une incompatibilité : on ne la montre
      // pas, plutôt que de la ranger parmi les favorables.
      const type = classeAssociation(a.type, a.nom)
      if (type === "neutre") continue

      // Feedback Marc 2026-05-16 — Bug 03 : une règle est en étoile (« Poireau + »
      // = Poireau avec Artichaut, Asperge, Moutarde, Tomate). Sur la fiche
      // Tomate, seul Poireau est partenaire.
      const sujets = a.details.filter((d) => d.especeId && estSujet(d.especeId))
      const sujet = sujets.find((d) => d.requise) ?? sujets[0]
      if (!sujet) continue
      const base = { associationId: a.id, nom: a.nom, notes: a.notes, type }

      const partenaires = partenairesSelonPivot(a.details, estSujet)
      for (const d of partenaires) {
        const partenaireId = d.especeId as string
        // L'espèce personnelle d'un autre compte n'a pas à être nommée ici.
        if (d.espece && !estVisibleReferentiel(d.espece, session.user.id)) continue
        retenir(`e:${partenaireId.toLowerCase()}`, {
          ...base,
          description: justificationPaire(a, sujet, d),
          partenaire: d.espece?.nom?.trim() || partenaireId,
          partenaireId,
          niveau: d.groupe || "Espèce",
        })
      }
      if (partenaires.length > 0) continue

      // Aucune espèce en face : la règle vise une famille ou un groupe. Seules
      // les lignes SANS espèce comptent ; la famille portée par une ligne
      // d'espèce n'en est que l'annotation (celle du fenouil sur « Chou
      // Fenouil ! »), pas un partenaire.
      for (const d of a.details) {
        if (d.especeId) continue
        const libelle = d.groupe?.trim() || d.familleId
        if (!libelle) continue
        retenir(`f:${libelle.toLowerCase()}`, {
          ...base,
          description: justificationPaire(a, sujet, d),
          partenaire: libelle,
          partenaireId: null,
          niveau: d.groupe?.trim() ? "Groupe" : "Famille",
        })
      }
    }

    return NextResponse.json({ data: Array.from(parPartenaire.values()) })
  } catch (e) {
    console.error("GET /api/maraichage/especes/[id]/associations error:", e)
    return NextResponse.json(
      { error: "Erreur lors du chargement des associations de l'espèce" },
      { status: 500 }
    )
  }
}
