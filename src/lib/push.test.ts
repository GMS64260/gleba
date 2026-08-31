import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AlerteUrgente } from "./notifications/types"

const { generateVAPIDKeys, getSetting, sendNotification, setVapidDetails } = vi.hoisted(() => ({
  generateVAPIDKeys: vi.fn(),
  getSetting: vi.fn(),
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}))

vi.mock("web-push", () => ({
  default: { generateVAPIDKeys, sendNotification, setVapidDetails },
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
    expect(setVapidDetails).toHaveBeenCalled()
    expect(sendNotification).toHaveBeenCalledOnce()
  })
})
