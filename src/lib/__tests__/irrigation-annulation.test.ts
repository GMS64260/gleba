/**
 * Revue du modèle d'arrosage (2026-10-10) : « Noter » s'annule exactement.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const tx = vi.hoisted(() => ({
  culture: { findMany: vi.fn(), update: vi.fn() },
  irrigationPlanifiee: { deleteMany: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({
  default: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
}))
vi.mock("@/lib/irrigation-cache", () => ({ irrigationCache: { invalidateUser: vi.fn() } }))

import { annulerArrosageCultures } from "@/lib/irrigation-recording"
import { irrigationCache } from "@/lib/irrigation-cache"

const GESTE = new Date("2026-10-10T12:34:20.052Z")
const AVANT = "2026-09-29T08:00:00.000Z"

describe("annulerArrosageCultures", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.irrigationPlanifiee.deleteMany.mockResolvedValue({ count: 2 })
  })

  it("supprime les traces de CE geste et rend à chaque culture son dernier arrosage d'avant", async () => {
    tx.culture.findMany.mockResolvedValue([
      { id: 10, derniereIrrigation: GESTE },
      { id: 11, derniereIrrigation: GESTE },
    ])

    const r = await annulerArrosageCultures({ userId: "u1", dateEffective: GESTE, avant: { 10: AVANT, 11: null } })

    expect(tx.culture.findMany).toHaveBeenCalledWith({
      where: { userId: "u1", id: { in: [10, 11] } },
      select: { id: true, derniereIrrigation: true },
    })
    expect(tx.irrigationPlanifiee.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", cultureId: { in: [10, 11] }, fait: true, dateEffective: GESTE },
    })
    expect(tx.culture.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { derniereIrrigation: new Date(AVANT) } })
    expect(tx.culture.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { derniereIrrigation: null } })
    expect(r).toEqual({ tracesSupprimees: 2, culturesRestaurees: 2 })
    expect(irrigationCache.invalidateUser).toHaveBeenCalledWith("u1")
  })

  it("ne défait pas un arrosage noté depuis", async () => {
    tx.culture.findMany.mockResolvedValue([{ id: 10, derniereIrrigation: new Date("2026-10-10T17:00:00.000Z") }])

    const r = await annulerArrosageCultures({ userId: "u1", dateEffective: GESTE, avant: { 10: AVANT } })

    expect(tx.culture.update).not.toHaveBeenCalled()
    expect(r.culturesRestaurees).toBe(0)
  })

  it("ne touche qu'aux cultures du compte", async () => {
    tx.culture.findMany.mockResolvedValue([{ id: 10, derniereIrrigation: GESTE }])

    await annulerArrosageCultures({ userId: "u1", dateEffective: GESTE, avant: { 10: AVANT, 999: null } })

    expect(tx.irrigationPlanifiee.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", cultureId: { in: [10] }, fait: true, dateEffective: GESTE },
    })
  })

  it("refuse une demande vide ou une date invalide sans rien écrire", async () => {
    expect(await annulerArrosageCultures({ userId: "u1", dateEffective: new Date("x"), avant: { 10: null } })).toEqual({
      tracesSupprimees: 0,
      culturesRestaurees: 0,
    })
    expect(await annulerArrosageCultures({ userId: "u1", dateEffective: GESTE, avant: {} })).toEqual({
      tracesSupprimees: 0,
      culturesRestaurees: 0,
    })
    expect(tx.irrigationPlanifiee.deleteMany).not.toHaveBeenCalled()
  })
})
