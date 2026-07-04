/**
 * PROMPT DEV 2 Bug #10 — Détection des associations sur planches adjacentes.
 *
 * Le helper [[associations-alertes]] détecte les paires favorable/défavorable
 * pour les cultures cohabitant sur UNE MÊME planche. Ce module étend la
 * détection aux planches voisines : même îlot par défaut (notion d'adjacence
 * minimale, simple et explicable au maraîcher).
 *
 * Audit Marc 2026-05-14 : "Pas d'alerte quand on plante haricot à côté d'une
 * planche d'ail" — sans cette check, le module Associations était isolé.
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import prisma from "@/lib/prisma"
import { alertesAssociations, type AlerteAssociation } from "@/lib/associations-alertes"

type Tx = Prisma.TransactionClient | PrismaClient

export type AlerteAdjacence = AlerteAssociation & {
  plancheNom: string
}

export type SuggestionCompagnon = {
  especeId: string
  associationId: string
  message: string
}

export type AdjacenceResult = {
  alertes: AlerteAdjacence[]
  suggestions: SuggestionCompagnon[]
  /** Planches considérées adjacentes (même îlot). */
  planchesVoisines: { id: string; nom: string }[]
}

/**
 * Pour une espèce candidate sur une planche donnée, retourne les alertes
 * d'incompatibilité ET les suggestions de compagnons positifs sur les
 * planches du même îlot (cultures actives uniquement).
 *
 * Retourne un résultat vide si la planche n'a pas d'îlot défini.
 */
export async function checkAdjacence(
  especeId: string,
  plancheId: string,
  userId: string,
  tx: Tx = prisma
): Promise<AdjacenceResult> {
  const planche = await tx.planche.findFirst({
    where: { id: plancheId, userId },
    select: { id: true, nom: true, ilot: true },
  })
  if (!planche || !planche.ilot) {
    return { alertes: [], suggestions: [], planchesVoisines: [] }
  }

  // Planches du même îlot (hors planche cible).
  const voisines = await tx.planche.findMany({
    where: { userId, ilot: planche.ilot, id: { not: planche.id } },
    select: { id: true, nom: true },
  })
  if (voisines.length === 0) {
    return { alertes: [], suggestions: [], planchesVoisines: [] }
  }

  // Cultures actives sur les planches voisines.
  const culturesVoisines = await tx.culture.findMany({
    where: {
      userId,
      plancheId: { in: voisines.map((v) => v.id) },
      // "Active" = non terminée et non récoltée totalement.
      terminee: null,
    },
    select: { especeId: true, plancheId: true },
  })

  const especesParPlanche = new Map<string, string[]>()
  for (const c of culturesVoisines) {
    if (!c.especeId || !c.plancheId) continue
    const plancheId: string = c.plancheId
    const especeId: string = c.especeId
    const arr = especesParPlanche.get(plancheId) ?? []
    arr.push(especeId)
    especesParPlanche.set(plancheId, arr)
  }

  const alertes: AlerteAdjacence[] = []
  for (const v of voisines) {
    const especesAdj = especesParPlanche.get(v.id) ?? []
    if (especesAdj.length === 0) continue
    // On évalue la paire (especeId candidate, especeAdj) → réutilise le
    // helper existant en lui passant la paire à analyser.
    const paireAlerts = await alertesAssociations(tx, [especeId, ...especesAdj])
    for (const a of paireAlerts) {
      if (!a.especes.map((e) => e.toLowerCase()).includes(especeId.toLowerCase())) continue
      alertes.push({ ...a, plancheNom: v.nom })
    }
  }

  // Suggestions positives : on cherche les associations qui contiennent
  // l'espèce candidate ET qui ne sont pas encore présentes sur l'îlot.
  // Implémentation minimale : on liste les compagnons positifs à proposer.
  const especesIlot = new Set(
    [...especesParPlanche.values()].flat().map((e) => e.toLowerCase())
  )
  const associationsAssoc = await tx.association.findMany({
    where: {
      details: { some: { especeId: { equals: especeId, mode: "insensitive" } } },
    },
    include: { details: true },
  })
  const suggestions: SuggestionCompagnon[] = []
  for (const a of associationsAssoc) {
    // On se base sur le champ `type` (favorable | incompatible | neutre), et
    // non sur le nom : une association type='incompatible' nommée sans le mot
    // « incompat » était suggérée comme compagnon bénéfique (audit 2026-07, #37).
    // Repli sur le nom pour les lignes anciennes sans type explicite.
    const typeLower = (a.type || "").toLowerCase()
    const nomLower = a.nom.toLowerCase()
    const defavorable =
      typeLower === "incompatible" ||
      (!typeLower && (nomLower.includes("incompat") || nomLower.includes("défavorable") || nomLower.includes("defavorable")))
    if (defavorable || typeLower === "neutre") {
      continue // pas une suggestion positive
    }
    for (const d of a.details) {
      if (!d.especeId) continue
      const candidate = d.especeId.toLowerCase()
      if (candidate === especeId.toLowerCase()) continue
      if (especesIlot.has(candidate)) continue // déjà présent sur l'îlot
      suggestions.push({
        especeId: d.especeId,
        associationId: a.id,
        message: `${d.especeId} sur une planche adjacente serait bénéfique (${a.nom})`,
      })
    }
  }

  // Dédupliquer suggestions par especeId (garder la première occurrence).
  const seen = new Set<string>()
  const dedupedSuggestions = suggestions.filter((s) => {
    if (seen.has(s.especeId.toLowerCase())) return false
    seen.add(s.especeId.toLowerCase())
    return true
  })

  return {
    alertes,
    suggestions: dedupedSuggestions.slice(0, 5),
    planchesVoisines: voisines,
  }
}
