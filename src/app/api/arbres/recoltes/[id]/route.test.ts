import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * QA cmv2ebsdk (2026-10-10) : en modification d'une récolte de fruits, le
 * nouvel arbre choisi était ignoré (lot et notes enregistrés, arbre inchangé) :
 * la route PUT ne lisait pas `arbreId`. Impossible de corriger un rattachement.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  recolteFindUnique: vi.fn(),
  recolteUpdate: vi.fn(),
  recolteCount: vi.fn(),
  arbreFindFirst: vi.fn(),
  parcelleFindFirst: vi.fn(),
  parcelleFindUnique: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    recolteArbre: {
      findUnique: mocks.recolteFindUnique,
      update: mocks.recolteUpdate,
      count: mocks.recolteCount,
    },
    arbre: { findFirst: mocks.arbreFindFirst },
    parcelleGeo: { findFirst: mocks.parcelleFindFirst, findUnique: mocks.parcelleFindUnique },
  },
}))
vi.mock("@/lib/auto-compta", () => ({ createVenteFromRecolteArbre: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock("@/lib/facture-utils", () => ({ creerFacture: vi.fn(), annulerFactureLiee: vi.fn() }))

import { PUT } from "./route"

const RECOLTE = {
  id: 132,
  userId: "u1",
  arbreId: 10,
  date: new Date("2026-10-10T00:00:00.000Z"),
  parcelleId: "parc-1",
  numLot: "20261010-Verger-Prunier-01",
  arbre: { espece: "Prunier" },
}

const modifier = (body: Record<string, unknown>) =>
  PUT(
    new Request("http://localhost/api/arbres/recoltes/132", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: "132" }) }
  )

describe("PUT /api/arbres/recoltes/[id] — changement d'arbre", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.recolteFindUnique.mockResolvedValue(RECOLTE)
    mocks.recolteUpdate.mockImplementation(async ({ data }) => ({ ...RECOLTE, ...data }))
    mocks.recolteCount.mockResolvedValue(0)
    mocks.parcelleFindUnique.mockResolvedValue({ nom: "Verger" })
  })

  it("enregistre le nouvel arbre, vérifié dans le compte", async () => {
    mocks.arbreFindFirst.mockResolvedValue({ id: 20, espece: "Prunier" })

    const res = await modifier({ arbreId: 20, numLot: "TEST-LOT", notes: "Récolte de test" })

    expect(res.status).toBe(200)
    expect(mocks.arbreFindFirst).toHaveBeenCalledWith({
      where: { id: 20, userId: "u1" },
      select: { id: true, espece: true },
    })
    const data = mocks.recolteUpdate.mock.calls[0][0].data
    expect(data.arbreId).toBe(20)
    expect(data.numLot).toBe("TEST-LOT")
    expect(data.notes).toBe("Récolte de test")
  })

  it("refuse un arbre d'un autre compte sans rien écrire", async () => {
    mocks.arbreFindFirst.mockResolvedValue(null)

    const res = await modifier({ arbreId: 99 })

    expect(res.status).toBe(404)
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("refuse un identifiant d'arbre illisible", async () => {
    const res = await modifier({ arbreId: "abc" })
    expect(res.status).toBe(400)
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("ne relit pas l'arbre quand il est inchangé", async () => {
    const res = await modifier({ arbreId: 10, notes: "x" })

    expect(res.status).toBe(200)
    expect(mocks.arbreFindFirst).not.toHaveBeenCalled()
    expect(mocks.recolteUpdate.mock.calls[0][0].data.arbreId).toBeUndefined()
  })

  it("régénère un lot automatique quand l'espèce change avec l'arbre", async () => {
    mocks.arbreFindFirst.mockResolvedValue({ id: 30, espece: "Pommier" })

    await modifier({ arbreId: 30 })

    const data = mocks.recolteUpdate.mock.calls[0][0].data
    expect(data.arbreId).toBe(30)
    expect(data.numLot).toBe("20261010-Verger-Pommier-01")
    expect(mocks.recolteCount).toHaveBeenCalledWith({
      where: expect.objectContaining({ arbre: { espece: "Pommier" } }),
    })
  })

  it("ne touche jamais un lot saisi à la main", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...RECOLTE, numLot: "LOT-MANUEL-1010" })
    mocks.arbreFindFirst.mockResolvedValue({ id: 30, espece: "Pommier" })

    await modifier({ arbreId: 30 })

    expect(mocks.recolteUpdate.mock.calls[0][0].data.numLot).toBeUndefined()
  })
})
