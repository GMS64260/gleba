import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  exploitationFindUnique: vi.fn(),
  transaction: vi.fn(),
  lieuFindFirst: vi.fn(),
  lieuCreate: vi.fn(),
  lieuUpdate: vi.fn(),
  intervenantFindFirst: vi.fn(),
  intervenantCreate: vi.fn(),
  intervenantUpdate: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    exploitation: { findUnique: mocks.exploitationFindUnique },
    $transaction: mocks.transaction,
  },
}))

import { DELETE, GET, PATCH, POST } from "./route"

const request = (method: string, body: object) => new NextRequest(
  "http://localhost/api/elevage/cadre-reglementaire",
  {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  },
)

const lieu = {
  id: "lieu-1",
  exploitationId: "exploitation-1",
  parentId: null,
  type: "SITE",
  nom: "Ferme principale",
  numeroEde: "EDE-64",
  adresse: "1 chemin rural",
  codePostal: "64000",
  ville: "Pau",
  especes: ["Caprins"],
  usages: "Chèvrerie",
  planMasseUrl: null,
  archivedAt: null,
  createdAt: new Date("2026-07-26T10:00:00.000Z"),
  updatedAt: new Date("2026-07-26T10:00:00.000Z"),
}

describe("API cadre réglementaire élevage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.exploitationFindUnique.mockResolvedValue({
      id: "exploitation-1",
      raisonSociale: "Ferme test",
      numeroEde: "EDE-64",
      veterinaireSanitaire: null,
      lieuxDetentionElevage: [],
      intervenantsElevage: [],
    })
    mocks.lieuFindFirst.mockResolvedValue(null)
    mocks.lieuCreate.mockResolvedValue(lieu)
    mocks.lieuUpdate.mockImplementation(async ({ data }) => ({ ...lieu, ...data }))
    mocks.intervenantFindFirst.mockResolvedValue(null)
    mocks.intervenantCreate.mockResolvedValue({
      id: "intervenant-1",
      exploitationId: "exploitation-1",
      role: "DETENTEUR",
      statut: "ACTIF",
      nom: "Alice Martin",
      organisme: null,
      archivedAt: null,
      createdAt: new Date("2026-07-26T10:00:00.000Z"),
      updatedAt: new Date("2026-07-26T10:00:00.000Z"),
    })
    mocks.intervenantUpdate.mockImplementation(async ({ data }) => ({
      id: "intervenant-1",
      exploitationId: "exploitation-1",
      role: "DETENTEUR",
      statut: "ACTIF",
      nom: "Alice Martin",
      archivedAt: null,
      ...data,
    }))
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" })
    mocks.transaction.mockImplementation(async (callback) => callback({
      lieuDetentionElevage: {
        findFirst: mocks.lieuFindFirst,
        create: mocks.lieuCreate,
        update: mocks.lieuUpdate,
      },
      intervenantElevage: {
        findFirst: mocks.intervenantFindFirst,
        create: mocks.intervenantCreate,
        update: mocks.intervenantUpdate,
      },
      declarationReglementaireEvenement: {
        create: mocks.auditCreate,
      },
    }))
  })

  it("scope la lecture sur l’exploitation du compte authentifié", async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(mocks.exploitationFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1" },
    }))
    expect((await response.json()).configured).toBe(true)
  })

  it("crée un lieu et son événement d’audit dans la même transaction", async () => {
    mocks.exploitationFindUnique.mockResolvedValueOnce({ id: "exploitation-1" })

    const response = await POST(request("POST", {
      kind: "lieu",
      data: {
        type: "SITE",
        nom: "Ferme principale",
        numeroEde: "EDE-64",
        adresse: "1 chemin rural",
        codePostal: "64000",
        ville: "Pau",
        especes: ["Caprins"],
        usages: "Chèvrerie",
        planMasseUrl: "",
        parentId: "",
      },
    }))

    expect(response.status).toBe(201)
    expect(mocks.lieuCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        exploitationId: "exploitation-1",
        nom: "Ferme principale",
        parentId: null,
      }),
    })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        action: "CADRE_LIEU_CREE",
        declarationKey: "cadre-reglementaire:lieu:lieu-1",
        snapshotHash: expect.any(String),
      }),
    })
  })

  it("refuse de modifier un intervenant d’une autre exploitation", async () => {
    mocks.exploitationFindUnique.mockResolvedValueOnce({ id: "exploitation-1" })
    mocks.intervenantFindFirst.mockResolvedValueOnce(null)

    const response = await PATCH(request("PATCH", {
      kind: "intervenant",
      id: "intervenant-autre-tenant",
      data: {
        role: "DETENTEUR",
        statut: "ACTIF",
        nom: "Alice Martin",
        especes: [],
        typesProduction: [],
      },
    }))

    expect(response.status).toBe(404)
    expect(mocks.intervenantFindFirst).toHaveBeenCalledWith({
      where: {
        id: "intervenant-autre-tenant",
        exploitationId: "exploitation-1",
      },
    })
    expect(mocks.intervenantUpdate).not.toHaveBeenCalled()
  })

  it("archive sans supprimer physiquement et journalise l’action", async () => {
    mocks.exploitationFindUnique.mockResolvedValueOnce({ id: "exploitation-1" })
    mocks.intervenantFindFirst.mockResolvedValueOnce({
      id: "intervenant-1",
      exploitationId: "exploitation-1",
      role: "DETENTEUR",
      statut: "ACTIF",
      nom: "Alice Martin",
      archivedAt: null,
    })

    const response = await DELETE(request("DELETE", {
      kind: "intervenant",
      id: "intervenant-1",
      archived: true,
    }))

    expect(response.status).toBe(200)
    expect(mocks.intervenantUpdate).toHaveBeenCalledWith({
      where: { id: "intervenant-1" },
      data: { archivedAt: expect.any(Date) },
    })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CADRE_INTERVENANT_ARCHIVE",
        declarationKey: "cadre-reglementaire:intervenant:intervenant-1",
      }),
    })
  })

  it("bloque un cycle dans la hiérarchie des lieux", async () => {
    mocks.exploitationFindUnique.mockResolvedValueOnce({ id: "exploitation-1" })
    mocks.lieuFindFirst
      .mockResolvedValueOnce(lieu)
      .mockResolvedValueOnce({ parentId: "lieu-1", archivedAt: null })

    const response = await PATCH(request("PATCH", {
      kind: "lieu",
      id: "lieu-1",
      data: {
        type: "SITE",
        nom: "Ferme principale",
        parentId: "lieu-2",
        numeroEde: "",
        adresse: "",
        codePostal: "",
        ville: "",
        especes: [],
        usages: "",
        planMasseUrl: "",
      },
    }))

    expect(response.status).toBe(409)
    expect(mocks.lieuUpdate).not.toHaveBeenCalled()
  })
})
