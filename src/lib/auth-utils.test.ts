import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), etat: vi.fn(), contexte: vi.fn(), redirect: vi.fn((chemin: string) => { throw new Error(`REDIRECT:${chemin}`) }),
}))
vi.mock("./auth", () => ({ auth: mocks.auth }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock("./activity", () => ({ touchActivity: vi.fn() }))
vi.mock("./compte-actif", () => ({ lireEtatCompte: mocks.etat }))
vi.mock("./exploitation/membres", () => ({ resoudreContexteExploitation: mocks.contexte }))
vi.mock("./abonnement/serveur", () => ({ refusAbonnementApi: vi.fn(async () => null) }))

import { requireAdmin, requireAdminApi, requireAuth, requireAuthApi } from "./auth-utils"

const session = (role: string, impersonatedBy: string | null = null) => ({ user: { id: "u1", email: "a@b.fr", role, impersonatedBy } })
const requete = () => new Request("http://localhost/api/admin/users", { method: "GET" })

describe("gardes de session : la base fait foi sur le rôle et le compte actif", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NODE_ENV", "test")
    mocks.contexte.mockResolvedValue({ tenantId: "u1", acteurId: "u1", role: "PROPRIETAIRE", modules: null, estProprietaire: true, peutEcrire: true })
  })

  it("un administrateur rétrogradé perd l’accès admin malgré son jeton", async () => {
    mocks.auth.mockResolvedValue(session("ADMIN"))
    mocks.etat.mockResolvedValue({ actif: true, role: "USER" })
    const { error, session: rendue } = await requireAdminApi(requete())
    expect(rendue).toBeNull()
    expect(error?.status).toBe(403)
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/")
  })

  it("un compte promu en base devient administrateur sans se reconnecter", async () => {
    mocks.auth.mockResolvedValue(session("USER"))
    mocks.etat.mockResolvedValue({ actif: true, role: "ADMIN" })
    const { error, session: rendue } = await requireAdminApi(requete())
    expect(error).toBeNull()
    expect(rendue?.user.role).toBe("ADMIN")
  })

  it("un compte désactivé reçoit 401 côté API et quitte sa session côté page", async () => {
    mocks.auth.mockResolvedValue(session("USER"))
    mocks.etat.mockResolvedValue({ actif: false })
    const { error, session: rendue } = await requireAuthApi(requete())
    expect(rendue).toBeNull()
    expect(error?.status).toBe(401)
    await expect(requireAuth()).rejects.toThrow("REDIRECT:/api/session-terminee")
  })

  it("transmet l’administrateur d’une consultation à la relecture", async () => {
    mocks.auth.mockResolvedValue(session("USER", "a1"))
    mocks.etat.mockResolvedValue({ actif: true, role: "USER" })
    await requireAuthApi(requete())
    expect(mocks.etat).toHaveBeenCalledWith("u1", "a1")
  })
})
