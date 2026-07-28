import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  animalFindMany: vi.fn(),
  lotFindMany: vi.fn(),
  abattageFindMany: vi.fn(),
  naissanceFindMany: vi.fn(),
  exploitationFindUnique: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    animal: { findMany: mocks.animalFindMany },
    lotAnimaux: { findMany: mocks.lotFindMany },
    abattage: { findMany: mocks.abattageFindMany },
    naissanceAnimale: { findMany: mocks.naissanceFindMany },
    exploitation: { findUnique: mocks.exploitationFindUnique },
    declarationReglementaireEvenement: { create: mocks.auditCreate },
  },
}))

import { GET } from "./route"

describe("registre des mouvements PDF", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.animalFindMany.mockResolvedValue([])
    mocks.lotFindMany.mockResolvedValue([])
    mocks.abattageFindMany.mockResolvedValue([])
    mocks.naissanceFindMany.mockResolvedValue([])
    mocks.exploitationFindUnique.mockResolvedValue(null)
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" })
  })

  it("génère un PDF paginé et journalise son empreinte", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/registre-elevage?year=2026",
    ))
    const bytes = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-disposition")).toContain("registre-elevage-2026.pdf")
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF")
    expect(mocks.animalFindMany).toHaveBeenCalledTimes(2)
    expect(mocks.lotFindMany).toHaveBeenCalledTimes(2)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "REGISTRE_MOUVEMENTS_GENERE",
        declarationKey: "registre-mouvements:2026",
        snapshotHash: expect.any(String),
      }),
    })
  })

  it("rejette une année hors bornes avant les lectures métier", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/registre-elevage?year=1980",
    ))

    expect(response.status).toBe(400)
    expect(mocks.animalFindMany).not.toHaveBeenCalled()
  })

  it("ne double pas une naissance comme entrée individuelle", async () => {
    const date = new Date("2026-02-03T00:00:00.000Z")
    mocks.animalFindMany
      .mockResolvedValueOnce([{
        id: 12,
        identifiant: "FR0012",
        nom: "Agneau 12",
        dateArrivee: date,
        dateNaissance: date,
        createdAt: date,
        dateSortie: null,
        provenance: "Naissance sur l’exploitation",
        nExploitationOrigine: null,
        nExploitationDestination: null,
        motifSortie: null,
        causeSortie: null,
        ficheNaissance: { id: 4 },
        especeAnimale: { nom: "Ovin" },
        lot: null,
      }])
      .mockResolvedValueOnce([])
    mocks.naissanceFindMany.mockResolvedValueOnce([{
      id: 4,
      date,
      nombreVivants: 1,
      mere: {
        nom: "Brebis 1",
        identifiant: "FR-MERE-1",
        especeAnimale: { nom: "Ovin" },
      },
      lot: null,
    }])

    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/registre-elevage?year=2026",
    ))

    expect(response.status).toBe(200)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ mouvements: 1 }),
      }),
    })
  })
})
