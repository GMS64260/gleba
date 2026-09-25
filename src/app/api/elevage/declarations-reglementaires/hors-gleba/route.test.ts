import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  charger: vi.fn(),
  upsert: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/elevage/declarations-reglementaires.server", () => ({
  chargerDeclarationsReglementaires: mocks.charger,
}))
vi.mock("@/lib/prisma", () => ({ default: { $transaction: mocks.transaction } }))

import { POST } from "./route"

const declaration = (key: string, statut: string) => ({
  key,
  statut,
  anomalies: ["Numéro d’exploitation de destination manquant"],
  snapshot: { declarationKey: key },
  snapshotHash: `hash-${key}`,
})

const post = (body: object) => POST(new NextRequest(
  "http://localhost/api/elevage/declarations-reglementaires/hors-gleba",
  { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
))

describe("POST déclarations déjà faites hors Gleba", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.charger.mockResolvedValue({
      declarations: [
        declaration("animal:1:SORTIE", "HORS_DELAI"),
        declaration("animal:2:SORTIE", "HORS_DELAI"),
        declaration("animal:3:SORTIE", "TRANSMISE"),
      ],
    })
    mocks.upsert.mockResolvedValue({})
    mocks.auditCreate.mockResolvedValue({})
    mocks.transaction.mockImplementation(async (callback) => callback({
      declarationReglementaireSuivi: { upsert: mocks.upsert },
      declarationReglementaireEvenement: { create: mocks.auditCreate },
    }))
  })

  it("marque les déclarations à traiter de l'année et ignore celles déjà finalisées ou inconnues", async () => {
    const response = await post({
      year: 2024,
      keys: ["animal:1:SORTIE", "animal:2:SORTIE", "animal:3:SORTIE", "animal:9:SORTIE"],
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: { marquees: 2, ignorees: ["animal:3:SORTIE", "animal:9:SORTIE"] },
    })
    expect(mocks.charger).toHaveBeenCalledWith("user-1", { year: 2024 })
    expect(mocks.upsert).toHaveBeenCalledTimes(2)
    expect(mocks.upsert.mock.calls[0][0].create).toEqual(expect.objectContaining({
      userId: "user-1",
      declarationKey: "animal:1:SORTIE",
      statut: "TRANSMISE",
      canalTransmission: "Déclarée hors Gleba",
      snapshotHash: "hash-animal:1:SORTIE",
    }))
    expect(mocks.auditCreate).toHaveBeenCalledTimes(2)
  })

  it("répond 409 quand rien n'est à traiter", async () => {
    const response = await post({ year: 2024, keys: ["animal:3:SORTIE"] })

    expect(response.status).toBe(409)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
