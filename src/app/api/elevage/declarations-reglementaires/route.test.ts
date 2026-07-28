import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  charger: vi.fn(),
  upsert: vi.fn(),
  findUnique: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/elevage/declarations-reglementaires.server", () => ({
  chargerDeclarationsReglementaires: mocks.charger,
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: mocks.transaction,
    declarationReglementaireSuivi: {
      upsert: mocks.upsert,
      findUnique: mocks.findUnique,
    },
    declarationReglementaireEvenement: {
      create: mocks.auditCreate,
    },
  },
}))

import { GET, PATCH } from "./route"

const declaration = {
  key: "animal:7:ENTREE",
  type: "ENTREE",
  categorie: "BOVIN",
  organisme: "EDE / BDNI",
  dateEvenement: "2026-07-20T00:00:00.000Z",
  dateEcheance: "2026-07-27T23:59:59.999Z",
  joursRestants: 2,
  statut: "A_DECLARER",
  libelle: "Entrée de FR123",
  espece: "Bovin",
  cible: "FR123",
  sourceUrl: "/elevage?tab=animaux&edit=7",
  numeroEde: "EDE-64",
  identifiants: ["FR123"],
  quantite: 1,
  origine: "EDE-33",
  destination: null,
  anomalies: [],
  transmisAt: null,
  canalTransmission: null,
  referenceTransmission: null,
  notes: null,
  modifieeApresTransmission: false,
  snapshot: { declarationKey: "animal:7:ENTREE", identifiants: ["FR123"] },
  snapshotHash: "snapshot-hash",
}

const requestPatch = (body: object) => new NextRequest(
  "http://localhost/api/elevage/declarations-reglementaires",
  {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  },
)

describe("API déclarations réglementaires", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.charger.mockResolvedValue({
      year: 2026,
      generatedAt: "2026-07-25T00:00:00.000Z",
      declarations: [declaration],
      resume: {
        total: 1,
        aCompleter: 0,
        aDeclarer: 1,
        horsDelai: 0,
        transmises: 0,
        modifieesApresTransmission: 0,
      },
    })
    mocks.upsert.mockResolvedValue({
      declarationKey: declaration.key,
      statut: "TRANSMISE",
      transmisAt: new Date("2026-07-25T00:00:00.000Z"),
      canalTransmission: "Portail EDE",
      referenceTransmission: "AR-123",
    })
    mocks.findUnique.mockResolvedValue(null)
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" })
    mocks.transaction.mockImplementation(async (callback) => callback({
      declarationReglementaireSuivi: {
        upsert: mocks.upsert,
      },
      declarationReglementaireEvenement: {
        create: mocks.auditCreate,
      },
    }))
  })

  it("scope la lecture sur l'utilisateur authentifié", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/declarations-reglementaires?year=2026",
    ))

    expect(response.status).toBe(200)
    expect(mocks.charger).toHaveBeenCalledWith("user-1", { year: 2026 })
  })

  it("enregistre le snapshot et la preuve sous la clé composite du tenant", async () => {
    const response = await PATCH(requestPatch({
      key: declaration.key,
      year: 2026,
      statut: "TRANSMISE",
      transmisAt: "2026-07-25",
      canalTransmission: "Portail EDE",
      referenceTransmission: "AR-123",
    }))

    expect(response.status).toBe(200)
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_declarationKey: {
          userId: "user-1",
          declarationKey: declaration.key,
        },
      },
      create: expect.objectContaining({
        userId: "user-1",
        declarationKey: declaration.key,
        statut: "TRANSMISE",
        snapshotHash: "snapshot-hash",
      }),
    }))
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        declarationKey: declaration.key,
        action: "STATUT_MODIFIE",
        statutApres: "TRANSMISE",
        snapshotHash: "snapshot-hash",
      }),
    })
  })

  it("refuse de finaliser une déclaration incomplète", async () => {
    mocks.charger.mockResolvedValueOnce({
      year: 2026,
      generatedAt: "2026-07-25T00:00:00.000Z",
      declarations: [{ ...declaration, statut: "A_COMPLETER", anomalies: ["N° EDE manquant"] }],
      resume: {
        total: 1,
        aCompleter: 1,
        aDeclarer: 0,
        horsDelai: 0,
        transmises: 0,
        modifieesApresTransmission: 0,
      },
    })

    const response = await PATCH(requestPatch({
      key: declaration.key,
      year: 2026,
      statut: "TRANSMISE",
      canalTransmission: "Portail EDE",
      referenceTransmission: "AR-123",
    }))

    expect(response.status).toBe(409)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it("préserve la date de transmission lors d'une acceptation ultérieure", async () => {
    const dateTransmission = new Date("2026-07-21T09:30:00.000Z")
    mocks.findUnique.mockResolvedValueOnce({
      statut: "TRANSMISE",
      transmisAt: dateTransmission,
    })

    const response = await PATCH(requestPatch({
      key: declaration.key,
      year: 2026,
      statut: "ACCEPTEE",
    }))

    expect(response.status).toBe(200)
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        statut: "ACCEPTEE",
        transmisAt: dateTransmission,
      }),
    }))
  })
})
