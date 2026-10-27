/**
 * Revue 2026-10-20 — Élevage > Tableau de bord, « Répartition par espèce » :
 * la part des lots lisait la somme des compteurs stockés `quantiteActuelle`,
 * qui dérive (la mort d'une fiche rattachée ne le décrémente pas), et les
 * fiches rattachées s'y ajoutaient alors que l'effectif du lot les compte.
 * Démo : Pintade perle 5 au lieu de 4 (lot 71), Chèvre Alpine 8 au lieu de 4
 * (lot 58, quatre fiches nominatives). La part d'un lot est désormais sa part
 * collective reconstituée, comme les ateliers de l'économie de l'élevage.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lotFindMany: vi.fn(),
  animalGroupBy: vi.fn(),
  animalCount: vi.fn(),
  especeFindMany: vi.fn(),
  reconstituerEffectifsLots: vi.fn(),
  aggregatVide: () => vi.fn().mockResolvedValue({ _sum: {}, _count: 0 }),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/elevage/effectif", () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))
vi.mock("@/lib/elevage/pondeuses", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/elevage/pondeuses")>()),
  calculerTetesNonPondeuses: vi.fn().mockResolvedValue(new Map()),
}))
vi.mock("@/lib/elevage/stock-oeufs-lots", () => ({
  computeStockOeufsParLots: vi.fn().mockResolvedValue({ stats: { commercialisables: 0 } }),
}))
vi.mock("@/lib/stocks-helpers", () => ({
  calculerStockOeufs: vi.fn().mockResolvedValue({
    stockNet: 0,
    detail: { produits: 0, casses: 0, sales: 0, vendus: 0, autresSorties: 0 },
  }),
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    animal: { count: mocks.animalCount, groupBy: mocks.animalGroupBy, findMany: vi.fn().mockResolvedValue([]) },
    lotAnimaux: { findMany: mocks.lotFindMany },
    productionOeuf: { aggregate: mocks.aggregatVide() },
    venteProduit: { aggregate: mocks.aggregatVide(), findMany: vi.fn().mockResolvedValue([]) },
    abattage: { aggregate: mocks.aggregatVide() },
    userStockAliment: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    consommationAliment: { aggregate: mocks.aggregatVide() },
    especeAnimale: { findMany: mocks.especeFindMany },
    collecteLait: { aggregate: mocks.aggregatVide() },
    lotFromage: { aggregate: mocks.aggregatVide() },
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}))

import { GET } from "./route"

describe("GET /api/elevage/stats — répartition par espèce", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
  })

  it("compte chaque lot pour sa part collective reconstituée, pas son compteur stocké", async () => {
    const pintades = { id: 71, especeAnimaleId: "pintade", quantiteInitiale: 2, quantiteActuelle: 5 }
    const chevres = { id: 58, especeAnimaleId: "chevre", quantiteInitiale: 4, quantiteActuelle: 4 }
    // Premier appel : lots actifs ; second : lots pondeurs (non utilisés ici).
    mocks.lotFindMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      where.especeAnimale ? [] : [pintades, chevres],
    )
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map([
      [71, { effectifCalcule: 4, nominatifsActifs: 0, effectifCollectif: 4 }],
      [58, { effectifCalcule: 4, nominatifsActifs: 4, effectifCollectif: 0 }],
    ]))
    // Les quatre chèvres du lot 58 sont des fiches actives rattachées.
    mocks.animalGroupBy.mockResolvedValue([{ especeAnimaleId: "chevre", _count: 4 }])
    mocks.animalCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      where.statut === "actif" ? ("OR" in where ? 0 : 4) : 0,
    )
    mocks.especeFindMany.mockResolvedValue([
      { id: "pintade", nom: "Pintade perle", couleur: null, production: "mixte", productions: [] },
      { id: "chevre", nom: "Chèvre Alpine", couleur: null, production: "lait", productions: [] },
    ])

    const res = await GET(new NextRequest("http://localhost/api/elevage/stats?annee=2026"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mocks.reconstituerEffectifsLots).toHaveBeenCalledTimes(1)
    expect(mocks.reconstituerEffectifsLots).toHaveBeenCalledWith("user-1", [pintades, chevres])
    const parEspece = Object.fromEntries(
      json.animauxParType.map((e: { nom: string; count: number }) => [e.nom, e.count]),
    )
    // Avant : Pintade perle 5 (compteur), Chèvre Alpine 8 (4 fiches + compteur 4).
    expect(parEspece).toEqual({ "Pintade perle": 4, "Chèvre Alpine": 4 })
    // La répartition retombe sur le total du cheptel de la même tuile.
    expect(json.stats.animauxTotal).toBe(8)
  })
})
