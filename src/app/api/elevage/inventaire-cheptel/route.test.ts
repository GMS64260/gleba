import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  animauxFindMany: vi.fn(),
  animauxGroupBy: vi.fn(),
  lotsFindMany: vi.fn(),
  naissancesFindMany: vi.fn(),
  abattagesGroupBy: vi.fn(),
  exploitationFindUnique: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    animal: {
      findMany: mocks.animauxFindMany,
      groupBy: mocks.animauxGroupBy,
    },
    lotAnimaux: { findMany: mocks.lotsFindMany },
    naissanceAnimale: { findMany: mocks.naissancesFindMany },
    abattage: { groupBy: mocks.abattagesGroupBy },
    exploitation: { findUnique: mocks.exploitationFindUnique },
    declarationReglementaireEvenement: { create: mocks.auditCreate },
  },
}))

import { GET } from "./route"

describe("API inventaire daté du cheptel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.animauxGroupBy.mockResolvedValue([])
    mocks.naissancesFindMany.mockResolvedValue([])
    mocks.abattagesGroupBy.mockResolvedValue([])
    mocks.animauxFindMany.mockResolvedValue([
      {
        id: 1,
        identifiant: "FR001",
        nom: "Amande",
        sexe: "femelle",
        dateNaissance: new Date("2025-01-01T00:00:00.000Z"),
        dateArrivee: new Date("2025-01-01T00:00:00.000Z"),
        dateSortie: null,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        race: null,
        pereIdentifiant: null,
        mereIdentifiant: null,
        especeAnimale: { nom: "Caprin", categorieReglementaire: "Caprin" },
        raceAnimale: { nom: "Alpine" },
        lot: { nom: "Laitières" },
        mere: null,
        pere: null,
      },
      {
        id: 2,
        identifiant: "FR002",
        nom: null,
        sexe: "male",
        dateNaissance: new Date("2024-01-01T00:00:00.000Z"),
        dateArrivee: new Date("2024-01-01T00:00:00.000Z"),
        dateSortie: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        race: null,
        pereIdentifiant: null,
        mereIdentifiant: null,
        especeAnimale: { nom: "Caprin", categorieReglementaire: "Caprin" },
        raceAnimale: null,
        lot: null,
        mere: null,
        pere: null,
      },
    ])
    mocks.lotsFindMany.mockResolvedValue([{
      id: 3,
      nom: "Chevrettes",
      dateArrivee: new Date("2026-02-01T00:00:00.000Z"),
      dateReforme: null,
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      statut: "actif",
      quantiteInitiale: 4,
      quantiteActuelle: 4,
      especeAnimale: { nom: "Caprin", categorieReglementaire: "Caprin" },
    }])
    mocks.exploitationFindUnique.mockResolvedValue({
      raisonSociale: "Ferme test",
      numeroEde: "EDE64",
      adresseSiege: "1 chemin",
      codePostal: "64000",
      ville: "Pau",
    })
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" })
  })

  it("reconstitue la présence à la date demandée et produit un CSV traçable", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/inventaire-cheptel?date=2026-07-20&format=csv",
    ))
    const csv = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("content-disposition")).toContain("2026-07-20.csv")
    expect(csv).toContain("FR001")
    expect(csv).not.toContain("FR002")
    expect(csv).toContain("Chevrettes")
    expect(mocks.animauxFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1" },
    }))
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "INVENTAIRE_CHEPTEL_GENERE",
        declarationKey: "inventaire:2026-07-20",
        snapshotHash: expect.any(String),
      }),
    })
  })

  it("refuse une date future avant toute lecture métier", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/inventaire-cheptel?date=2099-01-01&format=csv",
    ))

    expect(response.status).toBe(400)
    expect(mocks.animauxFindMany).not.toHaveBeenCalled()
  })

  it("refuse une date calendaire impossible", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/inventaire-cheptel?date=2026-02-31&format=csv",
    ))

    expect(response.status).toBe(400)
    expect(mocks.animauxFindMany).not.toHaveBeenCalled()
  })

  it("génère aussi un inventaire PDF paginé", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/inventaire-cheptel?date=2026-07-20&format=pdf",
    ))
    const bytes = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF")
  })
})
