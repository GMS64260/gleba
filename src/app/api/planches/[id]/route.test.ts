import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  invalidateKpi: vi.fn(),
  cultureGroupBy: vi.fn(),
  fertilisationGroupBy: vi.fn(),
  interventionGroupBy: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: mocks.invalidateKpi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    planche: {
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
      update: mocks.update,
      delete: mocks.delete,
    },
    culture: { groupBy: mocks.cultureGroupBy },
    fertilisation: { groupBy: mocks.fertilisationGroupBy },
    intervention: { groupBy: mocks.interventionGroupBy },
  },
}))

import { DELETE, PUT } from "./route"

const SESSION = { error: null, session: { user: { id: "u1" } } }
const EXISTANTE = {
  id: "cme000000000000000000001",
  nom: "4-copie-copie-copie",
  userId: "u1",
  largeur: 1.2,
  longueur: 11,
}

const requete = (body: unknown) =>
  new Request("http://localhost/api/planches/x", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never

const params = (id: string) => ({ params: Promise.resolve({ id }) })

describe("PUT /api/planches/[id] — renommage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue(SESSION)
  })

  it("exige une session", async () => {
    mocks.requireAuthApi.mockResolvedValue({
      error: Response.json({ error: "Non autorisé" }, { status: 401 }),
      session: null,
    })
    const res = await PUT(requete({ nom: "A1" }), params(EXISTANTE.id))
    expect(res.status).toBe(401)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("renomme une planche adressée par son identifiant", async () => {
    // 1er findFirst = résolution par id ; 2e = recherche de collision.
    mocks.findFirst.mockResolvedValueOnce({ id: EXISTANTE.id })
    mocks.findUnique
      .mockResolvedValueOnce(EXISTANTE) // chargement de l'existante
      .mockResolvedValueOnce(null) // pas de collision de nom
    mocks.update.mockResolvedValue({ ...EXISTANTE, nom: "Planche 4" })

    const res = await PUT(requete({ nom: "Planche 4" }), params(EXISTANTE.id))

    expect(res.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: EXISTANTE.id } })
    )
    expect(mocks.update.mock.calls[0][0].data.nom).toBe("Planche 4")
  })

  it("refuse un nom déjà pris avec un message explicite", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: EXISTANTE.id })
    mocks.findUnique
      .mockResolvedValueOnce(EXISTANTE)
      .mockResolvedValueOnce({ id: "cme000000000000000000002" }) // collision

    const res = await PUT(requete({ nom: "Planche A" }), params(EXISTANTE.id))

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({
      error: "Vous avez déjà une planche nommée « Planche A ».",
    })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("ne cherche pas de collision quand le nom est inchangé", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: EXISTANTE.id })
    mocks.findUnique.mockResolvedValueOnce(EXISTANTE)
    mocks.update.mockResolvedValue(EXISTANTE)

    const res = await PUT(requete({ nom: EXISTANTE.nom }), params(EXISTANTE.id))

    expect(res.status).toBe(200)
    // Un seul findUnique : celui du chargement, pas celui de la collision.
    expect(mocks.findUnique).toHaveBeenCalledTimes(1)
  })

  it("refuse un nom vide via la validation", async () => {
    const res = await PUT(requete({ nom: "" }), params(EXISTANTE.id))
    expect(res.status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("répond 404 sur une planche inconnue", async () => {
    mocks.findFirst.mockResolvedValue(null)
    const res = await PUT(requete({ nom: "A1" }), params("inconnue"))
    expect(res.status).toBe(404)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/planches/[id] — traces qui retiennent la planche", () => {
  const suppression = () =>
    new Request("http://localhost/api/planches/x", { method: "DELETE" }) as never

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue(SESSION)
    mocks.findFirst.mockResolvedValue({ id: EXISTANTE.id })
    mocks.findUnique.mockResolvedValue({ id: EXISTANTE.id, nom: EXISTANTE.nom })
    mocks.cultureGroupBy.mockResolvedValue([])
    mocks.fertilisationGroupBy.mockResolvedValue([])
    mocks.interventionGroupBy.mockResolvedValue([])
    mocks.delete.mockResolvedValue({})
  })

  it("supprime une planche sans aucune trace", async () => {
    const res = await DELETE(suppression(), params(EXISTANTE.id))
    expect(res.status).toBe(200)
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: EXISTANTE.id } })
  })

  // QA cmv29i9ad — l'intervention survivait à la planche et la liste
  // affichait l'identifiant brut à la place du nom.
  it.each([
    ["par son identifiant", EXISTANTE.id],
    ["par son nom historique", EXISTANTE.nom],
  ])("refuse une planche référencée par une intervention %s, en le disant", async (_l, reference) => {
    mocks.interventionGroupBy.mockResolvedValue([{ plancheId: reference, _count: { _all: 1 } }])

    const res = await DELETE(suppression(), params(EXISTANTE.id))

    expect(res.status).toBe(409)
    const corps = await res.json()
    expect(corps.error).toBe(
      `La planche « ${EXISTANTE.nom} » porte encore 1 intervention : supprimez-la ou rattachez-la à une autre planche avant de la supprimer, pour ne pas perdre son emplacement.`
    )
    expect(corps.details).toEqual({ cultures: 0, interventions: 1, fertilisations: 0 })
    expect(mocks.interventionGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", plancheId: { in: [EXISTANTE.id, EXISTANTE.nom] } } })
    )
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it("refuse une planche qui porte des fertilisations (supprimées en cascade sinon)", async () => {
    mocks.fertilisationGroupBy.mockResolvedValue([{ plancheId: EXISTANTE.id, _count: { _all: 2 } }])
    mocks.cultureGroupBy.mockResolvedValue([{ plancheId: EXISTANTE.id, _count: { _all: 3 } }])

    const res = await DELETE(suppression(), params(EXISTANTE.id))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain("3 cultures et 2 fertilisations")
    expect(mocks.delete).not.toHaveBeenCalled()
  })
})
