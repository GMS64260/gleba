import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  plancheFindFirst: vi.fn(),
  plancheDelete: vi.fn(),
  objetCreate: vi.fn(),
  transaction: vi.fn(),
  resoudreIdPlanche: vi.fn(),
  invalidateKpi: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    planche: { findFirst: mocks.plancheFindFirst, delete: mocks.plancheDelete },
    objetJardin: { create: mocks.objetCreate },
    $transaction: mocks.transaction,
  },
}))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: mocks.invalidateKpi }))
vi.mock("@/lib/planches/resolution", () => ({ resoudreIdPlanche: mocks.resoudreIdPlanche }))

import { POST } from "./route"

const params = Promise.resolve({ id: "pl-mur" })

function convertir(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/planches/pl-mur/convertir-en-objet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params }
  )
}

/** Planche typique du détournement : 10 cm de large, nommée « Mur », jamais cultivée. */
const planche = (over: Record<string, unknown> = {}) => ({
  id: "pl-mur",
  nom: "Mur 2",
  largeur: 0.1,
  longueur: 10,
  posX: 6.3,
  posY: -1.4,
  rotation2D: 90,
  notes: null,
  parcelleGeoId: "parc-1",
  _count: { cultures: 0, fertilisations: 0, analyses: 0 },
  ...over,
})

/**
 * Le plan 2D n'ayant longtemps offert aucun élément bâti, des murs et des
 * clôtures ont été saisis comme planches de 10 cm. Cette route les reclasse en
 * objets du plan sans faire perdre le placement, qui est l'essentiel du travail
 * de tracé.
 */
describe("POST /api/planches/[id]/convertir-en-objet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.resoudreIdPlanche.mockResolvedValue("pl-mur")
    mocks.plancheFindFirst.mockResolvedValue(planche())
    mocks.objetCreate.mockImplementation(async ({ data }) => ({ id: 77, ...data }))
    // Le mock de transaction exécute le callback avec le même client : on
    // vérifie ainsi l'ordre création → suppression réellement écrit.
    mocks.transaction.mockImplementation(async cb =>
      cb({
        objetJardin: { create: mocks.objetCreate },
        planche: { delete: mocks.plancheDelete },
      })
    )
  })

  it("reporte position, dimensions, orientation et parcelle sur l'objet créé", async () => {
    const response = await convertir({ type: "mur" })
    expect(response.status).toBe(200)

    expect(mocks.objetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        nom: "Mur 2",
        type: "mur",
        largeur: 0.1,
        longueur: 10,
        posX: 6.3,
        posY: -1.4,
        rotation2D: 90,
        parcelleGeoId: "parc-1",
      }),
    })
    expect(mocks.plancheDelete).toHaveBeenCalledWith({ where: { id: "pl-mur" } })
    expect(mocks.invalidateKpi).toHaveBeenCalledWith("user-1")
  })

  it("crée l'objet avant de supprimer la planche, dans une transaction", async () => {
    await convertir({ type: "cloture" })
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(mocks.objetCreate.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.plancheDelete.mock.invocationCallOrder[0]
    )
  })

  it("refuse un type inconnu plutôt que de le ramener silencieusement à « autre »", async () => {
    const response = await convertir({ type: "cabane" })
    expect(response.status).toBe(400)
    expect(mocks.objetCreate).not.toHaveBeenCalled()
    expect(mocks.plancheDelete).not.toHaveBeenCalled()
  })

  it("refuse une conversion sans type", async () => {
    const response = await convertir({})
    expect(response.status).toBe(400)
    expect(mocks.plancheDelete).not.toHaveBeenCalled()
  })

  it.each([
    ["une culture", { cultures: 1, fertilisations: 0, analyses: 0 }],
    ["une fertilisation", { cultures: 0, fertilisations: 2, analyses: 0 }],
    ["une analyse de sol", { cultures: 0, fertilisations: 0, analyses: 1 }],
  ])("refuse une planche qui porte %s", async (_libelle, compte) => {
    mocks.plancheFindFirst.mockResolvedValue(planche({ _count: compte }))

    const response = await convertir({ type: "mur" })
    expect(response.status).toBe(409)
    // Le point critique : rien ne doit être supprimé sur un refus.
    expect(mocks.plancheDelete).not.toHaveBeenCalled()
    expect(mocks.objetCreate).not.toHaveBeenCalled()
  })

  it("répond 404 sur une planche inconnue ou appartenant à une autre exploitation", async () => {
    mocks.resoudreIdPlanche.mockResolvedValue(null)
    const response = await convertir({ type: "mur" })
    expect(response.status).toBe(404)
    expect(mocks.plancheDelete).not.toHaveBeenCalled()
  })

  it("borne les dimensions manquantes pour ne pas créer un objet invisible", async () => {
    mocks.plancheFindFirst.mockResolvedValue(
      planche({ largeur: null, longueur: null, posX: null, posY: null, rotation2D: null })
    )

    await convertir({ type: "haie" })
    const { data } = mocks.objetCreate.mock.calls[0][0]
    expect(data.largeur).toBeGreaterThan(0)
    expect(data.longueur).toBeGreaterThan(0)
    expect(data.posX).toBe(0)
    expect(data.posY).toBe(0)
    expect(data.rotation2D).toBe(0)
  })

  it("laisse la garde d'écriture de requireAuthApi arrêter un acteur en lecture seule", async () => {
    mocks.requireAuthApi.mockResolvedValue({
      error: new Response("lecture seule", { status: 403 }),
      session: null,
    })

    const response = await convertir({ type: "mur" })
    expect(response.status).toBe(403)
    expect(mocks.plancheFindFirst).not.toHaveBeenCalled()
    expect(mocks.plancheDelete).not.toHaveBeenCalled()
  })
})
