import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * QA cmv2r19al (2026-10-10) : une récolte datée du 10/10 était acceptée sur une
 * culture dont la plantation était prévue le 21/11, et la culture passait
 * « récoltée » avant d'être plantée. Le corps rejoué est celui de l'écran de
 * saisie (`/maraichage/recoltes/saisie`) : date « AAAA-MM-JJ » passée par
 * `new Date()`, soit minuit UTC.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  cultureFindUnique: vi.fn(),
  cultureUpdate: vi.fn(),
  recolteCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/recolte/rendement-effectif", () => ({
  chargerSurchargesRendement: vi.fn(async () => new Map()),
  rendementEffectif: (espece: { uniteRendement?: string | null }) => ({ uniteRendement: espece.uniteRendement ?? null }),
}))
vi.mock("@/lib/prisma", () => {
  const tx = {
    recolte: { create: mocks.recolteCreate },
    culture: { update: mocks.cultureUpdate },
  }
  return {
    default: {
      culture: { findUnique: mocks.cultureFindUnique },
      $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  }
})

import { POST } from "./route"

// Fuseau de la production : la règle compare des journées civiles de Paris.
beforeAll(() => { vi.stubEnv("TZ", "Europe/Paris") })
afterAll(() => { vi.unstubAllEnvs() })

const ZINNIA = {
  id: 1174,
  userId: "u1",
  especeId: "Zinnia",
  // Stockage réel : minuit de Paris, soit la veille à 22:00/23:00 UTC.
  dateSemis: new Date("2026-10-09T22:00:00.000Z"),
  datePlantation: new Date("2026-11-20T23:00:00.000Z"),
  dateRecolte: new Date("2027-01-15T23:00:00.000Z"),
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  espece: { id: "Zinnia", uniteRendement: "tiges/m2" },
  planche: null,
}

const enregistrer = (date: string) =>
  POST(
    new Request("http://localhost/api/recoltes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        especeId: "Zinnia",
        cultureId: 1174,
        quantite: 25,
        date: new Date(date),
        datePeremption: null,
        notes: null,
      }),
    }) as never
  )

describe("POST /api/recoltes — date de récolte et cycle de la culture", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.cultureFindUnique.mockResolvedValue(ZINNIA)
    mocks.recolteCreate.mockImplementation(async ({ data }) => ({ id: 1, ...data }))
    mocks.cultureUpdate.mockResolvedValue({})
  })

  it("refuse une récolte avant la plantation prévue, sans rien écrire", async () => {
    const res = await enregistrer("2026-10-10")
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.champ).toBe("date")
    expect(json.error).toContain("la plantation de la culture #1174 est prévue le 21/11/2026, après le 10/10/2026")
    expect(mocks.recolteCreate).not.toHaveBeenCalled()
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it("refuse la veille de la plantation, plantation stockée à minuit de Paris", async () => {
    const res = await enregistrer("2026-11-20")
    expect(res.status).toBe(400)
    expect((await enregistrer("2026-11-21")).status).toBe(201)
  })

  it("accepte une récolte après la plantation et garde la date saisie", async () => {
    const res = await enregistrer("2027-01-17")
    expect(res.status).toBe(201)
    expect(mocks.recolteCreate).toHaveBeenCalledTimes(1)
    expect(mocks.recolteCreate.mock.calls[0][0].data.date).toEqual(new Date("2027-01-17"))
  })

  it("la culture est relue dans le compte connecté", async () => {
    await enregistrer("2027-01-17")
    expect(mocks.cultureFindUnique.mock.calls[0][0].where).toEqual({ id: 1174, userId: "u1" })
  })
})
