import { Prisma } from "@prisma/client"
import { journaliserEvenementReglementaire } from "@/lib/elevage/audit-reglementaire"
import type { DeclarationReglementaire } from "@/lib/elevage/declarations-reglementaires"

/**
 * Écriture unique du suivi d'une déclaration réglementaire, partagée par le
 * PATCH unitaire et l'attestation groupée « déjà déclarée hors Gleba » : même
 * snapshot, même journal append-only, quel que soit le chemin.
 */
export async function enregistrerSuiviDeclaration(
  tx: Prisma.TransactionClient,
  args: {
    userId: string
    acteur: string
    year: number
    declaration: DeclarationReglementaire
    statut: string
    statutAvant: string
    transmisAt: Date | null
    canalTransmission?: string
    referenceTransmission?: string
    notes?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const { userId, declaration } = args
  const reset = args.statut === "A_DECLARER"
  const updated = await tx.declarationReglementaireSuivi.upsert({
    where: { userId_declarationKey: { userId, declarationKey: declaration.key } },
    create: {
      userId,
      declarationKey: declaration.key,
      statut: args.statut,
      transmisAt: args.transmisAt,
      canalTransmission: reset ? null : args.canalTransmission ?? null,
      referenceTransmission: reset ? null : args.referenceTransmission ?? null,
      notes: args.notes ?? null,
      snapshot: reset ? Prisma.JsonNull : declaration.snapshot as Prisma.InputJsonValue,
      snapshotHash: reset ? null : declaration.snapshotHash,
    },
    update: {
      statut: args.statut,
      transmisAt: args.transmisAt,
      canalTransmission: reset ? null : args.canalTransmission ?? undefined,
      referenceTransmission: reset ? null : args.referenceTransmission ?? undefined,
      notes: args.notes ?? undefined,
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
    declarationKey: declaration.key,
    action: "STATUT_MODIFIE",
    actorUserId: args.acteur,
    statutAvant: args.statutAvant,
    statutApres: args.statut,
    snapshotHash: reset ? null : declaration.snapshotHash,
    metadata: {
      year: args.year,
      canalTransmission: reset ? null : args.canalTransmission ?? null,
      referenceTransmission: reset ? null : args.referenceTransmission ?? null,
      ...args.metadata,
    },
  })
  return updated
}
