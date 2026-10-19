/**
 * QA 2026-10-19 — Cave : 2 pièces vendues à 2 €/pièce sur un lot de 4 pièces
 * pour 0,30 kg s'affichaient « 2 pc · 0,3 kg » valorisés 0,60 € (0,3 kg × 2 €).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lotFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: { lotFromage: { findMany: mocks.lotFindMany } },
}))

import { GET } from "./route"

const lot = (surcharge: Record<string, unknown> = {}) => ({
  id: "lot-1",
  numeroLot: "L-2026-W01-01",
  typeFromage: "Crottin",
  dateFabrication: new Date("2026-10-19T00:00:00Z"),
  etat: "pret",
  dluo: null,
  dlc: null,
  nbPieces: 4,
  poidsTotalKg: 0.3,
  traitementThermique: "cru",
  mouvements: [],
  ventesProduit: [],
  ...surcharge,
})

describe("GET /api/elevage/affinage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
  })

  it("valorise au prix à la pièce et retire le poids moyen des pièces vendues", async () => {
    mocks.lotFindMany.mockResolvedValue([
      lot({
        mouvements: [{ nbPieces: 2, poidsKg: 0 }],
        ventesProduit: [{ quantite: 2, unite: "pièce", prixTotal: 4 }],
      }),
    ])
    const res = await GET(new NextRequest("http://localhost/api/elevage/affinage"))
    const json = await res.json()
    expect(json.data[0]).toMatchObject({
      stockPieces: 2,
      stockKg: 0.15,
      prixConstate: 2,
      unitePrixConstate: "piece",
      valorisation: 4,
    })
    expect(json.stats.valorisationTotale).toBe(4)
    expect(json.stats.nbLotsMasques).toBe(0)
    expect(mocks.lotFindMany.mock.calls[0][0].where).toEqual({ userId: "user-1" })
  })

  it("valorise au kg une vente au poids", async () => {
    mocks.lotFindMany.mockResolvedValue([
      lot({
        typeFromage: "Tomme",
        nbPieces: 1,
        poidsTotalKg: 2,
        mouvements: [{ nbPieces: 0, poidsKg: 0.5 }],
        ventesProduit: [{ quantite: 0.5, unite: "kg", prixTotal: 10 }],
      }),
    ])
    const json = await (await GET(new NextRequest("http://localhost/api/elevage/affinage"))).json()
    expect(json.data[0]).toMatchObject({ stockPieces: 1, stockKg: 1.5, unitePrixConstate: "kg", valorisation: 30 })
  })

  it("nomme les lots épuisés par le calcul que la vue par défaut masque", async () => {
    mocks.lotFindMany.mockResolvedValue([
      lot(),
      // Encore « prêt » en base, mais ses 4 pièces sont sorties.
      lot({ id: "lot-2", numeroLot: "L-2026-W01-02", mouvements: [{ nbPieces: 4, poidsKg: 0 }] }),
    ])
    const json = await (await GET(new NextRequest("http://localhost/api/elevage/affinage"))).json()
    expect(json.data.map((l: { id: string }) => l.id)).toEqual(["lot-1"])
    expect(json.stats.nbLotsMasques).toBe(1)
    const tous = await (await GET(new NextRequest("http://localhost/api/elevage/affinage?inclureEcoules=1"))).json()
    expect(tous.data).toHaveLength(2)
    expect(tous.stats.nbLotsMasques).toBe(0)
  })
})
