import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import {
  acteurReglementaire,
  journaliserEvenementReglementaire,
} from "@/lib/elevage/audit-reglementaire"
import { chargerDeclarationsReglementaires } from "@/lib/elevage/declarations-reglementaires.server"

const currentYear = () => new Date().getUTCFullYear()

const yearSchema = z.coerce.number().int().min(1990).max(currentYear() + 1)

const suiviSchema = z.object({
  key: z.string().min(5).max(300),
  year: yearSchema,
  statut: z.enum(["A_DECLARER", "TRANSMISE", "ACCEPTEE", "REJETEE", "ANNULEE"]),
  transmisAt: z.coerce.date().optional(),
  canalTransmission: z.string().trim().min(2).max(100).optional(),
  referenceTransmission: z.string().trim().min(2).max(300).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const rawYear = new URL(request.url).searchParams.get("year") ?? String(currentYear())
  const parsedYear = yearSchema.safeParse(rawYear)
  if (!parsedYear.success) {
    return NextResponse.json({ error: "Année invalide" }, { status: 400 })
  }

  const resultat = await chargerDeclarationsReglementaires(session.user.id, {
    year: parsedYear.data,
  })
  return NextResponse.json(resultat)
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 })
  }
  const parsed = suiviSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const userId = session.user.id
  const data = parsed.data
  const resultat = await chargerDeclarationsReglementaires(userId, { year: data.year })
  const declaration = resultat.declarations.find((item) => item.key === data.key)
  if (!declaration) {
    return NextResponse.json({ error: "Déclaration introuvable pour cet exercice" }, { status: 404 })
  }

  if (data.statut === "TRANSMISE") {
    if (!data.canalTransmission || !data.referenceTransmission) {
      return NextResponse.json(
        { error: "Le canal et la référence ou preuve de transmission sont requis" },
        { status: 400 },
      )
    }
    if (declaration.anomalies.length > 0) {
      return NextResponse.json(
        { error: "Corrigez les informations obligatoires avant de marquer la déclaration transmise" },
        { status: 409 },
      )
    }
  }

  const suiviAvant = await prisma.declarationReglementaireSuivi.findUnique({
    where: { userId_declarationKey: { userId, declarationKey: data.key } },
    select: { statut: true, transmisAt: true },
  })
  if (["ACCEPTEE", "REJETEE"].includes(data.statut) && !suiviAvant?.transmisAt) {
    return NextResponse.json(
      { error: "Une déclaration doit être transmise avant d’être acceptée ou rejetée" },
      { status: 409 },
    )
  }

  const reset = data.statut === "A_DECLARER"
  const transmisAt = reset
    ? null
    : data.transmisAt ?? suiviAvant?.transmisAt ?? new Date()
  const suivi = await prisma.$transaction(async (tx) => {
    const updated = await tx.declarationReglementaireSuivi.upsert({
      where: { userId_declarationKey: { userId, declarationKey: data.key } },
      create: {
        userId,
        declarationKey: data.key,
        statut: data.statut,
        transmisAt,
        canalTransmission: reset ? null : data.canalTransmission ?? null,
        referenceTransmission: reset ? null : data.referenceTransmission ?? null,
        notes: data.notes ?? null,
        snapshot: reset ? Prisma.JsonNull : declaration.snapshot as Prisma.InputJsonValue,
        snapshotHash: reset ? null : declaration.snapshotHash,
      },
      update: {
        statut: data.statut,
        transmisAt,
        canalTransmission: reset ? null : data.canalTransmission ?? undefined,
        referenceTransmission: reset ? null : data.referenceTransmission ?? undefined,
        notes: data.notes ?? undefined,
        snapshot: reset ? Prisma.JsonNull : declaration.snapshot as Prisma.InputJsonValue,
        snapshotHash: reset ? null : declaration.snapshotHash,
      },
      select: {
        declarationKey: true,
        statut: true,
        transmisAt: true,
        canalTransmission: true,
        referenceTransmission: true,
      },
    })
    await journaliserEvenementReglementaire(tx, {
      userId,
      declarationKey: data.key,
      action: "STATUT_MODIFIE",
      actorUserId: acteurReglementaire(session.user),
      statutAvant: suiviAvant?.statut ?? declaration.statut,
      statutApres: data.statut,
      snapshotHash: reset ? null : declaration.snapshotHash,
      metadata: {
        year: data.year,
        canalTransmission: reset ? null : data.canalTransmission ?? null,
        referenceTransmission: reset ? null : data.referenceTransmission ?? null,
      },
    })
    return updated
  })

  return NextResponse.json({ data: suivi })
}
