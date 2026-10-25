import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Ticket QA cmvnulry1 (2026-10-25), même famille : les données d'exemple d'un
 * nouveau compte écrivaient `new Date(a, m, j)`, un minuit LOCAL stocké la
 * veille à 22:00 ou 23:00 UTC, que le Registre de culture (jour UTC) affichait
 * au jour précédent (semis du 15 mars lu au 14). Les dates au jour seul sont
 * écrites à minuit UTC, comme une saisie de formulaire.
 */

const mocks = vi.hoisted(() => ({
  parcelleGeoCreate: vi.fn(),
  plancheCreate: vi.fn(),
  cultureCreate: vi.fn(),
  recolteCreate: vi.fn(),
  arbreCreate: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    parcelleGeo: { create: mocks.parcelleGeoCreate },
    planche: { create: mocks.plancheCreate },
    culture: { create: mocks.cultureCreate },
    recolte: { create: mocks.recolteCreate },
    arbre: { create: mocks.arbreCreate },
  },
}))

import { createSampleDataForUser } from "../user-sample-data"

const tzAvant = process.env.TZ
beforeAll(() => {
  process.env.TZ = "Europe/Paris"
})
afterAll(() => {
  if (tzAvant === undefined) delete process.env.TZ
  else process.env.TZ = tzAvant
})

/** Toutes les dates passées à `create` par ce mock. */
function datesEcrites(mock: ReturnType<typeof vi.fn>): [string, Date][] {
  return mock.mock.calls.flatMap(([{ data }]) =>
    Object.entries(data as Record<string, unknown>).filter((e): e is [string, Date] => e[1] instanceof Date),
  )
}

describe("données d'exemple : dates au jour seul", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let id = 0
    const cree = async ({ data }: { data: Record<string, unknown> }) => ({ id: `id${++id}`, ...data })
    for (const mock of Object.values(mocks)) mock.mockImplementation(cree)
  })

  it("cultures, récoltes et arbres sont datés à minuit UTC", async () => {
    await createSampleDataForUser("u-neuf", { parcelleGeoId: "parcelle-1" })

    const dates = [
      ...datesEcrites(mocks.cultureCreate),
      ...datesEcrites(mocks.recolteCreate),
      ...datesEcrites(mocks.arbreCreate),
    ]
    expect(dates.length).toBeGreaterThanOrEqual(17)
    for (const [champ, date] of dates) {
      expect(date.getTime() % 86_400_000, `${champ} ${date.toISOString()}`).toBe(0)
    }
  })

  it("le semis du 15 mars de l'an dernier est stocké le 15 mars", async () => {
    await createSampleDataForUser("u-neuf", { parcelleGeoId: "parcelle-1", avecVerger: false })

    const anneePassee = new Date().getFullYear() - 1
    const premiere = mocks.cultureCreate.mock.calls[0][0].data
    expect(premiere.dateSemis.toISOString()).toBe(`${anneePassee}-03-15T00:00:00.000Z`)
    expect(premiere.datePlantation.toISOString()).toBe(`${anneePassee}-05-10T00:00:00.000Z`)
  })
})
