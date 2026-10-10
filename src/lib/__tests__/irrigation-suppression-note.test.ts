/**
 * Ticket QA cmv2rfmzl (2026-10-10) : un arrosage noté se supprime depuis le
 * registre ; « Noter » ayant arrosé toute la planche, c'est le geste entier
 * qui part, et chaque culture retrouve son arrosage précédent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({
  irrigationPlanifiee: { findFirst: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  culture: { findMany: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ default: db }))
vi.mock("@/lib/irrigation-cache", () => ({ irrigationCache: { invalidateUser: vi.fn() } }))

import { supprimerArrosageNote } from "@/lib/irrigation-recording"
import { irrigationCache } from "@/lib/irrigation-cache"

const GESTE = new Date("2026-10-10T07:30:00.000Z")
const DOUBLE_TAP = new Date("2026-10-10T07:35:00.000Z")
const PRECEDENTE = new Date("2026-10-02T18:00:00.000Z")
const AUTRE_JOUR = new Date("2026-10-11T09:00:00.000Z")

describe("supprimerArrosageNote", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.irrigationPlanifiee.deleteMany.mockReturnValue({ kind: "delete" })
    db.culture.update.mockImplementation((arg) => ({ kind: "update", arg }))
    db.$transaction.mockResolvedValue([])
  })

  it("supprime le geste sur toute la planche et rend à chaque culture son arrosage précédent", async () => {
    db.irrigationPlanifiee.findFirst.mockResolvedValue({ id: 7, cultureId: 10, dateEffective: GESTE, culture: { plancheId: "p1" } })
    db.irrigationPlanifiee.findMany
      .mockResolvedValueOnce([{ id: 7, cultureId: 10 }, { id: 8, cultureId: 11 }])
      .mockResolvedValueOnce([{ cultureId: 10, dateEffective: PRECEDENTE }])
    db.culture.findMany.mockResolvedValue([
      { id: 10, derniereIrrigation: GESTE },
      // Double « Noter » 5 min après : une seule trace, horodatage avancé.
      { id: 11, derniereIrrigation: DOUBLE_TAP },
    ])

    const r = await supprimerArrosageNote({ userId: "u1", traceId: 7 })

    expect(r).toEqual({ supprime: true, cultureIds: [10, 11] })
    // Le geste : même horodatage, même planche, arrosages notés du compte.
    expect(db.irrigationPlanifiee.findMany.mock.calls[0][0].where).toMatchObject({
      userId: "u1",
      dateEffective: GESTE,
      culture: { plancheId: "p1" },
    })
    expect(db.irrigationPlanifiee.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [7, 8] }, userId: "u1" } })
    expect(db.culture.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { derniereIrrigation: PRECEDENTE } })
    expect(db.culture.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { derniereIrrigation: null } })
    expect(irrigationCache.invalidateUser).toHaveBeenCalledWith("u1")
  })

  it("ne touche pas au dernier arrosage s'il vient d'un geste ultérieur", async () => {
    db.irrigationPlanifiee.findFirst.mockResolvedValue({ id: 7, cultureId: 10, dateEffective: GESTE, culture: { plancheId: "p1" } })
    db.irrigationPlanifiee.findMany.mockResolvedValueOnce([{ id: 7, cultureId: 10 }]).mockResolvedValueOnce([])
    db.culture.findMany.mockResolvedValue([{ id: 10, derniereIrrigation: AUTRE_JOUR }])

    await supprimerArrosageNote({ userId: "u1", traceId: 7 })

    expect(db.culture.update).not.toHaveBeenCalled()
    expect(db.$transaction).toHaveBeenCalledWith([{ kind: "delete" }])
  })

  it("une trace introuvable (autre compte, passage non fait) : rien n'est écrit", async () => {
    db.irrigationPlanifiee.findFirst.mockResolvedValue(null)

    const r = await supprimerArrosageNote({ userId: "u1", traceId: 999 })

    expect(r).toEqual({ supprime: false, cultureIds: [] })
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(irrigationCache.invalidateUser).not.toHaveBeenCalled()
  })
})
