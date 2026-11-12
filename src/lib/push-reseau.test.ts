import { describe, expect, it } from "vitest"
import net from "node:net"
import { endpointPushValide, estAdresseIpPublique, lookupPublic, posterNotificationPush } from "./push-reseau"

describe("garde réseau des notifications push (SEC-05)", () => {
  it.each(["8.8.8.8", "142.250.74.10", "::ffff:8.8.8.8", "2a00:1450:4007:80f::200a"])("%s est public", (ip) => expect(estAdresseIpPublique(ip)).toBe(true))
  it.each(["127.0.0.1", "10.1.2.3", "172.31.0.1", "192.168.0.1", "169.254.169.254", "100.100.0.1", "0.0.0.0", "::1", "::", "fd12::1", "fe80::1", "::ffff:10.0.0.1", "::ffff:127.0.0.1", "224.0.0.1", "nimporte"])(
    "%s n'est pas public", (ip) => expect(estAdresseIpPublique(ip)).toBe(false))

  it("donne la raison du refus", () => {
    expect(endpointPushValide("https://10.0.0.1/x")).toEqual({ ok: false, raison: "adresse IP non publique" })
    expect(endpointPushValide("pas une url")).toEqual({ ok: false, raison: "adresse invalide" })
  })

  it("refuse un nom qui se résout vers la boucle locale", async () => {
    const erreur = await new Promise<NodeJS.ErrnoException | null>((r) =>
      (lookupPublic as unknown as (h: string, o: object, cb: (e: NodeJS.ErrnoException | null) => void) => void)("localhost", {}, (e) => r(e)))
    expect(erreur?.code).toBe("EADDRNOTPUBLIC")
  })

  it("détruit la requête d'un service muet au terme du délai absolu", async () => {
    let fermee = false
    const serveur = net.createServer((s) => { s.resume(); s.on("close", () => { fermee = true }) })
    await new Promise<void>((r) => serveur.listen(0, "127.0.0.1", () => r()))
    const debut = Date.now()
    await expect(posterNotificationPush({ endpoint: `https://127.0.0.1:${(serveur.address() as net.AddressInfo).port}/x`, method: "POST", headers: {} }, 250)).rejects.toThrow()
    expect(Date.now() - debut).toBeLessThan(1000)
    await new Promise((r) => setTimeout(r, 50))
    expect(fermee).toBe(true)
    await new Promise<void>((r) => serveur.close(() => r()))
  })
})
