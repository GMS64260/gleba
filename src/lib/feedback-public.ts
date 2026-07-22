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
