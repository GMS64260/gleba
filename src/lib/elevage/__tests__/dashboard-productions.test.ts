import { describe, expect, it, vi } from "vitest"

import { agregerProductionsLaitieresDashboard, construireProductionsDashboard } from "../dashboard-productions"

describe("construireProductionsDashboard", () => {
  it("affiche simultanément chaque production avec son unité", () => {
    expect(construireProductionsDashboard({
      oeufs: 240,
      laitLitres: 123.456,
      fromagePieces: 48,
      fromageKg: 9.876,
      viandeKg: 32.555,
    })).toEqual([
      { type: "oeufs", label: "Œufs", quantite: 240, unite: "œufs" },
      { type: "lait", label: "Lait collecté", quantite: 123.46, unite: "L" },
      { type: "fromage", label: "Fromages fabriqués", quantite: 48, unite: "pièces", detail: "9.88 kg au total" },
      { type: "viande", label: "Viande (carcasse)", quantite: 32.56, unite: "kg" },
    ])
  })

  it("omet les catégories absentes et renvoie un état vide exploitable", () => {
    expect(construireProductionsDashboard({
      oeufs: 0,
      laitLitres: 0,
      fromagePieces: 0,
      fromageKg: 0,
      viandeKg: 0,
    })).toEqual([])
  })

  it("affiche un fromage enregistré uniquement au poids", () => {
    expect(construireProductionsDashboard({
      oeufs: 0, laitLitres: 0, fromagePieces: 0, fromageKg: 12.345, viandeKg: 0,
    })).toEqual([
      { type: "fromage", label: "Fromages fabriqués", quantite: 12.35, unite: "kg" },
    ])
  })

  it("affiche un fromage enregistré uniquement en pièces", () => {
    expect(construireProductionsDashboard({
      oeufs: 0, laitLitres: 0, fromagePieces: 18, fromageKg: 0, viandeKg: 0,
    })).toEqual([
      { type: "fromage", label: "Fromages fabriqués", quantite: 18, unite: "pièces" },
    ])
  })
})

describe("agregerProductionsLaitieresDashboard", () => {
  it("limite chaque source à l'exploitation et à l'année sélectionnée", async () => {
    const collecteLait = { aggregate: vi.fn().mockResolvedValue({ _sum: { quantiteLitres: 125.5 }, _count: 4 }) }
    const lotFromage = { aggregate: vi.fn().mockResolvedValue({ _sum: { nbPieces: 8, poidsTotalKg: 3.2 } }) }
    const debut = new Date(2025, 0, 1)
    const fin = new Date(2025, 11, 31, 23, 59, 59)

    await expect(agregerProductionsLaitieresDashboard(
      { collecteLait, lotFromage }, "exploitation-a", debut, fin
    )).resolves.toEqual({ laitLitres: 125.5, nbCollectes: 4, fromagePieces: 8, fromageKg: 3.2 })

    expect(collecteLait.aggregate).toHaveBeenCalledWith({
      where: { userId: "exploitation-a", date: { gte: debut, lte: fin } },
      _sum: { quantiteLitres: true },
      _count: true,
    })
    expect(lotFromage.aggregate).toHaveBeenCalledWith({
      where: { userId: "exploitation-a", dateFabrication: { gte: debut, lte: fin } },
      _sum: { nbPieces: true, poidsTotalKg: true },
    })
  })
})
