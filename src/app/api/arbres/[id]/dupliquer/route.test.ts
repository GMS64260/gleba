import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Revue du 2026-10-29 : « Dupliquer ×N » recopiait le prix et la date d'achat
 * de l'arbre source et créait N dépenses d'achat sans prévenir, toutes datées
 * de l'achat d'origine. La recopie de l'achat est désormais une option
 * explicite, refusée par défaut.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  arbreFindFirst: vi.fn(),
  arbreFindMany: vi.fn(),
  arbreCreate: vi.fn(),
  createDepenseFromAchatArbre: vi.fn(),
  genererCalendrierEntretien: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => {
  const db = {
    arbre: { findFirst: mocks.arbreFindFirst, findMany: mocks.arbreFindMany, create: mocks.arbreCreate },
  }
  return { default: { ...db, $transaction: (fn: (tx: typeof db) => unknown) => fn(db) } }
})
vi.mock("@/lib/stocks/verrou-commercial", () => ({ verrouillerStockCommercial: vi.fn() }))
vi.mock("@/lib/auto-compta", () => ({ createDepenseFromAchatArbre: mocks.createDepenseFromAchatArbre }))
vi.mock("@/lib/kpi/cache", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/verger/creation-arbre", () => ({ genererCalendrierEntretien: mocks.genererCalendrierEntretien }))

import { POST } from "./route"

const source = {
  id: 7, userId: "user-1", nom: "Pommier", posX: 2, posY: 3, envergure: 2,
  type: "fruitier", espece: "Pommier", especeId: "Pommier", variete: "Reinette",
  fournisseur: "Pépinière synthétique", dateAchat: new Date("2026-03-01T00:00:00Z"), prixAchat: 30,
  datePlantation: new Date("2026-03-10T00:00:00Z"), parcelleGeoId: "p1",
}

const requete = (body: unknown) =>
  new Request("http://localhost/api/arbres/7/dupliquer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never
const params = { params: Promise.resolve({ id: "7" }) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
  mocks.arbreFindFirst.mockResolvedValue(source)
  mocks.arbreFindMany.mockResolvedValue([{ nom: "Pommier" }])
  mocks.genererCalendrierEntretien.mockResolvedValue(true)
  let id = 100
  mocks.arbreCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: ++id, createdAt: new Date(), ...data }))
})

describe("POST /api/arbres/[id]/dupliquer — achat", () => {
  it("ne recopie ni le prix ni la date d'achat par défaut, et ne crée aucune dépense", async () => {
    const res = await POST(requete({ nombre: 3 }), params)

    expect(res.status).toBe(201)
    expect(mocks.arbreCreate).toHaveBeenCalledTimes(3)
    for (const [{ data }] of mocks.arbreCreate.mock.calls) {
      expect(data).toMatchObject({ prixAchat: null, dateAchat: null, fournisseur: "Pépinière synthétique", datePlantation: source.datePlantation })
    }
    expect(mocks.createDepenseFromAchatArbre).not.toHaveBeenCalled()
    expect((await res.json()).achatsRecopies).toBe(0)
  })

  it("recopie l'achat sur demande explicite : une dépense par copie", async () => {
    const res = await POST(requete({ nombre: 2, recopierAchat: true }), params)

    expect(res.status).toBe(201)
    for (const [{ data }] of mocks.arbreCreate.mock.calls) {
      expect(data).toMatchObject({ prixAchat: 30, dateAchat: source.dateAchat })
    }
    expect(mocks.createDepenseFromAchatArbre).toHaveBeenCalledTimes(2)
    expect((await res.json()).achatsRecopies).toBe(2)
  })

  it("refuse une option d'achat qui n'est pas un booléen", async () => {
    const res = await POST(requete({ nombre: 2, recopierAchat: "oui" }), params)

    expect(res.status).toBe(400)
    expect(mocks.arbreCreate).not.toHaveBeenCalled()
  })
})
