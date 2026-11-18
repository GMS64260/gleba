import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ requireAuthApi: vi.fn(), checkAdjacence: vi.fn() }))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: (session: { user: { exploitationId: string } }) => session.user.exploitationId,
}))
vi.mock("@/lib/associations-adjacence", () => ({ checkAdjacence: mocks.checkAdjacence }))

import { GET } from "./route"

const appel = (query: string) => GET(new NextRequest(`http://localhost/api/cultures/check-adjacence${query}`))

describe("GET /api/cultures/check-adjacence", () => {
  beforeEach(() => {
    mocks.requireAuthApi.mockReset()
    mocks.checkAdjacence.mockReset()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "compte-invite", exploitationId: "exploitation-1" } },
    })
    mocks.checkAdjacence.mockResolvedValue({ alertes: [], suggestions: [], ilot: null, planchesVoisines: [] })
  })

  it("borne à l'exploitation et transmet la période de la candidate", async () => {
    const res = await appel("?especeId=Haricot&plancheId=p1&debut=2026-05-01&fin=2026-08-31")
    expect(res.status).toBe(200)
    const args = mocks.checkAdjacence.mock.calls[0]
    expect(args.slice(0, 3)).toEqual(["Haricot", "p1", "exploitation-1"])
    expect(args[5]).toEqual({
      debut: new Date("2026-05-01T00:00:00.000Z"),
      fin: new Date("2026-08-31T00:00:00.000Z"),
    })
  })

  it("ignore une période incomplète, invalide ou inversée", async () => {
    for (const q of ["", "&debut=2026-05-01", "&debut=abc&fin=2026-08-31", "&debut=2026-09-01&fin=2026-08-31"]) {
      await appel(`?especeId=Haricot&plancheId=p1${q}`)
      expect(mocks.checkAdjacence.mock.lastCall?.[5]).toBeNull()
    }
  })

  it("rend 400 sans espèce ou planche, et une erreur lisible sur panne", async () => {
    expect((await appel("?especeId=Haricot")).status).toBe(400)
    mocks.checkAdjacence.mockRejectedValue(new Error("base indisponible"))
    const res = await appel("?especeId=Haricot&plancheId=p1")
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/voisinage/)
  })
})
