import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: { archiveRegistreElevage: { findMany: mocks.findMany } },
}))

import { GET } from "./route"

describe("liste des archives du registre", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.findMany.mockResolvedValue([])
  })

  it("borne la liste à l’utilisateur et à l’année demandée", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/registres-archives?year=2026",
    ))

    expect(response.status).toBe(200)
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1", annee: 2026 },
      take: 50,
    }))
  })

  it("rejette une année invalide avant la requête Prisma", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/registres-archives?year=1980",
    ))

    expect(response.status).toBe(400)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
