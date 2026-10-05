/**
 * POST /api/arbres/:id/dupliquer   body: { nombre?: number }  (1 à 20)
 *
 * Crée `nombre` copies de l'arbre : mêmes caractéristiques (type, espèce,
 * variété, porte-greffe, conduite, plantation, achat, parcelle, envergure),
 * noms numérotés depuis le nom de base, positions alignées à droite de la
 * source sur le plan. Ce qui est propre à un individu n'est pas copié : GPS,
 * circonférence, notes, état, historique. Chaque copie reçoit son calendrier
 * d'entretien comme à la création (même geste que POST /api/arbres).
 *
 * Une seule route pour le plan du jardin et la liste du verger : voir
 * `src/lib/verger/duplication-arbre.ts` pour l'origine (friction 2026-10-05).
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { genererCalendrierEntretien } from "@/lib/verger/creation-arbre"
import { planCopiesArbre } from "@/lib/verger/duplication-arbre"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  try {
    const { id } = await params
    const arbreId = parseInt(id)
    if (isNaN(arbreId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const nombre = Number(body?.nombre ?? 1)
    if (!Number.isInteger(nombre) || nombre < 1 || nombre > 20) {
      return NextResponse.json(
        { error: "Le nombre de copies doit être un entier entre 1 et 20" },
        { status: 400 }
      )
    }

    const source = await prisma.arbre.findFirst({ where: { id: arbreId, userId } })
    if (!source) {
      return NextResponse.json({ error: "Arbre non trouvé" }, { status: 404 })
    }

    const existants = await prisma.arbre.findMany({ where: { userId }, select: { nom: true } })
    const plan = planCopiesArbre(
      { nom: source.nom, posX: source.posX ?? 0, posY: source.posY ?? 0, envergure: source.envergure ?? 2 },
      nombre,
      existants.map((a) => a.nom)
    )

    const creees = await prisma.$transaction(
      plan.map((copie) =>
        prisma.arbre.create({
          data: {
            userId,
            nom: copie.nom,
            posX: copie.posX,
            posY: copie.posY,
            type: source.type,
            espece: source.espece,
            especeId: source.especeId,
            variete: source.variete,
            portGreffe: source.portGreffe,
            porteGreffeId: source.porteGreffeId,
            fournisseur: source.fournisseur,
            dateAchat: source.dateAchat,
            prixAchat: source.prixAchat,
            datePlantation: source.datePlantation,
            age: source.age,
            envergure: source.envergure,
            envergureAdulte: source.envergureAdulte,
            hauteur: source.hauteur,
            pollinisateur: source.pollinisateur,
            couleur: source.couleur,
            productif: source.productif,
            anneeProduction: source.anneeProduction,
            rendementMoyen: source.rendementMoyen,
            formeTaille: source.formeTaille,
            vigueur: source.vigueur,
            distancePlantation: source.distancePlantation,
            distanceRang: source.distanceRang,
            orientationRang: source.orientationRang,
            dateGreffe: source.dateGreffe,
            typeGreffe: source.typeGreffe,
            heuresFroidRequis: source.heuresFroidRequis,
            floraison: source.floraison,
            groupePollinisation: source.groupePollinisation,
            autofertile: source.autofertile,
            periodeRecolte: source.periodeRecolte,
            conservation: source.conservation,
            zoneId: source.zoneId,
            parcelleGeoId: source.parcelleGeoId,
          },
        })
      )
    )

    let calendriers = 0
    for (const arbre of creees) {
      if (await genererCalendrierEntretien(arbre, userId)) calendriers++
    }

    return NextResponse.json(
      { arbres: creees.map((a) => ({ id: a.id, nom: a.nom })), calendriers },
      { status: 201 }
    )
  } catch (err) {
    console.error("POST /api/arbres/[id]/dupliquer error:", err)
    return NextResponse.json({ error: "Erreur lors de la duplication de l'arbre" }, { status: 500 })
  }
}
