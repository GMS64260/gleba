/**
 * Historique des rectifications du registre phytosanitaire.
 *
 * Arrêté du 24 décembre 2025 (NOR AGRG2536515A), article 3 : les informations
 * du registre sont « conservées pendant une durée d'au moins cinq ans après
 * leur enregistrement », « de manière à garantir leur pérennité et leur
 * intégrité ». Avant ce module, modifier un traitement réalisé écrasait ses
 * valeurs et le supprimer l'effaçait sans trace (revue de conformité du
 * 2026-11-12, constat C3).
 *
 * Règle : toute modification ou suppression d'un traitement RÉALISÉ dépose
 * d'abord son état complet dans `registre_phyto_historique` (table en ajout
 * seul, protégée par un déclencheur), datée, attribuée et éventuellement
 * motivée. La saisie reste corrigeable : une erreur de saisie se corrige, et
 * l'original reste retrouvable et exportable avec le registre.
 */

import type { Prisma } from "@prisma/client"
import { METHODES_OBSERVATION_REGISTRE } from "@/lib/tracabilite/conformite-observation-phyto"

type Tx = Prisma.TransactionClient

export type SourceRegistre = "intervention" | "observation_sante" | "operation_arbre"
export type ActionRectification = "modification" | "suppression"

export const LIBELLES_SOURCE: Record<SourceRegistre, string> = {
  intervention: "Intervention",
  observation_sante: "Verger · santé",
  operation_arbre: "Verger · opération",
}

/** Traitement réalisé d'une intervention : il figure au registre. */
export function interventionAuRegistre(i: { type: string; fait: boolean }): boolean {
  return i.type === "traitement_phyto" && i.fait
}

/** Observation santé qui figure au registre (même filtre que le registre et son export). */
export function observationAuRegistre(o: {
  methodeTraitement?: string | null
  produit?: string | null
  numAMM?: string | null
}): boolean {
  return (
    (o.methodeTraitement != null && (METHODES_OBSERVATION_REGISTRE as readonly string[]).includes(o.methodeTraitement)) ||
    o.produit != null ||
    o.numAMM != null
  )
}

/** Opération d'arbre qui figure au registre. */
export function operationAuRegistre(op: {
  type: string
  fait: boolean
  produit?: string | null
  description?: string | null
}): boolean {
  return op.type === "traitement" && op.fait && (op.produit != null || op.description != null)
}

/** Copie JSON fidèle d'une ligne (dates en ISO). */
export function instantane(ligne: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(ligne)) as Prisma.InputJsonValue
}

/** Motif saisi, borné et nettoyé ; null s'il est vide. */
export function motifRectification(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null
  const motif = valeur.trim().slice(0, 500)
  return motif === "" ? null : motif
}

export async function journaliserRectificationPhyto(
  tx: Tx,
  entree: {
    userId: string
    source: SourceRegistre
    sourceId: number
    action: ActionRectification
    avant: unknown
    apres?: unknown
    motif?: string | null
    auteurId?: string | null
  },
): Promise<void> {
  await tx.registrePhytoHistorique.create({
    data: {
      userId: entree.userId,
      source: entree.source,
      sourceId: entree.sourceId,
      action: entree.action,
      avant: instantane(entree.avant),
      ...(entree.apres !== undefined ? { apres: instantane(entree.apres) } : {}),
      motif: entree.motif ?? null,
      auteurId: entree.auteurId ?? null,
    },
  })
}
