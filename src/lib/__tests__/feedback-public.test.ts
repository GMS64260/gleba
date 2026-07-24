import { describe, expect, it } from "vitest"
import { feedbackRef, feedbackStatusLabels, publicFeedbackSelect, shouldSendResolutionEmail } from "../feedback-public"

describe("feedback public", () => {
  it("projette uniquement les champs publics", () => {
    expect(Object.keys(publicFeedbackSelect)).toEqual([
      "id", "type", "message", "status", "createdAt", "updatedAt",
    ])
    expect(publicFeedbackSelect).not.toHaveProperty("adminNote")
    expect(publicFeedbackSelect).not.toHaveProperty("user")
    expect(publicFeedbackSelect).not.toHaveProperty("statusLogs")
  })

  it("traduit les trois états", () => {
    expect(feedbackStatusLabels).toEqual({ OPEN: "Reçue", IN_PROGRESS: "En cours", RESOLVED: "Résolue" })
  })

  it("dérive une référence de suivi stable et lisible depuis l'id", () => {
    expect(feedbackRef("cmrz0slrg000lzh4faf7ziw06")).toBe("FB-7ZIW06")
    // Stable : même id -> même référence.
    expect(feedbackRef("cmrz0slrg000lzh4faf7ziw06")).toBe(feedbackRef("cmrz0slrg000lzh4faf7ziw06"))
    // Toujours préfixée FB- et en majuscules.
    expect(feedbackRef("abcdef123456")).toBe("FB-123456")
  })

  it("autorise au plus le premier email de résolution", () => {
    expect(shouldSendResolutionEmail("OPEN", "RESOLVED", false)).toBe(true)
    expect(shouldSendResolutionEmail("IN_PROGRESS", "RESOLVED", true)).toBe(false)
    expect(shouldSendResolutionEmail("RESOLVED", "RESOLVED", false)).toBe(false)
    expect(shouldSendResolutionEmail("OPEN", "IN_PROGRESS", false)).toBe(false)
  })
})
