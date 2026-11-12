import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * Revue du 2026-11-11 — les paramètres de liste allaient tels quels à Prisma :
 * `pageSize=abc`, `page=0` ou un `sortBy` inconnu rendaient une erreur 500.
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

const lister = (requete: string) => GET(new NextRequest(`http://localhost/api/cultures${requete}`))
const lecture = () => mocks.findMany.mock.calls[0][0] as Record<string, unknown>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "exploitation-1" } } })
  mocks.findMany.mockResolvedValue([])
  mocks.count.mockResolvedValue(0)
})

describe("GET /api/cultures — paramètres de liste", () => {
  it("retombe sur les défauts pour une page, une taille ou un tri inexploitables", async () => {
    const res = await lister("?page=0&pageSize=abc&sortBy=inconnue&sortOrder=de-travers&annee=abc")
    expect(res.status).toBe(200)
    expect(lecture()).toMatchObject({ skip: 0, take: 50, orderBy: { id: "desc" } })
    expect((lecture().where as Record<string, unknown>).annee).toBeUndefined()
    expect(await res.json()).toMatchObject({ page: 1, pageSize: 50, totalPages: 0 })
  })

  it("garde une demande valide, bornée à l'exploitation", async () => {
    await lister("?page=2&pageSize=20&sortBy=dateSemis&sortOrder=asc&annee=2026")
    expect(lecture()).toMatchObject({
      skip: 20,
      take: 20,
      orderBy: { dateSemis: "asc" },
      where: { userId: "exploitation-1", annee: 2026 },
    })
  })

  // Une espèce ou une variété personnelle a un identifiant opaque : son nom
  // vit dans `nom`, que la recherche ignorait.
  it("cherche aussi dans le nom de l'espèce et de la variété", async () => {
    await lister("?search=physalis")
    const where = lecture().where as { OR: Array<Record<string, unknown>>; userId: string }
    expect(where.userId).toBe("exploitation-1")
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { espece: { nom: { contains: "physalis", mode: "insensitive" } } },
        { variete: { nom: { contains: "physalis", mode: "insensitive" } } },
        { espece: { id: { contains: "physalis", mode: "insensitive" } } },
      ])
    )
  })

  it("ne rend que les cultures non terminées avec enCours=1", async () => {
    await lister("?enCours=1&pageSize=500")
    expect(lecture()).toMatchObject({ take: 500, where: { userId: "exploitation-1", terminee: null } })
    mocks.findMany.mockClear()
    await lister("?pageSize=500")
    expect("terminee" in (lecture().where as object)).toBe(false)
  })
})
