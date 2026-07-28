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
  justificatifEquarrissageArchiveSchema,
  justificatifEquarrissageMutationSchema,
} from "@/lib/elevage/justificatifs-equarrissage"
import prisma from "@/lib/prisma"

class ErreurJustificatifEquarrissage extends Error {
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

const debutJourUtc = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())

async function verifierMortalitesAccessibles(
  tx: Prisma.TransactionClient,
  animalIds: number[],
  userId: string,
  dateEnlevement: Date,
) {
  if (!animalIds.length) return []
  const animaux = await tx.animal.findMany({
    where: {
      id: { in: animalIds },
      userId,
      statut: "mort",
    },
    select: {
      id: true,
      identifiant: true,
      nom: true,
      dateSortie: true,
      causeSortie: true,
      especeAnimale: { select: { nom: true } },
    },
  })
  if (animaux.length !== animalIds.length) {
    throw new ErreurJustificatifEquarrissage(
      "Une mortalité est introuvable ou inaccessible pour ce compte",
      404,
    )
  }
  const sansDate = animaux.find((animal) => !animal.dateSortie)
  if (sansDate) {
    throw new ErreurJustificatifEquarrissage(
      "Chaque mortalité rattachée doit avoir une date de décès",
      409,
    )
  }
  const enlevement = debutJourUtc(dateEnlevement)
  if (animaux.some((animal) =>
    animal.dateSortie && debutJourUtc(animal.dateSortie) > enlevement
  )) {
    throw new ErreurJustificatifEquarrissage(
      "La date d’enlèvement ne peut pas précéder la date de mortalité",
      409,
    )
  }
  return animaux
}

async function verifierAbsenceCouvertureActive(
  tx: Prisma.TransactionClient,
  animalIds: number[],
  userId: string,
  justificatifExcluId?: string,
) {
  if (!animalIds.length) return
  const doublon = await tx.justificatifEquarrissageAnimal.findFirst({
    where: {
      animalId: { in: animalIds },
      justificatif: {
        userId,
        archivedAt: null,
        ...(justificatifExcluId ? { id: { not: justificatifExcluId } } : {}),
      },
    },
    select: { animalId: true },
  })
  if (doublon) {
    throw new ErreurJustificatifEquarrissage(
      `La mortalité #${doublon.animalId} possède déjà un bon actif`,
      409,
    )
  }
}

