import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Revue du 2026-10-29 : une perte ou une consommation enregistrée sur une
 * récolte jamais livrée la figeait (quantité, date, suppression refusées).
 * Seul un BL ou une facture fige désormais le lot ; ses sorties physiques
 * doivent rester couvertes par la quantité corrigée.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lot: null as Record<string, unknown> | null,
  mouvements: [] as Array<Record<string, unknown>>,
  update: vi.fn(),
  remove: vi.fn(),
  mouvementsDeleteMany: vi.fn(),
  deleteAutoEntry: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/stocks/verrou-commercial", () => ({ verrouillerStockCommercial: vi.fn() }))
vi.mock("@/lib/prisma", () => {
  const db = {
    recolteArbre: {
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
vi.mock("@/lib/auto-compta", () => ({ deleteAutoEntry: mocks.deleteAutoEntry, createVenteFromRecolteArbre: vi.fn() }))
vi.mock("@/lib/facture-utils", () => ({ creerFacture: vi.fn(), annulerFactureLiee: vi.fn() }))
vi.mock("@/lib/verger/dar", () => ({ avertissementsDarFruit: vi.fn(async () => []) }))

import { DELETE, PUT } from "./route"

const params = { params: Promise.resolve({ id: "5" }) }
const modifier = (body: Record<string, unknown>) =>
  PUT(new Request("http://localhost/api/arbres/recoltes/5", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }) as never, params)
const supprimer = () => DELETE(new Request("http://localhost/api/arbres/recoltes/5", { method: "DELETE" }) as never, params)

const perte = { id: "perte-1", nature: "perte", quantite: 2, unite: "kg", date: new Date("2026-10-22T12:00:00Z") }
const livraison = { id: "bl-1", nature: "livraison", quantite: 3, unite: "kg", date: new Date("2026-10-23T12:00:00Z") }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
  mocks.lot = {
    id: 5, userId: "u1", arbreId: 10, quantite: 10, stockDisponibleCommercial: 8, statut: "en_stock", factureId: null,
    date: new Date("2026-10-20T12:00:00Z"), parcelleId: null, numLot: "LOT-MANUEL", arbre: { espece: "Pommier" },
  }
  mocks.mouvements = [perte]
  mocks.update.mockImplementation(async ({ data }) => ({ ...mocks.lot, ...data, arbre: null }))
})

describe("PUT /api/arbres/recoltes/[id] — lot entamé par une perte", () => {
  it("corrige la quantité d'un lot sans document et recalcule son reliquat", async () => {
    const res = await modifier({ quantite: 12 })

    expect(res.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quantite: 12, stockDisponibleCommercial: 10 }),
    }))
  })

  it("refuse une quantité qui ne couvre plus la perte enregistrée", async () => {
    const res = await modifier({ quantite: 1 })

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain("couvrir les sorties")
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("reste figé dès qu'un BL a livré une partie du lot", async () => {
    mocks.lot = { ...mocks.lot!, stockDisponibleCommercial: 5 }
    mocks.mouvements = [livraison, perte]
    const res = await modifier({ quantite: 12 })

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain("document commercial")
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/arbres/recoltes/[id] — lot entamé par une perte", () => {
  it("supprime un lot sans document avec son journal de pertes", async () => {
    const res = await supprimer()

    expect(res.status).toBe(200)
    expect(mocks.mouvementsDeleteMany).toHaveBeenCalledWith({ where: { userId: "u1", id: { in: ["perte-1"] } } })
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: 5, userId: "u1" } })
  })

  it("conserve un lot livré par BL et ses mouvements", async () => {
    mocks.lot = { ...mocks.lot!, stockDisponibleCommercial: 5 }
    mocks.mouvements = [livraison, perte]
    const res = await supprimer()

    expect(res.status).toBe(409)
    expect(mocks.mouvementsDeleteMany).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
  })
})
