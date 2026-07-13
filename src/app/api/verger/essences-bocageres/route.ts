/**
 * GET  /api/verger/essences-bocageres[?role=brise-vent|mellifère|...]
 * POST /api/verger/essences-bocageres — création perso / Gleba officiel.
 *
 * PROMPT DEV 2 Bug #4 — Sous-référentiel essences bocagères/forestières.
 *
 * Pour l'onglet Référentiel : toutes les essences visibles avec leurs rôles
 * écologiques (brise-vent, mellifère, refuge auxiliaires, bois énergie…),
 * harmonisé sur le modèle communauté/perso (cf. src/lib/referentiel-communaute.ts).
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import type { Prisma } from "@prisma/client"
import {
  visibiliteReferentiel,
  attributionCreation,
} from "@/lib/referentiel-communaute"

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const sp = request.nextUrl.searchParams
  const role = sp.get("role")

  const vis = visibiliteReferentiel(session!.user.id)
  const where: Prisma.EssenceBocagereWhereInput = role
    ? { AND: [{ roles: { has: role } }, vis] }
    : vis

  const essences = await prisma.essenceBocagere.findMany({
    where,
    orderBy: [{ nomCommun: "asc" }],
  })

  return NextResponse.json({ data: essences, count: essences.length })
}

// POST — création (admin → Gleba officiel ; user → perso proposé/privé).
export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === "ADMIN"

  try {
    const body = await request.json()

    const nomCommun = typeof body.nomCommun === "string" ? body.nomCommun.trim() : ""
    const nomLatin = typeof body.nomLatin === "string" ? body.nomLatin.trim() : ""
    if (!nomCommun || !nomLatin) {
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

    const essence = await prisma.essenceBocagere.create({
      data: {
        nomCommun,
        nomLatin,
        hauteurM: typeof body.hauteurM === "number" ? body.hauteurM : 0,
        croissance: typeof body.croissance === "string" ? body.croissance : "Moyenne",
        roles: Array.isArray(body.roles) ? body.roles : [],
        persistant: body.persistant === true,
        epineux: body.epineux === true,
        notes: typeof body.notes === "string" ? body.notes : null,
        userId,
        partageCommunaute,
      },
    })

    return NextResponse.json(essence, { status: 201 })
  } catch (err) {
    console.error("POST /api/verger/essences-bocageres error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la création de l'essence bocagère" },
      { status: 500 }
    )
  }
}
