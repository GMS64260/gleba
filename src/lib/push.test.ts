import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AlerteUrgente } from "./notifications/types"

const { sendNotification, setVapidDetails } = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}))

vi.mock("web-push", () => ({
  default: { sendNotification, setVapidDetails },
}))

import {
  construirePayloadAlerteUrgente,
  envoyerPushSubscription,
  getVapidPublicKey,
  pushConfigure,
} from "./push"

describe("notifications push", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    delete process.env.VAPID_SUBJECT
  })

  it.each([
    ["irrigation-inutile", "/calendrier"],
    ["irrigation-rappel", "/calendrier"],
    ["association-incompatible", "/calendrier"],
    ["tache-retard", "/calendrier"],
    ["recolte-mure", "/calendrier"],
    ["tache-itp-semaine", "/calendrier"],
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

  it("considère la configuration VAPID complète comme active", () => {
    process.env.VAPID_PUBLIC_KEY = "public"
    process.env.VAPID_PRIVATE_KEY = "private"
    process.env.VAPID_SUBJECT = "mailto:test@example.com"

    expect(pushConfigure()).toBe(true)
    expect(getVapidPublicKey()).toBe("public")
  })

  it("considère la configuration VAPID incomplète comme inactive", () => {
    process.env.VAPID_PUBLIC_KEY = "public"

    expect(pushConfigure()).toBe(false)
    expect(getVapidPublicKey()).toBeNull()
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
