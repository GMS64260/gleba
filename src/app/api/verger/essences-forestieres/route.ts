/**
 * GET  /api/verger/essences-forestieres — référentiel communautaire des
 *      essences forestières (Gleba officiel + communauté + perso courant).
 * POST /api/verger/essences-forestieres — création :
 *   - Admin : catalogue Gleba officiel (userId null).
 *   - Utilisateur : perso (userId = lui), proposé à la communauté ou privé.
 *
 * Harmonisé sur le modèle communauté/perso (cf. src/lib/referentiel-communaute.ts),
 * comme les espèces/variétés.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import {
  visibiliteReferentiel,
  attributionCreation,
} from "@/lib/referentiel-communaute"

// GET — liste visible.
export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const essences = await prisma.essenceForestiere.findMany({
      where: visibiliteReferentiel(session!.user.id),
      orderBy: [{ nom: "asc" }],
    })
    return NextResponse.json({ data: essences, count: essences.length })
  } catch (err) {
    console.error("GET /api/verger/essences-forestieres error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des essences forestières" },
      { status: 500 }
    )
  }
}

// POST — création (admin → Gleba officiel ; user → perso proposé/privé).
export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === "ADMIN"

  try {
    const body = await request.json()

    const nom = typeof body.nom === "string" ? body.nom.trim() : ""
    const nomLatin = typeof body.nomLatin === "string" ? body.nomLatin.trim() : ""
    if (!nom || !nomLatin) {
      return NextResponse.json(
        { error: "Le nom commun et le nom latin sont requis." },
        { status: 400 }
      )
    }

    const { userId, partageCommunaute } = attributionCreation(
      isAdmin,
      session!.user.id,
      body.partageCommunaute === true
    )

    const essence = await prisma.essenceForestiere.create({
      data: {
        nom,
        nomLatin,
        categorie: typeof body.categorie === "string" ? body.categorie : "feuillu",
        usages: Array.isArray(body.usages) ? body.usages : [],
        densitesParHa: (body.densitesParHa ?? {}) as object,
        croissance: typeof body.croissance === "string" ? body.croissance : "moyenne",
        sols: Array.isArray(body.sols) ? body.sols : [],
        expositions: Array.isArray(body.expositions) ? body.expositions : [],
        cycleAnsRecolte:
          typeof body.cycleAnsRecolte === "number" ? body.cycleAnsRecolte : null,
        conseils: typeof body.conseils === "string" ? body.conseils : null,
        userId,
        partageCommunaute,
      },
    })

    return NextResponse.json(essence, { status: 201 })
  } catch (err) {
    console.error("POST /api/verger/essences-forestieres error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la création de l'essence forestière" },
      { status: 500 }
    )
  }
}
