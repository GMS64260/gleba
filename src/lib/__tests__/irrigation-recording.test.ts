import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  default: {
    culture: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    irrigationPlanifiee: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      createMany: vi.fn(),
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
    findMany: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
    createMany: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
}

const DATE_EFFECTIVE = new Date("2026-07-29T10:00:00.000Z")
const FIN_JOURNEE = new Date("2026-07-29T23:59:59.999Z")
const DEBUT_JOURNEE = new Date("2026-07-29T00:00:00.000Z")

/** Espèce gourmande : cycle d'arrosage de 2 jours. */
const GOURMANDE = { espece: { besoinEau: 4 } }

function passage(
  id: number,
  cultureId: number,
  datePrevue: string,
  culture: { espece: { besoinEau: number | null } } = GOURMANDE,
) {
  return { id, cultureId, datePrevue: new Date(datePrevue), fait: false, perimee: false, culture }
}

/** Les deux lectures de la fonction : passages ouverts, puis clos du jour. */
function mockLectures(
  ouvertes: ReturnType<typeof passage>[],
  closesAujourdhui: Array<{ cultureId: number }> = [],
) {
  mockedPrisma.irrigationPlanifiee.findMany
    .mockResolvedValueOnce(ouvertes)
    .mockResolvedValueOnce(closesAujourdhui)
}

/** Le n-ième `updateMany` passé à la transaction (0 = clôture, 1 = péremption). */
function updateManyCall(index: number) {
  return mockedPrisma.irrigationPlanifiee.updateMany.mock.calls[index][0]
}

