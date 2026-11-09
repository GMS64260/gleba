/**
 * Revue 2026-10-20 — le plafond de ponte plausible d'une collecte de lot lisait
 * le compteur stocké `quantiteActuelle`, qui dérive : la mort d'une fiche
 * nominative rattachée ne le décrémente pas. Lot démo « Pintades perle A3
 * 1708 » : compteur 5, effectif reconstitué 4 (écran Lots). Le plafond et le
 * message de refus suivent désormais l'effectif reconstitué.
 *
 * Même jour — le PATCH (crayon de la liste des collectes) n'appliquait aucun
 * plafond : il partage désormais la règle du POST (`refusCollecteHorsPlafond`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lotFindFirst: vi.fn(),
  productionFindFirst: vi.fn(),
  productionCreate: vi.fn(),
  productionUpdate: vi.fn(),
  productionFindMany: vi.fn(),
  productionAggregate: vi.fn(),
  reconstituerEffectifsLots: vi.fn(),
  sortiesFindMany: vi.fn().mockResolvedValue([]),
  sortiesAggregate: vi.fn().mockResolvedValue({ _count: 0, _sum: { quantite: null } }),
  productionDelete: vi.fn(),
  productionFindFirstSousVerrou: vi.fn().mockResolvedValue(null),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/elevage/effectif", () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))
vi.mock("@/lib/prisma", () => ({
  default: {
    lotAnimaux: { findFirst: mocks.lotFindFirst },
    productionOeuf: { findFirst: mocks.productionFindFirst, create: mocks.productionCreate, update: mocks.productionUpdate, findMany: mocks.productionFindMany, aggregate: mocks.productionAggregate },
    animal: { findFirst: vi.fn() },
    // La correction et la suppression passent par une transaction sous verrou.
    $transaction: (fn: (tx: unknown) => unknown) => fn({
      $executeRaw: vi.fn(),
      mouvementStockOeuf: { findMany: mocks.sortiesFindMany, aggregate: mocks.sortiesAggregate },
      productionOeuf: { update: mocks.productionUpdate, delete: mocks.productionDelete, create: mocks.productionCreate, findFirst: mocks.productionFindFirstSousVerrou },
    }),
  },
}))

import { DELETE, GET, PATCH, POST } from "./route"

it("la liste garde une ponte future corrigeable sans la compter comme produite", async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-11-03T10:00:00Z"))
  try {
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    const pontes = [
      { id: 1, date: new Date("2026-11-03"), quantite: 20 },
      { id: 2, date: new Date("2026-11-28"), quantite: 44 },
    ]
    mocks.productionFindMany.mockResolvedValue(pontes)
    mocks.productionAggregate.mockImplementation(async ({ where }) => ({
      _count: 1, _sum: { quantite: pontes.filter(p => p.date >= where.date.gte && p.date <= where.date.lte).reduce((n, p) => n + p.quantite, 0) },
    }))
    const res = await GET(new NextRequest("http://localhost/api/elevage/production-oeufs?annee=2026"))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.map((p: { id: number }) => p.id)).toEqual([1, 2])
    expect(json.stats.total).toBe(20)
  } finally {
    vi.useRealTimers()
  }
})

const LOT_PINTADES = {
  id: 71,
  quantiteInitiale: 2,
  quantiteActuelle: 5,
  statut: "actif",
  nom: "Pintades perle A3 1708",
  especeAnimale: { nom: "Pintade perle" },
}

// Corps envoyé par Élevage > Production > « Saisir une collecte » (ProductionTab).
const corpsEcran = (quantite: number, extra: Record<string, unknown> = {}) => ({
  lotId: 71,
  date: "2026-10-20",
  quantite,
  casses: 0,
  sales: 0,
  calibre: null,
  notes: null,
  ...extra,
})

const post = (body: object) =>
  POST(new NextRequest("http://localhost/api/elevage/production-oeufs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }))

const patch = (body: object) =>
  PATCH(new NextRequest("http://localhost/api/elevage/production-oeufs", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }))

describe("POST /api/elevage/production-oeufs — plafond sur l'effectif reconstitué", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.lotFindFirst.mockResolvedValue(LOT_PINTADES)
    mocks.reconstituerEffectifsLots.mockResolvedValue(
      new Map([[71, { effectifCalcule: 4, nominatifsActifs: 0, naissancesVivantes: 3, abattagesTotal: 0, sortiesNominatives: 1 }]]),
    )
    mocks.productionFindFirst.mockResolvedValue(null)
    mocks.productionCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: 1, ...data }))
  })

  it("refuse 6 œufs pour 4 pintades (le compteur stocké en annonçait 5, plafond 6)", async () => {
    const res = await post(corpsEcran(6))
    const json = await res.json()

    expect(mocks.reconstituerEffectifsLots).toHaveBeenCalledWith("user-1", [LOT_PINTADES])
    expect(res.status).toBe(422)
    expect(json.code).toBe("COLLECTE_OVER_SEUIL")
    expect(json.details).toMatchObject({ quantite: 6, seuilMax: 5, effectif: 4, lotNom: "Pintades perle A3 1708" })
    expect(json.details.message).toBe(
      "4 Pintade perle ne peuvent pas pondre 6 œufs en 1 jour (plafond plausible ≈ 5). Confirmer pour forcer la saisie.",
    )
    expect(mocks.productionCreate).not.toHaveBeenCalled()
  })

  it("accepte une collecte sous le plafond de l'effectif reconstitué", async () => {
    const res = await post(corpsEcran(5))
    expect(res.status).toBe(201)
    expect(mocks.productionCreate).toHaveBeenCalledTimes(1)
  })

  it("retombe sur le compteur stocké quand le lot n'est pas reconstitué", async () => {
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map())
    const res = await post(corpsEcran(6))
    // Compteur 5 → plafond 6 : la collecte passe, comme avant.
    expect(res.status).toBe(201)
  })

  it("ne reconstitue rien quand l'éleveur force la saisie", async () => {
    const res = await post(corpsEcran(6, { overrideCoherence: true }))
    expect(res.status).toBe(201)
    expect(mocks.reconstituerEffectifsLots).not.toHaveBeenCalled()
  })
})

// Collecte existante de 3 œufs sur le lot 71, sans sortie de stock.
const COLLECTE = {
  id: 910,
  userId: "user-1",
  lotId: 71,
  animalId: null,
  date: new Date("2026-10-20T00:00:00.000Z"),
  quantite: 3,
  casses: 0,
  sales: 0,
  calibre: null,
  notes: null,
  _count: { mouvementsStock: 0 },
}

// Corps envoyé par le crayon de la liste (ProductionTab, `postProduction` avec
// `editingId`) : l'id puis le même payload que la saisie, lot compris.
const corpsEcranModif = (quantite: number, extra: Record<string, unknown> = {}) => ({
  id: 910,
  ...corpsEcran(quantite, extra),
})

describe("PATCH /api/elevage/production-oeufs — même plafond que le POST", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.lotFindFirst.mockResolvedValue(LOT_PINTADES)
    mocks.reconstituerEffectifsLots.mockResolvedValue(
      new Map([[71, { effectifCalcule: 4, nominatifsActifs: 0, naissancesVivantes: 3, abattagesTotal: 0, sortiesNominatives: 1 }]]),
    )
    mocks.productionFindFirst.mockResolvedValue(COLLECTE)
    mocks.productionUpdate.mockImplementation(async ({ data }: { data: object }) => ({
      ...COLLECTE, ...data, lot: { id: 71, nom: LOT_PINTADES.nom }, animal: null,
    }))
  })

  it("refuse de porter la collecte de 3 à 6 œufs pour 4 pintades, avec le corps de refus du POST", async () => {
    const res = await patch(corpsEcranModif(6))
    const json = await res.json()

    expect(mocks.reconstituerEffectifsLots).toHaveBeenCalledWith("user-1", [LOT_PINTADES])
    expect(res.status).toBe(422)
    expect(json.error).toBe("Saisie incohérente")
    expect(json.code).toBe("COLLECTE_OVER_SEUIL")
    expect(json.details).toEqual({
      quantite: 6,
      seuilMax: 5,
      effectif: 4,
      espece: "Pintade perle",
      lotNom: "Pintades perle A3 1708",
      message: "4 Pintade perle ne peuvent pas pondre 6 œufs en 1 jour (plafond plausible ≈ 5). Confirmer pour forcer la saisie.",
    })
    expect(mocks.productionUpdate).not.toHaveBeenCalled()
  })

  it("accepte 5 œufs (sous le plafond) et enregistre la nouvelle quantité", async () => {
    const res = await patch(corpsEcranModif(5))
    expect(res.status).toBe(200)
    expect(mocks.productionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 910 }, data: expect.objectContaining({ quantite: 5, lotId: 71 }) }),
    )
  })

  it("ne replafonne pas une modification qui ne touche ni la quantité ni le lot", async () => {
    const res = await patch(corpsEcranModif(3, { notes: "ramassage du soir" }))
    expect(res.status).toBe(200)
    expect(mocks.reconstituerEffectifsLots).not.toHaveBeenCalled()
    expect(mocks.productionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantite: 3, notes: "ramassage du soir" }) }),
    )
  })

  it("replafonne sur le nouveau lot quand la collecte change de lot", async () => {
    const cailles = { ...LOT_PINTADES, id: 72, nom: "Cailles", especeAnimale: { nom: "Caille" } }
    mocks.lotFindFirst.mockResolvedValue(cailles)
    mocks.reconstituerEffectifsLots.mockResolvedValue(
      new Map([[72, { effectifCalcule: 1, nominatifsActifs: 0, naissancesVivantes: 0, abattagesTotal: 0, sortiesNominatives: 0 }]]),
    )
    const res = await patch(corpsEcranModif(3, { lotId: 72 }))
    expect(res.status).toBe(422)
    expect((await res.json()).details).toMatchObject({ quantite: 3, seuilMax: 2, effectif: 1, lotNom: "Cailles" })
    expect(mocks.productionUpdate).not.toHaveBeenCalled()
  })

  it("rejoue la modification forcée (« Forcer la saisie ») sans reconstituer", async () => {
    const res = await patch(corpsEcranModif(6, { overrideCoherence: true }))
    expect(res.status).toBe(200)
    expect(mocks.reconstituerEffectifsLots).not.toHaveBeenCalled()
    expect(mocks.productionUpdate).toHaveBeenCalledTimes(1)
  })
})

describe("collecte d'œufs entamée — correction et suppression", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.productionFindFirst.mockResolvedValue({ ...COLLECTE, quantite: 300 })
    mocks.productionUpdate.mockImplementation(async ({ data }: { data: object }) => ({ ...COLLECTE, ...data }))
    mocks.sortiesFindMany.mockResolvedValue([{ quantite: 24, date: new Date("2026-10-21T09:00:00.000Z") }])
    mocks.sortiesAggregate.mockResolvedValue({ _count: 1, _sum: { quantite: 24 } })
  })

  const requete = (method: string, body?: object, query = "") => new NextRequest(`http://localhost/api/elevage/production-oeufs${query}`, {
    method, ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  })

  it("corrige les notes et une quantité qui couvre encore les œufs sortis", async () => {
    expect((await PATCH(requete("PATCH", { id: 910, notes: "poulailler B" }))).status).toBe(200)
    expect((await PATCH(requete("PATCH", { id: 910, quantite: 30, overrideCoherence: true }))).status).toBe(200)
    expect(mocks.productionUpdate).toHaveBeenCalledTimes(2)
  })

  it("refuse (409) une quantité sous le total sorti, avec un message qui nomme les ventes", async () => {
    const res = await PATCH(requete("PATCH", { id: 910, quantite: 12, overrideCoherence: true }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain("Annulez d'abord les ventes")
    expect(mocks.productionUpdate).not.toHaveBeenCalled()
  })

  it("refuse la suppression en 409, plus en 500", async () => {
    const res = await DELETE(requete("DELETE", undefined, "?id=910"))
    expect(res.status).toBe(409)
    expect(mocks.productionDelete).not.toHaveBeenCalled()

    mocks.sortiesAggregate.mockResolvedValue({ _count: 0, _sum: { quantite: null } })
    expect((await DELETE(requete("DELETE", undefined, "?id=910"))).status).toBe(200)
    expect(mocks.productionDelete).toHaveBeenCalledWith({ where: { id: 910 } })
  })
})

describe("création d'une collecte d'œufs — doublon sous verrou", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.lotFindFirst.mockResolvedValue(LOT_PINTADES)
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map([[71, { effectifCalcule: 4, nominatifsActifs: 0 }]]))
    mocks.productionCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: 1, ...data }))
  })

  const post = (body: object) => POST(new NextRequest("http://localhost/api/elevage/production-oeufs", {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  }))

  it("refuse la seconde de deux collectes envoyées ensemble, vue seulement sous le verrou", async () => {
    // Contrôle rapide : rien. Sous verrou : l'autre requête a déjà écrit.
    mocks.productionFindFirst.mockResolvedValue(null)
    mocks.productionFindFirstSousVerrou.mockResolvedValueOnce({ id: 910, quantite: 3 })

    const res = await post({ lotId: 71, date: "2026-10-20", quantite: 3 })

    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe("DOUBLON_DATE_LOT")
    expect(mocks.productionCreate).not.toHaveBeenCalled()
  })

  it("crée la collecte quand rien n'existe ce jour-là", async () => {
    mocks.productionFindFirst.mockResolvedValue(null)
    expect((await post({ lotId: 71, date: "2026-10-20", quantite: 3 })).status).toBe(201)
    expect(mocks.productionCreate).toHaveBeenCalledTimes(1)
  })
})
