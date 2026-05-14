/**
 * Détecteur d'alertes d'associations sur une planche / zone (PROMPT 23 §3).
 *
 * Pour un ensemble de cultures simultanées sur une même planche, on
 * recherche les paires d'espèces dans la table Association via
 * AssociationDetail. Une association "favorable" produit un message vert,
 * une "défavorable" (nom contenant "incompat" ou "défavorable") un
 * message d'alerte rouge.
 *
 * Performance : la liste des associations est petite (< 1000 lignes) ;
 * on charge l'ensemble côté serveur et on cherche en mémoire.
 */

import type { PrismaClient } from "@prisma/client"

type PrismaTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

export type AlerteAssociation = {
  type: "favorable" | "defavorable"
  especes: [string, string]
  message: string
  associationId: string
  notes?: string | null
}

function isDefavorable(nom: string): boolean {
  const lower = nom.toLowerCase()
  return lower.includes("incompat") || lower.includes("défavorable") || lower.includes("defavorable")
}

/**
 * Pour un ensemble d'identifiants d'espèces présents simultanément,
 * retourne la liste des alertes (favorable et défavorable).
 */
export async function alertesAssociations(
  tx: PrismaTx | PrismaClient,
  especesIds: string[]
): Promise<AlerteAssociation[]> {
  if (especesIds.length < 2) return []
  const uniq = Array.from(new Set(especesIds.map((s) => s.toLowerCase())))

  // Charger toutes les associations qui concernent au moins une de nos espèces
  const associations = await tx.association.findMany({
    where: {
      details: {
        some: {
          OR: [
            { especeId: { in: uniq, mode: "insensitive" } },
            // Familles : on les ignore ici, la détection précise demanderait
            // de remonter Espece → Famille pour chaque culture (TODO).
          ],
        },
      },
    },
    include: { details: true },
  })

  const out: AlerteAssociation[] = []
  for (const a of associations) {
    const especesAssoc = a.details.map((d) => d.especeId?.toLowerCase()).filter(Boolean) as string[]
    // Sous-ensemble des espèces présentes qui apparaissent dans l'association
    const present = uniq.filter((e) => especesAssoc.includes(e))
    if (present.length < 2) continue
    const defavorable = isDefavorable(a.nom)
    // On émet une alerte par PAIRE présente (en pratique 2-3 max)
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        out.push({
          type: defavorable ? "defavorable" : "favorable",
          especes: [present[i], present[j]],
          message: defavorable
            ? `Association défavorable : ${present[i]} ↔ ${present[j]} — ${a.description || a.nom}`
            : `Association favorable : ${present[i]} ↔ ${present[j]} — ${a.description || a.nom}`,
          associationId: a.id,
          notes: a.notes,
        })
      }
    }
  }
  return out
}
