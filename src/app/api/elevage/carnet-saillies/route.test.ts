import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  saillieFindMany: vi.fn(),
  exploitationFindUnique: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    saillie: { findMany: mocks.saillieFindMany },
    exploitation: { findUnique: mocks.exploitationFindUnique },
  },
}))

import { GET } from "./route"

describe("carnet de saillies PDF", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.saillieFindMany.mockResolvedValue([])
    mocks.exploitationFindUnique.mockResolvedValue(null)
  })

  it("génère un PDF paginé dans le périmètre de l'utilisateur", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/carnet-saillies?year=2026&filiere=rente",
    ))
    const bytes = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF")
    expect(mocks.saillieFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: "user-1" }),
    }))
  })

  it("rejette une année ou une filière invalide avant les lectures métier", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/carnet-saillies?year=1980&filiere=inconnue",
    ))

    expect(response.status).toBe(400)
    expect(mocks.saillieFindMany).not.toHaveBeenCalled()
  })
})
