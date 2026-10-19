import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  resoudreIdPlanche: vi.fn(),
  plancheFindFirst: vi.fn(),
  plancheFindMany: vi.fn(),
  plancheCreate: vi.fn(),
  transaction: vi.fn(),
  invalidateKpi: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: mocks.invalidateKpi }))
vi.mock("@/lib/planches/resolution", () => ({ resoudreIdPlanche: mocks.resoudreIdPlanche }))
vi.mock("@/lib/prisma", () => ({
  default: {
    planche: {
      findFirst: mocks.plancheFindFirst,
      findMany: mocks.plancheFindMany,
      create: mocks.plancheCreate,
    },
    $transaction: mocks.transaction,
  },
}))

import { POST } from "./route"

const SESSION = { error: null, session: { user: { id: "u1" } } }

/** Planche du ticket : îlot, plein champ, limoneux, rétention moyenne, rotation. */
const SOURCE = {
  nom: "Successions",
  posX: 2,
  posY: 5,
  largeur: 1.2,
  longueur: 15,
  surface: 18,
  rotation2D: 0,
  ilot: "Îlot nord",
  parcelleGeoId: "parcelle-1",
  type: "Plein champ",
  irrigation: null,
  rotationId: "rotation-1",
  annee: 2026,
  typeSol: "Limoneux",
  retentionEau: "Moyenne",
  argile: null,
  limon: null,
  sable: null,
  phSol: null,
  carboneOrg: null,
  derniereAnalyseSol: null,
}

// Corps envoyé par le plan 2D (« Dupliquer ×2 »).
const dupliquer = (body: unknown, id = "pl-1") =>
  POST(
    new NextRequest(`http://localhost/api/planches/${id}/dupliquer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )

describe("POST /api/planches/[id]/dupliquer (ticket QA du 2026-10-19)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue(SESSION)
    mocks.resoudreIdPlanche.mockResolvedValue("pl-1")
    mocks.plancheFindFirst.mockResolvedValue(SOURCE)
    mocks.plancheFindMany.mockResolvedValue([{ nom: "Successions" }, { nom: "Autre" }])
    mocks.plancheCreate.mockImplementation(({ data }: { data: { nom: string } }) => ({ id: `id-${data.nom}`, nom: data.nom }))
    mocks.transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops))
  })

  it("exige une session", async () => {
    mocks.requireAuthApi.mockResolvedValue({
      error: Response.json({ error: "Non autorisé" }, { status: 401 }),
      session: null,
    })
    const res = await dupliquer({ nombre: 1 })
    expect(res.status).toBe(401)
    expect(mocks.plancheCreate).not.toHaveBeenCalled()
  })

  it("les copies reprennent îlot, type, sol, rétention et rotation de la source", async () => {
    const res = await dupliquer({ nombre: 2 })

    expect(res.status).toBe(201)
    expect(mocks.plancheCreate).toHaveBeenCalledTimes(2)
    const donnees = mocks.plancheCreate.mock.calls.map(([arg]) => arg.data)
    for (const data of donnees) {
      expect(data).toMatchObject({
        userId: "u1",
        ilot: "Îlot nord",
        type: "Plein champ",
        typeSol: "Limoneux",
        retentionEau: "Moyenne",
        rotationId: "rotation-1",
        annee: 2026,
        parcelleGeoId: "parcelle-1",
        largeur: 1.2,
        longueur: 15,
        surface: 18,
      })
      expect(data).not.toHaveProperty("id")
    }
    expect(donnees.map((d) => [d.nom, d.posX, d.posY])).toEqual([
      ["Successions (2)", 3.6, 5],
      ["Successions (3)", 5.2, 5],
    ])
    const corps = await res.json()
    expect(corps.planches.map((p: { nom: string }) => p.nom)).toEqual(["Successions (2)", "Successions (3)"])
    expect(mocks.invalidateKpi).toHaveBeenCalledWith("u1")
  })

  it("relit la source bornée à son propriétaire, et tous les noms du compte", async () => {
    await dupliquer({ nombre: 1 })
    expect(mocks.resoudreIdPlanche).toHaveBeenCalledWith(expect.anything(), "pl-1", "u1")
    expect(mocks.plancheFindFirst.mock.calls[0][0].where).toEqual({ id: "pl-1", userId: "u1" })
    expect(mocks.plancheFindMany.mock.calls[0][0].where).toEqual({ userId: "u1" })
  })

  it("planche d'un autre compte ou inconnue : 404, rien n'est créé", async () => {
    mocks.resoudreIdPlanche.mockResolvedValue(null)
    const res = await dupliquer({ nombre: 1 }, "pl-autrui")
    expect(res.status).toBe(404)
    expect(mocks.plancheCreate).not.toHaveBeenCalled()
  })

  it("refuse un nombre hors bornes en nommant le champ", async () => {
    for (const nombre of [0, 21, 1.5, "abc"]) {
      const res = await dupliquer({ nombre })
      expect(res.status).toBe(400)
      expect((await res.json()).champ).toBe("nombre")
    }
    expect(mocks.plancheCreate).not.toHaveBeenCalled()
  })

  it("refuse un nom de copie trop long plutôt que de le tronquer", async () => {
    mocks.plancheFindFirst.mockResolvedValue({ ...SOURCE, nom: "P".repeat(48) })
    const res = await dupliquer({ nombre: 1 })
    expect(res.status).toBe(400)
    expect((await res.json()).champ).toBe("nom")
    expect(mocks.plancheCreate).not.toHaveBeenCalled()
  })

  it("refuse des copies qui sortiraient du plan", async () => {
    mocks.plancheFindFirst.mockResolvedValue({ ...SOURCE, posX: 95 })
    const res = await dupliquer({ nombre: 5 })
    expect(res.status).toBe(400)
    expect((await res.json()).champ).toBe("nombre")
    expect(mocks.plancheCreate).not.toHaveBeenCalled()
  })
})
