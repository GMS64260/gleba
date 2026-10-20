import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  naissanceFindMany: vi.fn(),
  abattageGroupBy: vi.fn(),
  animalGroupBy: vi.fn(),
  lotFindMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    naissanceAnimale: { findMany: mocks.naissanceFindMany },
    abattage: { groupBy: mocks.abattageGroupBy },
    animal: { groupBy: mocks.animalGroupBy },
    lotAnimaux: { findMany: mocks.lotFindMany },
  },
}))

import { chargerCheptelEnStock } from "../stock-cheptel"

type GroupByArgs = { by: string[]; where: Record<string, unknown> }

/**
 * `animal.groupBy` sert trois requêtes : fiches hors lot actif par espèce
 * (stock-cheptel), fiches actives et fiches sorties par lot (effectif.ts).
 */
const mockAnimaux = ({
  horsLot = [] as unknown[],
  actifsParLot = [] as unknown[],
  sortiesParLot = [] as unknown[],
} = {}) => {
  mocks.animalGroupBy.mockImplementation(async (args: GroupByArgs) => {
    if (args.by[0] === "especeAnimaleId") return horsLot
    const statut = args.where.statut as { not?: string } | string | undefined
    return typeof statut === "object" && statut.not === "actif" ? sortiesParLot : actifsParLot
  })
}

describe("chargerCheptelEnStock", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.naissanceFindMany.mockResolvedValue([])
    mocks.abattageGroupBy.mockResolvedValue([])
    mocks.lotFindMany.mockResolvedValue([])
    mockAnimaux()
  })

  // QA cmvgdo90z — démo, lot 71 « Pintades perle A3 1708 » : 2 initiales,
  // éclosions de 2 puis 1 vivants (compteur stocké passé à 5), fiche Perlita
  // rattachée au lot puis morte. Élevage > Lots affiche 4, Stocks affichait 5.
  it("compte le lot à son effectif reconstitué, comme Élevage > Lots", async () => {
    mocks.lotFindMany.mockResolvedValue([
      {
        id: 71,
        especeAnimaleId: "pintade",
        nom: "Pintades perle A3 1708",
        quantiteInitiale: 2,
        quantiteActuelle: 5,
        especeAnimale: { nom: "Pintade perle" },
      },
    ])
    mocks.naissanceFindMany.mockResolvedValue([
      { lotId: 71, nombreVivants: 2 },
      { lotId: 71, nombreVivants: 1 },
    ])
    mockAnimaux({ sortiesParLot: [{ lotId: 71, _count: { _all: 1 } }] })

    const cheptel = await chargerCheptelEnStock("demo")

    expect(cheptel.lots).toEqual([{ id: 71, especeAnimaleId: "pintade", nom: "Pintades perle A3 1708", tetes: 4 }])
  })

  it("ne compte une fiche active d'un lot actif qu'une fois, dans le lot", async () => {
    mocks.lotFindMany.mockResolvedValue([
      { id: 9, especeAnimaleId: "chevre", nom: null, quantiteInitiale: 3, quantiteActuelle: 2, especeAnimale: { nom: "Chèvre" } },
    ])
    mockAnimaux({
      horsLot: [{ especeAnimaleId: "chevre", _count: 2 }],
      actifsParLot: [{ lotId: 9, _count: { _all: 1 } }],
    })

    const cheptel = await chargerCheptelEnStock("u1")

    expect(cheptel.lots).toEqual([{ id: 9, especeAnimaleId: "chevre", nom: "Chèvre", tetes: 3 }])
    expect(cheptel.individuels).toEqual([{ especeAnimaleId: "chevre", tetes: 2 }])
    const requeteIndividuels = mocks.animalGroupBy.mock.calls
      .map(([args]) => args as GroupByArgs)
      .find((args) => args.by[0] === "especeAnimaleId")
    expect(requeteIndividuels?.where).toEqual({
      userId: "u1",
      statut: "actif",
      OR: [{ lotId: null }, { lot: { statut: { not: "actif" } } }],
    })
  })

  it("ne lit que les lots actifs du compte", async () => {
    await chargerCheptelEnStock("u1")
    expect(mocks.lotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", statut: "actif" } }),
    )
    // Aucun lot : le helper d'effectif n'interroge pas la base.
    expect(mocks.naissanceFindMany).not.toHaveBeenCalled()
  })
})
