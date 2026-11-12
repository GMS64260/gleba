import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  getAssociations: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: (session: { user: { id: string } }) => session.user.id,
}))
vi.mock("@/lib/planification", () => ({ getAssociations: mocks.getAssociations }))

import { GET } from "./route"

const appel = (query: string) => GET(new NextRequest(`http://localhost/api/planification/associations${query}`))

describe("GET /api/planification/associations", () => {
  beforeEach(() => {
    mocks.requireAuthApi.mockReset()
    mocks.getAssociations.mockReset()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "exploitation-1" } } })
    mocks.getAssociations.mockResolvedValue([])
  })

  it("lit l'année demandée et borne la lecture à l'exploitation", async () => {
    const res = await appel("?annee=2027")
    expect(res.status).toBe(200)
    expect(mocks.getAssociations).toHaveBeenCalledWith("exploitation-1", 2027)
    expect((await res.json()).annee).toBe(2027)
  })

  it("retombe sur l'année courante quand le paramètre n'est pas une année", async () => {
    const courante = new Date().getFullYear()
    for (const query of ["?annee=abc", "?annee=", "?annee=12", ""]) {
      const res = await appel(query)
      expect(res.status).toBe(200)
      expect(mocks.getAssociations).toHaveBeenLastCalledWith("exploitation-1", courante)
      expect((await res.json()).annee).toBe(courante)
    }
  })
})
