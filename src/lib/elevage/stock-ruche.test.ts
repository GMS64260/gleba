import { describe, expect, it, vi } from "vitest"
import type { Prisma } from "@prisma/client"
import {
  StockRucheError,
  calculerStocksRuche,
  synchroniserStockRucheVente,
} from "./stock-ruche"

function transaction(productions: Array<{
  id: number
  quantite: number
  unite?: "kg" | "g"
  mouvementsStock: Array<{ quantite: number }>
}>) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(0),
    productionRuche: {
      findMany: vi.fn().mockResolvedValue(
        productions.map((production) => ({ unite: "kg", ...production })),
      ),
    },
    mouvementStockRuche: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
  } as unknown as Prisma.TransactionClient
}

describe("stock des produits de la ruche", () => {
  it("calcule le disponible par produit et unité", () => {
    expect(calculerStocksRuche([
      {
        produit: "miel",
        unite: "kg",
        quantite: 10,
        mouvementsStock: [{ quantite: 2.5 }, { quantite: 1 }],
      },
      {
        produit: "miel",
        unite: "g",
        quantite: 500,
        mouvementsStock: [],
      },
    ])).toEqual([{
      produit: "miel",
      unite: "kg",
      quantiteProduite: 10.5,
      sorti: 3.5,
      disponible: 7,
    }])
  })

  it("ventile une vente en FIFO sur plusieurs récoltes", async () => {
    const tx = transaction([
      { id: 1, quantite: 10, mouvementsStock: [{ quantite: 2 }] },
      { id: 2, quantite: 5, mouvementsStock: [] },
    ])

    await synchroniserStockRucheVente(tx, {
      userId: "user-1",
      venteId: 42,
      type: "miel",
      date: new Date("2026-07-29"),
      quantite: 10,
      unite: "kg",
    })

    const create = tx.mouvementStockRuche.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls.map((call) => ({
      productionId: call[0].data.productionId,
      quantite: call[0].data.quantite,
      operationId: call[0].data.operationId,
    }))).toEqual([
      { productionId: 1, quantite: 8, operationId: "vente:42" },
      { productionId: 2, quantite: 2, operationId: "vente:42" },
    ])
  })

  it("refuse atomiquement une vente supérieure au stock", async () => {
    const tx = transaction([
      { id: 1, quantite: 3, mouvementsStock: [] },
    ])

    await expect(synchroniserStockRucheVente(tx, {
      userId: "user-1",
      venteId: 43,
      type: "cire",
      date: new Date("2026-07-29"),
      quantite: 5,
      unite: "kg",
    })).rejects.toBeInstanceOf(StockRucheError)
  })

  it("convertit les kilogrammes en grammes pendant la ventilation", async () => {
    const tx = transaction([
      { id: 1, quantite: 1, mouvementsStock: [] },
    ])

    await synchroniserStockRucheVente(tx, {
      userId: "user-1",
      venteId: 45,
      type: "miel",
      date: new Date("2026-07-29"),
      quantite: 250,
      unite: "g",
    })

    expect(tx.mouvementStockRuche.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ productionId: 1, quantite: 0.25 }),
    })
  })

  it("refuse une unité non suivie pour une vente apicole", async () => {
    const tx = transaction([])
    await expect(synchroniserStockRucheVente(tx, {
      userId: "user-1",
      venteId: 44,
      type: "miel",
      date: new Date("2026-07-29"),
      quantite: 1,
      unite: "pot",
    })).rejects.toMatchObject({ status: 400 })
  })
})
