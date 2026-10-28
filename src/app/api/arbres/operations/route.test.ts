import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  arbreFindFirst: vi.fn(),
  operationCreate: vi.fn(),
  operationFindMany: vi.fn(),
  createDepense: vi.fn(),
  membreFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => {
  const db = {
    $executeRaw: vi.fn(),
    arbre: { findFirst: mocks.arbreFindFirst },
    operationArbre: { create: mocks.operationCreate, findMany: mocks.operationFindMany },
    membreExploitation: { findFirst: mocks.membreFindFirst },
  }
  return { default: { ...db, $transaction: (callback: (tx: typeof db) => unknown) => callback(db) } }
})

vi.mock("@/lib/auto-compta", () => ({
  createDepenseFromOperationArbre: mocks.createDepense,
}))

import { GET, POST } from "./route"
import { whereOperationsArbreAnnee } from "@/lib/verger/annee-operation"

const request = (body: unknown) =>
  new Request("http://localhost/api/arbres/operations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

describe("POST /api/arbres/operations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.arbreFindFirst.mockResolvedValue({ id: 42, userId: "user-1" })
    mocks.operationCreate.mockImplementation(async ({ data }) => ({
      id: 1,
      ...data,
      arbre: { id: 42, nom: "Pommier", type: "fruitier" },
    }))
  })

  it("refuse une opération à faire sans date prévue", async () => {
    const response = await POST(request({
      arbreId: 42,
      type: "taille",
      fait: false,
      date: "2026-07-29",
    }) as never)

    expect(response.status).toBe(400)
    expect(mocks.operationCreate).not.toHaveBeenCalled()
  })

  it("conserve la date prévue comme date métier d'une opération à faire", async () => {
    const response = await POST(request({
      arbreId: 42,
      type: "taille",
      fait: false,
      date: "2026-07-29",
      datePrevue: "2026-08-18",
    }) as never)

    expect(response.status).toBe(201)
    expect(mocks.operationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        fait: false,
        date: new Date("2026-08-18"),
        datePrevue: new Date("2026-08-18"),
      }),
    }))
  })

  // Revue du 2026-10-20 (cmvgeltj1) — l'opérateur désigné sort en Applicateur
  // au registre phyto : `body.operateurId` était écrit sans aucun contrôle.
  it("refuse un operateurId qui n'est ni le titulaire ni un membre de l'exploitation", async () => {
    mocks.membreFindFirst.mockResolvedValue(null)
    const response = await POST(request({ arbreId: 42, type: "traitement", operateurId: "user-tiers" }) as never)

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain("operateurId")
    expect(mocks.operationCreate).not.toHaveBeenCalled()
  })

  it("enregistre un membre actif de l'exploitation comme opérateur", async () => {
    mocks.membreFindFirst.mockResolvedValue({ id: "adhesion-1" })
    const response = await POST(request({ arbreId: 42, type: "traitement", operateurId: "user-membre" }) as never)

    expect(response.status).toBe(201)
    expect(mocks.operationCreate.mock.calls[0][0].data.operateurId).toBe("user-membre")
  })
})

describe("GET /api/arbres/operations — année (QA 2026-10-19)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.operationFindMany.mockResolvedValue([])
  })

  const get = (query: string) =>
    GET(new NextRequest(`http://localhost/api/arbres/operations${query}`))

  it("filtre l'année demandée par l'onglet Opérations, avec la règle partagée", async () => {
    // L'écran envoie exactement ce paramètre (OperationsTab).
    const response = await get("?annee=2025")
    expect(response.status).toBe(200)
    expect(mocks.operationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1", AND: [whereOperationsArbreAnnee(2025)] },
    }))
  })

  it("garde l'alias historique ?year= du calendrier", async () => {
    await get("?year=2027")
    expect(mocks.operationFindMany.mock.calls[0][0].where.AND).toEqual([whereOperationsArbreAnnee(2027)])
  })

  it("sans année, ou avec annee=all, rend toutes les années (Calendrier à faire, registre phyto)", async () => {
    await get("?fait=false")
    expect(mocks.operationFindMany.mock.calls[0][0].where).toEqual({ userId: "user-1", fait: false })
    await get("?annee=all")
    expect(mocks.operationFindMany.mock.calls[1][0].where).toEqual({ userId: "user-1" })
  })
})
