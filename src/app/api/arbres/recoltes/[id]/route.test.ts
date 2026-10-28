vi.mock("@/lib/stocks/verrou-commercial", () => ({ verrouillerStockCommercial: vi.fn(async () => undefined) }))
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
  varieteFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: async (fn: (tx: unknown) => unknown) => { const { default: db } = await import("@/lib/prisma"); return fn(db) },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    recolteArbre: {
      findUnique: mocks.recolteFindUnique,
      update: mocks.recolteUpdate,
      count: mocks.recolteCount,
    },
    arbre: { findFirst: mocks.arbreFindFirst },
    parcelleGeo: { findFirst: mocks.parcelleFindFirst, findUnique: mocks.parcelleFindUnique },
    variete: { findMany: mocks.varieteFindMany },
  },
}))
vi.mock("@/lib/auto-compta", () => ({ createVenteFromRecolteArbre: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock("@/lib/facture-utils", () => ({ creerFacture: vi.fn(), annulerFactureLiee: vi.fn() }))

vi.mock("@/lib/verger/dar", () => ({ avertissementsDarFruit: vi.fn(async () => []) }))
import { PUT } from "./route"

const RECOLTE = {
  id: 132,
  userId: "u1",
  arbreId: 10,
  // Midi UTC : le lot lit la date en heure locale, minuit UTC tomberait la
  // veille à l'ouest de Greenwich.
  date: new Date("2026-10-10T12:00:00.000Z"),
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
    mocks.recolteUpdate.mockImplementation(async ({ data }) => ({ ...RECOLTE, ...Object.fromEntries(Object.entries(data).filter(([,v]) => v !== undefined)) }))
    mocks.recolteCount.mockResolvedValue(0)
    mocks.parcelleFindUnique.mockResolvedValue({ nom: "Verger" })
    mocks.parcelleFindFirst.mockResolvedValue({ id: "parc-1", nom: "Verger" })
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

  // Revue : le formulaire renvoie le lot affiché ; ce lot inchangé ne doit pas
  // bloquer la régénération (sinon arbre Pommier et lot « Prunier »).
  it("régénère le lot automatique quand l'écran renvoie le lot affiché, inchangé", async () => {
    mocks.arbreFindFirst.mockResolvedValue({ id: 30, espece: "Pommier" })
    mocks.parcelleFindFirst.mockResolvedValue({ id: "parc-1", nom: "Verger" })

    await modifier({ arbreId: 30, numLot: RECOLTE.numLot, notes: null, parcelleId: "parc-1" })

    expect(mocks.recolteUpdate.mock.calls[0][0].data.numLot).toBe("20261010-Verger-Pommier-01")
  })

  it("garde un nouveau lot saisi dans le formulaire", async () => {
    mocks.arbreFindFirst.mockResolvedValue({ id: 30, espece: "Pommier" })

    await modifier({ arbreId: 30, numLot: "  ETIQUETTE-42 " })

    expect(mocks.recolteUpdate.mock.calls[0][0].data.numLot).toBe("ETIQUETTE-42")
  })

  it("ne touche jamais un lot saisi à la main", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...RECOLTE, numLot: "LOT-MANUEL-1010" })
    mocks.arbreFindFirst.mockResolvedValue({ id: 30, espece: "Pommier" })

    // Corps réel de l'écran : il renvoie le lot affiché.
    await modifier({ arbreId: 30, numLot: "LOT-MANUEL-1010" })

    expect(mocks.recolteUpdate.mock.calls[0][0].data.numLot).toBeUndefined()
  })
})

/**
 * QA cmvkoxe5o (2026-10-23) — la modification ne contrôlait pas la saison :
 * une récolte de Mirabelle de Nancy (S33-S34) déplacée au 10 juillet passait
 * sans un mot, alors que la création l'aurait signalée.
 */
describe("PUT /api/arbres/recoltes/[id] — saison de la variété", () => {
  const ARBRE_MIRABELLE = { id: 10, nom: "Prunier 3", type: "fruitier", espece: "Prunier", especeId: "Prunier", variete: "Mirabelle de Nancy" }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.recolteFindUnique.mockResolvedValue({ ...RECOLTE, numLot: "LOT-MANUEL" })
    mocks.recolteUpdate.mockImplementation(async ({ data }) => ({
      ...RECOLTE,
      numLot: "LOT-MANUEL",
      date: data.date ?? RECOLTE.date,
      arbre: ARBRE_MIRABELLE,
    }))
    mocks.varieteFindMany.mockResolvedValue([
      { id: "Mirabelle de Nancy", nom: "Mirabelle de Nancy", nomNormalise: "mirabelle de nancy", especeId: "Prunier", userId: null, semaineRecolte: 33, dureeRecolte: 2 },
    ])
  })

  // Corps réel de l'écran en modification (ProductionsTab) : tout le
  // formulaire, date comprise, parcelle d'origine comprise.
  const corpsEcran = (over: Record<string, unknown> = {}) => ({
    arbreId: 10, date: "2026-10-10", quantite: 12.5, qualite: null, prixKg: null, datePeremption: null,
    notes: null, statutBioSnapshot: null, numLot: "LOT-MANUEL", categorieCommerciale: null,
    destinationCommerce: null, conditionnement: null, parcelleId: "parc-1", ...over,
  })

  it("renvoie l'alerte quand la date modifiée sort de la période de la variété", async () => {
    mocks.parcelleFindFirst.mockResolvedValue({ id: "parc-1", nom: "Verger" })
    const res = await modifier(corpsEcran({ date: "2026-07-10" }))
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.warnings).toHaveLength(1)
    expect(payload.warnings[0]).toContain("Mirabelle de Nancy")
    expect(mocks.varieteFindMany).toHaveBeenCalledTimes(1)
  })

  it("se tait quand la date revient dans la période de la variété", async () => {
    mocks.parcelleFindFirst.mockResolvedValue({ id: "parc-1", nom: "Verger" })
    const res = await modifier(corpsEcran({ date: "2026-08-14" }))
    expect((await res.json()).warnings).toBeUndefined()
  })

  it("ne relance pas le contrôle quand seul le prix change (date renvoyée inchangée)", async () => {
    mocks.parcelleFindFirst.mockResolvedValue({ id: "parc-1", nom: "Verger" })
    // RECOLTE.date = 2026-10-10 à midi UTC : l'écran renvoie le jour affiché.
    mocks.recolteFindUnique.mockResolvedValue({ ...RECOLTE, numLot: "LOT-MANUEL", date: new Date("2026-10-10") })
    const res = await modifier(corpsEcran({ prixKg: 3.2 }))
    expect(res.status).toBe(200)
    expect((await res.json()).warnings).toBeUndefined()
    expect(mocks.varieteFindMany).not.toHaveBeenCalled()
  })

  it("retire des notes la mention figée par l'ancienne création", async () => {
    mocks.parcelleFindFirst.mockResolvedValue({ id: "parc-1", nom: "Verger" })
    await modifier(corpsEcran({ date: "2026-08-14", notes: "⚠️ Hors saison : Prunier Mirabelle de Nancy se récolte normalement semaines 33-35 (saisie semaine 28).\nCueillie à l'échelle" }))
    expect(mocks.recolteUpdate.mock.calls[0][0].data.notes).toBe("Cueillie à l'échelle")
  })
})
