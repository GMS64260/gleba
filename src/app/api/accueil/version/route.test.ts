import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lireVersionAccueil: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/accueil/preference.server", () => ({ lireVersionAccueil: mocks.lireVersionAccueil }))

import { GET } from "./route"

const session = { user: { id: "exploitation-1", acteurId: "personne-2", role: "USER" } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session })
  mocks.lireVersionAccueil.mockResolvedValue("v2")
})

describe("GET /api/accueil/version", () => {
  it("rend le refus d'authentification tel quel", async () => {
    const refus = new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401 })
    mocks.requireAuthApi.mockResolvedValue({ error: refus, session: null })
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mocks.lireVersionAccueil).not.toHaveBeenCalled()
  })

  it("lit la version effective de l'ACTEUR (pas du tenant) et n'est jamais mise en cache", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(mocks.lireVersionAccueil).toHaveBeenCalledWith("personne-2")
    expect(res.headers.get("Cache-Control")).toContain("no-store")
    expect(await res.json()).toEqual({ version: "v2" })
  })
})
