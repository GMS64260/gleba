/**
 * Aides communes aux routes d'écriture des associations.
 */

import { Prisma } from "@prisma/client"
import type { AssociationDetail } from "@/lib/validations/association"

/** Sélection des détails : ordre stable, la fiche espèce et le formulaire en dépendent. */
export const INCLUDE_DETAILS = {
  details: {
    include: {
      espece: { select: { id: true, couleur: true } },
      famille: { select: { id: true, couleur: true } },
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.AssociationInclude

const texte = (v: string | null | undefined) => (typeof v === "string" && v.trim() ? v.trim() : null)

/**
 * Lignes à écrire : une ligne sans espèce, famille ni groupe ne désigne rien
 * et resterait muette partout. Seul le formulaire les filtrait.
 */
export function detailsAEcrire(details: AssociationDetail[]) {
  return details
    .map((d) => ({
      especeId: texte(d.especeId),
      familleId: texte(d.familleId),
      groupe: texte(d.groupe),
      requise: d.requise || false,
      notes: d.notes || null,
    }))
    .filter((d) => d.especeId || d.familleId || d.groupe)
}

/** Espèce ou famille inexistante : violation de clé étrangère sur un détail. */
export function estReferenceInconnue(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003"
}

export const MESSAGE_REFERENCE_INCONNUE =
  "Une espèce ou une famille de l'association n'existe pas dans le référentiel"

export const MESSAGE_TROP_PEU_DE_MEMBRES =
  "Une association relie au moins deux plantes (espèce, famille ou groupe)"
