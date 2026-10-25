import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * QA cmvnp0dm9 (2026-10-25) : un lot d'élagage de 0,2 m³ vendu 24 € avec
 * facture automatique produisait la facture « Vente de bois - elagage
 * (0.2 m³) » : la route composait l'objet et la ligne à partir de la valeur
 * technique du type. Le test rejoue le corps envoyé par le bouton « Confirmer
 * la vente » (ProductionsTab, handleVendre).
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  productionFindUnique: vi.fn(),
  productionUpdate: vi.fn(),
  clientFindFirst: vi.fn(),
  creerFacture: vi.fn(),
  annulerFactureLiee: vi.fn(),
  createVenteFromProductionBois: vi.fn(),
  deleteAutoEntry: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => {
  const tx = { productionBois: { update: mocks.productionUpdate } }
  return {
    default: {
      productionBois: { findUnique: mocks.productionFindUnique, update: mocks.productionUpdate },
      client: { findFirst: mocks.clientFindFirst },
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    },
  }
})
vi.mock("@/lib/facture-utils", () => ({
  creerFacture: mocks.creerFacture,
  annulerFactureLiee: mocks.annulerFactureLiee,
}))
vi.mock("@/lib/auto-compta", () => ({
  createVenteFromProductionBois: mocks.createVenteFromProductionBois,
  deleteAutoEntry: mocks.deleteAutoEntry,
}))

import { PATCH, PUT } from "./route"

const LOT = {
  id: 41,
  userId: "u1",
  arbreId: 881,
  type: "elagage",
  volumeM3: 0.2,
  poidsKg: null,
  statut: "en_stock",
  factureId: null,
  clientId: null,
  clientNom: null,
  dateVente: null,
  arbre: { id: 881, nom: "Noyer 2", espece: "Noyer" },
}

const vendre = (body: Record<string, unknown>) =>
  PATCH(
    new Request("http://localhost/api/arbres/bois/41", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: "41" }) }
  )

describe("PATCH /api/arbres/bois/[id] — vente avec facture automatique", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.productionFindUnique.mockResolvedValue(LOT)
    mocks.creerFacture.mockResolvedValue({ id: 9, numero: "F-2026-0009" })
    mocks.productionUpdate.mockImplementation(async ({ data }) => ({ ...LOT, ...data }))
  })

  it("écrit « Élagage » et le volume à la française sur la facture", async () => {
    const res = await vendre({
      statut: "vendu",
      dateVente: "2026-10-25T09:00:00.000Z",
      prixVente: 24,
      clientId: null,
      clientNom: "Client de passage",
      destination: "vente",
      creerFacture: true,
    })

    expect(res.status).toBe(200)
    expect(mocks.creerFacture).toHaveBeenCalledTimes(1)
    const facture = mocks.creerFacture.mock.calls[0][1]
    expect(facture.objet).toBe("Vente de bois - Élagage (0,2 m³)")
    expect(facture.lignes).toHaveLength(1)
    expect(facture.lignes[0]).toMatchObject({
      description: "Élagage - Noyer 2",
      quantite: 0.2,
      unite: "m³",
    })
    expect(JSON.stringify(facture)).not.toContain("elagage")
    expect(mocks.productionUpdate.mock.calls[0][0].data.factureId).toBe(9)
  })
})

describe("PUT /api/arbres/bois/[id] — type de production", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.productionFindUnique.mockResolvedValue(LOT)
    mocks.productionUpdate.mockImplementation(async ({ data }) => ({ ...LOT, ...data }))
  })

  const modifier = (body: Record<string, unknown>) =>
    PUT(
      new Request("http://localhost/api/arbres/bois/41", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }) as never,
      { params: Promise.resolve({ id: "41" }) }
    )

  it("refuse un type hors liste, comme la création", async () => {
    const res = await modifier({ type: "coupe" })

    expect(res.status).toBe(400)
    expect((await res.json()).champ).toBe("type")
    expect(mocks.productionUpdate).not.toHaveBeenCalled()
  })

  it("laisse passer une modification sans type, ou avec un type de la liste", async () => {
    expect((await modifier({ notes: "Bois sec" })).status).toBe(200)
    expect((await modifier({ type: "branchage" })).status).toBe(200)
    expect(mocks.productionUpdate).toHaveBeenCalledTimes(2)
  })
})
