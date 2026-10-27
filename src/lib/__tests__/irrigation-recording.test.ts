import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

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
      update: vi.fn(),
    },
    intervention: {
      create: vi.fn(),
      deleteMany: vi.fn(),
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
import { annulerArrosageMesure, enregistrerArrosageCultures, enregistrerArrosageMesure } from "@/lib/irrigation-recording"

const mockedPrisma = prisma as unknown as {
  culture: {
    findMany: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
  }
  irrigationPlanifiee: {
    findMany: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
    createMany: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
}

const DATE_EFFECTIVE = new Date("2026-07-29T10:00:00.000Z")
// Fin du 29 juillet en Europe/Paris (UTC+2), comme le conteneur applicatif.
const FIN_JOURNEE = new Date("2026-07-29T21:59:59.999Z")
beforeAll(() => { vi.stubEnv("TZ", "Europe/Paris") })
afterAll(() => { vi.unstubAllEnvs() })

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
  closesAujourdhui: Array<{ id?: number; cultureId: number; notes?: string | null }> = [],
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
      select: { id: true, derniereIrrigation: true },
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
        // Fenêtre anti-doublon de 10 minutes (un second arrosage du soir a sa trace).
        dateEffective: { gte: new Date(DATE_EFFECTIVE.getTime() - 10 * 60_000), lte: FIN_JOURNEE },
      },
      select: { id: true, cultureId: true, notes: true },
    })
    expect(mockedPrisma.irrigationPlanifiee.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user-1",
          cultureId: 10,
          datePrevue: DATE_EFFECTIVE,
          fait: true,
          dateEffective: DATE_EFFECTIVE,
          notes: "Arrosage noté",
        },
        {
          userId: "user-1",
          cultureId: 11,
          datePrevue: DATE_EFFECTIVE,
          fait: true,
          dateEffective: DATE_EFFECTIVE,
          notes: "Arrosage noté",
        },
      ],
    })
  })

  // Refonte de l'arrosage (2026-10-10) : l'observation saisie sur la page
  // Tâches accompagne la trace, au lieu d'un passage planifié qu'on cochait.
  it("garde l'observation saisie avec l'arrosage dans la trace", async () => {
    mockedPrisma.culture.findMany
      .mockResolvedValueOnce([{ id: 10, plancheId: "planche-a" }])
      .mockResolvedValueOnce([{ id: 10 }])
    mockLectures([])

    await enregistrerArrosageCultures({
      userId: "user-1",
      cultureIds: [10],
      dateEffective: DATE_EFFECTIVE,
      notes: "  Sol sec en surface  ",
    })

    expect(mockedPrisma.irrigationPlanifiee.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ cultureId: 10, notes: "Sol sec en surface" })],
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

  // Double geste (deux écrans, double tap) avec une observation : elle
  // complète la trace du premier geste au lieu d'être perdue.
  it("complète la trace d'un double geste avec la nouvelle observation", async () => {
    mockedPrisma.culture.findMany
      .mockResolvedValueOnce([{ id: 10, plancheId: "planche-a" }])
      .mockResolvedValueOnce([{ id: 10 }, { id: 11 }])
    mockLectures([], [
      { id: 5, cultureId: 10, notes: "Arrosage noté" },
      { id: 6, cultureId: 11, notes: "Paillage refait" },
    ])

    await enregistrerArrosageCultures({
      userId: "user-1",
      cultureIds: [10],
      dateEffective: DATE_EFFECTIVE,
      notes: "Feuilles flétries",
    })

    expect(mockedPrisma.irrigationPlanifiee.createMany.mock.calls[0][0].data).toEqual([])
    expect(mockedPrisma.irrigationPlanifiee.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { notes: "Feuilles flétries" },
    })
    expect(mockedPrisma.irrigationPlanifiee.update).toHaveBeenCalledWith({
      where: { id: 6 },
      data: { notes: "Paillage refait · Feuilles flétries" },
    })
  })

  it("un double geste sans observation ne touche pas la trace", async () => {
    mockedPrisma.culture.findMany
      .mockResolvedValueOnce([{ id: 10, plancheId: "planche-a" }])
      .mockResolvedValueOnce([{ id: 10 }])
    mockLectures([], [{ id: 5, cultureId: 10, notes: "Paillage refait" }])

    await enregistrerArrosageCultures({ userId: "user-1", cultureIds: [10], dateEffective: DATE_EFFECTIVE })

    expect(mockedPrisma.irrigationPlanifiee.update).not.toHaveBeenCalled()
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

// Ticket QA cmv3japsf : « Noter » avec la quantité versée.
describe("enregistrerArrosageMesure", () => {
  const p = prisma as unknown as {
    culture: { findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> }
    intervention: { create: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> }
    irrigationPlanifiee: { createMany: ReturnType<typeof vi.fn> }
  }
  beforeEach(() => vi.clearAllMocks())

  it("crée une intervention « arrosage » avec ses litres, sans remettre le sol plein", async () => {
    p.culture.findMany.mockResolvedValue([{ id: 7, plancheId: "c3" }, { id: 8, plancheId: "c3" }])
    p.intervention.create.mockResolvedValue({ id: 501 })
    const r = await enregistrerArrosageMesure({ userId: "u1", cultureIds: [8, 7], litres: 193.04, dateEffective: DATE_EFFECTIVE })
    expect(r).toEqual({ ok: true, interventionId: 501, cultureIds: [7, 8], plancheId: "c3" })
    expect(p.intervention.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        date: DATE_EFFECTIVE,
        type: "arrosage",
        cultureId: 8,
        plancheId: "c3",
        fait: true,
        intrantNom: "Eau",
        intrantQuantite: 193,
        intrantUnite: "L",
        notes: null,
      },
      select: { id: true },
    })
    // Ni `derniereIrrigation` ni trace « Noter » : tous deux valent un plein.
    expect(p.culture.updateMany).not.toHaveBeenCalled()
    expect(p.irrigationPlanifiee.createMany).not.toHaveBeenCalled()
    expect(irrigationCache.invalidateUser).toHaveBeenCalledWith("u1")
  })

  it("refuse une quantité nulle ou démesurée, des planches mêlées ou des cultures d'un autre compte", async () => {
    expect(await enregistrerArrosageMesure({ userId: "u1", cultureIds: [7], litres: 0 })).toEqual({ ok: false, erreur: "Quantité versée invalide" })
    expect((await enregistrerArrosageMesure({ userId: "u1", cultureIds: [7], litres: 250_000 })).ok).toBe(false)
    p.culture.findMany.mockResolvedValueOnce([{ id: 7, plancheId: "c3" }, { id: 9, plancheId: "b5" }])
    expect(await enregistrerArrosageMesure({ userId: "u1", cultureIds: [7, 9], litres: 50 })).toEqual({
      ok: false,
      erreur: "Une quantité se note planche par planche",
    })
    p.culture.findMany.mockResolvedValueOnce([])
    expect(await enregistrerArrosageMesure({ userId: "u1", cultureIds: [7], litres: 50 })).toEqual({ ok: false, erreur: "Culture non trouvée" })
    expect(p.intervention.create).not.toHaveBeenCalled()
  })

  it("s'annule en supprimant l'intervention du compte, et elle seule", async () => {
    p.intervention.deleteMany.mockResolvedValue({ count: 1 })
    expect(await annulerArrosageMesure({ userId: "u1", interventionId: 501 })).toEqual({ interventionsSupprimees: 1 })
    expect(p.intervention.deleteMany).toHaveBeenCalledWith({ where: { id: 501, userId: "u1", type: "arrosage" } })
  })
})
