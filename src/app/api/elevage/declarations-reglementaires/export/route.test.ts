import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  charger: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/elevage/declarations-reglementaires.server", () => ({
  chargerDeclarationsReglementaires: mocks.charger,
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    declarationReglementaireEvenement: { create: mocks.auditCreate },
  },
}))

import { GET } from "./route"

const declaration = {
  key: "animal:7:ENTREE",
  statut: "A_DECLARER",
  type: "ENTREE",
  dateEvenement: "2026-07-20T00:00:00.000Z",
  dateEcheance: "2026-07-27T23:59:59.999Z",
  organisme: "EDE / BDNI",
  numeroEde: "EDE64",
  espece: "Bovin",
  cible: "FR001",
  identifiants: ["FR001"],
  quantite: 1,
  origine: "EDE33",
  destination: null,
  anomalies: [],
  transmisAt: null,
  canalTransmission: null,
  referenceTransmission: null,
  snapshotHash: "hash-1",
}

describe("export CSV des déclarations réglementaires", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.charger.mockResolvedValue({
      declarations: [declaration],
      year: 2026,
      generatedAt: "2026-07-25T00:00:00.000Z",
      resume: {},
    })
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" })
  })

  it("génère et journalise un export filtré", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/declarations-reglementaires/export?year=2026&statut=A_DECLARER",
    ))
    const csv = await response.text()

    expect(response.status).toBe(200)
    expect(csv).toContain("FR001")
    expect(mocks.charger).toHaveBeenCalledWith("user-1", { year: 2026 })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        declarationKey: "export:2026:A_DECLARER",
        action: "EXPORT_CSV_GENERE",
        snapshotHash: expect.any(String),
      }),
    })
  })

  it("rejette un filtre de statut inconnu", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/declarations-reglementaires/export?year=2026&statut=INCONNU",
    ))

    expect(response.status).toBe(400)
    expect(mocks.charger).not.toHaveBeenCalled()
  })
})
