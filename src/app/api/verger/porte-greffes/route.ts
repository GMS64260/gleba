/**
 * GET  /api/verger/porte-greffes[?especeId=<Pommier|Poirier|...>]
 *
 * - Avec `especeId` : retourne les porte-greffes adaptés à cette espèce
 *   (relation many-to-many `porte_greffe_especes`). Utilisé dans l'Assistant
 *   Plantation et dans la fiche Arbre pour le dropdown contextuel.
 * - Sans `especeId` (Bug #4) : retourne tous les porte-greffes avec leurs
 *   espèces compatibles, pour l'onglet Référentiel.
 *
 * Dans les deux cas la visibilité communautaire s'applique : Gleba officiel
 * (userId null) + communauté (partagé) + perso courant (cf.
 * src/lib/referentiel-communaute.ts).
 *
 * POST /api/verger/porte-greffes — création (admin → Gleba officiel ;
 * utilisateur → perso proposé/privé).
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { statsAvisPourRefs } from "@/lib/avis/stats-liste"
import type { Prisma } from "@prisma/client"
import {
  visibiliteReferentiel,
  attributionCreation,
} from "@/lib/referentiel-communaute"

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const especeId = searchParams.get("especeId")
  const includeAvis = searchParams.get("avis") === "1"

  const vis = visibiliteReferentiel(session!.user.id)

  if (especeId) {
    const where: Prisma.PorteGreffeWhereInput = {
      AND: [{ especes: { some: { especeId } } }, vis],
    }
    const portesGreffe = await prisma.porteGreffe.findMany({
      where,
      select: {
        id: true,
        nom: true,
        vigueur: true,
        precocite: true,
        sensibilites: true,
        drageonnement: true,
        notes: true,
        userId: true,
        partageCommunaute: true,
      },
      orderBy: { vigueur: "asc" },
    })
    return NextResponse.json({ data: portesGreffe, count: portesGreffe.length })
  }

  // Bug #4 — Référentiel global avec les espèces compatibles incluses.
  const all = await prisma.porteGreffe.findMany({
    where: vis,
    select: {
      id: true,
      nom: true,
      vigueur: true,
      precocite: true,
      sensibilites: true,
      drageonnement: true,
      notes: true,
      userId: true,
      partageCommunaute: true,
      especes: { select: { especeId: true } },
    },
    orderBy: [{ nom: "asc" }],
  })
  const statsMap = includeAvis
    ? await statsAvisPourRefs(prisma, 'PORTE_GREFFE', all.map((pg) => pg.id))
    : null
  const flat = all.map((pg) => ({
    ...pg,
    especesCompatibles: pg.especes.map((e) => e.especeId),
    ...(statsMap ? { avisStats: statsMap.get(pg.id) } : {}),
  }))
  return NextResponse.json({ data: flat, count: flat.length })
}

// POST — création (admin → Gleba officiel ; user → perso proposé/privé).
export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === "ADMIN"

  try {
    const body = await request.json()

    const nom = typeof body.nom === "string" ? body.nom.trim() : ""
    if (!nom) {
      return NextResponse.json(
        { error: "Le nom du porte-greffe est requis." },
        { status: 400 }
      )
    }

    // `nom` est unique en base : on signale explicitement le doublon.
    const existing = await prisma.porteGreffe.findUnique({ where: { nom } })
    if (existing) {
      return NextResponse.json(
        { error: `Le porte-greffe "${nom}" existe déjà.` },
        { status: 409 }
      )
    }

    const { userId, partageCommunaute } = attributionCreation(
      isAdmin,
      session!.user.id,
      body.partageCommunaute === true
    )

    const porteGreffe = await prisma.porteGreffe.create({
      data: {
        nom,
        vigueur: typeof body.vigueur === "number" ? body.vigueur : 3,
        precocite: typeof body.precocite === "number" ? body.precocite : 3,
        sensibilites: Array.isArray(body.sensibilites) ? body.sensibilites : [],
        drageonnement: body.drageonnement === true,
        notes: typeof body.notes === "string" ? body.notes : null,
        userId,
        partageCommunaute,
      },
    })

    return NextResponse.json(porteGreffe, { status: 201 })
  } catch (err) {
    console.error("POST /api/verger/porte-greffes error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la création du porte-greffe" },
      { status: 500 }
    )
  }
}
