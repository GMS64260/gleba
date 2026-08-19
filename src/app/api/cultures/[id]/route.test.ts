import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  cultureFindUnique: vi.fn(),
  cultureUpdate: vi.fn(),
  invalidateUser: vi.fn(),
  invalidateKpi: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: () => "user-1",
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    culture: {
      findUnique: mocks.cultureFindUnique,
      update: mocks.cultureUpdate,
    },
  },
}))
vi.mock("@/lib/irrigation-cache", () => ({
  irrigationCache: { invalidateUser: mocks.invalidateUser },
}))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: mocks.invalidateKpi }))

import { PATCH } from "./route"

const params = Promise.resolve({ id: "42" })

function patch(body: Record<string, unknown>) {
  return PATCH(
    new NextRequest("http://localhost/api/cultures/42", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params }
  )
}

/**
 * QA cmsio768u / cmsio8o54 (2026-08-07) — les actions rapides du tableau sont
 * des bascules : recliquer sur une étape déjà faite la dé-marquait en un clic,
 * et la cascade d'état affichait « Planifiée » sur une culture portant 3
 * récoltes. Le registre de récolte fait foi.
 */
describe("PATCH /api/cultures/[id] — cohérence du cycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.cultureUpdate.mockResolvedValue({ id: 42 })
  })

  const culture = (over: Record<string, unknown> = {}, recoltes = 0) => ({
    id: 42,
    semisFait: true,
    plantationFaite: false,
    recolteFaite: false,
    _count: { recoltes },
    ...over,
  })

  it("refuse d'annuler le semis d'une culture qui porte des récoltes", async () => {
    mocks.cultureFindUnique.mockResolvedValue(culture({}, 3))

    const response = await patch({ semisFait: false })
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload.recoltes).toBe(3)
    expect(payload.error).toContain("3 récoltes enregistrées")
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it("refuse d'annuler la récolte d'une culture qui porte des récoltes", async () => {
    mocks.cultureFindUnique.mockResolvedValue(
      culture({ plantationFaite: true, recolteFaite: true }, 4)
    )

    const response = await patch({ recolteFaite: false })

    expect(response.status).toBe(409)
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it("refuse d'annuler une étape amont si une étape aval reste faite", async () => {
    mocks.cultureFindUnique.mockResolvedValue(
      culture({ plantationFaite: true, recolteFaite: true })
    )

    const response = await patch({ semisFait: false })
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload.error).toContain("Annulez d'abord")
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it("accepte l'annulation en cascade dans le même appel", async () => {
    mocks.cultureFindUnique.mockResolvedValue(
      culture({ plantationFaite: true, recolteFaite: true })
    )

    const response = await patch({
      semisFait: false,
      plantationFaite: false,
      recolteFaite: false,
    })

    expect(response.status).toBe(200)
    expect(mocks.cultureUpdate).toHaveBeenCalled()
  })

  it("accepte d'annuler la dernière étape faite sans récolte enregistrée", async () => {
    mocks.cultureFindUnique.mockResolvedValue(culture())

    const response = await patch({ semisFait: false })

    expect(response.status).toBe(200)
    expect(mocks.cultureUpdate).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { semisFait: false },
    })
  })

  it("laisse passer le marquage d'une étape sur une culture récoltée", async () => {
    mocks.cultureFindUnique.mockResolvedValue(culture({}, 3))

    const response = await patch({ recolteFaite: true })

    expect(response.status).toBe(200)
    expect(mocks.cultureUpdate).toHaveBeenCalled()
  })
})
