import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Revue du 2026-10-29 : un usage interne enregistré sur un lot de bois jamais
 * livré le figeait (volume, date, suppression refusés). Seul un BL ou une
 * facture fige désormais le lot ; ses usages internes restent couverts par le
 * volume corrigé, dans la même mesure.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lot: null as Record<string, unknown> | null,
  mouvements: [] as Array<Record<string, unknown>>,
  update: vi.fn(),
  remove: vi.fn(),
  mouvementsDeleteMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/stocks/verrou-commercial", () => ({ verrouillerStockCommercial: vi.fn() }))
vi.mock("@/lib/prisma", () => {
  const db = {
    productionBois: {
      findUnique: vi.fn(async () => mocks.lot),
      findFirst: vi.fn(async () => mocks.lot),
      update: mocks.update,
      delete: mocks.remove,
    },
    mouvementStockCommercial: {
      findMany: vi.fn(async () => mocks.mouvements),
      deleteMany: mocks.mouvementsDeleteMany,
    },
  }
  return { default: { ...db, $transaction: (fn: (tx: typeof db) => unknown) => fn(db) } }
})
vi.mock("@/lib/auto-compta", () => ({ deleteAutoEntry: vi.fn(), createVenteFromProductionBois: vi.fn() }))
vi.mock("@/lib/facture-utils", () => ({ creerFacture: vi.fn(), annulerFactureLiee: vi.fn() }))

import { DELETE, PUT } from "./route"

const params = { params: Promise.resolve({ id: "8" }) }
const modifier = (body: Record<string, unknown>) =>
  PUT(new Request("http://localhost/api/arbres/bois/8", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }) as never, params)
const supprimer = () => DELETE(new Request("http://localhost/api/arbres/bois/8", { method: "DELETE" }) as never, params)

const usage = { id: "usage-1", nature: "utilise", quantite: 2, unite: "stère", date: new Date("2026-10-22T12:00:00Z") }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
  mocks.lot = {
    id: 8, userId: "u1", arbreId: null, type: "buche", volumeStere: 5, volumeM3: null, poidsKg: null,
    stockDisponibleCommercial: 3, statut: "en_stock", factureId: null, date: new Date("2026-10-20T12:00:00Z"),
  }
  mocks.mouvements = [usage]
  mocks.update.mockImplementation(async ({ data }) => ({ ...mocks.lot, ...data }))
})

describe("PUT /api/arbres/bois/[id] — lot entamé par un usage interne", () => {
  it("corrige le volume d'un lot sans document et recalcule son reliquat", async () => {
    const res = await modifier({ volumeM3: 10 })

    expect(res.status).toBe(200)
    const { data } = mocks.update.mock.calls[0][0]
    expect(data.volumeStere).toBeGreaterThan(2)
    expect(data.stockDisponibleCommercial).toBeCloseTo(data.volumeStere - 2, 6)
  })

  it("refuse de changer la mesure dans laquelle l'usage a été compté", async () => {
    mocks.lot = { ...mocks.lot!, volumeStere: null, poidsKg: 5 }
    mocks.mouvements = [{ ...usage, unite: "kg" }]
    const res = await modifier({ volumeM3: 3 })

    expect(res.status).toBe(409)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/arbres/bois/[id] — lot entamé par un usage interne", () => {
  it("supprime un lot sans document avec son journal d'usages", async () => {
    const res = await supprimer()

    expect(res.status).toBe(200)
    expect(mocks.mouvementsDeleteMany).toHaveBeenCalledWith({ where: { userId: "u1", id: { in: ["usage-1"] } } })
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: 8, userId: "u1" } })
  })
})
