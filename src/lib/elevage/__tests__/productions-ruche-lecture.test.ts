/**
 * Liste des récoltes de la ruche coupée à 200 par année sans le dire
 * (défaut ouvert de Gleba-motifs-bugs) : le nombre réel est exposé et
 * `limit = null` rend toute l'année.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  groupBy: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: { productionRuche: { findMany: mocks.findMany, groupBy: mocks.groupBy } },
}))

import { computeProductionsRuche } from "../productions-ruche-lecture"

const recolte = (id: number) => ({
  id,
  produit: "miel",
  unite: "kg",
  quantite: 10,
  date: new Date("2025-06-01"),
  mouvementsStock: [],
  lot: null,
  animal: null,
})

describe("computeProductionsRuche", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.groupBy.mockResolvedValue([
      { produit: "miel", unite: "kg", _sum: { quantite: 2500 }, _count: 250 },
      { produit: "cire", unite: "kg", _sum: { quantite: 30 }, _count: 12 },
    ])
  })

  it("borne la liste mais annonce le nombre réel de récoltes de l'année", async () => {
    mocks.findMany.mockImplementation((args: { take?: number; where: { date?: unknown } }) =>
      Promise.resolve(args.where.date ? Array.from({ length: args.take ?? 262 }, (_, i) => recolte(i)) : []),
    )
    const lecture = await computeProductionsRuche("user-1", 2025)
    expect(mocks.findMany.mock.calls[0][0].take).toBe(200)
    expect(lecture.meta).toEqual({ annee: 2025, total: 262, affichees: 200 })
  })

  it("limit = null rend toutes les récoltes de l'année", async () => {
    mocks.findMany.mockImplementation((args: { take?: number; where: { date?: unknown } }) =>
      Promise.resolve(args.where.date ? Array.from({ length: args.take ?? 262 }, (_, i) => recolte(i)) : []),
    )
    const lecture = await computeProductionsRuche("user-1", 2025, null)
    expect(mocks.findMany.mock.calls[0][0]).not.toHaveProperty("take")
    expect(lecture.meta).toEqual({ annee: 2025, total: 262, affichees: 262 })
  })
})
