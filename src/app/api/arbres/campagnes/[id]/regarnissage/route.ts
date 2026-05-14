/**
 * Génération d'un brouillon de campagne "Regarnissage" depuis une cohorte
 * mère dont le taux de reprise < 90 % (PROMPT 24 §3).
 *
 * POST /api/arbres/campagnes/[id]/regarnissage
 *   → crée une CampagnePlantation enfant pré-remplie (mêmes essence,
 *     pépinière, porte-greffe, parcelle) et chaîne via campagneMereId.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { id } = await params
  const campagneId = parseInt(id, 10)

  const mere = await prisma.campagnePlantation.findFirst({
    where: { id: campagneId, userId: session.user.id },
  })
  if (!mere) return NextResponse.json({ error: "Cohorte introuvable" }, { status: 404 })
  if (!mere.nombrePlants) {
    return NextResponse.json({ error: "Nombre de plants initial inconnu" }, { status: 400 })
  }

  // Nombre de plants à recommander = différence entre initial et dernier observé
  const dernier = mere.nbPlantsRepriseAn3 ?? mere.nbPlantsRepriseAn2 ?? mere.nbPlantsRepriseAn1 ?? mere.nombrePlants
  const manquants = Math.max(0, mere.nombrePlants - dernier)

  const nouvelle = await prisma.campagnePlantation.create({
    data: {
      userId: session.user.id,
      nom: `Regarnissage ${mere.nom}`,
      typeFormation: mere.typeFormation,
      nature: "regarnissage",
      cause: "echec_plantation",
      peuplementPrecedent: mere.peuplementPrecedent,
      essencePrecedente: mere.essencePrecedente,
      porteGreffeId: mere.porteGreffeId,
      typePlant: mere.typePlant,
      conduite: mere.conduite,
      labelProvenance: mere.labelProvenance,
      parcelleGeoId: mere.parcelleGeoId,
      zoneVergerId: mere.zoneVergerId,
      surfaceHa: mere.surfaceHa,
      especeId: mere.especeId,
      essenceLibre: mere.essenceLibre,
      varieteOuProvenance: mere.varieteOuProvenance,
      nombrePlants: manquants,
      densitePlantsParHa: mere.densitePlantsParHa,
      ecartementRang: mere.ecartementRang,
      ecartementPlant: mere.ecartementPlant,
      pepiniere: mere.pepiniere,
      prixUnitaire: mere.prixUnitaire,
      budgetPrevu: manquants && mere.prixUnitaire ? manquants * mere.prixUnitaire : null,
      protectionType: mere.protectionType,
      objectifs: mere.objectifs,
      notes: `Brouillon généré automatiquement depuis "${mere.nom}" (taux de reprise ${
        mere.tauxReprise ?? "?"
      } %, manquants ${manquants}).`,
      statut: "planifiee",
      campagneMereId: mere.id,
    },
  })

  // Marque la mère comme regarnissage planifié
  await prisma.campagnePlantation.update({
    where: { id: mere.id },
    data: { regarnissagePlanifie: true },
  })

  return NextResponse.json({ data: nouvelle }, { status: 201 })
}
