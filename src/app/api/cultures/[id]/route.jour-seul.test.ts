import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * Ticket QA cmvnulry1 (2026-10-25), modification d'une culture : règle par
 * JOUR (celle de `dateSoinRetenue` en élevage). Même jour civil que la date
 * stockée : l'instant stocké est gardé et la date n'est pas « redéfinie » (la
 * date de plan mémorisée reste) ; autre jour : minuit UTC de ce jour.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  cultureFindUnique: vi.fn(),
  cultureUpdate: vi.fn(),
  plancheFindFirst: vi.fn(),
  itpFindFirst: vi.fn(),
  varieteFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi, getUserId: () => "u-demo" }))
vi.mock("@/lib/rotation-check", () => ({ checkRotationViolation: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/irrigation-cache", () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
// Mock partiel : `calendrier-climat` dérive ses zones de `terroir` au chargement.
vi.mock("@/lib/terroir", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/terroir")>()),
  zoneEffectiveUser: vi.fn().mockResolvedValue(null),
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    culture: { findUnique: mocks.cultureFindUnique, update: mocks.cultureUpdate },
    planche: { findFirst: mocks.plancheFindFirst },
    iTP: { findFirst: mocks.itpFindFirst },
    variete: { findFirst: mocks.varieteFindFirst },
  },
}))

import { PUT } from "./route"

// Le conteneur tourne en Europe/Paris.
const tzAvant = process.env.TZ
beforeAll(() => {
  process.env.TZ = "Europe/Paris"
})
afterAll(() => {
  if (tzAvant === undefined) delete process.env.TZ
  else process.env.TZ = tzAvant
})

const PLANCHE = "cmvnulpl0000planche0002"

const stockee = {
  id: 1237,
  userId: "u-demo",
  especeId: "Courge",
  varieteId: null,
  itpId: null,
  plancheId: PLANCHE,
  annee: 2027,
  quantite: 10,
  nbRangs: 1,
  longueur: 10,
  espacement: 100,
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  dateSemis: new Date("2027-04-05T00:00:00.000Z") as Date | null,
  datePlantation: null as Date | null,
  dateRecolte: null as Date | null,
  finRecolte: null as Date | null,
  dateSemisPlan: null as Date | null,
  datePlantationPlan: null,
  dateRecoltePlan: null,
}

const modifier = (corps: Record<string, unknown>) =>
  PUT(
    new NextRequest("http://localhost/api/cultures/1237", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    }),
    { params: Promise.resolve({ id: "1237" }) }
  )

const ecrit = () => mocks.cultureUpdate.mock.calls[0][0].data as Record<string, unknown>

describe("PUT /api/cultures/[id] — dates comparées et écrites par jour (cmvnulry1)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u-demo" } } })
    mocks.cultureFindUnique.mockResolvedValue(stockee)
    mocks.plancheFindFirst.mockResolvedValue({ nom: "v8-Marc-2010 (2)", longueur: 10 })
    mocks.itpFindFirst.mockResolvedValue(null)
    mocks.cultureUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...stockee, ...data }))
  })

  it("la fiche renvoie le minuit local d'un ITP resynchronisé : stocké au jour civil, minuit UTC", async () => {
    const res = await modifier({ dateSemis: "2027-04-11T22:00:00.000Z" })

    expect(res.status).toBe(200)
    expect((ecrit().dateSemis as Date).toISOString()).toBe("2027-04-12T00:00:00.000Z")
    // Autre jour : nouvelle date de plan.
    expect(ecrit()).toHaveProperty("dateSemisPlan", null)
  })

  describe("une date non touchée d'une étape faite (instant horodaté)", () => {
    const faite = {
      ...stockee,
      semisFait: true,
      dateSemis: new Date("2026-10-25T13:45:12.000Z"),
      dateSemisPlan: new Date("2026-10-30T00:00:00.000Z"),
    }
    beforeEach(() => {
      mocks.cultureFindUnique.mockResolvedValue(faite)
    })

    it("renvoyée telle quelle : intacte, pas « redéfinie »", async () => {
      await modifier({ dateSemis: "2026-10-25T13:45:12.000Z", semisFait: true, notes: "Levée régulière" })

      expect((ecrit().dateSemis as Date).toISOString()).toBe("2026-10-25T13:45:12.000Z")
      expect(ecrit()).not.toHaveProperty("dateSemisPlan")
    })

    it("renvoyée en « AAAA-MM-JJ » par le champ date : même jour, instant stocké gardé", async () => {
      await modifier({ dateSemis: "2026-10-25", semisFait: true })

      expect((ecrit().dateSemis as Date).toISOString()).toBe("2026-10-25T13:45:12.000Z")
      expect(ecrit()).not.toHaveProperty("dateSemisPlan")
    })
  })

  it("culture ancienne stockée à minuit Paris, renvoyée « AAAA-MM-JJ » : même jour, inchangée", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, dateSemis: new Date("2027-04-11T22:00:00.000Z") })

    await modifier({ dateSemis: "2027-04-12" })

    expect((ecrit().dateSemis as Date).toISOString()).toBe("2027-04-11T22:00:00.000Z")
    expect(ecrit()).not.toHaveProperty("dateSemisPlan")
  })
})
