import { describe, expect, it } from "vitest"
import {
  StockOeufsVenteError,
  marqueurVenteOeufs,
  quantiteOeufsVendus,
  synchroniserStockOeufsVente,
} from "./stock-oeufs-vente"

describe("stock d’œufs lié aux ventes", () => {
  it("convertit les douzaines en œufs physiques", () => {
    expect(quantiteOeufsVendus(0.5, "douzaine")).toBe(6)
    expect(quantiteOeufsVendus(2, "unite")).toBe(2)
  })

  it("refuse une fraction d’œuf ou une unité incompatible", () => {
    expect(() => quantiteOeufsVendus(0.5, "unite")).toThrow(StockOeufsVenteError)
    expect(() => quantiteOeufsVendus(1, "kg")).toThrow(StockOeufsVenteError)
  })

  it("génère un marqueur stable pour restaurer le stock à l’annulation", () => {
    expect(marqueurVenteOeufs(103)).toBe("[vente-produit:103]")
  })

  it("ventile une demi-douzaine en FIFO sur le stock commercialisable", async () => {
    const creations: Array<{ productionId: number; quantite: number; notes: string }> = []
    const tx = {
      mouvementStockOeuf: {
        deleteMany: async () => ({ count: 0 }),
        create: async ({ data }: { data: { productionId: number; quantite: number; notes: string } }) => {
          creations.push(data)
          return data
        },
      },
      productionOeuf: {
        findMany: async () => [
          {
            id: 10,
            date: new Date("2026-07-25T00:00:00Z"),
            quantite: 4,
            casses: 0,
            sales: 0,
            mouvementsStock: [],
          },
          {
            id: 11,
            date: new Date("2026-07-26T00:00:00Z"),
            quantite: 8,
            casses: 0,
            sales: 0,
            mouvementsStock: [],
          },
        ],
      },
    }

    await synchroniserStockOeufsVente(tx as never, {
      userId: "u1",
      venteId: 103,
      date: new Date("2026-07-29T00:00:00Z"),
      quantite: 0.5,
      unite: "douzaine",
    })

    expect(creations).toEqual([
      expect.objectContaining({ productionId: 10, quantite: 4 }),
      expect.objectContaining({ productionId: 11, quantite: 2 }),
    ])
    expect(creations.every((item) => item.notes.startsWith("[vente-produit:103]"))).toBe(true)
  })

  it("refuse atomiquement une vente supérieure au stock disponible", async () => {
    const tx = {
      mouvementStockOeuf: {
        deleteMany: async () => ({ count: 0 }),
        create: async ({ data }: { data: unknown }) => data,
      },
      productionOeuf: {
        findMany: async () => [
          {
            id: 10,
            date: new Date("2026-07-25T00:00:00Z"),
            quantite: 2,
            casses: 0,
            sales: 0,
            mouvementsStock: [],
          },
        ],
      },
    }

    await expect(
      synchroniserStockOeufsVente(tx as never, {
        userId: "u1",
        venteId: 103,
        date: new Date("2026-07-29T00:00:00Z"),
        quantite: 0.5,
        unite: "douzaine",
      })
    ).rejects.toMatchObject({
      status: 409,
      message: "Stock d’œufs commercialisables insuffisant : il manque 4 œuf(s).",
    })
  })
})
