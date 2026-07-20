import { describe, expect, it } from "vitest"
import { cadenceDecision, eligibleGrowthProfile, growthFeedbackEmail, redactedPreview } from "../growth-campaign"
import { listUnsubscribeHeaders } from "../unsubscribe"

const now = new Date("2026-07-20T12:00:00.000Z")
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000)

describe("growth campaign safety", () => {
  it("requires the full allowlist profile", () => {
    const valid = { role: "USER", active: true, emailVerified: true, emailOptOut: false, email: "user@example.test", activityDays: 3, modules: ["verger" as const], hasResponded: false }
    expect(eligibleGrowthProfile(valid)).toBe(true)
    expect(eligibleGrowthProfile({ ...valid, role: "ADMIN" })).toBe(false)
    expect(eligibleGrowthProfile({ ...valid, active: false })).toBe(false)
    expect(eligibleGrowthProfile({ ...valid, emailVerified: false })).toBe(false)
    expect(eligibleGrowthProfile({ ...valid, emailOptOut: true })).toBe(false)
    expect(eligibleGrowthProfile({ ...valid, email: "demo@gleba.fr" })).toBe(false)
    expect(eligibleGrowthProfile({ ...valid, activityDays: 2 })).toBe(false)
    expect(eligibleGrowthProfile({ ...valid, modules: [] })).toBe(false)
  })
  it("excludes responders, enforces cooldown and permits only one follow-up", () => {
    expect(cadenceDecision(now, [], [], true).reason).toBe("feedback_already_received")
    expect(cadenceDecision(now, [], [{ contactedAt: ago(2), kind: "first", outcome: "sent" }], false).reason).toBe("user_30d_cooldown")
    expect(cadenceDecision(now, [], [
      { contactedAt: ago(70), kind: "first", outcome: "sent" },
      { contactedAt: ago(35), kind: "follow_up", outcome: "sent" },
    ], false).reason).toBe("follow_up_already_sent")
  })

  it("counts reservations so concurrent workers cannot exceed five", () => {
    const reservations = Array.from({ length: 5 }, (_, i) => ({ contactedAt: new Date(now.getTime() - i), kind: "first" as const, outcome: "reserved" }))
    expect(cadenceDecision(now, reservations, [], false).reason).toBe("global_24h_limit")
  })

  it("redacts identity, address and message content from preview", () => {
    const preview = redactedPreview(0, 7, ["maraichage"], "first")
    expect(preview).toEqual({ candidate: 1, activityDays: 7, modules: ["maraichage"], kind: "first", templateVersion: "growth-feedback-fr-v1" })
    expect(JSON.stringify(preview)).not.toMatch(/email|name|subject|html|message/i)
  })

  it("uses the RFC 8058 POST handler for one-click unsubscribe", () => {
    expect(listUnsubscribeHeaders("safe-token")).toEqual({
      "List-Unsubscribe": "<https://gleba.fr/api/desabonnement/safe-token>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    })
  })

  it("asks explicitly about workflows and indispensable paid value", () => {
    const mail = growthFeedbackEmail({
      name: null,
      modules: ["verger"],
      feedbackUrl: "https://gleba.fr/feedback/token",
      unsubscribeUrl: "https://gleba.fr/desabonnement/token",
      kind: "first",
    })
    expect(mail.html).toMatch(/Quels workflows utilisez-vous/)
    expect(mail.html).toMatch(/rendrait Gleba indispensable/)
    expect(mail.html).toMatch(/prêt à payer/)
  })
})
