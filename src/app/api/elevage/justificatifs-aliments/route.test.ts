import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  verifierFichier: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(),
  alimentFindFirst: vi.fn(),
  justificatifFindFirst: vi.fn(),
  justificatifCreate: vi.fn(),
  justificatifUpdate: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/elevage/justificatif-fichier.server", () => ({
  ErreurFichierJustificatif: class ErreurFichierJustificatif extends Error {},
  verifierFichierJustificatif: mocks.verifierFichier,
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    justificatifAlimentElevage: { findMany: mocks.findMany },
    $transaction: mocks.transaction,
  },
}))

import { DELETE, GET, PATCH, POST } from "./route"

const request = (method: string, body: object) => new NextRequest(
  "http://localhost/api/elevage/justificatifs-aliments",
  {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  },
)

const documentInput = {
  typeDocument: "FACTURE",
  dateDocument: "2026-07-20",
  alimentId: "foin",
  reference: "FAC-2026-018",
  fournisseur: "Coopérative locale",
  numeroLot: "FOIN-07",
  fichierUrl: "/api/upload/justificatif/123e4567-e89b-42d3-a456-426614174000.pdf",
  nomFichier: "facture-foin.pdf",
  notes: "",
}

const justificatif = {
  id: "justificatif-1",
  userId: "user-1",
  alimentId: "foin",
  typeDocument: "FACTURE",
  dateDocument: new Date("2026-07-20T00:00:00.000Z"),
  reference: "FAC-2026-018",
  fournisseur: "Coopérative locale",
  numeroLot: "FOIN-07",
  fichierUrl: documentInput.fichierUrl,
  nomFichier: "facture-foin.pdf",
  tailleOctets: 2048,
  empreinteSha256: "a".repeat(64),
  notes: null,
  archivedAt: null,
  createdAt: new Date("2026-07-26T00:00:00.000Z"),
  updatedAt: new Date("2026-07-26T00:00:00.000Z"),
  aliment: { id: "foin", nom: "Foin" },
}

describe("API justificatifs d’aliments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.verifierFichier.mockResolvedValue({
      tailleOctets: 2048,
      empreinteSha256: "a".repeat(64),
    })
    mocks.findMany.mockResolvedValue([])
    mocks.alimentFindFirst.mockResolvedValue({ id: "foin" })
    mocks.justificatifFindFirst.mockResolvedValue(justificatif)
    mocks.justificatifCreate.mockResolvedValue(justificatif)
    mocks.justificatifUpdate.mockImplementation(async ({ data }) => ({
      ...justificatif,
      ...data,
    }))
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" })
    mocks.transaction.mockImplementation(async (callback) => callback({
      aliment: { findFirst: mocks.alimentFindFirst },
      justificatifAlimentElevage: {
        findFirst: mocks.justificatifFindFirst,
        create: mocks.justificatifCreate,
        update: mocks.justificatifUpdate,
      },
      declarationReglementaireEvenement: { create: mocks.auditCreate },
    }))
  })

  it("borne et scope la liste sur l’année et l’utilisateur authentifié", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/justificatifs-aliments?year=2026",
    ))

    expect(response.status).toBe(200)
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: "user-1",
        dateDocument: {
          gte: new Date("2026-01-01T00:00:00.000Z"),
          lt: new Date("2027-01-01T00:00:00.000Z"),
        },
      },
    }))
  })

  it("vérifie le fichier serveur et journalise la création dans la transaction", async () => {
    const response = await POST(request("POST", { data: documentInput }))

    expect(response.status).toBe(201)
    expect(mocks.verifierFichier).toHaveBeenCalledWith(
      "user-1",
      documentInput.fichierUrl,
    )
    expect(mocks.justificatifCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        alimentId: "foin",
        tailleOctets: 2048,
        empreinteSha256: "a".repeat(64),
      }),
      include: { aliment: { select: { id: true, nom: true } } },
    })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "JUSTIFICATIF_ALIMENT_CREE",
        declarationKey: "justificatif-aliment:justificatif-1",
        snapshotHash: expect.any(String),
      }),
    })
  })

  it("refuse de rattacher un aliment privé d’un autre compte", async () => {
    mocks.alimentFindFirst.mockResolvedValueOnce(null)

    const response = await POST(request("POST", {
      data: { ...documentInput, fichierUrl: null, nomFichier: null },
    }))

    expect(response.status).toBe(404)
    expect(mocks.justificatifCreate).not.toHaveBeenCalled()
  })

  it("refuse de modifier un justificatif d’un autre compte", async () => {
    mocks.justificatifFindFirst.mockResolvedValueOnce(null)

    const response = await PATCH(request("PATCH", {
      id: "justificatif-autre-compte",
      data: documentInput,
    }))

    expect(response.status).toBe(404)
    expect(mocks.justificatifUpdate).not.toHaveBeenCalled()
  })

  it("archive sans supprimer le document ni son fichier", async () => {
    const response = await DELETE(request("DELETE", {
      id: "justificatif-1",
      archived: true,
    }))

    expect(response.status).toBe(200)
    expect(mocks.justificatifUpdate).toHaveBeenCalledWith({
      where: { id: "justificatif-1" },
      data: { archivedAt: expect.any(Date) },
    })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "JUSTIFICATIF_ALIMENT_ARCHIVE",
      }),
    })
  })
})
