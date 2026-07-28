import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  productionFindFirst: vi.fn(),
  mouvementCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    productionOeuf: { findFirst: mocks.productionFindFirst },
    mouvementStockOeuf: { create: mocks.mouvementCreate },
  },
}))

import { POST } from "./route"

const request = (body: object) => new NextRequest("http://localhost/api/elevage/stock-oeufs", {
  method: "POST",
  body: JSON.stringify(body),
  headers: { "content-type": "application/json" },
})

describe("sorties du stock d'œufs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.productionFindFirst.mockResolvedValue({
      id: 7,
      userId: "user-1",
      date: new Date("2026-07-01T00:00:00Z"),
      quantite: 30,
      casses: 2,
      sales: 1,
      mouvementsStock: [{ quantite: 5 }],
    })
    mocks.mouvementCreate.mockResolvedValue({ id: "mvt-1" })
  })

  it("interdit une vente après J+21", async () => {
    const response = await POST(request({
      productionId: 7,
      date: "2026-07-23",
      type: "vente",
      quantite: 2,
    }))

    expect(response.status).toBe(422)
    expect((await response.json()).error).toContain("J+21")
    expect(mocks.mouvementCreate).not.toHaveBeenCalled()
  })

  it("refuse une sortie supérieure au stock restant du lot", async () => {
    const response = await POST(request({
      productionId: 7,
      date: "2026-07-10",
      type: "don",
      quantite: 23,
    }))

    expect(response.status).toBe(422)
    expect((await response.json()).error).toContain("22 œuf")
    expect(mocks.mouvementCreate).not.toHaveBeenCalled()
  })
})
