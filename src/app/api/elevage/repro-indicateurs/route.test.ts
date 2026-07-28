import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  saillieFindMany: vi.fn(),
  naissanceFindMany: vi.fn(),
  animalFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    saillie: { findMany: mocks.saillieFindMany },
    naissanceAnimale: { findMany: mocks.naissanceFindMany },
    animal: { findMany: mocks.animalFindMany },
  },
}))

import { GET } from "./route"

describe("API indicateurs de reproduction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.saillieFindMany.mockResolvedValue([])
    mocks.naissanceFindMany.mockResolvedValue([])
    mocks.animalFindMany.mockResolvedValue([])
  })

  it("filtre les naissances par la mère ou par le lot", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/repro-indicateurs?annee=2026&filiere=rente",
    ))

    expect(response.status).toBe(200)
    expect(mocks.naissanceFindMany).toHaveBeenCalledTimes(2)
    for (const [appel] of mocks.naissanceFindMany.mock.calls) {
      expect(appel.where).toEqual(expect.objectContaining({
        userId: "user-1",
        OR: [
          { mere: { especeAnimale: { filiere: "rente" } } },
          { lot: { especeAnimale: { filiere: "rente" } } },
        ],
      }))
    }
  })
})
