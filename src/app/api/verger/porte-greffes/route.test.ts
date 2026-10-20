import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * QA cmvgddn3l (2026-10-20) — Verger > Arbres > Ajouter : « prunier » en
 * minuscules ne proposait que « Aucun » porte-greffe, « Prunier » en proposait
 * quatre. La liaison `porte_greffe_especes` porte l'id canonique : la route
 * résout la saisie par le même helper que la sauvegarde de l'arbre.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  porteGreffeFindMany: vi.fn(),
  especeFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/avis/stats-liste", () => ({ statsAvisPourRefs: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  default: {
    porteGreffe: { findMany: mocks.porteGreffeFindMany },
    espece: { findMany: mocks.especeFindMany },
  },
}))

import { GET } from "./route"

const get = (especeId: string) =>
  GET(new Request(`http://localhost/api/verger/porte-greffes?especeId=${encodeURIComponent(especeId)}`) as never)

/** Clé d'espèce demandée à la base par la requête des porte-greffes. */
const especeDemandee = () => {
  const where = mocks.porteGreffeFindMany.mock.calls[0][0].where as {
    AND: Array<{ especes?: { some: { especeId: string } } }>
  }
  return where.AND[0].especes?.some.especeId
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
  mocks.especeFindMany.mockResolvedValue([
    { id: "Prunier", nom: "Prunier", userId: null, type: "arbre_fruitier" },
    { id: "Pêcher", nom: "Pêcher", userId: null, type: "arbre_fruitier" },
  ])
  mocks.porteGreffeFindMany.mockResolvedValue([
    { id: "pg-1", nom: "Myrobolan", vigueur: 4, precocite: 3 },
  ])
})

describe("GET /api/verger/porte-greffes?especeId=… — espèce résolue comme à la sauvegarde", () => {
  it("scénario du ticket : « prunier » en minuscules interroge l'espèce canonique « Prunier »", async () => {
    const res = await get("prunier")
    expect(res.status).toBe(200)
    expect(especeDemandee()).toBe("Prunier")
    const body = await res.json()
    expect(body.especeId).toBe("Prunier")
    expect(body.count).toBe(1)
  })

  it("accents et espaces ignorés : « pecher » trouve « Pêcher »", async () => {
    await get("  pecher ")
    expect(especeDemandee()).toBe("Pêcher")
  })

  it("le libellé canonique reste inchangé", async () => {
    await get("Prunier")
    expect(especeDemandee()).toBe("Prunier")
  })

  it("hors catalogue : la saisie sert de clé, comme avant", async () => {
    await get("Asiminier")
    expect(especeDemandee()).toBe("Asiminier")
  })

  it("lit les espèces visibles du compte uniquement", async () => {
    await get("prunier")
    const where = mocks.especeFindMany.mock.calls[0][0].where
    expect(JSON.stringify(where)).toContain("user-1")
  })
})

/**
 * Revue du 2026-10-20 (cmvgeltj1) — l'id du compte qui a proposé une entrée
 * communautaire était renvoyé au client ; il servait d'`operateurId` pour faire
 * sortir un nom tiers au registre phyto.
 */
describe("GET /api/verger/porte-greffes — aucun id de compte tiers", () => {
  it("liste par espèce : pas de userId", async () => {
    await get("prunier")
    expect(mocks.porteGreffeFindMany.mock.calls[0][0].select.userId).toBeUndefined()
  })

  it("référentiel : Gleba = null, le sien = son id, un autre compte = marqueur non identifiant", async () => {
    mocks.porteGreffeFindMany.mockResolvedValue([
      { id: "pg-1", nom: "Myrobolan", userId: null, partageCommunaute: false, especes: [] },
      { id: "pg-2", nom: "Mien", userId: "user-1", partageCommunaute: false, especes: [] },
      { id: "pg-3", nom: "Partagé", userId: "user-tiers", partageCommunaute: true, especes: [{ especeId: "Prunier" }] },
    ])
    const res = await GET(new Request("http://localhost/api/verger/porte-greffes") as never)
    const { data } = await res.json()
    expect(data.map((pg: { userId: string | null }) => pg.userId)).toEqual([null, "user-1", "communaute"])
    expect(JSON.stringify(data)).not.toContain("user-tiers")
    expect(data[2].especesCompatibles).toEqual(["Prunier"])
  })
})
