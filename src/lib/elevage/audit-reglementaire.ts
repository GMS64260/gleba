import { Prisma } from "@prisma/client"

export const ACTIONS_REGLEMENTAIRES = [
  "STATUT_MODIFIE",
  "EXPORT_CSV_GENERE",
  "DOCUMENT_CIRCULATION_PREPARE",
  "DOCUMENT_CIRCULATION_GENERE",
  "INVENTAIRE_CHEPTEL_GENERE",
  "REGISTRE_COMPLET_GENERE",
  "REGISTRE_COMPLET_ARCHIVE",
  "REGISTRE_COMPLET_ARCHIVE_TELECHARGE",
  "REGISTRE_SANITAIRE_GENERE",
  "REGISTRE_MOUVEMENTS_GENERE",
  "CADRE_LIEU_CREE",
  "CADRE_LIEU_MODIFIE",
  "CADRE_LIEU_ARCHIVE",
  "CADRE_LIEU_REACTIVE",
  "CADRE_INTERVENANT_CREE",
  "CADRE_INTERVENANT_MODIFIE",
  "CADRE_INTERVENANT_ARCHIVE",
  "CADRE_INTERVENANT_REACTIVE",
  "JUSTIFICATIF_ALIMENT_CREE",
  "JUSTIFICATIF_ALIMENT_MODIFIE",
  "JUSTIFICATIF_ALIMENT_ARCHIVE",
  "JUSTIFICATIF_ALIMENT_REACTIVE",
  "JUSTIFICATIF_EQUARRISSAGE_CREE",
  "JUSTIFICATIF_EQUARRISSAGE_MODIFIE",
  "JUSTIFICATIF_EQUARRISSAGE_ARCHIVE",
  "JUSTIFICATIF_EQUARRISSAGE_REACTIVE",
] as const

export type ActionReglementaire = (typeof ACTIONS_REGLEMENTAIRES)[number]

type ClientJournal = {
  declarationReglementaireEvenement: {
    create: (args: {
      data: {
        userId: string
        declarationKey: string
        action: ActionReglementaire
        actorUserId: string
        statutAvant?: string | null
        statutApres?: string | null
        snapshotHash?: string | null
        metadata?: Prisma.InputJsonValue | typeof Prisma.JsonNull
      }
    }) => Promise<unknown>
  }
}

export interface EvenementReglementaireInput {
  userId: string
  declarationKey: string
  action: ActionReglementaire
  actorUserId?: string
  statutAvant?: string | null
  statutApres?: string | null
  snapshotHash?: string | null
  metadata?: Record<string, unknown> | null
}

export async function journaliserEvenementReglementaire(
  client: ClientJournal,
  evenement: EvenementReglementaireInput,
) {
  return client.declarationReglementaireEvenement.create({
    data: {
      userId: evenement.userId,
      declarationKey: evenement.declarationKey,
      action: evenement.action,
      actorUserId: evenement.actorUserId ?? evenement.userId,
      statutAvant: evenement.statutAvant ?? null,
      statutApres: evenement.statutApres ?? null,
      snapshotHash: evenement.snapshotHash ?? null,
      metadata: evenement.metadata
        ? evenement.metadata as Prisma.InputJsonValue
        : Prisma.JsonNull,
    },
  })
}

export function acteurReglementaire(user: {
  id: string
  impersonatedBy?: string | null
}): string {
  return user.impersonatedBy || user.id
}
