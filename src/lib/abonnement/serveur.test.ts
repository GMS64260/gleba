import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  abonnementGleba: { findUnique: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({ default: db }))
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
import { chargerAccesService, demarrerEssai, refusAbonnementApi } from "./serveur"
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("GLEBA_ABONNEMENTS_ACTIFS", "true")
  db.user.findUnique.mockResolvedValue({ createdAt: new Date("2026-11-09"), email: "qa@example.invalid" })
  db.abonnementGleba.findUnique.mockResolvedValue(null)
})
afterEach(() => vi.unstubAllEnvs())
describe("droits serveur et essai", () => {
  it("ne consulte aucune table commerciale sur une instance non activée", async () => {
    vi.stubEnv("GLEBA_ABONNEMENTS_ACTIFS", "false")
    expect((await chargerAccesService("qa")).etat).toBe("libre")
    expect(db.abonnementGleba.findUnique).not.toHaveBeenCalled()
  })
  it("un ancien compte ne reçoit aucun début ni fin d’essai", async () => {
    db.user.findUnique.mockResolvedValue({ createdAt: new Date("2026-01-01"), email: "qa@example.invalid" })
    expect((await demarrerEssai("qa")).etat).toBe("gratuit-vie")
    expect(db.abonnementGleba.createMany).not.toHaveBeenCalled()
  })
  it("un retour de connexion ne réinitialise jamais un essai commencé", async () => {
    await demarrerEssai("qa")
    expect(db.abonnementGleba.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }))
    expect(db.abonnementGleba.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "qa", essaiDebut: null, gratuitAVie: false } }))
  })
  it("refuse un contexte HTTP absent et lit le chemin réel d’un Request", async () => {
    expect((await refusAbonnementApi("qa"))?.status).toBe(503)
    const req = new Request("https://gleba.example/api/meteo", { headers: { "x-gleba-chemin": "/api/abonnement" } })
    expect((await refusAbonnementApi("qa", req))?.status).toBe(403)
    expect(await refusAbonnementApi("qa", new Request("https://gleba.example/api/account/export"))).toBeNull()
  })
})
