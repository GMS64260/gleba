import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  parcelleFindFirst: vi.fn(),
  arbresFindMany: vi.fn(),
  arbresUpdateMany: vi.fn(),
  lotFindFirst: vi.fn(),
  executeRaw: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => {
  const tx = {
    $executeRaw: mocks.executeRaw,
    arbre: { findMany: mocks.arbresFindMany, updateMany: mocks.arbresUpdateMany },
    lotArbres: { findFirst: mocks.lotFindFirst },
  }
  return {
    default: {
      ...tx,
      parcelleGeo: { findFirst: mocks.parcelleFindFirst },
      $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
    },
  }
})

import { POST } from "./route"

const request = (arbreIds = [1, 2], parcelleGeoId: string | null = "cible") =>
  new Request("http://localhost/api/arbres/bulk-parcelle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ arbreIds, parcelleGeoId }),
  }) as never

const pommier = { id: 1, nom: "Pommier du pré", espece: "Pommier", parcelleGeoId: "source" }
const poirier = { id: 2, nom: "Poirier du pré", espece: "Poirier", parcelleGeoId: "source" }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ session: { user: { id: "ferme-1" } }, error: null })
  mocks.parcelleFindFirst.mockResolvedValue({ id: "cible", nom: "Pré", usage: null, couches: ["VERGER"] })
  mocks.arbresFindMany.mockResolvedValue([pommier, poirier])
  mocks.arbresUpdateMany.mockResolvedValue({ count: 2 })
  mocks.lotFindFirst.mockResolvedValue(null)
})

describe("POST /api/arbres/bulk-parcelle", () => {
  it("refuse l'arbre en conflit et déplace l'autre avec le détail par arbre", async () => {
    mocks.lotFindFirst.mockImplementation(async ({ where }) =>
      where.espece.in.includes("Pommier") ? { id: "lot-pommiers" } : null,
    )
    mocks.arbresUpdateMany.mockResolvedValue({ count: 1 })

    const res = await POST(request([1, 2, 99]))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      updated: 1,
      refusedIds: [99],
      conflits: [{ id: 1, nom: "Pommier du pré", espece: "Pommier" }],
      avertissement: null,
    })
    expect(mocks.arbresUpdateMany).toHaveBeenCalledOnce()
    expect(mocks.arbresUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [2] }, userId: "ferme-1" },
      data: { parcelleGeoId: "cible" },
    })
    expect(mocks.arbresFindMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2, 99] }, userId: "ferme-1" },
      select: { id: true, nom: true, espece: true, parcelleGeoId: true },
    })
    expect(mocks.lotFindFirst).toHaveBeenCalledWith({
      where: { userId: "ferme-1", parcelleGeoId: "cible", espece: { in: ["Pommier"], mode: "insensitive" } },
      select: { id: true },
    })
    expect(mocks.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(mocks.arbresFindMany.mock.invocationCallOrder[0])
  })

  it("conserve les arbres déjà rattachés à la cible malgré un conflit historique", async () => {
    mocks.arbresFindMany.mockResolvedValue([{ ...pommier, parcelleGeoId: "cible" }])
    mocks.arbresUpdateMany.mockResolvedValue({ count: 1 })
    mocks.lotFindFirst.mockResolvedValue({ id: "lot-pommiers" })

    const res = await POST(request([1]))

    expect(await res.json()).toMatchObject({ updated: 1, conflits: [] })
    expect(mocks.lotFindFirst).not.toHaveBeenCalled()
  })

  it("permet le détachement sans rechercher de lot agrégé", async () => {
    const res = await POST(request([1, 2], null))

    expect(await res.json()).toMatchObject({ updated: 2, conflits: [] })
    expect(mocks.lotFindFirst).not.toHaveBeenCalled()
    expect(mocks.arbresUpdateMany.mock.calls[0][0].data).toEqual({ parcelleGeoId: null })
  })

  it("n'écrit rien lorsque tous les arbres sont en conflit", async () => {
    mocks.lotFindFirst.mockResolvedValue({ id: "lot" })

    const res = await POST(request())

    expect(await res.json()).toMatchObject({ updated: 0, conflits: [
      { id: 1, nom: pommier.nom, espece: "Pommier" },
      { id: 2, nom: poirier.nom, espece: "Poirier" },
    ] })
    expect(mocks.arbresUpdateMany).not.toHaveBeenCalled()
  })

  it("ne masque pas une erreur de base comme un conflit par arbre", async () => {
    mocks.lotFindFirst.mockRejectedValue(new Error("Base indisponible"))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const res = await POST(request())
      expect(res.status).toBe(500)
      expect(mocks.arbresUpdateMany).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  it("refuse une parcelle étrangère avant toute lecture d'arbre", async () => {
    mocks.parcelleFindFirst.mockResolvedValue(null)

    const res = await POST(request())

    expect(res.status).toBe(404)
    expect(mocks.parcelleFindFirst.mock.calls[0][0].where).toEqual({ id: "cible", userId: "ferme-1" })
    expect(mocks.arbresFindMany).not.toHaveBeenCalled()
  })
})
