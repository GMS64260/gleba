import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * QA cmv2r1v63 — le refus de largeur de POST /api/cultures porte des
 * `ajustements` structurés : le bouton « Réduire à 2 rangs » de
 * /maraichage/cultures/new en dépend. Corps rejoué : celui que le formulaire
 * envoie (Zinnia, ITP 3 rangs, planche Marc-v7-QA2-1010 du signalement).
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  especeFindFirst: vi.fn(),
  itpFindFirst: vi.fn(),
  plancheFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/rotation-check", () => ({ checkRotationViolation: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
// Mock partiel : `calendrier-climat` dérive ses zones de `terroir` au chargement.
vi.mock("@/lib/terroir", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/terroir")>()),
  zoneEffectiveUser: vi.fn().mockResolvedValue(null),
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    espece: { findFirst: mocks.especeFindFirst },
    iTP: { findFirst: mocks.itpFindFirst },
    planche: { findFirst: mocks.plancheFindFirst },
  },
}))

import { POST } from "./route"

const enPlace = (id: number, nbRangs: number, espacementRangs: number | null) => ({
  id,
  espece: { id: `e${id}`, vivace: false },
  nbRangs,
  itp: { espacementRangs },
  dateSemis: new Date("2026-10-09T22:00:00.000Z"),
  datePlantation: null,
  dateRecolte: new Date("2027-01-15T23:00:00.000Z"),
  finRecolte: new Date("2027-04-23T22:00:00.000Z"),
})

const corpsFormulaire = (nbRangs: number) => ({
  especeId: "Zinnia",
  varieteId: null,
  itpId: "Zinnia — plein champ",
  plancheId: "cmv2epoyb000vriklr0lp3chn",
  annee: 2026,
  dateSemis: "2026-10-09T22:00:00.000Z",
  datePlantation: "2026-11-20T23:00:00.000Z",
  dateRecolte: "2027-01-15T23:00:00.000Z",
  finRecolte: null,
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  terminee: null,
  quantite: nbRangs * 80,
  nbRangs,
  longueur: 24,
  espacement: 30,
  notes: null,
  confirmRotation: false,
})

const creer = (nbRangs: number) =>
  POST(
    new Request("http://localhost/api/cultures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpsFormulaire(nbRangs)),
    }) as never
  )

describe("POST /api/cultures — refus de largeur de planche", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ session: { user: { id: "u1" } } })
    mocks.especeFindFirst.mockResolvedValue({ id: "Zinnia", besoinEau: 2, irrigation: null })
    mocks.itpFindFirst.mockResolvedValue({
      userId: null,
      zoneClimat: null,
      semaineSemis: 41,
      semainePlantation: 47,
      semaineRecolte: 3,
      semaineRecolteFin: 17,
      dureeRecolte: 14,
      espacementRangs: 35,
      nbGrainesPlant: null,
      doseSemis: null,
    })
    mocks.plancheFindFirst.mockResolvedValue({
      id: "cmv2epoyb000vriklr0lp3chn",
      largeur: 0.9,
      longueur: 24,
      cultures: [enPlace(1173, 4, null), enPlace(1174, 1, 35)],
    })
  })

  it("renvoie l'ajustement « Réduire à 2 rangs » sous forme structurée", async () => {
    const res = await creer(3)
    expect(res.status).toBe(400)
    const corps = await res.json()
    expect(corps.error).toMatch(/besoin de 0\.70m, disponible 0\.50m/)
    expect(corps.ajustements).toContainEqual(
      expect.objectContaining({ reduireRangs: 2, message: "Réduire à 2 rangs (au lieu de 3)" })
    )
    expect(corps.suggestions).toContain("Réduire à 2 rangs (au lieu de 3)")
  })
})
