import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import {
  acteurReglementaire,
  journaliserEvenementReglementaire,
} from "@/lib/elevage/audit-reglementaire"
import { empreinteDeclaration } from "@/lib/elevage/declarations-reglementaires"
import {
  ErreurFichierJustificatif,
  verifierFichierJustificatif,
} from "@/lib/elevage/justificatif-fichier.server"
import {
  justificatifAlimentArchiveSchema,
  justificatifAlimentMutationSchema,
} from "@/lib/elevage/justificatifs-aliments"
import prisma from "@/lib/prisma"

class ErreurJustificatifAliment extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const currentYear = () => new Date().getUTCFullYear()
const yearSchema = z.coerce.number().int().min(1990).max(currentYear() + 1)

const jsonAudit = (value: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>

async function verifierAlimentAccessible(
  tx: Prisma.TransactionClient,
  alimentId: string | null | undefined,
  userId: string,
) {
  if (!alimentId) return
  const aliment = await tx.aliment.findFirst({
    where: {
      id: alimentId,
      OR: [{ ownerUserId: null }, { ownerUserId: userId }],
    },
    select: { id: true },
  })
  if (!aliment) {
    throw new ErreurJustificatifAliment(
      "Aliment introuvable ou inaccessible pour ce compte",
      404,
    )
  }
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const rawYear = new URL(request.url).searchParams.get("year") ?? String(currentYear())
  const parsedYear = yearSchema.safeParse(rawYear)
  if (!parsedYear.success) {
    return NextResponse.json({ error: "Année invalide" }, { status: 400 })
  }
  const debut = new Date(Date.UTC(parsedYear.data, 0, 1))
  const fin = new Date(Date.UTC(parsedYear.data + 1, 0, 1))

  const data = await prisma.justificatifAlimentElevage.findMany({
    where: {
      userId: session.user.id,
      dateDocument: { gte: debut, lt: fin },
    },
    orderBy: [{ archivedAt: "asc" }, { dateDocument: "desc" }, { createdAt: "desc" }],
    include: {
      aliment: { select: { id: true, nom: true } },
    },
  })
  return NextResponse.json({ data, year: parsedYear.data })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const parsed = justificatifAlimentMutationSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const fichier = parsed.data.data.fichierUrl
      ? await verifierFichierJustificatif(
          session.user.id,
          parsed.data.data.fichierUrl,
        )
      : { tailleOctets: null, empreinteSha256: null }

    const created = await prisma.$transaction(async (tx) => {
      await verifierAlimentAccessible(
        tx,
        parsed.data.data.alimentId,
        session.user.id,
      )
      const result = await tx.justificatifAlimentElevage.create({
        data: {
          userId: session.user.id,
          ...parsed.data.data,
          ...fichier,
        },
        include: { aliment: { select: { id: true, nom: true } } },
      })
      const snapshot = jsonAudit(result)
      await journaliserEvenementReglementaire(tx, {
        userId: session.user.id,
        declarationKey: `justificatif-aliment:${result.id}`,
        action: "JUSTIFICATIF_ALIMENT_CREE",
        actorUserId: acteurReglementaire(session.user),
        snapshotHash: empreinteDeclaration(snapshot),
        metadata: {
          objectType: "justificatif_aliment",
          objectId: result.id,
          after: snapshot,
        },
      })
      return result
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (err) {
    if (err instanceof ErreurFichierJustificatif) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    if (err instanceof ErreurJustificatifAliment) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("POST /api/elevage/justificatifs-aliments error:", err)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const parsed = justificatifAlimentMutationSchema.safeParse(await request.json())
    if (!parsed.success || !parsed.data.id) {
      return NextResponse.json(
        {
          error: "Données invalides",
          details: parsed.success ? { fieldErrors: { id: ["Identifiant requis"] } } : parsed.error.flatten(),
        },
        { status: 400 },
      )
    }
    const fichier = parsed.data.data.fichierUrl
      ? await verifierFichierJustificatif(
          session.user.id,
          parsed.data.data.fichierUrl,
        )
      : { tailleOctets: null, empreinteSha256: null }

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.justificatifAlimentElevage.findFirst({
        where: { id: parsed.data.id, userId: session.user.id },
        include: { aliment: { select: { id: true, nom: true } } },
      })
      if (!before) {
        throw new ErreurJustificatifAliment("Justificatif introuvable", 404)
      }
      await verifierAlimentAccessible(
        tx,
        parsed.data.data.alimentId,
        session.user.id,
      )
      const result = await tx.justificatifAlimentElevage.update({
        where: { id: before.id },
        data: {
          ...parsed.data.data,
          ...fichier,
        },
        include: { aliment: { select: { id: true, nom: true } } },
      })
      const beforeAudit = jsonAudit(before)
      const afterAudit = jsonAudit(result)
      await journaliserEvenementReglementaire(tx, {
        userId: session.user.id,
        declarationKey: `justificatif-aliment:${result.id}`,
        action: "JUSTIFICATIF_ALIMENT_MODIFIE",
        actorUserId: acteurReglementaire(session.user),
        snapshotHash: empreinteDeclaration(afterAudit),
        metadata: {
          objectType: "justificatif_aliment",
          objectId: result.id,
          before: beforeAudit,
          after: afterAudit,
        },
      })
      return result
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof ErreurFichierJustificatif) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    if (err instanceof ErreurJustificatifAliment) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("PATCH /api/elevage/justificatifs-aliments error:", err)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const parsed = justificatifAlimentArchiveSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.justificatifAlimentElevage.findFirst({
        where: { id: parsed.data.id, userId: session.user.id },
      })
      if (!before) {
        throw new ErreurJustificatifAliment("Justificatif introuvable", 404)
      }
      const result = await tx.justificatifAlimentElevage.update({
        where: { id: before.id },
        data: { archivedAt: parsed.data.archived ? new Date() : null },
      })
      const snapshot = jsonAudit(result)
      await journaliserEvenementReglementaire(tx, {
        userId: session.user.id,
        declarationKey: `justificatif-aliment:${result.id}`,
        action: parsed.data.archived
          ? "JUSTIFICATIF_ALIMENT_ARCHIVE"
          : "JUSTIFICATIF_ALIMENT_REACTIVE",
        actorUserId: acteurReglementaire(session.user),
        snapshotHash: empreinteDeclaration(snapshot),
        metadata: {
          objectType: "justificatif_aliment",
          objectId: result.id,
          archivedAt: result.archivedAt?.toISOString() ?? null,
        },
      })
      return result
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof ErreurJustificatifAliment) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("DELETE /api/elevage/justificatifs-aliments error:", err)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
