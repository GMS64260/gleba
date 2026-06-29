/**
 * Saisie observation de reprise pour une cohorte (PROMPT 24).
 *
 * POST /api/arbres/campagnes/[id]/reprise
 *   body: { annee: 1|2|3, nbPlantsReprise: int, causes?: string[] }
 *
 * Calcule le taux de reprise correspondant (an1/an2/an3) en %, met à
 * jour les colonnes de la campagne et `tauxReprise` global = an1 si
 * c'est la première observation, sinon la dernière en date.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { z } from "zod"

interface Params {
  params: Promise<{ id: string }>
}

const schema = z.object({
  annee: z.coerce.number().int().min(1).max(3),
  nbPlantsReprise: z.coerce.number().int().min(0),
  causes: z.array(z.string()).optional().default([]),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { id } = await params
  const campagneId = parseInt(id, 10)
  if (isNaN(campagneId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 })
  }

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 })
    }
    const { annee, nbPlantsReprise, causes } = parsed.data

    const campagne = await prisma.campagnePlantation.findFirst({
      where: { id: campagneId, userId: session.user.id },
    })
    if (!campagne) return NextResponse.json({ error: "Cohorte introuvable" }, { status: 404 })
    if (!campagne.nombrePlants) {
      return NextResponse.json({ error: "Nombre de plants initial inconnu" }, { status: 400 })
    }

    const taux = Math.round((nbPlantsReprise / campagne.nombrePlants) * 1000) / 10
    const data: any = {
      mortaliteCauses: causes,
      dateDernObservation: new Date(),
    }
    if (annee === 1) { data.nbPlantsRepriseAn1 = nbPlantsReprise; data.tauxRepriseAn1 = taux }
    if (annee === 2) { data.nbPlantsRepriseAn2 = nbPlantsReprise; data.tauxRepriseAn2 = taux }
    if (annee === 3) { data.nbPlantsRepriseAn3 = nbPlantsReprise; data.tauxRepriseAn3 = taux }

    // POSTREVIEW Sprint 7 — tauxReprise global = taux de la PLUS GRANDE année
    // observée parmi {an1, an2, an3} ∪ {nouvelle saisie}. Avant : on écrasait
    // systématiquement avec `taux` → saisir N+1 après N+2 faisait remonter
    // le taux global, masquant la mortalité ultérieure.
    const candidats: Array<[number, number]> = []
    if (annee === 1 || campagne.tauxRepriseAn1 != null) candidats.push([1, annee === 1 ? taux : campagne.tauxRepriseAn1!])
    if (annee === 2 || campagne.tauxRepriseAn2 != null) candidats.push([2, annee === 2 ? taux : campagne.tauxRepriseAn2!])
    if (annee === 3 || campagne.tauxRepriseAn3 != null) candidats.push([3, annee === 3 ? taux : campagne.tauxRepriseAn3!])
    if (candidats.length > 0) {
      candidats.sort((a, b) => b[0] - a[0]) // tri descendant par année
      data.tauxReprise = candidats[0][1]
    }
    const tauxGlobalAfter: number = data.tauxReprise ?? taux

    // Si taux < 90 % et regarnissage pas encore planifié, on flag
    if (tauxGlobalAfter < 90 && !campagne.regarnissagePlanifie && !campagne.regarnissageRealiseDate) {
      data.regarnissagePlanifie = true
    }

    const updated = await prisma.campagnePlantation.update({
      where: { id: campagneId },
      data,
    })

    return NextResponse.json({ data: updated, suggererRegarnissage: tauxGlobalAfter < 90 })
  } catch (err) {
    console.error("POST /api/arbres/campagnes/[id]/reprise error:", err)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
