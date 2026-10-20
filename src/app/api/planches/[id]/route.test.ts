import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  invalidateKpi: vi.fn(),
  cultureGroupBy: vi.fn(),
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
  ])("refuse une planche référencée par une intervention %s, en disant où la trouver", async (_l, reference) => {
    mocks.interventionGroupBy.mockResolvedValue([
      {
        plancheId: reference,
        _count: { _all: 1 },
        _min: { date: new Date("2025-06-12T10:00:00Z") },
        _max: { date: new Date("2025-06-12T10:00:00Z") },
      },
    ])

    const res = await DELETE(suppression(), params(EXISTANTE.id))

    expect(res.status).toBe(409)
    const corps = await res.json()
    expect(corps.error).toBe(
      `La planche « ${EXISTANTE.nom} » porte encore 1 intervention (année 2025) : supprimez cette intervention ou rattachez-la à une autre planche depuis l'écran Interventions, puis supprimez la planche.`
    )
    expect(corps.details).toEqual({ cultures: 0, interventions: 1, anneesInterventions: [2025, 2025], anneesCultures: [], culturesSansAnnee: 0 })
    expect(corps.lien).toEqual({ href: "/interventions?annee=2025", libelle: "Voir les interventions" })
    expect(mocks.interventionGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", plancheId: { in: [EXISTANTE.id, EXISTANTE.nom] } } })
    )
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it("additionne les interventions stockées par id et par nom, années comprises", async () => {
    mocks.cultureGroupBy.mockResolvedValue([{ plancheId: EXISTANTE.id, annee: 2026, _count: { _all: 3 } }])
    mocks.interventionGroupBy.mockResolvedValue([
      { plancheId: EXISTANTE.id, _count: { _all: 1 }, _min: { date: new Date("2026-04-02T10:00:00Z") }, _max: { date: new Date("2026-04-02T10:00:00Z") } },
      { plancheId: EXISTANTE.nom, _count: { _all: 2 }, _min: { date: new Date("2024-05-01T10:00:00Z") }, _max: { date: new Date("2025-05-01T10:00:00Z") } },
    ])

    const res = await DELETE(suppression(), params(EXISTANTE.id))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain(
      "porte encore 3 cultures (année 2026) et 3 interventions (années 2024 à 2026) : supprimez ces saisies ou rattachez-les à une autre planche depuis les écrans Cultures et Interventions"
    )
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  // QA cmvgdp9fn — quatre cultures planifiées en 2027 : l'écran disait
  // « 4 culture(s) associée(s) » sans l'année où les retrouver.
  it("nomme l'année des cultures qui retiennent la planche et renvoie vers leur liste filtrée", async () => {
    mocks.cultureGroupBy.mockResolvedValue([{ plancheId: EXISTANTE.id, annee: 2027, _count: { _all: 4 } }])

    const res = await DELETE(suppression(), params(EXISTANTE.id))

    expect(res.status).toBe(409)
    const corps = await res.json()
    expect(corps.error).toBe(
      `La planche « ${EXISTANTE.nom} » porte encore 4 cultures (année 2027) : supprimez ces cultures ou rattachez-les à une autre planche depuis l'écran Cultures, puis supprimez la planche.`
    )
    expect(corps.details.anneesCultures).toEqual([2027])
    expect(corps.lien).toEqual({
      href: `/maraichage/cultures?planche=${EXISTANTE.id}&annee=2027`,
      libelle: "Voir les cultures",
    })
    expect(mocks.cultureGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ["plancheId", "annee"], where: { plancheId: { in: [EXISTANTE.id] } } })
    )
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it("cumule les cultures de plusieurs années et les nomme toutes, sans filtre d'année dans le lien", async () => {
    mocks.cultureGroupBy.mockResolvedValue([
      { plancheId: EXISTANTE.id, annee: 2027, _count: { _all: 3 } },
      { plancheId: EXISTANTE.id, annee: 2025, _count: { _all: 1 } },
      { plancheId: EXISTANTE.id, annee: null, _count: { _all: 1 } },
    ])

    const res = await DELETE(suppression(), params(EXISTANTE.id))

    const corps = await res.json()
    // Revue du 2026-10-20 : la culture sans année est dite, pas tue.
    expect(corps.error).toContain("porte encore 5 cultures (années 2025 et 2027, et 1 sans année)")
    expect(corps.lien.href).toBe(`/maraichage/cultures?planche=${EXISTANTE.id}`)
  })

  it("une année et des cultures sans année : pas de filtre d'année qui les cacherait", async () => {
    mocks.cultureGroupBy.mockResolvedValue([
      { plancheId: EXISTANTE.id, annee: 2027, _count: { _all: 4 } },
      { plancheId: EXISTANTE.id, annee: null, _count: { _all: 2 } },
    ])

    const corps = await (await DELETE(suppression(), params(EXISTANTE.id))).json()

    expect(corps.error).toContain("porte encore 6 cultures (année 2027, et 2 sans année)")
    expect(corps.details.culturesSansAnnee).toBe(2)
    expect(corps.lien.href).toBe(`/maraichage/cultures?planche=${EXISTANTE.id}`)
  })

  it("des cultures toutes sans année sont dites « sans année »", async () => {
    mocks.cultureGroupBy.mockResolvedValue([{ plancheId: EXISTANTE.id, annee: null, _count: { _all: 2 } }])

    const corps = await (await DELETE(suppression(), params(EXISTANTE.id))).json()

    expect(corps.error).toContain("porte encore 2 cultures (sans année) : supprimez ces cultures")
  })

  // Les fertilisations (import Potaléger) n'ont aucun écran pour être
  // supprimées ou déplacées : elles ne retiennent pas la planche.
  it("ne compte pas les fertilisations comme une trace bloquante", async () => {
    const res = await DELETE(suppression(), params(EXISTANTE.id))
    expect(res.status).toBe(200)
  })
})
