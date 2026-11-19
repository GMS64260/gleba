/**
 * Associations d'une espèce (PROMPT 23 §1).
 * GET /api/maraichage/especes/[id]/associations
 *   → { data: [{ associationId, nom, description, notes, type, partenaire,
 *                partenaireId, niveau }] }
 *
 * Une ligne par partenaire. Le verdict de chaque paire vient du moteur des
 * alertes (`evaluerPairesAssociations`) : la fiche et les alertes ne peuvent
 * pas se contredire.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import {
  aliasMinuscules,
  chargerContexteEspeces,
  classeAssociation,
  evaluerPairesAssociations,
  justificationPaire,
  partenairesSelonPivot,
  whereAssociationsConcernant,
} from "@/lib/associations-alertes"
import { estVisibleReferentiel, visibiliteReferentiel } from "@/lib/referentiel-communaute"

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

  // Les règles du référentiel sont indexées sur les noms génériques (« Pois »,
  // « Haricot », « Chou ») : alias, groupes et familles sont lus comme dans
  // les alertes (`whereAssociationsConcernant`).
  const aliases = aliasMinuscules(especeId)
  const estSujet = (candidat: string) => aliases.includes(candidat.toLowerCase())

  try {
    const contexteSujet = await chargerContexteEspeces(prisma, [especeId], session.user.id)
    const associations = await prisma.association.findMany({
      where: whereAssociationsConcernant([especeId], contexteSujet, session.user.id),
      include: {
        details: {
          where: { OR: [{ especeId: null }, { espece: { is: visibiliteReferentiel(session.user.id) } }] },
          orderBy: { id: "asc" },
          include: {
            espece: { select: { id: true, nom: true, userId: true, partageCommunaute: true } },
          },
        },
      },
      orderBy: { id: "asc" },
    })
    const triees = [...associations].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

    // Espèces en face, dans l'ordre des règles. L'espèce personnelle d'un
    // autre compte n'a pas à être nommée ici.
    const candidats = new Map<string, string>()
    for (const a of triees) {
      for (const d of a.details) {
        if (!d.especeId || estSujet(d.especeId)) continue
        if (d.espece && !estVisibleReferentiel(d.espece, session.user.id)) continue
        if (!candidats.has(d.especeId.toLowerCase())) candidats.set(d.especeId.toLowerCase(), d.especeId)
      }
    }
    const contexte = await chargerContexteEspeces(prisma, [especeId, ...candidats.values()], session.user.id)

    // Une ligne par partenaire. Le verdict de chaque paire est celui du moteur
    // des alertes (règle la plus précise, puis l'incompatible, puis le plus
    // petit identifiant) : la fiche et les alertes ne peuvent pas se contredire.
    const parPartenaire = new Map<string, LignePartenaire>()
    for (const [cle, partenaireId] of candidats) {
      const [verdict] = evaluerPairesAssociations(triees, [especeId, partenaireId], contexte)
      if (!verdict) continue
      const ligne = verdict.details[1]
      parPartenaire.set(`e:${cle}`, {
        associationId: verdict.association.id,
        nom: verdict.association.nom,
        notes: verdict.association.notes,
        type: verdict.alerte.type,
        description: verdict.justification,
        partenaire: contexte.get(cle)?.nom?.trim() || ligne.espece?.nom?.trim() || partenaireId,
        partenaireId,
        niveau: ligne.groupe || "Espèce",
      })
    }

    // Règles qui visent une famille ou un groupe, sans espèce en face. Seules
    // les lignes SANS espèce comptent ; la famille portée par une ligne
    // d'espèce n'en est que l'annotation (celle du fenouil sur « Chou
    // Fenouil ! »), pas un partenaire. À libellé égal, l'incompatible l'emporte.
    const retenir = (cle: string, ligne: LignePartenaire) => {
      const existante = parPartenaire.get(cle)
      if (existante && (existante.type === "defavorable" || ligne.type !== "defavorable")) return
      parPartenaire.set(cle, ligne)
    }
    for (const a of triees) {
      const type = classeAssociation(a.type, a.nom)
      if (type === "neutre") continue
      const sujets = a.details.filter((d) => d.especeId && estSujet(d.especeId))
      const sujet = sujets.find((d) => d.requise) ?? sujets[0]
      if (!sujet || partenairesSelonPivot(a.details, estSujet).length > 0) continue
      for (const d of a.details) {
        if (d.especeId) continue
        const libelle = d.groupe?.trim() || d.familleId
        if (!libelle) continue
        retenir(`f:${libelle.toLowerCase()}`, {
          associationId: a.id,
          nom: a.nom,
          notes: a.notes,
          type,
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
