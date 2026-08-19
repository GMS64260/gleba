/**
 * QA cmsogea5w — le compteur cuivre n'agrégeait pas les opérations d'arbres
 * (operations_arbres) : une « Bouillie bordelaise 3 kg » saisie via
 * Verger > Opérations, seul traitement cuivré réellement dosé, restait
 * invisible de la conformité Bio.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  parcelleFindMany: vi.fn(),
  interventionFindMany: vi.fn(),
  observationFindMany: vi.fn(),
  operationFindMany: vi.fn(),
  arbreFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    parcelleGeo: { findMany: mocks.parcelleFindMany },
    intervention: { findMany: mocks.interventionFindMany },
    observationSante: { findMany: mocks.observationFindMany },
    operationArbre: { findMany: mocks.operationFindMany },
    arbre: { findMany: mocks.arbreFindMany },
  },
}))

import { GET } from "./route"

describe("GET /api/phyto/cuivre — agrégation des opérations d'arbres", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.parcelleFindMany.mockResolvedValue([
      { id: "P1", nom: "Verger nord", surface: 0.5 },
    ])
    mocks.interventionFindMany.mockResolvedValue([])
    mocks.observationFindMany.mockResolvedValue([])
    mocks.operationFindMany.mockResolvedValue([])
    mocks.arbreFindMany.mockResolvedValue([])
  })

  it("compte une opération d'arbre cuivrée (Bouillie bordelaise 3 kg)", async () => {
    mocks.operationFindMany.mockResolvedValue([
      {
        id: 938,
        date: new Date(), // année courante
        arbreId: 5,
        produit: "Bouillie bordelaise",
        description: null,
        quantite: 3,
        unite: "kg",
      },
    ])
    mocks.arbreFindMany.mockResolvedValue([{ id: 5, parcelleGeoId: "P1" }])

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.operationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          type: "traitement",
          fait: true,
        }),
      })
    )
    const p1 = json.parcelles.find(
      (p: { parcelleId: string }) => p.parcelleId === "P1"
    )
    expect(p1).toBeDefined()
    // 3 kg × 20% Cu (défaut bouillie) = 0.6 kg Cu sur 0.5 ha → 1.2 kg/ha/an
    expect(p1.cumulAnnuelKg).toBeCloseTo(0.6, 3)
    expect(p1.cuivreKgParHaAn).toBeCloseTo(1.2, 3)
    expect(p1.nbTraitementsAn).toBe(1)
    expect(p1.nbTraitementsCuivreSansDose7ans).toBe(0)
    expect(p1.parcelleNom).toBe("Verger nord")
  })

  it("ignore une opération d'arbre non cuivrée", async () => {
    mocks.operationFindMany.mockResolvedValue([
      {
        id: 939,
        date: new Date(),
        arbreId: 5,
        produit: "Savon noir",
        description: null,
        quantite: 2,
        unite: "L",
      },
    ])
    mocks.arbreFindMany.mockResolvedValue([{ id: 5, parcelleGeoId: "P1" }])

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(
      json.parcelles.find((p: { parcelleId: string }) => p.parcelleId === "P1")
    ).toBeUndefined()
  })

  it("rattache au bucket « Sans parcelle » une opération sur arbre non localisé", async () => {
    mocks.operationFindMany.mockResolvedValue([
      {
        id: 940,
        date: new Date(),
        arbreId: 7,
        produit: "Bouillie bordelaise",
        description: null,
        quantite: 1,
        unite: "kg",
      },
    ])
    mocks.arbreFindMany.mockResolvedValue([{ id: 7, parcelleGeoId: null }])

    const response = await GET()
    const json = await response.json()

    const sans = json.parcelles.find(
      (p: { parcelleId: string }) => p.parcelleId === "__sans_parcelle__"
    )
    expect(sans).toBeDefined()
    expect(sans.cumulAnnuelKg).toBeCloseTo(0.2, 3)
    expect(sans.parcelleNom).toBe("Sans rattachement parcellaire")
  })
})
