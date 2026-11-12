import { afterEach, describe, expect, it, vi } from "vitest"
import crypto from "node:crypto"
import net from "node:net"
import webpush from "web-push"

/**
 * Revue Codex du 2026-11-12, SEC-05. Un abonnement push qui accepte la
 * connexion mais ne répond jamais tenait l'envoi en attente sans fin : la
 * bibliothèque ne pose aucun délai par défaut, et le scan des alertes urgentes
 * attend chaque envoi. Banc hors réseau : serveur TCP local muet.
 */
const vapid = webpush.generateVAPIDKeys()
vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn(async (cle: string) => ({
    "vapid.publicKey": vapid.publicKey, "vapid.privateKey": vapid.privateKey, "vapid.subject": "mailto:test@example.invalid",
  } as Record<string, string>)[cle] ?? ""),
}))
// Le banc vise 127.0.0.1 : la garde d'adresse publique est levée ici pour
// éprouver le délai lui-même (la garde a ses propres tests).
vi.mock("./push-reseau", async (importOriginal) => {
  const reel = await importOriginal<typeof import("./push-reseau")>()
  return { ...reel, endpointPushValide: (endpoint: string) => ({ ok: true as const, url: new URL(endpoint) }), lookupPublic: undefined }
})

import { envoyerPushSubscription } from "./push"

const sockets: net.Socket[] = []
let serveur: net.Server | null = null
afterEach(async () => {
  sockets.forEach((s) => s.destroy())
  await new Promise<void>((r) => (serveur ? serveur.close(() => r()) : r()))
})

describe("délai d'un envoi push", () => {
  it("abandonne un endpoint muet dans le délai et ferme la connexion", async () => {
    let fermees = 0
    serveur = net.createServer((s) => { sockets.push(s); s.resume(); s.on("close", () => fermees++) })
    await new Promise<void>((r) => serveur!.listen(0, "127.0.0.1", () => r()))
    const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys()
    const subscription = {
      endpoint: `https://127.0.0.1:${(serveur.address() as net.AddressInfo).port}/muet`,
      keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") },
    }
    const debut = Date.now()
    const envoi = (envoyerPushSubscription as (...a: unknown[]) => Promise<string>)(subscription, { title: "t", body: "b", url: "/", tag: "x" }, { delaiMs: 300 })
    const issue = await Promise.race([envoi, new Promise((r) => setTimeout(() => r("toujours en attente"), 2000))])
    expect(issue).toBe("echec")
    expect(Date.now() - debut).toBeLessThan(1500)
    await new Promise((r) => setTimeout(r, 50))
    expect(fermees).toBe(1)
  })
})
