import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  productionFindMany: vi.fn(),
  soinFindMany: vi.fn(),
  animalFindFirst: vi.fn(),
  animalFindMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    productionOeuf: { findMany: mocks.productionFindMany },
    soinAnimal: { findMany: mocks.soinFindMany },
    animal: { findFirst: mocks.animalFindFirst, findMany: mocks.animalFindMany },
  },
}))

import { computeStockOeufsParLots } from "./stock-oeufs-lots"

const ponte = (id: number, date: string, lotId: number | null = 54, animalId: number | null = null) => ({
  id,
  date: new Date(date),
  lotId,
  animalId,
  quantite: 12,
  casses: 0,
  sales: 0,
  calibre: null,
  lot: lotId != null ? { id: lotId, nom: "Pondeuses 2026" } : null,
  mouvementsStock: [],
})

// Preuve du ticket cmsoeyhs5 : Dectomax fait sur le lot 54, fin d'attente
// œufs au 2026-09-04 — une ponte du 11/08 était « commercialisable ».
const soinLot54 = (overrides: Record<string, unknown> = {}) => ({
  date: new Date("2026-08-01T00:00:00Z"),
  finAttenteOeufs: new Date("2026-09-04T00:00:00Z"),
  animalId: null,
  lotId: 54,
  ...overrides,
})

describe("stock d'œufs par lots — délai d'attente vétérinaire (cmsoeyhs5)", () => {
  const now = new Date("2026-08-11T12:00:00Z")

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.soinFindMany.mockResolvedValue([])
    mocks.animalFindFirst.mockResolvedValue(null)
    mocks.animalFindMany.mockResolvedValue([])
  })

  it("bloque une ponte pendant le délai d'attente œufs d'un soin fait sur le lot", async () => {
    mocks.productionFindMany.mockResolvedValue([ponte(1, "2026-08-11T00:00:00Z")])
    mocks.soinFindMany.mockResolvedValue([soinLot54()])

    const stock = await computeStockOeufsParLots("user-1", now)

    expect(stock.data).toHaveLength(1)
    expect(stock.data[0].statut).toBe("bloque_attente_veto")
    expect(stock.data[0].remiseEnVente?.toISOString().slice(0, 10)).toBe("2026-09-05")
    expect(stock.stats.commercialisables).toBe(0)
    expect(stock.stats.bloquesVeto).toBe(12)
    expect(stock.stats.stockPhysique).toBe(12)
  })

  it("laisse commercialisable une ponte postérieure à finAttenteOeufs", async () => {
    mocks.productionFindMany.mockResolvedValue([ponte(2, "2026-08-08T00:00:00Z")])
    mocks.soinFindMany.mockResolvedValue([soinLot54({
      date: new Date("2026-07-28T00:00:00Z"),
      finAttenteOeufs: new Date("2026-08-05T00:00:00Z"),
    })])

    const stock = await computeStockOeufsParLots("user-1", now)

    expect(stock.data[0].statut).toBe("commercialisable")
    expect(stock.data[0].remiseEnVente).toBeNull()
    expect(stock.stats.commercialisables).toBe(12)
    expect(stock.stats.bloquesVeto).toBe(0)
  })

  it("ignore les soins non faits : le filtre fait=true est poussé dans la requête", async () => {
    mocks.productionFindMany.mockResolvedValue([ponte(3, "2026-08-11T00:00:00Z")])

    const stock = await computeStockOeufsParLots("user-1", now)

    expect(stock.data[0].statut).toBe("commercialisable")
    expect(mocks.soinFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: "user-1",
        fait: true,
        finAttenteOeufs: expect.objectContaining({ not: null }),
      }),
    }))
  })

  it("bloque la ponte du lot quand le soin vise un animal membre du lot", async () => {
    mocks.productionFindMany.mockResolvedValue([ponte(4, "2026-08-11T00:00:00Z")])
    mocks.soinFindMany.mockResolvedValue([soinLot54({ lotId: null, animalId: 9 })])
    // ciblesAffectees : l'animal 9 appartient au lot 54.
    mocks.animalFindFirst.mockResolvedValue({ lotId: 54 })

    const stock = await computeStockOeufsParLots("user-1", now)

    expect(stock.data[0].statut).toBe("bloque_attente_veto")
    expect(stock.stats.bloquesVeto).toBe(12)
  })

  it("garde « périmé » terminal même sous délai vétérinaire", async () => {
    mocks.productionFindMany.mockResolvedValue([ponte(5, "2026-08-02T00:00:00Z")])
    mocks.soinFindMany.mockResolvedValue([soinLot54()])

    const stock = await computeStockOeufsParLots("user-1", new Date("2026-09-15T00:00:00Z"))

    expect(stock.data[0].statut).toBe("perime")
    expect(stock.stats.perimes).toBe(12)
    expect(stock.stats.bloquesVeto).toBe(0)
  })
})
