import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AlerteUrgente } from "./notifications/types"

const { generateVAPIDKeys, getSetting, generateRequestDetails, sendNotification } = vi.hoisted(() => ({
  generateVAPIDKeys: vi.fn(),
  getSetting: vi.fn(),
  generateRequestDetails: vi.fn(() => ({ endpoint: "https://push.example.com/test", method: "POST", headers: {}, body: null })),
  // Revue Codex du 2026-11-12 (SEC-05) : l'envoi ne passe plus par
  // `webpush.sendNotification`, sans délai, mais par `posterNotificationPush`,
  // borné. Ce double porte le nom de l'ancien pour garder les cas lisibles.
  sendNotification: vi.fn(),
}))

vi.mock("web-push", () => ({
  default: { generateVAPIDKeys, generateRequestDetails },
}))
vi.mock("./push-reseau", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./push-reseau")>()),
  posterNotificationPush: sendNotification,
}))

vi.mock("@/lib/settings", () => ({ getSetting }))

import {
  construirePayloadAlerteUrgente,
  envoyerPushSubscription,
  genererClesVapid,
  getVapidPublicKey,
  pushConfigure,
} from "./push"

describe("notifications push", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    delete process.env.VAPID_SUBJECT
    getSetting.mockImplementation(async (cle: string) => {
      if (cle === "vapid.publicKey") return process.env.VAPID_PUBLIC_KEY || ""
      if (cle === "vapid.privateKey") return process.env.VAPID_PRIVATE_KEY || ""
      return process.env.VAPID_SUBJECT || "mailto:contact@gleba.fr"
    })
  })

  it.each([
    ["irrigation-inutile", "/taches"],
    ["irrigation-rappel", "/taches"],
    ["association-incompatible", "/taches"],
    ["tache-retard", "/taches"],
    ["recolte-mure", "/taches"],
    ["tache-itp-semaine", "/taches"],
    ["stock-bas", "/comptabilite/stocks"],
  ] as const)("construit le payload pour %s", (type, chemin) => {
    const alerte: AlerteUrgente = {
      type,
      titre: "Titre court",
      message: "Message de test",
      key: `${type}:test`,
    }

    expect(construirePayloadAlerteUrgente(alerte)).toEqual({
      title: "Titre court",
      body: "Message de test",
      url: `https://gleba.fr${chemin}`,
      tag: `${type}:test`,
    })
  })

  it("considère la configuration VAPID complète comme active", async () => {
    process.env.VAPID_PUBLIC_KEY = "public"
    process.env.VAPID_PRIVATE_KEY = "private"
    process.env.VAPID_SUBJECT = "mailto:test@example.com"

    await expect(pushConfigure()).resolves.toBe(true)
    await expect(getVapidPublicKey()).resolves.toBe("public")
  })

  it("considère la configuration VAPID incomplète comme inactive", async () => {
    process.env.VAPID_PUBLIC_KEY = "public"

    await expect(pushConfigure()).resolves.toBe(false)
    await expect(getVapidPublicKey()).resolves.toBeNull()
  })

  it("génère une paire de clés VAPID", () => {
    generateVAPIDKeys.mockReturnValue({ publicKey: "public", privateKey: "private" })

    expect(genererClesVapid()).toEqual({ publicKey: "public", privateKey: "private" })
    expect(generateVAPIDKeys).toHaveBeenCalledOnce()
  })

  it.each([404, 410])("classe une subscription morte en gone", async (statusCode) => {
    process.env.VAPID_PUBLIC_KEY = "public"
    process.env.VAPID_PRIVATE_KEY = "private"
    sendNotification.mockRejectedValueOnce({ statusCode })

    const resultat = await envoyerPushSubscription(
      { endpoint: "https://push.example.com/test", keys: { p256dh: "p256dh", auth: "auth" } },
      { title: "Test", body: "Test", url: "/", tag: "test" }
    )

    expect(resultat).toBe("gone")
    expect(generateRequestDetails).toHaveBeenCalledWith(expect.anything(), expect.any(String), {
      vapidDetails: { subject: "mailto:contact@gleba.fr", publicKey: "public", privateKey: "private" },
    })
    expect(sendNotification).toHaveBeenCalledOnce()
  })

  // Revue Codex du 2026-11-12, SEC-05 : une erreur réseau ou un 5xx était
  // compté comme une livraison réussie (« ok »).
  it("qualifie un échec d'envoi au lieu de le compter comme livré", async () => {
    process.env.VAPID_PUBLIC_KEY = "public"
    process.env.VAPID_PRIVATE_KEY = "private"
    sendNotification.mockRejectedValueOnce({ statusCode: 500 })
    const resultat = await envoyerPushSubscription(
      { endpoint: "https://push.example.com/test", keys: { p256dh: "p256dh", auth: "auth" } },
      { title: "Test", body: "Test", url: "/", tag: "test" }
    )
    expect(resultat).toBe("echec")
  })

  it("refuse sans le contacter un endpoint non public, même déjà enregistré", async () => {
    process.env.VAPID_PUBLIC_KEY = "public"
    process.env.VAPID_PRIVATE_KEY = "private"
    const resultat = await envoyerPushSubscription(
      { endpoint: "https://192.168.1.10/push", keys: { p256dh: "p256dh", auth: "auth" } },
      { title: "Test", body: "Test", url: "/", tag: "test" }
    )
    expect(resultat).toBe("refuse")
    expect(sendNotification).not.toHaveBeenCalled()
  })
})
