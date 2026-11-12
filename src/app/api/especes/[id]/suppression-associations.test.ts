/**
 * Suppression d'une espèce : ses lignes d'association partent avec elle (clé en
 * cascade), et une règle qui tombe à moins de deux membres part aussi au lieu
 * de rester muette (revue du 2026-11-12).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  especeFindFirst: vi.fn(),
  especeDelete: vi.fn(),
  detailFindMany: vi.fn(),
  detailCount: vi.fn(),
  associationDelete: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: async () => ({ session: { user: { id: "admin", role: "ADMIN" } }, error: null }),
}))
vi.mock("@/lib/prisma", () => {
  const client = {
    espece: { findFirst: mocks.especeFindFirst, delete: mocks.especeDelete },
    associationDetail: { findMany: mocks.detailFindMany, count: mocks.detailCount },
    association: { delete: mocks.associationDelete },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  }
  return { default: client }
})

import { DELETE } from "./route"

const sansAttache = {
  id: "Basilic",
  userId: null,
  _count: {
    cultures: 0, recoltes: 0, itps: 0, varietes: 0, userStocks: 0,
    arbres: 0, campagnesPlantation: 0, consommations: 0,
  },
}

function supprimer() {
  return DELETE(new NextRequest("http://x/api/especes/Basilic", { method: "DELETE" }), {
    params: Promise.resolve({ id: "Basilic" }),
  })
}

describe("DELETE /api/especes/[id] et associations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.especeFindFirst.mockResolvedValue(sansAttache)
    mocks.especeDelete.mockResolvedValue({})
    mocks.associationDelete.mockResolvedValue({})
  })

  it("supprime la règle qui ne garde plus qu'un membre, garde les autres", async () => {
    mocks.detailFindMany.mockResolvedValue([{ associationId: "asso-a" }, { associationId: "asso-b" }])
    mocks.detailCount.mockImplementation(async ({ where }: { where: { associationId: string } }) =>
      where.associationId === "asso-a" ? 1 : 3
    )

    const res = await supprimer()

    expect(res.status).toBe(200)
    expect(mocks.especeDelete).toHaveBeenCalledWith({ where: { id: "Basilic" } })
    expect(mocks.associationDelete).toHaveBeenCalledTimes(1)
    expect(mocks.associationDelete).toHaveBeenCalledWith({ where: { id: "asso-a" } })
  })

  it("ne touche à aucune règle quand l'espèce n'en porte pas", async () => {
    mocks.detailFindMany.mockResolvedValue([])

    const res = await supprimer()

    expect(res.status).toBe(200)
    expect(mocks.detailCount).not.toHaveBeenCalled()
    expect(mocks.associationDelete).not.toHaveBeenCalled()
  })
})
