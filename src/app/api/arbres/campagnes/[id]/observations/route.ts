/**
 * API Observations d'une campagne (suivi taux de reprise)
 * GET - Liste
 * POST - Ajouter une observation (et MAJ tauxReprise sur la campagne)
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

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
    select: { id: true, nombrePlants: true },
  })
  if (!campagne) {
    return NextResponse.json({ error: "Campagne non trouvée" }, { status: 404 })
  }

  const body = await request.json()
  const date = body.date ? new Date(body.date) : new Date()

  // Calcul du taux de reprise si possible
  let tauxReprise: number | null = body.tauxReprise ? parseFloat(body.tauxReprise) : null
  const nbVivants = body.nbVivants ? parseInt(body.nbVivants) : null
  const nbMorts = body.nbMorts ? parseInt(body.nbMorts) : null
  const nbManquants = body.nbManquants ? parseInt(body.nbManquants) : null

  if (tauxReprise === null && nbVivants !== null) {
    const total = (nbVivants || 0) + (nbMorts || 0) + (nbManquants || 0)
    if (total > 0) {
      tauxReprise = Math.round((nbVivants / total) * 1000) / 10
    } else if (campagne.nombrePlants && campagne.nombrePlants > 0) {
      tauxReprise = Math.round((nbVivants / campagne.nombrePlants) * 1000) / 10
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
      hauteurMoyenneCm: body.hauteurMoyenneCm ? parseFloat(body.hauteurMoyenneCm) : null,
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
