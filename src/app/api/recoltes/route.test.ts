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
  cultureFindMany: vi.fn(),
  cultureUpdate: vi.fn(),
  recolteCreate: vi.fn(),
  chargerSurcharges: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
// Règle réelle du rendement effectif ; seule la lecture des surcharges de la
// ferme est simulée.
vi.mock("@/lib/recolte/rendement-effectif", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/recolte/rendement-effectif")>()),
  chargerSurchargesRendement: mocks.chargerSurcharges,
}))
vi.mock("@/lib/prisma", () => {
  const tx = {
    recolte: { create: mocks.recolteCreate },
    culture: { update: mocks.cultureUpdate },
  }
  return {
    default: {
      culture: { findMany: mocks.cultureFindMany },
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
    mocks.cultureFindMany.mockResolvedValue([ZINNIA])
    mocks.recolteCreate.mockImplementation(async ({ data }) => ({ id: 1, ...data }))
    mocks.cultureUpdate.mockResolvedValue({})
    mocks.chargerSurcharges.mockResolvedValue(new Map())
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
    expect(mocks.cultureFindMany.mock.calls[0][0].where).toEqual({ id: { in: [1174] }, userId: "u1" })
  })
})

/**
 * Ticket QA du 2026-10-19 : la saisie ne proposait que des kilos. L'unité se
 * décide pour l'ESPÈCE chez la ferme (carte « Chez moi » de sa fiche, PUT
 * mon-rendement), et l'écran envoie le même corps qu'avant : la route dérive
 * l'unité de la récolte de cette surcharge et ignore toute unité reçue.
 */
describe("POST /api/recoltes — unité de la récolte", () => {
  const BASILIC = {
    id: 501,
    userId: "u1",
    especeId: "Basilic",
    dateSemis: new Date("2026-04-01T22:00:00.000Z"),
    datePlantation: new Date("2026-05-10T22:00:00.000Z"),
    dateRecolte: new Date("2026-07-01T22:00:00.000Z"),
    semisFait: true,
    plantationFaite: true,
    recolteFaite: false,
    espece: { id: "Basilic", rendement: 1.5, uniteRendement: "kg_m2" },
    planche: null,
  }

  // Corps de `/maraichage/recoltes/saisie`, plus une unité qu'un client
  // pourrait glisser : elle ne doit rien décider.
  const enregistrerBasilic = () =>
    POST(
      new Request("http://localhost/api/recoltes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          especeId: "Basilic",
          cultureId: 501,
          quantite: 10,
          date: new Date("2026-10-19"),
          datePeremption: null,
          notes: null,
          unite: "kg",
        }),
      }) as never
    )

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.cultureFindMany.mockResolvedValue([BASILIC])
    mocks.recolteCreate.mockImplementation(async ({ data }) => ({ id: 2, ...data }))
    mocks.cultureUpdate.mockResolvedValue({})
  })

  it("compte en bottes une espèce que la ferme compte en bottes", async () => {
    mocks.chargerSurcharges.mockResolvedValue(
      new Map([["Basilic", { rendement: null, uniteRendement: "bottes_m2" }]]),
    )
    const res = await enregistrerBasilic()
    expect(res.status).toBe(201)
    expect(mocks.chargerSurcharges).toHaveBeenCalledWith("u1", ["Basilic"])
    expect(mocks.recolteCreate.mock.calls[0][0].data).toMatchObject({ quantite: 10, unite: "botte" })
    expect((await res.json()).unite).toBe("botte")
  })

  it("sans unité déclarée par la ferme, l'unité du catalogue", async () => {
    mocks.chargerSurcharges.mockResolvedValue(new Map())
    const res = await enregistrerBasilic()
    expect(res.status).toBe(201)
    expect(mocks.recolteCreate.mock.calls[0][0].data.unite).toBe("kg")
  })
})
