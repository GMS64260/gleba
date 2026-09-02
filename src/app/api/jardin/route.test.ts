/**
 * GET /api/jardin — les cultures affichées sur le plan.
 *
 * Régression du 2026-08-25 : des fraisiers (vivace) plantés en 2023 étaient
 * absents du plan parce que la route ne gardait que l'année courante. La route
 * doit désormais garder toute vivace non terminée, et transmettre
 * `espece.vivace` pour que le plan vivant ne la retire pas en fin de récolte.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  plancheFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: { planche: { findMany: mocks.plancheFindMany } },
}))

import { NextRequest } from "next/server"
import { GET } from "./route"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ session: { user: { id: "u1" } }, error: null })
  mocks.plancheFindMany.mockResolvedValue([])
})

describe("GET /api/jardin — cultures en place", () => {
  it("garde l'année courante non terminée ET les vivaces non terminées de toute année", async () => {
    const res = await GET(new NextRequest("http://localhost/api/jardin"))
    expect(res.status).toBe(200)

    const args = mocks.plancheFindMany.mock.calls[0][0]
    const cultures = args.select.cultures
    expect(cultures.where.terminee).toBeNull()
    expect(cultures.where.OR).toEqual([
      { annee: new Date().getFullYear() },
      { espece: { vivace: true } },
    ])
    // Sans ce champ, croissanceCulture() traiterait la vivace comme une annuelle
    expect(cultures.select.espece.select.vivace).toBe(true)
  })

  it("filtre par parcelle sans toucher au filtre des cultures", async () => {
    await GET(new NextRequest("http://localhost/api/jardin?parcelle=none"))
    const args = mocks.plancheFindMany.mock.calls[0][0]
    expect(args.where).toEqual({ userId: "u1", parcelleGeoId: null })
    expect(args.select.cultures.where.OR).toHaveLength(2)
  })
})
