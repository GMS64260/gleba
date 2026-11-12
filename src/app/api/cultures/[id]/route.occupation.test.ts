import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * Relecture du 2026-11-12 — la modification d'une culture contrôle l'occupation
 * de sa planche quand la longueur, les rangs, la planche, l'itinéraire ou les
 * dates changent, sans compter la culture elle-même, et sans bloquer une
 * culture déjà en dépassement que la modification n'aggrave pas.
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
  especeId: "Oignon",
  varieteId: null,
  itpId: "Oignon-printemps",
  plancheId: PLANCHE,
  annee: 2027,
  quantite: null,
  nbRangs: 3,
  longueur: 1 as number | null,
  espacement: 10,
  terminee: null,
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  dateSemis: new Date("2027-04-05T00:00:00.000Z") as Date | null,
  datePlantation: null as Date | null,
  dateRecolte: new Date("2027-08-02T00:00:00.000Z") as Date | null,
  finRecolte: null as Date | null,
  dateSemisPlan: null as Date | null,
  datePlantationPlan: null,
  dateRecoltePlan: null,
}

// Voisine de 3 rangs à 25 cm (0,50 m), sur la même période.
const voisine = (longueur: number | null) => ({
  id: 900,
  espece: { id: "Carotte", vivace: false },
  dateSemis: new Date("2027-03-01T00:00:00.000Z"),
  datePlantation: null,
  dateRecolte: new Date("2027-09-01T00:00:00.000Z"),
  finRecolte: null,
  nbRangs: 3,
  longueur,
  itp: { espacementRangs: 25 },
})
const planche = (cultures: unknown[]) => ({ nom: "P1", largeur: 0.8, longueur: 20, cultures })

const modifier = (corps: Record<string, unknown>) =>
  PUT(
    new NextRequest("http://localhost/api/cultures/1237", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    }),
    { params: Promise.resolve({ id: "1237" }) }
  )

describe("PUT /api/cultures/[id] — occupation de la planche", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u-demo" } } })
    mocks.cultureFindUnique.mockResolvedValue(stockee)
    mocks.plancheFindFirst.mockResolvedValue(planche([voisine(19)]))
    mocks.itpFindFirst.mockResolvedValue({ espacementRangs: 25 })
    mocks.cultureUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...stockee, ...data }))
  })

  it("refuse d'étendre à toute la planche une culture logée à la suite d'une autre", async () => {
    const res = await modifier({ longueur: 20 })

    expect(res.status).toBe(400)
    const corps = await res.json()
    expect(corps.error).toMatch(/Largeur insuffisante/)
    expect(corps.ajustements).toBeInstanceOf(Array)
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it("lit les cultures de la planche sans la culture modifiée", async () => {
    await modifier({ longueur: 20 })
    const lecture = mocks.plancheFindFirst.mock.calls[0][0]
    expect(lecture.select.cultures.where).toEqual({ terminee: null, id: { not: 1237 } })
  })

  it("refuse un rang de trop, accepte ce qui tient", async () => {
    mocks.plancheFindFirst.mockResolvedValue(planche([voisine(null)]))
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, nbRangs: 1, longueur: null })

    expect((await modifier({ nbRangs: 2 })).status).toBe(400)
    expect((await modifier({ notes: "paillée" })).status).toBe(200)
  })

  it("ne contrôle rien quand ni la place ni la période ne changent", async () => {
    // Formulaire complet renvoyé à l'identique, plus une note.
    const res = await modifier({ notes: "paillée", nbRangs: 3, longueur: 1, plancheId: PLANCHE, dateSemis: "2027-04-05" })
    expect(res.status).toBe(200)
    expect(mocks.plancheFindFirst.mock.calls.every(([a]) => !a.select.cultures)).toBe(true)
  })

  it("laisse corriger une culture déjà en dépassement sans l'aggraver", async () => {
    mocks.plancheFindFirst.mockResolvedValue(planche([voisine(null)]))
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, nbRangs: 3, longueur: null })

    expect((await modifier({ dateSemis: "2027-04-12" })).status).toBe(200)
    expect((await modifier({ longueur: 12 })).status).toBe(200)
    expect((await modifier({ nbRangs: 2 })).status).toBe(200)
    expect((await modifier({ nbRangs: 4 })).status).toBe(400)
  })

  it("refuse le déplacement vers une planche où elle ne tient pas", async () => {
    mocks.plancheFindFirst.mockResolvedValue(planche([voisine(null)]))
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, plancheId: "autre", longueur: null })

    expect((await modifier({ plancheId: PLANCHE })).status).toBe(400)
  })

  it("n'empêche pas de modifier une culture terminée", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, terminee: "Terminée" })
    expect((await modifier({ longueur: 20 })).status).toBe(200)
  })
})
