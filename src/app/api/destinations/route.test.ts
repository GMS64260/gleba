import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: { destination: { findMany: mocks.findMany } },
}))

import { GET } from "./route"

describe("GET /api/destinations", () => {
  beforeEach(() => vi.clearAllMocks())

  it("exige une session", async () => {
    const unauthorized = Response.json({ error: "Non autorisé" }, { status: 401 })
    mocks.requireAuthApi.mockResolvedValue({ error: unauthorized, session: null })

    const response = await GET()

    expect(response.status).toBe(401)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it("retourne le référentiel trié avec une projection publique minimale", async () => {
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.findMany.mockResolvedValue([
      { id: "Consommation", description: "Consommation personnelle" },
    ])

    const response = await GET()

    expect(response.status).toBe(200)
    expect(mocks.findMany).toHaveBeenCalledWith({
      select: { id: true, description: true },
      orderBy: { id: "asc" },
    })
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "Consommation", description: "Consommation personnelle" }],
    })
  })
})
