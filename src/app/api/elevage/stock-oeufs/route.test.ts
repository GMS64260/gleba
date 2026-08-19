import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  productionFindFirst: vi.fn(),
  mouvementCreate: vi.fn(),
  soinFindMany: vi.fn(),
  animalFindFirst: vi.fn(),
  animalFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    productionOeuf: { findFirst: mocks.productionFindFirst },
    mouvementStockOeuf: { create: mocks.mouvementCreate },
    // Ticket cmsoeyhs5 — la garde vente consulte les soins (délai œufs) et
    // l'expansion lot↔membres (ciblesAffectees).
    soinAnimal: { findMany: mocks.soinFindMany },
    animal: { findFirst: mocks.animalFindFirst, findMany: mocks.animalFindMany },
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
      lotId: 54,
      animalId: null,
      quantite: 30,
      casses: 2,
      sales: 1,
      mouvementsStock: [{ quantite: 5 }],
    })
    mocks.mouvementCreate.mockResolvedValue({ id: "mvt-1" })
    mocks.soinFindMany.mockResolvedValue([])
    mocks.animalFindFirst.mockResolvedValue(null)
    mocks.animalFindMany.mockResolvedValue([])
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

  // Ticket cmsoeyhs5 — soin Dectomax fait sur le lot 54, fin d'attente œufs
  // au 2026-09-04 : une ponte du 11/08 ne doit jamais partir en vente.
  it("refuse la vente d'œufs pondus pendant un délai d'attente vétérinaire", async () => {
    mocks.productionFindFirst.mockResolvedValue({
      id: 7,
      userId: "user-1",
      date: new Date("2026-08-11T00:00:00Z"),
      lotId: 54,
      animalId: null,
      quantite: 30,
      casses: 0,
      sales: 0,
      mouvementsStock: [],
    })
    mocks.soinFindMany.mockResolvedValue([{
      date: new Date("2026-08-01T00:00:00Z"),
      finAttenteOeufs: new Date("2026-09-04T00:00:00Z"),
      animalId: null,
      lotId: 54,
    }])

    const response = await POST(request({
      productionId: 7,
      date: "2026-08-11",
      type: "vente",
      quantite: 2,
    }))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain("délai d'attente vétérinaire")
    expect(body.error).toContain("05/09/2026")
    expect(mocks.mouvementCreate).not.toHaveBeenCalled()
  })

  it("laisse sortir en destruction des œufs sous délai vétérinaire", async () => {
    mocks.productionFindFirst.mockResolvedValue({
      id: 7,
      userId: "user-1",
      date: new Date("2026-08-11T00:00:00Z"),
      lotId: 54,
      animalId: null,
      quantite: 30,
      casses: 0,
      sales: 0,
      mouvementsStock: [],
    })
    mocks.soinFindMany.mockResolvedValue([{
      date: new Date("2026-08-01T00:00:00Z"),
      finAttenteOeufs: new Date("2026-09-04T00:00:00Z"),
      animalId: null,
      lotId: 54,
    }])

    const response = await POST(request({
      productionId: 7,
      date: "2026-08-12",
      type: "destruction",
      quantite: 30,
    }))

    expect(response.status).toBe(201)
    expect(mocks.mouvementCreate).toHaveBeenCalled()
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
