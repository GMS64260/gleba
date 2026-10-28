import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * QA cmvnp0dm9 (2026-10-25) : la liste des types de production de bois était
 * recopiée dans l'écran et dans cette route. Elle vit désormais dans
 * `src/lib/verger/production-bois.ts` ; un type hors liste, qui n'aurait aucun
 * libellé à afficher sur la vente ni sur la facture, est refusé à la création.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  productionCreate: vi.fn(),
  productionCount: vi.fn(),
  arbreFindFirst: vi.fn(),
  parcelleFindUnique: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: async (fn: (tx: unknown) => unknown) => { const { default: db } = await import('@/lib/prisma'); return fn(db) },
    $executeRaw: vi.fn(async () => 0), $queryRaw: vi.fn(async () => [{ dernier_numero: 1 }]),
    productionBois: { create: mocks.productionCreate, count: mocks.productionCount },
    arbre: { findFirst: mocks.arbreFindFirst },
    parcelleGeo: { findFirst: mocks.parcelleFindUnique },
  },
}))

import { POST } from "./route"

const creer = (body: Record<string, unknown>) =>
  POST(
    new Request("http://localhost/api/arbres/bois", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never
  )

// Corps envoyé par « Ajouter au stock » (ProductionsTab, handleSubmit).
const CORPS_ECRAN = {
  arbreId: 881,
  date: "2026-10-25",
  type: "elagage",
  volumeM3: 0.2,
  volumeStere: null,
  poidsKg: null,
  qualiteBois: null,
  destination: null,
  statut: "en_stock",
  notes: null,
}

describe("POST /api/arbres/bois — type de production", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.arbreFindFirst.mockResolvedValue({ id: 881, espece: "Noyer", parcelleGeoId: "parc-v" })
    mocks.parcelleFindUnique.mockResolvedValue({ nom: "Demo-V" })
    mocks.productionCount.mockResolvedValue(0)
    mocks.productionCreate.mockImplementation(async ({ data }) => ({ id: 41, ...data }))
  })

  it("accepte « elagage », le type envoyé par l'écran", async () => {
    const res = await creer(CORPS_ECRAN)

    expect(res.status).toBe(201)
    expect(mocks.productionCreate).toHaveBeenCalledTimes(1)
    expect(mocks.productionCreate.mock.calls[0][0].data).toMatchObject({ type: "elagage", volumeM3: 0.2, arbreId: 881 })
  })

  it("refuse un type hors liste en nommant les types acceptés", async () => {
    const res = await creer({ ...CORPS_ECRAN, type: "coupe" })

    expect(res.status).toBe(400)
    const corps = await res.json()
    expect(corps.champ).toBe("type")
    expect(corps.error).toContain("Élagage, Abattage, Branchage")
    expect(mocks.productionCreate).not.toHaveBeenCalled()
  })

  it("refuse un type absent en désignant le champ", async () => {
    const res = await creer({ ...CORPS_ECRAN, type: "" })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Le type de production est requis", champ: "type" })
    expect(mocks.productionCreate).not.toHaveBeenCalled()
  })
})
