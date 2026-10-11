import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * QA cmv2r1v63 — l'aperçu d'occupation de l'assistant lit la planche par son
 * identifiant, dans le compte, et rend le verdict de la création. Requête
 * rejouée : celle que construit AssistantStepDates.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  plancheFindFirst: vi.fn(),
  itpFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
// Mock partiel : `calendrier-climat` dérive ses zones de `terroir` au chargement.
vi.mock("@/lib/terroir", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/terroir")>()),
  zoneEffectiveUser: vi.fn().mockResolvedValue(null),
}))
vi.mock("@/lib/itp-acces", () => ({ whereItpUtilisable: () => ({}) }))
vi.mock("@/lib/prisma", () => ({
  default: {
    planche: { findFirst: mocks.plancheFindFirst },
    iTP: { findFirst: mocks.itpFindFirst },
  },
}))

import { GET } from "./route"

const PLANCHE = {
  largeur: 0.9,
  longueur: 24,
  cultures: [
    {
      id: 1173,
      espece: { id: "Radis", vivace: false },
      nbRangs: 4,
      itp: { espacementRangs: null },
      dateSemis: new Date("2026-10-09T22:00:00.000Z"),
      datePlantation: null,
      dateRecolte: new Date("2026-11-19T23:00:00.000Z"),
      finRecolte: new Date("2026-12-25T23:00:00.000Z"),
    },
    {
      id: 1174,
      espece: { id: "Zinnia", vivace: false },
      nbRangs: 1,
      itp: { espacementRangs: 35 },
      dateSemis: new Date("2026-10-09T22:00:00.000Z"),
      datePlantation: new Date("2026-11-20T23:00:00.000Z"),
      dateRecolte: new Date("2027-01-15T23:00:00.000Z"),
      finRecolte: new Date("2027-04-23T22:00:00.000Z"),
    },
  ],
}

const ITP_ZINNIA = {
  userId: null,
  zoneClimat: null,
  semaineSemis: 41,
  semainePlantation: 47,
  semaineRecolte: 3,
  semaineRecolteFin: 17,
  dureeRecolte: 14,
  espacementRangs: 35,
}

const apercu = (nbRangs: number) =>
  GET(
    new Request(
      `http://localhost/api/cultures/occupation?${new URLSearchParams({
        plancheId: "cmv2epoyb000vriklr0lp3chn",
        itpId: "Zinnia — plein champ",
        nbRangs: String(nbRangs),
        longueur: "24",
        dateSemis: "2026-10-10",
        datePlantation: "2026-11-21",
        dateRecolte: "2027-01-16",
      })}`
    ) as never
  )

describe("GET /api/cultures/occupation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ session: { user: { id: "u1" } } })
    mocks.plancheFindFirst.mockResolvedValue(PLANCHE)
    mocks.itpFindFirst.mockResolvedValue(ITP_ZINNIA)
  })

  it("refuse 3 rangs comme la création, et propose 2 rangs", async () => {
    const res = await apercu(3)
    const verdict = await res.json()
    expect(verdict).toMatchObject({ verifie: true, possible: false })
    expect(verdict.largeurDisponible).toBeCloseTo(0.5)
    expect(verdict.ajustements[0]).toMatchObject({ reduireRangs: 2 })
  })

  it("accepte les 2 rangs proposés", async () => {
    const verdict = await (await apercu(2)).json()
    expect(verdict).toMatchObject({ verifie: true, possible: true })
  })

  it("lit la planche par son identifiant, dans le compte", async () => {
    await apercu(2)
    expect(mocks.plancheFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "cmv2epoyb000vriklr0lp3chn", userId: "u1" } })
    )
    mocks.plancheFindFirst.mockResolvedValue(null)
    expect((await apercu(2)).status).toBe(404)
  })
})
