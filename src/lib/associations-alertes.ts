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

/**
 * Classe une association d'après son champ `type` (favorable | incompatible |
 * neutre), source de vérité. Auparavant on reniflait le `nom` ("incompat") :
 * une association type='incompatible' nommée "Laitue Tomate" était alors
 * affichée comme FAVORABLE (audit 2026-07, #27). Repli sur le nom pour les
 * lignes anciennes dont le type ne serait pas renseigné.
 */
function classeAssociation(type: string | null | undefined, nom: string): "favorable" | "defavorable" | "neutre" {
  if (type === "incompatible") return "defavorable"
  if (type === "favorable") return "favorable"
  if (type === "neutre") return "neutre"
  const lower = (nom || "").toLowerCase()
  if (lower.includes("incompat") || lower.includes("défavorable") || lower.includes("defavorable")) return "defavorable"
  return "favorable"
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
    const classe = classeAssociation(a.type, a.nom)
    if (classe === "neutre") continue // pas d'alerte pour une association neutre
    const defavorable = classe === "defavorable"
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