const includeJustificatif = {
  animaux: {
    include: {
      animal: {
        select: {
          id: true,
          identifiant: true,
          nom: true,
          dateSortie: true,
          causeSortie: true,
          especeAnimale: { select: { nom: true } },
        },
      },
    },
  },
} satisfies Prisma.JustificatifEquarrissageElevageInclude

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
  const data = await prisma.justificatifEquarrissageElevage.findMany({
    where: {
      userId: session.user.id,
      OR: [
        { dateEnlevement: { gte: debut, lt: fin } },
        {
          animaux: {
            some: { animal: { dateSortie: { gte: debut, lt: fin } } },
          },
        },
      ],
    },
    orderBy: [{ archivedAt: "asc" }, { dateEnlevement: "desc" }, { createdAt: "desc" }],
    include: includeJustificatif,
  })
  return NextResponse.json({ data, year: parsedYear.data })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const parsed = justificatifEquarrissageMutationSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const fichier = parsed.data.data.fichierUrl
      ? await verifierFichierJustificatif(session.user.id, parsed.data.data.fichierUrl)
      : { tailleOctets: null, empreinteSha256: null }
    const { animalIds, ...data } = parsed.data.data

    const created = await prisma.$transaction(async (tx) => {
      await verifierMortalitesAccessibles(
        tx,
        animalIds,
        session.user.id,
        data.dateEnlevement,
      )
      await verifierAbsenceCouvertureActive(tx, animalIds, session.user.id)
      const result = await tx.justificatifEquarrissageElevage.create({
        data: {
          userId: session.user.id,
          ...data,
          ...fichier,
          animaux: {
            create: animalIds.map((animalId) => ({ animalId })),
          },
        },
        include: includeJustificatif,
      })
      const snapshot = jsonAudit(result)
      await journaliserEvenementReglementaire(tx, {
        userId: session.user.id,
        declarationKey: `justificatif-equarrissage:${result.id}`,
        action: "JUSTIFICATIF_EQUARRISSAGE_CREE",
        actorUserId: acteurReglementaire(session.user),
        snapshotHash: empreinteDeclaration(snapshot),
        metadata: {
          objectType: "justificatif_equarrissage",
          objectId: result.id,
          after: snapshot,
        },
      })
      return result
    })
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (err) {
    return gererErreur(err, "POST")
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const parsed = justificatifEquarrissageMutationSchema.safeParse(await request.json())
    if (!parsed.success || !parsed.data.id) {
      return NextResponse.json(
        {
          error: "Données invalides",
          details: parsed.success
            ? { fieldErrors: { id: ["Identifiant requis"] } }
            : parsed.error.flatten(),
        },
        { status: 400 },
      )
    }
    const fichier = parsed.data.data.fichierUrl
      ? await verifierFichierJustificatif(session.user.id, parsed.data.data.fichierUrl)
      : { tailleOctets: null, empreinteSha256: null }
    const { animalIds, ...data } = parsed.data.data

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.justificatifEquarrissageElevage.findFirst({
        where: { id: parsed.data.id, userId: session.user.id },
        include: includeJustificatif,
      })
      if (!before) {
        throw new ErreurJustificatifEquarrissage("Justificatif introuvable", 404)
      }
      await verifierMortalitesAccessibles(
        tx,
        animalIds,
        session.user.id,
        data.dateEnlevement,
      )
      await verifierAbsenceCouvertureActive(
        tx,
        animalIds,
        session.user.id,
        before.id,
      )
      const result = await tx.justificatifEquarrissageElevage.update({
        where: { id: before.id },
        data: {
          ...data,
          ...fichier,
          animaux: {
            deleteMany: {},
            create: animalIds.map((animalId) => ({ animalId })),
          },
        },
        include: includeJustificatif,
      })
      const beforeAudit = jsonAudit(before)
      const afterAudit = jsonAudit(result)
      await journaliserEvenementReglementaire(tx, {
        userId: session.user.id,
        declarationKey: `justificatif-equarrissage:${result.id}`,
        action: "JUSTIFICATIF_EQUARRISSAGE_MODIFIE",
        actorUserId: acteurReglementaire(session.user),
        snapshotHash: empreinteDeclaration(afterAudit),
        metadata: {
          objectType: "justificatif_equarrissage",
          objectId: result.id,
          before: beforeAudit,
          after: afterAudit,
        },
      })
      return result
    })
    return NextResponse.json({ data: updated })
  } catch (err) {
    return gererErreur(err, "PATCH")
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const parsed = justificatifEquarrissageArchiveSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.justificatifEquarrissageElevage.findFirst({
        where: { id: parsed.data.id, userId: session.user.id },
        include: { animaux: { select: { animalId: true } } },
      })
      if (!before) {
        throw new ErreurJustificatifEquarrissage("Justificatif introuvable", 404)
      }
      if (!parsed.data.archived) {
        await verifierAbsenceCouvertureActive(
          tx,
          before.animaux.map((lien) => lien.animalId),
          session.user.id,
          before.id,
        )
      }
      const result = await tx.justificatifEquarrissageElevage.update({
        where: { id: before.id },
        data: { archivedAt: parsed.data.archived ? new Date() : null },
      })
      const snapshot = jsonAudit(result)
      await journaliserEvenementReglementaire(tx, {
        userId: session.user.id,
        declarationKey: `justificatif-equarrissage:${result.id}`,
        action: parsed.data.archived
          ? "JUSTIFICATIF_EQUARRISSAGE_ARCHIVE"
          : "JUSTIFICATIF_EQUARRISSAGE_REACTIVE",
        actorUserId: acteurReglementaire(session.user),
        snapshotHash: empreinteDeclaration(snapshot),
        metadata: {
          objectType: "justificatif_equarrissage",
          objectId: result.id,
          archivedAt: result.archivedAt?.toISOString() ?? null,
        },
      })
      return result
    })
    return NextResponse.json({ data: updated })
  } catch (err) {
    return gererErreur(err, "DELETE")
  }
}

function gererErreur(err: unknown, method: string) {
  if (err instanceof ErreurFichierJustificatif) {
    return NextResponse.json({ error: err.message }, { status: 409 })
  }
  if (err instanceof ErreurJustificatifEquarrissage) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error(`${method} /api/elevage/justificatifs-equarrissage error:`, err)
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
}
