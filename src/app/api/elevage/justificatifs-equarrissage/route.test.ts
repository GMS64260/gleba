import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  verifierFichier: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(),
  animalFindMany: vi.fn(),
  couvertureFindFirst: vi.fn(),
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
    justificatifEquarrissageElevage: { findMany: mocks.findMany },
    $transaction: mocks.transaction,
  },
}))

import { DELETE, GET, PATCH, POST } from "./route"

const request = (method: string, body: object) => new NextRequest(
  "http://localhost/api/elevage/justificatifs-equarrissage",
  {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  },
)

const input = {
  typeDocument: "BON_ENLEVEMENT",
  dateEnlevement: "2026-07-24",
  animalIds: [12],
  nombreAnimauxNonIdentifies: 0,
  typeAnimauxNonIdentifies: null,
  reference: "BE-2026-0042",
  prestataire: "Équarrissage régional",
  fichierUrl: "/api/upload/justificatif/123e4567-e89b-42d3-a456-426614174000.pdf",
  nomFichier: "bon-enlevement.pdf",
  notes: null,
}

const animal = {
  id: 12,
  identifiant: "FR6400012345",
  nom: null,
  dateSortie: new Date("2026-07-23T00:00:00.000Z"),
  causeSortie: "Maladie",
  especeAnimale: { nom: "Caprin" },
}

const justificatif = {
  id: "equarrissage-1",
  userId: "user-1",
  typeDocument: "BON_ENLEVEMENT",
  dateEnlevement: new Date("2026-07-24T00:00:00.000Z"),
  nombreAnimauxNonIdentifies: 0,
  typeAnimauxNonIdentifies: null,
  reference: "BE-2026-0042",
  prestataire: "Équarrissage régional",
  fichierUrl: input.fichierUrl,
  nomFichier: "bon-enlevement.pdf",
  tailleOctets: 4096,
  empreinteSha256: "b".repeat(64),
  notes: null,
  archivedAt: null,
  createdAt: new Date("2026-07-26T00:00:00.000Z"),
  updatedAt: new Date("2026-07-26T00:00:00.000Z"),
  animaux: [{ animalId: 12, animal }],
}

describe("API justificatifs d’équarrissage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.verifierFichier.mockResolvedValue({
      tailleOctets: 4096,
      empreinteSha256: "b".repeat(64),
    })
    mocks.findMany.mockResolvedValue([])
    mocks.animalFindMany.mockResolvedValue([animal])
    mocks.couvertureFindFirst.mockResolvedValue(null)
    mocks.justificatifFindFirst.mockResolvedValue(justificatif)
    mocks.justificatifCreate.mockResolvedValue(justificatif)
    mocks.justificatifUpdate.mockImplementation(async ({ data }) => ({
      ...justificatif,
      ...data,
    }))
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" })
    mocks.transaction.mockImplementation(async (callback) => callback({
      animal: { findMany: mocks.animalFindMany },
      justificatifEquarrissageAnimal: { findFirst: mocks.couvertureFindFirst },
      justificatifEquarrissageElevage: {
        findFirst: mocks.justificatifFindFirst,
        create: mocks.justificatifCreate,
        update: mocks.justificatifUpdate,
      },
      declarationReglementaireEvenement: { create: mocks.auditCreate },
    }))
  })

  it("borne la liste au compte et inclut les décès de l’année", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/justificatifs-equarrissage?year=2026",
    ))

    expect(response.status).toBe(200)
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: "user-1",
        OR: expect.arrayContaining([
          { dateEnlevement: {
            gte: new Date("2026-01-01T00:00:00.000Z"),
            lt: new Date("2027-01-01T00:00:00.000Z"),
          } },
        ]),
      }),
    }))
  })

  it("valide les mortalités, le fichier et journalise une création atomique", async () => {
    const response = await POST(request("POST", { data: input }))

    expect(response.status).toBe(201)
    expect(mocks.animalFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: [12] }, userId: "user-1", statut: "mort" },
    }))
    expect(mocks.justificatifCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        tailleOctets: 4096,
        empreinteSha256: "b".repeat(64),
        animaux: { create: [{ animalId: 12 }] },
      }),
      include: expect.any(Object),
    })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "JUSTIFICATIF_EQUARRISSAGE_CREE",
        declarationKey: "justificatif-equarrissage:equarrissage-1",
      }),
    })
  })

  it("refuse une mortalité d’un autre compte ou encore active", async () => {
    mocks.animalFindMany.mockResolvedValueOnce([])
    const response = await POST(request("POST", { data: input }))

    expect(response.status).toBe(404)
    expect(mocks.justificatifCreate).not.toHaveBeenCalled()
  })

  it("refuse un enlèvement antérieur au décès", async () => {
    mocks.animalFindMany.mockResolvedValueOnce([{
      ...animal,
      dateSortie: new Date("2026-07-25T00:00:00.000Z"),
    }])
    const response = await POST(request("POST", { data: input }))

    expect(response.status).toBe(409)
    expect(mocks.justificatifCreate).not.toHaveBeenCalled()
  })

  it("refuse de couvrir une mortalité déjà liée à un autre bon actif", async () => {
    mocks.couvertureFindFirst.mockResolvedValueOnce({ animalId: 12 })
    const response = await POST(request("POST", { data: input }))

    expect(response.status).toBe(409)
    expect(mocks.justificatifCreate).not.toHaveBeenCalled()
  })

  it("remplace atomiquement les rattachements lors d’une modification", async () => {
    const response = await PATCH(request("PATCH", {
      id: "equarrissage-1",
      data: input,
    }))

    expect(response.status).toBe(200)
    expect(mocks.justificatifUpdate).toHaveBeenCalledWith({
      where: { id: "equarrissage-1" },
      data: expect.objectContaining({
        animaux: {
          deleteMany: {},
          create: [{ animalId: 12 }],
        },
      }),
      include: expect.any(Object),
    })
    expect(mocks.couvertureFindFirst).toHaveBeenCalledWith({
      where: {
        animalId: { in: [12] },
        justificatif: {
          userId: "user-1",
          archivedAt: null,
          id: { not: "equarrissage-1" },
        },
      },
      select: { animalId: true },
    })
  })

  it("archive sans supprimer le bon ni ses rattachements", async () => {
    const response = await DELETE(request("DELETE", {
      id: "equarrissage-1",
      archived: true,
    }))

    expect(response.status).toBe(200)
    expect(mocks.justificatifUpdate).toHaveBeenCalledWith({
      where: { id: "equarrissage-1" },
      data: { archivedAt: expect.any(Date) },
    })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "JUSTIFICATIF_EQUARRISSAGE_ARCHIVE",
      }),
    })
  })

  it("refuse de réactiver un ancien bon si une mortalité est déjà recouverte", async () => {
    mocks.couvertureFindFirst.mockResolvedValueOnce({ animalId: 12 })
    const response = await DELETE(request("DELETE", {
      id: "equarrissage-1",
      archived: false,
    }))

    expect(response.status).toBe(409)
    expect(mocks.justificatifUpdate).not.toHaveBeenCalled()
  })
})
