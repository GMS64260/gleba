import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  invalidateKpi: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: mocks.invalidateKpi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    culture: { findMany: mocks.findMany, updateMany: mocks.updateMany, update: mocks.update },
    $transaction: mocks.transaction,
  },
}))

import { POST } from "./route"

const requete = (corps: unknown) =>
  new NextRequest("http://localhost/api/cultures/bulk-fait", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  })

const etapesVides = {
  dateSemis: null,
  datePlantation: null,
  dateRecolte: null,
  dateSemisPlan: null,
  datePlantationPlan: null,
  dateRecoltePlan: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "exploitation-1" } } })
  mocks.transaction.mockResolvedValue([])
})

describe("POST /api/cultures/bulk-fait", () => {
  // Revue du 2026-11-11 : la « surface cultivée » des indicateurs compte les
  // cultures dont une étape est faite ; sans invalidation, « Marquer fait »
  // depuis le calendrier laissait l'indicateur périmé jusqu'à l'expiration du
  // cache, alors que la même action à l'unité (PATCH) le rafraîchit.
  it("invalide les indicateurs de l'exploitation après l'écriture", async () => {
    mocks.findMany.mockResolvedValue([{ id: 1, ...etapesVides }, { id: 2, ...etapesVides }])
    const res = await POST(requete({ ids: [1, 2], type: "semis" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ updated: 2, ignores: 0 })
    expect(mocks.findMany.mock.calls[0][0].where.userId).toBe("exploitation-1")
    expect(mocks.invalidateKpi).toHaveBeenCalledWith("exploitation-1")
  })

  it("n'invalide rien quand aucune culture n'est concernée", async () => {
    mocks.findMany.mockResolvedValue([])
    const res = await POST(requete({ ids: [9], type: "recolte" }))
    expect(await res.json()).toEqual({ updated: 0, ignores: 1 })
    expect(mocks.invalidateKpi).not.toHaveBeenCalled()
  })

  it("refuse un corps invalide sans rien lire", async () => {
    const res = await POST(requete({ ids: [], type: "semis" }))
    expect(res.status).toBe(400)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
