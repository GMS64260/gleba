import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  capteurFindFirst: vi.fn(),
  mesuresFindMany: vi.fn(),
  joursFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    capteur: { findFirst: mocks.capteurFindFirst },
    mesureCapteur: { findMany: mocks.mesuresFindMany },
    mesureCapteurJour: { findMany: mocks.joursFindMany },
  },
}))

import { GET } from "./route"

function lire(query: string, id = "cap-1") {
  return GET(new NextRequest(`http://localhost/api/capteurs/${id}/mesures?${query}`), { params: Promise.resolve({ id }) })
}

describe("GET /api/capteurs/[id]/mesures", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "proprio" } } })
    mocks.capteurFindFirst.mockResolvedValue({ id: "cap-1" })
    mocks.mesuresFindMany.mockResolvedValue([
      { mesureeA: new Date("2026-10-23T10:00:00Z"), valeur: 12 },
      { mesureeA: new Date("2026-10-23T09:00:00Z"), valeur: 11 },
    ])
    mocks.joursFindMany.mockResolvedValue([{ jour: new Date("2026-10-22T00:00:00Z"), min: 3, max: 18, moyenne: 10, nombre: 96 }])
  })

  it("ne lit pas le capteur d'un autre compte", async () => {
    mocks.capteurFindFirst.mockResolvedValue(null)
    expect((await lire("grandeur=temperature_air", "cap-x")).status).toBe(404)
    expect(mocks.capteurFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "cap-x", userId: "proprio" } }))
    expect(mocks.mesuresFindMany).not.toHaveBeenCalled()
  })

  it("refuse une grandeur inconnue", async () => {
    expect((await lire("grandeur=humidite_lunaire")).status).toBe(400)
  })

  it("rend les mesures brutes dans l'ordre chronologique, avec leur unité, jusqu'à 31 jours", async () => {
    const corps = await (await lire("grandeur=temperature_air&jours=7")).json()
    expect(corps).toMatchObject({ type: "brut", unite: "°C", tronque: false })
    expect(corps.points.map((p: { v: number }) => p.v)).toEqual([11, 12])
    expect(mocks.mesuresFindMany.mock.calls[0][0].where).toMatchObject({ capteurId: "cap-1", grandeur: "temperature_air" })
  })

  it("dit quand la série est coupée", async () => {
    mocks.mesuresFindMany.mockResolvedValue(Array.from({ length: 10000 }, (_, i) => ({ mesureeA: new Date(1_700_000_000_000 - i * 60_000), valeur: i })))
    expect((await (await lire("grandeur=temperature_air&jours=30")).json()).tronque).toBe(true)
  })

  it("au-delà de 31 jours, rend les agrégats journaliers", async () => {
    const corps = await (await lire("grandeur=temperature_air&jours=90")).json()
    expect(corps).toMatchObject({ type: "jour", jours: [{ jour: "2026-10-22", min: 3, max: 18, moyenne: 10 }] })
    expect(mocks.mesuresFindMany).not.toHaveBeenCalled()
  })
})
