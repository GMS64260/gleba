/**
 * API Observations d'une campagne (suivi taux de reprise)
 * GET - Liste
 * POST - Ajouter une observation (et MAJ tauxReprise sur la campagne)
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { lireNombreObservation, NombreObservationInvalide } from "@/lib/verger/nombre-observation"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const { id } = await params
  const campagneId = parseInt(id, 10)
  if (isNaN(campagneId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 })
  }

  const campagne = await prisma.campagnePlantation.findFirst({
    where: { id: campagneId, userId: session!.user.id },
    select: { id: true },
  })
  if (!campagne) {
    return NextResponse.json({ error: "Campagne non trouvée" }, { status: 404 })
  }

  const observations = await prisma.observationCampagne.findMany({
    where: { campagneId, userId: session!.user.id },
    orderBy: { date: "desc" },
  })
  return NextResponse.json(observations)
}

export async function POST(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const { id } = await params
  const campagneId = parseInt(id, 10)
  if (isNaN(campagneId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 })
  }

  const campagne = await prisma.campagnePlantation.findFirst({
    where: { id: campagneId, userId: session!.user.id },
    select: { id: true, nombrePlants: true, statut: true, datePlantationReelle: true },
  })
  if (!campagne) {
    return NextResponse.json({ error: "Campagne non trouvée" }, { status: 404 })
  }

  // Ticket cmsog61e5 — une observation de reprise n'a pas de sens avant la
  // plantation (obs saisie le 11/08 sur une campagne planifiée au 20/11) :
  // datePlantationReelle est renseignée en cochant l'étape Plantation.
  if (!campagne.datePlantationReelle) {
    return NextResponse.json(
      { error: "La plantation n'a pas encore été réalisée : enregistrez d'abord l'étape Plantation" },
      { status: 400 }
    )
  }

  const body = await request.json()
  const date = body.date ? new Date(body.date) : new Date()

  // Valider toutes les saisies avant d'enregistrer ; zéro est une valeur présente.
  let tauxReprise: number | null
  let nbVivants: number | null
  let nbMorts: number | null
  let nbManquants: number | null
  let hauteurMoyenneCm: number | null
  try {
    tauxReprise = lireNombreObservation(body.tauxReprise, "tauxReprise")
    nbVivants = lireNombreObservation(body.nbVivants, "nbVivants")
    nbMorts = lireNombreObservation(body.nbMorts, "nbMorts")
    nbManquants = lireNombreObservation(body.nbManquants, "nbManquants")
    hauteurMoyenneCm = lireNombreObservation(body.hauteurMoyenneCm, "hauteurMoyenneCm")
  } catch (error) {
    if (error instanceof NombreObservationInvalide) {
      return NextResponse.json({ error: error.message, champ: error.champ }, { status: 400 })
    }
    throw error
  }

  // Calcul du taux de reprise si possible
  if (tauxReprise === null && nbVivants !== null) {
    // Audit #12 : le dénominateur du taux de reprise est le nombre de plants
    // PLANTÉS de la campagne (source de vérité). L'ancienne branche
    // vivants/(vivants+morts+manquants) surestimait le taux dès que des plants
    // disparus n'étaient pas comptés. On ne retombe sur la somme observée que
    // si la campagne n'a pas de nombre de plants renseigné.
    if (campagne.nombrePlants && campagne.nombrePlants > 0) {
      tauxReprise = Math.round((nbVivants / campagne.nombrePlants) * 1000) / 10
    } else {
      const total = nbVivants + (nbMorts || 0) + (nbManquants || 0)
      if (total > 0) {
        tauxReprise = Math.round((nbVivants / total) * 1000) / 10
      }
    }
  }

  const observation = await prisma.observationCampagne.create({
    data: {
      userId: session!.user.id,
      campagneId,
      date,
      nbVivants,
      nbMorts,
      nbManquants,
      tauxReprise,
      hauteurMoyenneCm,
      vigueur: body.vigueur || null,
      problemes: body.problemes || null,
      notes: body.notes || null,
    },
  })

  // Mise à jour de la campagne avec dernière observation
  if (tauxReprise !== null) {
    await prisma.campagnePlantation.update({
      where: { id: campagneId },
      data: {
        tauxReprise,
        dateDernObservation: date,
      },
    })
  }

  return NextResponse.json(observation, { status: 201 })
}
