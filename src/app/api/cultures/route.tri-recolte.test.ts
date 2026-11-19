import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * Saisie de récolte : au-delà d'une page de cultures en cours, les cultures
 * prêtes à récolter (les plus anciennes, souvent) passaient en page 2, la page
 * étant triée par identifiant avant le tri « prêtes d'abord » de l'écran.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/rotation-check", () => ({ checkRotationViolation: vi.fn() }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/varietes", () => ({ ensurePlaceholderVariete: vi.fn() }))
vi.mock("@/lib/terroir", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/terroir")>()),
  zoneEffectiveUser: vi.fn().mockResolvedValue(null),
}))
vi.mock("@/lib/recolte/rendement-effectif", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/recolte/rendement-effectif")>()),
  chargerSurchargesRendement: vi.fn().mockResolvedValue(new Map()),
}))
vi.mock("@/lib/prisma", () => ({
  default: { culture: { findMany: mocks.findMany, count: mocks.count } },
}))

import { GET } from "./route"

// 80 cultures en cours : les 10 plus anciennes (id 1 à 10) sont mûres.
const cultures = Array.from({ length: 80 }, (_, i) => ({
  id: i + 1,
  dateRecolte: new Date(i < 10 ? "2026-11-20T00:00:00.000Z" : "2027-04-01T00:00:00.000Z"),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "exploitation-1" } } })
  mocks.count.mockResolvedValue(cultures.length)
  mocks.findMany.mockImplementation(async (args: { select?: unknown; where: { id?: { in: number[] } } }) => {
    if (args.select) return cultures
    const ids = args.where.id?.in ?? []
    // Ordre de la base quelconque : la route doit rétablir celui du tri.
    return cultures
      .filter((c) => ids.includes(c.id))
      .reverse()
      .map((c) => ({ ...c, especeId: "tomate", espece: null, recoltes: [] }))
  })
})

describe("GET /api/cultures?tri=recolte", () => {
  it("rend toutes les cultures prêtes en première page, avant les autres", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/cultures?enCours=1&tri=recolte&jour=2026-11-19&page=1&pageSize=50"),
    )
    const corps = await res.json()
    expect(res.status).toBe(200)
    expect(corps.totalPages).toBe(2)
    expect(corps.data).toHaveLength(50)
    expect(corps.data.slice(0, 10).map((c: { id: number }) => c.id).sort((a: number, b: number) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
    expect(mocks.findMany.mock.calls[0][0].where).toMatchObject({ userId: "exploitation-1", terminee: null })
  })

  it("poursuit le même ordre en page 2, sans doublon", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/cultures?enCours=1&tri=recolte&jour=2026-11-19&page=2&pageSize=50"),
    )
    const corps = await res.json()
    expect(corps.data).toHaveLength(30)
    const page1 = await (await GET(
      new NextRequest("http://localhost/api/cultures?enCours=1&tri=recolte&jour=2026-11-19&page=1&pageSize=50"),
    )).json()
    const ids = [...page1.data, ...corps.data].map((c: { id: number }) => c.id)
    expect(new Set(ids).size).toBe(80)
    // Prêtes (1 à 10), puis à date égale les identifiants décroissants.
    expect(ids).toEqual([...Array.from({ length: 10 }, (_, i) => 10 - i), ...Array.from({ length: 70 }, (_, i) => 80 - i)])
  })
})