describe("enregistrerArrosageCultures", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedPrisma.culture.updateMany.mockReturnValue({ kind: "cultures" })
    mockedPrisma.irrigationPlanifiee.updateMany.mockReturnValue({ kind: "irrigations" })
    mockedPrisma.irrigationPlanifiee.createMany.mockReturnValue({ kind: "traces" })
    mockedPrisma.irrigationPlanifiee.findMany.mockResolvedValue([])
    mockedPrisma.$transaction.mockResolvedValue([
      { count: 2 },
      { count: 3 },
      { count: 0 },
      { count: 2 },
    ])
  })

  it("synchronise les cultures de la planche et termine les tâches dues", async () => {
    mockedPrisma.culture.findMany
      .mockResolvedValueOnce([{ id: 10, plancheId: "planche-a" }])
      .mockResolvedValueOnce([{ id: 10 }, { id: 11 }])
    mockLectures([passage(1, 10, "2026-07-29T06:00:00.000Z")])

    const result = await enregistrerArrosageCultures({
      userId: "user-1",
      cultureIds: [10],
      dateEffective: DATE_EFFECTIVE,
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
    // Les passages ouverts sont lus avant d'être clos : seuls les
    // rattrapables sont ensuite estampillés de la date réelle.
    expect(mockedPrisma.irrigationPlanifiee.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        userId: "user-1",
        cultureId: { in: [10, 11] },
        fait: false,
        perimee: false,
        datePrevue: { lte: FIN_JOURNEE },
      },
      select: {
        id: true,
        cultureId: true,
        datePrevue: true,
        fait: true,
        perimee: true,
        culture: { select: { espece: { select: { besoinEau: true } } } },
      },
    })
    expect(updateManyCall(0)).toEqual({
      where: { id: { in: [1] } },
      data: { fait: true, dateEffective: DATE_EFFECTIVE },
    })
    expect(result).toMatchObject({
      cultureIds: [10, 11],
      plancheIds: ["planche-a"],
      culturesMisesAJour: 2,
      irrigationsPlanifieesTerminees: 3,
      irrigationsPerimees: 0,
      irrigationsTraceesCreees: 2,
    })
    expect(irrigationCache.invalidateUser).toHaveBeenCalledWith("user-1")
  })

  // Friction du 2026-08-14 : huit tapes « arrosé » soldaient trente lignes
  // prévues du 08 au 13, toutes estampillées du 14. Le registre affirmait des
  // arrosages qui n'avaient pas eu lieu.
  it("abandonne les passages manqués de plus d'un cycle au lieu de les antidater", async () => {
    mockedPrisma.culture.findMany
      .mockResolvedValueOnce([{ id: 10, plancheId: "planche-a" }])
      .mockResolvedValueOnce([{ id: 10 }])
    mockLectures([
      passage(1, 10, "2026-07-24T06:00:00.000Z"), // 5 j de retard → abandonné
      passage(2, 10, "2026-07-26T06:00:00.000Z"), // 3 j de retard → abandonné
      passage(3, 10, "2026-07-27T06:00:00.000Z"), // 2 j = un cycle → rattrapable
      passage(4, 10, "2026-07-29T06:00:00.000Z"), // aujourd'hui → rattrapable
    ])

    await enregistrerArrosageCultures({
      userId: "user-1",
      cultureIds: [10],
      dateEffective: DATE_EFFECTIVE,
    })

    expect(updateManyCall(0)).toEqual({
      where: { id: { in: [3, 4] } },
      data: { fait: true, dateEffective: DATE_EFFECTIVE },
    })
    expect(updateManyCall(1)).toEqual({
      where: { id: { in: [1, 2] } },
      data: { perimee: true },
    })
  })

  // Le cycle suit le besoin en eau de l'espèce : une culture peu exigeante
  // (5 jours) reste rattrapable là où une gourmande (2 jours) est abandonnée.
  it("mesure le cycle sur le besoin en eau de l'espèce", async () => {
    mockedPrisma.culture.findMany
      .mockResolvedValueOnce([{ id: 10, plancheId: "planche-a" }])
      .mockResolvedValueOnce([{ id: 10 }, { id: 11 }])
    mockLectures([
      passage(1, 10, "2026-07-25T06:00:00.000Z", GOURMANDE),
      passage(2, 11, "2026-07-25T06:00:00.000Z", { espece: { besoinEau: 1 } }),
    ])

    await enregistrerArrosageCultures({
      userId: "user-1",
      cultureIds: [10],
      dateEffective: DATE_EFFECTIVE,
    })

    expect(updateManyCall(0)).toEqual({
      where: { id: { in: [2] } },
      data: { fait: true, dateEffective: DATE_EFFECTIVE },
    })
    expect(updateManyCall(1)).toEqual({
      where: { id: { in: [1] } },
      data: { perimee: true },
    })
  })

  // QA cmsioeku5 — sans irrigation planifiée, l'arrosage noté n'apparaissait
  // nulle part dans Interventions : on crée la trace qui manquait.
  it("crée une irrigation clôturée pour les cultures sans trace du jour", async () => {
    mockedPrisma.culture.findMany
      .mockResolvedValueOnce([{ id: 10, plancheId: "planche-a" }])
      .mockResolvedValueOnce([{ id: 10 }, { id: 11 }])
    mockLectures([])

    await enregistrerArrosageCultures({
      userId: "user-1",
      cultureIds: [10],
      dateEffective: DATE_EFFECTIVE,
    })

    expect(mockedPrisma.irrigationPlanifiee.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        userId: "user-1",
        cultureId: { in: [10, 11] },
        fait: true,
        dateEffective: { gte: DEBUT_JOURNEE, lte: FIN_JOURNEE },
      },
      select: { cultureId: true },
    })
    expect(mockedPrisma.irrigationPlanifiee.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user-1",
          cultureId: 10,
          datePrevue: DATE_EFFECTIVE,
          fait: true,
          dateEffective: DATE_EFFECTIVE,
          notes: "Arrosage noté depuis les conseils d’irrigation",
        },
        {
          userId: "user-1",
          cultureId: 11,
          datePrevue: DATE_EFFECTIVE,
          fait: true,
          dateEffective: DATE_EFFECTIVE,
          notes: "Arrosage noté depuis les conseils d’irrigation",
        },
      ],
    })
  })

  it("ne duplique pas la trace quand une irrigation couvre déjà la journée", async () => {
    mockedPrisma.culture.findMany
      .mockResolvedValueOnce([{ id: 10, plancheId: "planche-a" }])
      .mockResolvedValueOnce([{ id: 10 }, { id: 11 }])
    mockLectures([], [{ cultureId: 10 }])

    await enregistrerArrosageCultures({
      userId: "user-1",
      cultureIds: [10],
      dateEffective: DATE_EFFECTIVE,
    })

    const [{ data }] = mockedPrisma.irrigationPlanifiee.createMany.mock.calls[0]
    expect(data.map((d: { cultureId: number }) => d.cultureId)).toEqual([11])
  })

  // Un passage abandonné n'est pas une trace : sans cela, l'arrosage réel du
  // jour disparaîtrait du registre d'interventions.
  it("crée la trace du jour même quand un passage périmé traîne sur la culture", async () => {
    mockedPrisma.culture.findMany
      .mockResolvedValueOnce([{ id: 10, plancheId: "planche-a" }])
      .mockResolvedValueOnce([{ id: 10 }])
    mockLectures([passage(1, 10, "2026-07-20T06:00:00.000Z")])

    await enregistrerArrosageCultures({
      userId: "user-1",
      cultureIds: [10],
      dateEffective: DATE_EFFECTIVE,
    })

    const [{ data }] = mockedPrisma.irrigationPlanifiee.createMany.mock.calls[0]
    expect(data.map((d: { cultureId: number }) => d.cultureId)).toEqual([10])
    expect(updateManyCall(0)).toEqual({
      where: { id: { in: [] } },
      data: { fait: true, dateEffective: DATE_EFFECTIVE },
    })
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
