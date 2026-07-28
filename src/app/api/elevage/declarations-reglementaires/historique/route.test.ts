import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findMany: vi.fn(),
  usersFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    declarationReglementaireEvenement: { findMany: mocks.findMany },
    user: { findMany: mocks.usersFindMany },
  },
}))

import { GET } from "./route"

describe("API historique réglementaire", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.findMany.mockResolvedValue([{
      id: "event-1",
      action: "STATUT_MODIFIE",
      actorUserId: "user-1",
      statutAvant: "A_DECLARER",
      statutApres: "TRANSMISE",
      snapshotHash: "hash",
      metadata: null,
      createdAt: new Date("2026-07-25T10:00:00.000Z"),
    }])
    mocks.usersFindMany.mockResolvedValue([{
      id: "user-1",
      name: "Éleveuse test",
      email: "test@example.test",
    }])
  })

  it("scope le journal par utilisateur et référence", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/declarations-reglementaires/historique?key=animal%3A7%3ASORTIE",
    ))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: "user-1",
        declarationKey: "animal:7:SORTIE",
      },
      take: 100,
    }))
    expect(payload.data[0].actorLabel).toBe("Éleveuse test")
  })

  it("rejette une référence absente", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/declarations-reglementaires/historique",
    ))
    expect(response.status).toBe(400)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
