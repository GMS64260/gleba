import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  naissanceFindMany: vi.fn(),
  abattageGroupBy: vi.fn(),
  animalGroupBy: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    naissanceAnimale: { findMany: mocks.naissanceFindMany },
    abattage: { groupBy: mocks.abattageGroupBy },
    animal: { groupBy: mocks.animalGroupBy },
  },
}))

import { reconstituerEffectifsLots } from "../effectif"

describe("reconstituerEffectifsLots", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.abattageGroupBy.mockResolvedValue([])
    mocks.animalGroupBy.mockResolvedValue([])
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

  // Ticket QA caprin cmrz0mt8c (2026-07-24) — les naissances individualisées en
  // fiches quittent le comptage anonyme (`quantiteActuelle` redescend) mais
  // deviennent des animaux nominatifs rattachés au lot : elles doivent être
  // réintégrées, sinon l'effectif fige.
  it("réintègre les naissances individualisées en fiches nominatives", async () => {
    // Lot : 6 initial, +3 naissances vivantes, 3 fiches créées → quantiteActuelle
    // redescendue à 6. Effectif réel attendu : 6 anonymes… non, 6 = 3 anonymes
    // restants + 3 nominatifs ; ici quantiteActuelle=6 + 3 nominatifs plafonné à 9.
    mocks.naissanceFindMany.mockResolvedValue([{ lotId: 51, nombreVivants: 3 }])
    mocks.animalGroupBy.mockResolvedValue([{ lotId: 51, _count: { _all: 3 } }])
    const result = await reconstituerEffectifsLots("u1", [
      { id: 51, quantiteInitiale: 6, quantiteActuelle: 6 },
    ])
    expect(result.get(51)?.effectifCalcule).toBe(9)
  })

  it("plafonne les affectations nominatives surnuméraires par les mouvements tracés", async () => {
    // 2 animaux nominatifs affectés manuellement (sans décrément du compteur),
    // initial 3 + 2 naissances : le plafond tracé (5) borne le total.
    mocks.naissanceFindMany.mockResolvedValue([{ lotId: 50, nombreVivants: 2 }])
    mocks.animalGroupBy.mockResolvedValue([{ lotId: 50, _count: { _all: 2 } }])
    const result = await reconstituerEffectifsLots("u1", [
      { id: 50, quantiteInitiale: 3, quantiteActuelle: 5 },
    ])
    expect(result.get(50)?.effectifCalcule).toBe(5)
  })
})
