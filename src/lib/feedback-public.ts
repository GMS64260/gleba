import type { BugStatus, BugType } from "@prisma/client"

export const feedbackStatusLabels: Record<BugStatus, string> = {
  OPEN: "Reçue",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolue",
}

export const feedbackTypeLabels: Record<BugType, string> = {
  BUG: "Bug",
  EVOLUTION: "Demande d'évolution",
  AUTRE: "Autre",
}

/**
 * Identifiant de suivi lisible et stable d'un feedback, dérivé de son id (cuid).
 * Ticket cmrz0slrg — permet à l'utilisateur et au support de référencer une
 * demande sans ambiguïté (toast d'envoi, carte « Mes demandes », dashboard admin).
 * Dérivé (aucune colonne ni migration) : stable par demande, court et copiable.
 */
export function feedbackRef(id: string): string {
  return "FB-" + id.slice(-6).toUpperCase()
}

export const publicFeedbackSelect = {
  id: true,
  type: true,
  message: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const

export function shouldSendResolutionEmail(
  previousStatus: BugStatus,
  nextStatus: BugStatus | undefined,
  alreadyNotified: boolean
) {
  return nextStatus === "RESOLVED" && previousStatus !== "RESOLVED" && !alreadyNotified
}
