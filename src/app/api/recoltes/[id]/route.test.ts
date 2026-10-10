import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * QA cmv2r19al (2026-10-10) : la règle « pas de récolte avant la plantation »
 * vaut aussi en modification. Corps rejoué : celui de la fiche récolte
 * (`/maraichage/recoltes/[id]`), qui renvoie date, quantité et notes.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  recolteFindUnique: vi.fn(),
  recolteUpdate: vi.fn(),
  cultureFindUnique: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/auto-compta", () => ({ createVenteFromRecolte: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock("@/lib/facture-utils", () => ({ creerFacture: vi.fn(), annulerFactureLiee: vi.fn() }))
vi.mock("@/lib/prisma", () => {
  const tx = { recolte: { update: mocks.recolteUpdate } }
  return {
    default: {
      recolte: { findUnique: mocks.recolteFindUnique },
      culture: { findUnique: mocks.cultureFindUnique },
      $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  }
})

import { PUT } from "./route"

// Fuseau de la production : la règle compare des journées civiles de Paris.
beforeAll(() => { vi.stubEnv("TZ", "Europe/Paris") })
afterAll(() => { vi.unstubAllEnvs() })

const RECOLTE = {
  id: 1150,
  userId: "u1",
  cultureId: 1174,
  especeId: "Zinnia",
  date: new Date("2027-01-20T12:00:00.000Z"),
  quantite: 25,
}

const ZINNIA = {
  id: 1174,
  especeId: "Zinnia",
  dateSemis: new Date("2026-10-09T22:00:00.000Z"),
  datePlantation: new Date("2026-11-20T23:00:00.000Z"),
  semisFait: false,
  plantationFaite: false,
}

const modifier = (body: Record<string, unknown>) =>
  PUT(
    new Request("http://localhost/api/recoltes/1150", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: "1150" }) }
  )

describe("PUT /api/recoltes/[id] — date de récolte et cycle de la culture", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.recolteFindUnique.mockResolvedValue(RECOLTE)
    mocks.cultureFindUnique.mockResolvedValue(ZINNIA)
    mocks.recolteUpdate.mockImplementation(async ({ data }) => ({ ...RECOLTE, ...data }))
  })

  it("refuse de redater une récolte avant la plantation", async () => {
    const res = await modifier({ date: new Date("2026-10-10T00:00:00.000Z").toISOString(), quantite: 25, notes: null })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("Une récolte ne peut pas précéder la plantation.")
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("accepte une nouvelle date postérieure à la plantation", async () => {
    const res = await modifier({ date: new Date("2027-01-24T00:00:00.000Z").toISOString(), quantite: 25, notes: null })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data.date).toEqual(new Date("2027-01-24T00:00:00.000Z"))
  })

  it("date inchangée : la retouche de la quantité ne relit pas la culture", async () => {
    // Corps réel de la fiche : la date affichée (20/01) repart à minuit UTC.
    const res = await modifier({ date: "2027-01-20T00:00:00.000Z", quantite: 30, notes: null })
    expect(res.status).toBe(200)
    expect(mocks.cultureFindUnique).not.toHaveBeenCalled()
  })

  it("sans date dans le corps, la récolte n'est pas redatée du jour", async () => {
    const res = await modifier({ quantite: 30 })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data).not.toHaveProperty("date")
  })

  it("refuse le rattachement à une culture d'une autre espèce", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...ZINNIA, id: 1180, especeId: "Tomate" })
    const res = await modifier({ cultureId: 1180, quantite: 25 })
    expect(res.status).toBe(400)
    expect((await res.json()).champ).toBe("especeId")
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("refuse le rattachement à une culture hors du compte", async () => {
    mocks.cultureFindUnique.mockResolvedValue(null)
    const res = await modifier({ cultureId: 999, quantite: 25 })
    expect(res.status).toBe(400)
    expect(mocks.cultureFindUnique.mock.calls[0][0].where).toEqual({ id: 999, userId: "u1" })
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })
})
