import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  default: {
    culture: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    irrigationPlanifiee: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/irrigation-cache", () => ({
  irrigationCache: {
    invalidateUser: vi.fn(),
  },
}))

import prisma from "@/lib/prisma"
import { irrigationCache } from "@/lib/irrigation-cache"
import { enregistrerArrosageCultures } from "@/lib/irrigation-recording"

const mockedPrisma = prisma as unknown as {
  culture: {
    findMany: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
  }
  irrigationPlanifiee: {
    updateMany: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
}

describe("enregistrerArrosageCultures", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedPrisma.culture.updateMany.mockReturnValue({ kind: "cultures" })
    mockedPrisma.irrigationPlanifiee.updateMany.mockReturnValue({ kind: "irrigations" })
    mockedPrisma.$transaction.mockResolvedValue([{ count: 2 }, { count: 3 }])
  })

  it("synchronise les cultures de la planche et termine les tâches dues", async () => {
    mockedPrisma.culture.findMany
      .mockResolvedValueOnce([{ id: 10, plancheId: "planche-a" }])
      .mockResolvedValueOnce([{ id: 10 }, { id: 11 }])

    const dateEffective = new Date("2026-07-29T10:00:00.000Z")
    const result = await enregistrerArrosageCultures({
      userId: "user-1",
      cultureIds: [10],
      dateEffective,
    })

    expect(mockedPrisma.culture.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        userId: "user-1",
        OR: [
          { id: { in: [10] } },
          {
            plancheId: { in: ["planche-a"] },
            terminee: null,
            AND: [{
              OR: [
                { semisFait: true },
                { plantationFaite: true },
              ],
            }],
          },
        ],
      },
      select: { id: true },
    })
    expect(mockedPrisma.irrigationPlanifiee.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        cultureId: { in: [10, 11] },
        fait: false,
        datePrevue: { lte: new Date("2026-07-29T23:59:59.999Z") },
      },
      data: {
        fait: true,
        dateEffective,
      },
    })
    expect(result).toMatchObject({
      cultureIds: [10, 11],
      plancheIds: ["planche-a"],
      culturesMisesAJour: 2,
      irrigationsPlanifieesTerminees: 3,
    })
    expect(irrigationCache.invalidateUser).toHaveBeenCalledWith("user-1")
  })

  it("ignore une culture qui n'appartient pas à l'utilisateur", async () => {
    mockedPrisma.culture.findMany.mockResolvedValueOnce([])

    const result = await enregistrerArrosageCultures({
      userId: "user-1",
      cultureIds: [999],
    })

    expect(result.culturesMisesAJour).toBe(0)
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled()
    expect(irrigationCache.invalidateUser).not.toHaveBeenCalled()
  })
})
