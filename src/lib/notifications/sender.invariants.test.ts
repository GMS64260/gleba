import { afterEach, expect, it, vi } from "vitest"
import { ErreurServicePush } from "@/lib/push-reseau"

const m = vi.hoisted(() => ({
  smtp: false, vapid: false, enabled: true, prefere: true,
  mailAccepte: true, pushAccepte: true, abonnement: true,
  bdd: new Map<string, { key: string; data: unknown; expiresAt: Date }>(),
  mails: 0, pushes: 0,
  sendMail: vi.fn(), posterNotificationPush: vi.fn(),
}))
vi.mock("@/lib/mail", () => ({ APP_URL: "https://example.invalid", smtpConfigure: async () => m.smtp, sendMail: m.sendMail }))
vi.mock("@/lib/settings", () => ({ getSetting: async (key: string) => key === "notif.enabled" ? m.enabled : m.vapid ? "cle-test" : "" }))
vi.mock("@/lib/abonnement/serveur", () => ({ serviceAutorise: async () => true }))
vi.mock("@/lib/unsubscribe", () => ({ getOrCreateUnsubscribeToken: async () => "jeton", unsubscribeUrl: () => "https://example.invalid/u", listUnsubscribeHeaders: () => ({}) }))
vi.mock("./queries", () => ({
  chargerPrefsNotif: async () => ({ autresUrgentes: m.prefere }),
  detecterAlertesUrgentes: async () => [{ type: "tache-retard", titre: "T", message: "M", key: "retard:test" }],
  getDestinatairesNotifications: async () => [{ id: "u-invariant", email: "test@example.invalid", name: "Test" }],
}))
vi.mock("./templates", () => ({ CHEMIN_TACHES: "/taches", alerteUrgenteEmail: () => ({ subject: "s", html: "h" }) }))
vi.mock("web-push", () => ({ default: { generateRequestDetails: () => ({}) } }))
vi.mock("@/lib/push-reseau", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/push-reseau")>(),
  posterNotificationPush: m.posterNotificationPush,
}))
vi.mock("@/lib/prisma", () => ({ default: {
  genericCache: {
    findUnique: async ({ where }: { where: { key: string } }) => m.bdd.get(where.key) ?? null,
    findMany: async () => [...m.bdd.values()],
    upsert: async ({ create }: { create: { key: string; data: unknown; expiresAt: Date } }) => { m.bdd.set(create.key, create); return create },
    deleteMany: async () => ({ count: 0 }),
  },
  pushSubscription: {
    findMany: async ({ where }: { where: { userId: string } }) => {
      expect(where.userId).toBe("u-invariant")
      return m.abonnement ? [{ id: "abonnement-test", endpoint: "https://push.example.invalid/message", p256dh: "test", auth: "test" }] : []
    },
  },
} }))

import { envoyerAlertesUrgentes } from "./sender"
import { resetStorePourTests } from "./store"

afterEach(() => { vi.restoreAllMocks() })

it("invariant : chaque canal accepté est acquitté une seule fois ; graine 20261118, 300 séquences", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  let graine = 20261118
  const hasard = () => {
    graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0
    return (graine & 0x10000) !== 0
  }
  m.sendMail.mockImplementation(async () => {
    if (!m.mailAccepte) throw new Error("SMTP indisponible")
    m.mails++
  })
  m.posterNotificationPush.mockImplementation(async () => {
    if (!m.pushAccepte) throw new ErreurServicePush(503)
    m.pushes++
  })

  for (let sequence = 0; sequence < 300; sequence++) {
    m.bdd.clear()
    resetStorePourTests()
    m.mails = 0
    m.pushes = 0
    let mailAcquitte = false
    let pushAcquitte = false
    for (let scan = 0; scan < 8; scan++) {
      // Les deux derniers scans livrent tout puis vérifient l'absence de doublon.
      const final = scan >= 6
      m.enabled = final || hasard()
      m.prefere = final || hasard()
      m.smtp = final || hasard()
      m.vapid = final || hasard()
      m.abonnement = final || hasard()
      m.mailAccepte = final || hasard()
      m.pushAccepte = final || hasard()
      if (hasard() || final) resetStorePourTests()
      const mailAttendu: boolean = !mailAcquitte && m.enabled && m.prefere && m.smtp && m.mailAccepte
      const pushAttendu: boolean = !pushAcquitte && m.enabled && m.prefere && m.vapid && m.abonnement && m.pushAccepte
      const resultat = await envoyerAlertesUrgentes()
      expect(resultat, `graine=20261118 séquence=${sequence} scan=${scan}`).toBe(Number(mailAttendu || pushAttendu))
      mailAcquitte ||= mailAttendu
      pushAcquitte ||= pushAttendu
      expect(m.mails).toBe(Number(mailAcquitte))
      expect(m.pushes).toBe(Number(pushAcquitte))
      expect(m.bdd.has("notif:envoyee:u-invariant:retard:test")).toBe(mailAcquitte)
      expect(m.bdd.has("notif:envoyee:u-invariant:push:retard:test")).toBe(pushAcquitte)
    }
    expect(m.mails).toBe(1)
    expect(m.pushes).toBe(1)
  }
})
