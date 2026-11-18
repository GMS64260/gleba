import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  requireAdminApi: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
  createMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  requireAdminApi: mocks.requireAdminApi,
}))
vi.mock("@/lib/prisma", () => {
  const client = {
    association: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
    },
    associationDetail: { deleteMany: mocks.deleteMany, createMany: mocks.createMany },
    $transaction: (fn: (tx: unknown) => unknown) => fn(client),
  }
  return { default: client }
})

import { GET, POST } from "./route"
import { GET as GET_UN, PUT } from "./[id]/route"

const URL_BASE = "http://localhost/api/associations"
const params = { params: Promise.resolve({ id: "asso-ail-pois" }) }
const corps = (methode: string, body: unknown, url = URL_BASE) =>
  new NextRequest(url, { method: methode, body: JSON.stringify(body) })

const DEUX = [
  { especeId: "Ail", requise: true },
  { especeId: "Pois", requise: false },
]

const cleEtrangere = () =>
  new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
    code: "P2003",
    clientVersion: "test",
  })

describe("/api/associations", () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) {
      m.mockReset()
    }
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.requireAdminApi.mockResolvedValue({ error: null, session: { user: { id: "admin" } } })
    mocks.findMany.mockResolvedValue([])
    mocks.findUnique.mockResolvedValue({ id: "asso-ail-pois", details: [] })
    mocks.create.mockResolvedValue({ id: "asso-ail-pois", details: [] })
    mocks.update.mockResolvedValue({})
    mocks.deleteMany.mockResolvedValue({ count: 0 })
    mocks.createMany.mockResolvedValue({ count: 0 })
  })

  it("rend les détails dans un ordre stable (liste, fiche, création, modification)", async () => {
    await GET(new NextRequest(URL_BASE))
    expect(mocks.findMany.mock.calls[0][0].include.details.orderBy).toEqual({ id: "asc" })

    await GET_UN(new NextRequest(`${URL_BASE}/asso-ail-pois`), params)
    expect(mocks.findUnique.mock.calls[0][0].include.details.orderBy).toEqual({ id: "asc" })

    await POST(corps("POST", { nom: "Ail Pois", type: "incompatible", details: DEUX }))
    expect(mocks.create.mock.calls[0][0].include.details.orderBy).toEqual({ id: "asc" })

    mocks.findUnique.mockClear()
    await PUT(corps("PUT", { nom: "Ail Pois" }), params)
    const relecture = mocks.findUnique.mock.calls.find((c) => c[0].include)
    expect(relecture?.[0].include.details.orderBy).toEqual({ id: "asc" })
  })

  it("filtre la liste par type quand il est connu, l'ignore sinon", async () => {
    await GET(new NextRequest(`${URL_BASE}?especeId=Ail&type=favorable`))
    expect(mocks.findMany.mock.calls[0][0].where.type).toBe("favorable")
    expect(mocks.findMany.mock.calls[0][0].where.details.some.OR[0].especeId.in).toEqual(["Ail"])

    await GET(new NextRequest(`${URL_BASE}?type=nimporte`))
    expect(mocks.findMany.mock.calls[1][0].where.type).toBeUndefined()
  })

  it("écarte à la création les lignes sans espèce, famille ni groupe", async () => {
    const res = await POST(
      corps("POST", {
        nom: "Ail Pois",
        type: "incompatible",
        details: [
          { especeId: "Ail", requise: true },
          { especeId: "", familleId: null, groupe: "  ", requise: false },
          { familleId: "Fabaceae", requise: false },
        ],
      })
    )
    expect(res.status).toBe(201)
    const crees = mocks.create.mock.calls[0][0].data.details.create
    expect(crees.map((d: { especeId: string | null; familleId: string | null }) => d.especeId ?? d.familleId)).toEqual([
      "Ail",
      "Fabaceae",
    ])
  })

  it("écarte à la modification les lignes vides", async () => {
    await PUT(
      corps("PUT", {
        details: [
          { especeId: "Ail", requise: true },
          { requise: false },
          { groupe: "Chou", requise: false },
        ],
      }),
      params
    )
    expect(mocks.createMany.mock.calls[0][0].data).toHaveLength(2)
  })

  it("rend 400 nommé quand une espèce ou une famille n'existe pas (création)", async () => {
    mocks.create.mockRejectedValue(cleEtrangere())
    const res = await POST(
      corps("POST", { nom: "Ail Pois", type: "incompatible", details: [{ especeId: "Inconnue", requise: true }, { especeId: "Ail", requise: false }] })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/espèce ou une famille/i)
  })

  it("rend 400 nommé quand une espèce ou une famille n'existe pas (modification)", async () => {
    mocks.createMany.mockRejectedValue(cleEtrangere())
    const res = await PUT(corps("PUT", { details: [{ especeId: "Inconnue", requise: true }, { especeId: "Ail", requise: false }] }), params)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/espèce ou une famille/i)
  })

  it("élargit le filtre par espèce à ses alias", async () => {
    await GET(new NextRequest(`${URL_BASE}?especeId=${encodeURIComponent("Haricot vert")}`))
    const filtre = mocks.findMany.mock.calls[0][0].where.details.some.OR[0].especeId
    expect(filtre.in).toEqual(expect.arrayContaining(["Haricot vert", "Haricot"]))
    expect(filtre.mode).toBe("insensitive")
  })

  it("refuse une association de moins de deux membres, à la création et à la modification", async () => {
    for (const details of [undefined, [], [{ especeId: "Ail", requise: true }, { requise: false }]]) {
      const res = await POST(corps("POST", { nom: "Ail", type: "favorable", details }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/au moins deux/)
    }
    expect(mocks.create).not.toHaveBeenCalled()

    const res = await PUT(corps("PUT", { details: [{ especeId: "Ail", requise: true }] }), params)
    expect(res.status).toBe(400)
    expect(mocks.deleteMany).not.toHaveBeenCalled()

    // Sans `details`, les lignes existantes ne sont ni relues ni refusées.
    expect((await PUT(corps("PUT", { nom: "Ail Pois" }), params)).status).toBe(200)
  })

  it("laisse la création et la modification à l'administration", async () => {
    const refus = { error: new Response(null, { status: 403 }), session: null }
    mocks.requireAdminApi.mockResolvedValue(refus)
    expect((await POST(corps("POST", { nom: "X", type: "favorable" }))).status).toBe(403)
    expect((await PUT(corps("PUT", { nom: "X" }), params)).status).toBe(403)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
