import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import {
  acteurReglementaire,
  journaliserEvenementReglementaire,
} from "@/lib/elevage/audit-reglementaire"
import {
  cadreReglementaireArchiveSchema,
  cadreReglementaireMutationSchema,
  manquesCadreReglementaire,
} from "@/lib/elevage/cadre-reglementaire"
import { empreinteDeclaration } from "@/lib/elevage/declarations-reglementaires"
import prisma from "@/lib/prisma"

class ErreurCadreReglementaire extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const jsonAudit = (value: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>

async function exploitationCourante(userId: string) {
  return prisma.exploitation.findUnique({
    where: { userId },
    select: {
      id: true,
      raisonSociale: true,
      numeroEde: true,
      veterinaireSanitaire: true,
      lieuxDetentionElevage: {
        orderBy: [{ archivedAt: "asc" }, { type: "asc" }, { nom: "asc" }],
      },
      intervenantsElevage: {
        orderBy: [{ archivedAt: "asc" }, { role: "asc" }, { nom: "asc" }],
      },
    },
  })
}

export async function GET() {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const exploitation = await exploitationCourante(session.user.id)
  if (!exploitation) {
    return NextResponse.json({
      configured: false,
      data: null,
      manques: ["Fiche de l’exploitation non configurée"],
    })
  }

  return NextResponse.json({
    configured: true,
    data: exploitation,
    manques: manquesCadreReglementaire({
      lieux: exploitation.lieuxDetentionElevage,
      intervenants: exploitation.intervenantsElevage,
      veterinaireSanitaireLegacy: exploitation.veterinaireSanitaire,
    }),
  })
}

async function verifierParentLieu(
  tx: Prisma.TransactionClient,
  exploitationId: string,
  parentId: string | null | undefined,
  lieuId?: string,
) {
  if (!parentId) return
  if (parentId === lieuId) {
    throw new ErreurCadreReglementaire("Un lieu ne peut pas être son propre parent", 400)
  }

  const visites = new Set(lieuId ? [lieuId] : [])
  let courant: string | null = parentId
  while (courant) {
    if (visites.has(courant)) {
      throw new ErreurCadreReglementaire("La hiérarchie des lieux créerait un cycle", 409)
    }
    visites.add(courant)
    const parent: { parentId: string | null; archivedAt: Date | null } | null =
      await tx.lieuDetentionElevage.findFirst({
      where: { id: courant, exploitationId },
      select: { parentId: true, archivedAt: true },
      })
    if (!parent) {
      throw new ErreurCadreReglementaire("Lieu parent introuvable pour cette exploitation", 404)
    }
    if (parent.archivedAt) {
      throw new ErreurCadreReglementaire("Un lieu archivé ne peut pas devenir parent", 409)
    }
    courant = parent.parentId
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const parsed = cadreReglementaireMutationSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const exploitation = await prisma.exploitation.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (!exploitation) {
      return NextResponse.json(
        { error: "Configurez d’abord la fiche de l’exploitation" },
        { status: 409 },
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      if (parsed.data.kind === "lieu") {
        await verifierParentLieu(
          tx,
          exploitation.id,
          parsed.data.data.parentId,
        )
        const created = await tx.lieuDetentionElevage.create({
          data: {
            exploitationId: exploitation.id,
            ...parsed.data.data,
          },
        })
        const snapshot = jsonAudit(created)
        await journaliserEvenementReglementaire(tx, {
          userId: session.user.id,
          declarationKey: `cadre-reglementaire:lieu:${created.id}`,
          action: "CADRE_LIEU_CREE",
          actorUserId: acteurReglementaire(session.user),
          snapshotHash: empreinteDeclaration(snapshot),
          metadata: { objectType: "lieu", objectId: created.id, after: snapshot },
        })
        return created
      }

      const created = await tx.intervenantElevage.create({
        data: {
          exploitationId: exploitation.id,
          ...parsed.data.data,
        },
      })
      const snapshot = jsonAudit(created)
      await journaliserEvenementReglementaire(tx, {
        userId: session.user.id,
        declarationKey: `cadre-reglementaire:intervenant:${created.id}`,
        action: "CADRE_INTERVENANT_CREE",
        actorUserId: acteurReglementaire(session.user),
        snapshotHash: empreinteDeclaration(snapshot),
        metadata: { objectType: "intervenant", objectId: created.id, after: snapshot },
      })
      return created
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (err) {
    if (err instanceof ErreurCadreReglementaire) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Un lieu porte déjà ce nom dans l’exploitation" },
        { status: 409 },
      )
    }
    console.error("POST /api/elevage/cadre-reglementaire error:", err)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const parsed = cadreReglementaireMutationSchema.safeParse(await request.json())
    if (!parsed.success || !parsed.data.id) {
      return NextResponse.json(
        {
          error: "Données invalides",
          details: parsed.success ? { fieldErrors: { id: ["Identifiant requis"] } } : parsed.error.flatten(),
        },
        { status: 400 },
      )
    }
    const exploitation = await prisma.exploitation.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (!exploitation) {
      return NextResponse.json({ error: "Exploitation introuvable" }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      if (parsed.data.kind === "lieu") {
        const before = await tx.lieuDetentionElevage.findFirst({
          where: { id: parsed.data.id, exploitationId: exploitation.id },
        })
        if (!before) throw new ErreurCadreReglementaire("Lieu introuvable", 404)
        await verifierParentLieu(
          tx,
          exploitation.id,
          parsed.data.data.parentId,
          before.id,
        )
        const updated = await tx.lieuDetentionElevage.update({
          where: { id: before.id },
          data: parsed.data.data,
        })
        const beforeAudit = jsonAudit(before)
        const afterAudit = jsonAudit(updated)
        await journaliserEvenementReglementaire(tx, {
          userId: session.user.id,
          declarationKey: `cadre-reglementaire:lieu:${updated.id}`,
          action: "CADRE_LIEU_MODIFIE",
          actorUserId: acteurReglementaire(session.user),
          snapshotHash: empreinteDeclaration(afterAudit),
          metadata: {
            objectType: "lieu",
            objectId: updated.id,
            before: beforeAudit,
            after: afterAudit,
          },
        })
        return updated
      }

      const before = await tx.intervenantElevage.findFirst({
        where: { id: parsed.data.id, exploitationId: exploitation.id },
      })
      if (!before) throw new ErreurCadreReglementaire("Intervenant introuvable", 404)
      const updated = await tx.intervenantElevage.update({
        where: { id: before.id },
        data: parsed.data.data,
      })
      const beforeAudit = jsonAudit(before)
      const afterAudit = jsonAudit(updated)
      await journaliserEvenementReglementaire(tx, {
        userId: session.user.id,
        declarationKey: `cadre-reglementaire:intervenant:${updated.id}`,
        action: "CADRE_INTERVENANT_MODIFIE",
        actorUserId: acteurReglementaire(session.user),
        snapshotHash: empreinteDeclaration(afterAudit),
        metadata: {
          objectType: "intervenant",
          objectId: updated.id,
          before: beforeAudit,
          after: afterAudit,
        },
      })
      return updated
    })

    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof ErreurCadreReglementaire) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Un lieu porte déjà ce nom dans l’exploitation" },
        { status: 409 },
      )
    }
    console.error("PATCH /api/elevage/cadre-reglementaire error:", err)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const parsed = cadreReglementaireArchiveSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const exploitation = await prisma.exploitation.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (!exploitation) {
      return NextResponse.json({ error: "Exploitation introuvable" }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const archivedAt = parsed.data.archived ? new Date() : null
      if (parsed.data.kind === "lieu") {
        const before = await tx.lieuDetentionElevage.findFirst({
          where: { id: parsed.data.id, exploitationId: exploitation.id },
        })
        if (!before) throw new ErreurCadreReglementaire("Lieu introuvable", 404)
        if (parsed.data.archived) {
          const enfantActif = await tx.lieuDetentionElevage.findFirst({
            where: {
              parentId: before.id,
              exploitationId: exploitation.id,
              archivedAt: null,
            },
            select: { id: true },
          })
          if (enfantActif) {
            throw new ErreurCadreReglementaire(
              "Archivez ou déplacez d’abord les lieux rattachés à ce site",
              409,
            )
          }
        }
        const updated = await tx.lieuDetentionElevage.update({
          where: { id: before.id },
          data: { archivedAt },
        })
        const afterAudit = jsonAudit(updated)
        await journaliserEvenementReglementaire(tx, {
          userId: session.user.id,
          declarationKey: `cadre-reglementaire:lieu:${updated.id}`,
          action: parsed.data.archived ? "CADRE_LIEU_ARCHIVE" : "CADRE_LIEU_REACTIVE",
          actorUserId: acteurReglementaire(session.user),
          snapshotHash: empreinteDeclaration(afterAudit),
          metadata: {
            objectType: "lieu",
            objectId: updated.id,
            archivedAt: updated.archivedAt?.toISOString() ?? null,
          },
        })
        return updated
      }

      const before = await tx.intervenantElevage.findFirst({
        where: { id: parsed.data.id, exploitationId: exploitation.id },
      })
      if (!before) throw new ErreurCadreReglementaire("Intervenant introuvable", 404)
      const updated = await tx.intervenantElevage.update({
        where: { id: before.id },
        data: { archivedAt },
      })
      const afterAudit = jsonAudit(updated)
      await journaliserEvenementReglementaire(tx, {
        userId: session.user.id,
        declarationKey: `cadre-reglementaire:intervenant:${updated.id}`,
        action: parsed.data.archived
          ? "CADRE_INTERVENANT_ARCHIVE"
          : "CADRE_INTERVENANT_REACTIVE",
        actorUserId: acteurReglementaire(session.user),
        snapshotHash: empreinteDeclaration(afterAudit),
        metadata: {
          objectType: "intervenant",
          objectId: updated.id,
          archivedAt: updated.archivedAt?.toISOString() ?? null,
        },
      })
      return updated
    })

    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof ErreurCadreReglementaire) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("DELETE /api/elevage/cadre-reglementaire error:", err)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
