import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  naissanceFindMany: vi.fn(),
  abattageGroupBy: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    naissanceAnimale: { findMany: mocks.naissanceFindMany },
    abattage: { groupBy: mocks.abattageGroupBy },
  },
}))

import { reconstituerEffectifsLots } from "../effectif"

describe("reconstituerEffectifsLots", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.abattageGroupBy.mockResolvedValue([])
  })

  it("ne recherche que les naissances explicitement rattachées aux lots", async () => {
    mocks.naissanceFindMany.mockResolvedValue([])
    await reconstituerEffectifsLots("u1", [{ id: 4, quantiteInitiale: 10, quantiteActuelle: 10 }])
    expect(mocks.naissanceFindMany).toHaveBeenCalledWith({
      where: { userId: "u1", lotId: { in: [4] } },
      select: { lotId: true, nombreVivants: true },
    })
  })

  it("soustrait les abattages sans dépasser le compteur stocké prudent", async () => {
    mocks.naissanceFindMany.mockResolvedValue([{ lotId: 4, nombreVivants: 3 }])
    mocks.abattageGroupBy.mockResolvedValue([{ lotId: 4, _sum: { quantite: 5 } }])
    const result = await reconstituerEffectifsLots("u1", [{ id: 4, quantiteInitiale: 10, quantiteActuelle: 12 }])
    expect(result.get(4)?.effectifCalcule).toBe(8)
  })
})
