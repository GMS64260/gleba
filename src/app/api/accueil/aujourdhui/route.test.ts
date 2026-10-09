/**
 * GET /api/accueil/aujourdhui — la route ne fait que passer la session à la
 * composition : pas de Prisma en direct ici, donc pas de fuite possible qui
 * ne soit déjà celle d'un service existant.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  composerAujourdhui: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/accueil/composition.server", () => ({ composerAujourdhui: mocks.composerAujourdhui }))

import { GET } from "./route"

const session = { user: { id: "exploitation-1", acteurId: "personne-2", role: "USER" } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session })
  mocks.composerAujourdhui.mockResolvedValue({ date: "2026-10-09", elements: [], sourcesEnErreur: [] })
})

describe("GET /api/accueil/aujourdhui", () => {
  it("rend le refus d'authentification tel quel, sans composer", async () => {
    const refus = new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401 })
    mocks.requireAuthApi.mockResolvedValue({ error: refus, session: null })

    const res = await GET()

    expect(res.status).toBe(401)
    expect(mocks.composerAujourdhui).not.toHaveBeenCalled()
  })

  it("compose avec la session rendue par requireAuthApi (tenant + acteur) et n'est jamais mise en cache", async () => {
    const res = await GET()

    expect(res.status).toBe(200)
    expect(mocks.composerAujourdhui).toHaveBeenCalledWith(session)
    expect(res.headers.get("Cache-Control")).toContain("no-store")
    expect(await res.json()).toMatchObject({ date: "2026-10-09" })
  })

  it("répond 500 avec un message lisible si la composition échoue", async () => {
    mocks.composerAujourdhui.mockRejectedValue(new Error("boom"))

    const res = await GET()

    expect(res.status).toBe(500)
    expect((await res.json()).error).toContain("Impossible de composer")
  })
})
