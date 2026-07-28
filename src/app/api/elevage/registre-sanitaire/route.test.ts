import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  soinFindMany: vi.fn(),
  exploitationFindUnique: vi.fn(),
  prophylaxieFindMany: vi.fn(),
  animauxFindMany: vi.fn(),
  statutsFindMany: vi.fn(),
  stockFindMany: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    soinAnimal: { findMany: mocks.soinFindMany },
    exploitation: { findUnique: mocks.exploitationFindUnique },
    prophylaxieElevage: { findMany: mocks.prophylaxieFindMany },
    animal: { findMany: mocks.animauxFindMany },
    statutSanitaireElevage: { findMany: mocks.statutsFindMany },
    stockMedicamentElevage: { findMany: mocks.stockFindMany },
    declarationReglementaireEvenement: { create: mocks.auditCreate },
  },
}))

import { GET } from "./route"

describe("registre sanitaire PDF", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.soinFindMany.mockResolvedValue([])
    mocks.exploitationFindUnique.mockResolvedValue(null)
    mocks.prophylaxieFindMany.mockResolvedValue([])
    mocks.animauxFindMany.mockResolvedValue([])
    mocks.statutsFindMany.mockResolvedValue([])
    mocks.stockFindMany.mockResolvedValue([])
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" })
  })

  it("génère un PDF paginé et journalise son empreinte", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/registre-sanitaire?year=2026",
    ))
    const bytes = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-disposition")).toContain("registre-sanitaire-2026.pdf")
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF")
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "REGISTRE_SANITAIRE_GENERE",
        declarationKey: "registre-sanitaire:2026",
        snapshotHash: expect.any(String),
      }),
    })
  })

  it("rejette une année hors bornes avant les lectures métier", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/registre-sanitaire?year=1980",
    ))

    expect(response.status).toBe(400)
    expect(mocks.soinFindMany).not.toHaveBeenCalled()
  })
})
