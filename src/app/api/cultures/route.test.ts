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
  plancheFindUnique: vi.fn(),
  cultureCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/rotation-check", () => ({ checkRotationViolation: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/varietes", () => ({ ensurePlaceholderVariete: vi.fn().mockResolvedValue("variete-placeholder") }))
// Mock partiel : `calendrier-climat` dérive ses zones de `terroir` au chargement.
vi.mock("@/lib/terroir", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/terroir")>()),
  zoneEffectiveUser: vi.fn().mockResolvedValue(null),
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    espece: { findFirst: mocks.especeFindFirst },
    iTP: { findFirst: mocks.itpFindFirst },
    planche: { findFirst: mocks.plancheFindFirst, findUnique: mocks.plancheFindUnique },
    $transaction: (fn: (tx: unknown) => unknown) => fn({ culture: { create: mocks.cultureCreate } }),
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
      // Champs d'identité lus depuis le ticket cmv4z6yhg (conduite contre type de planche).
      id: "Zinnia — plein champ",
      nom: null,
      especeId: "Zinnia",
      modeDemarrage: null,
      typePlanche: "Plein champ",
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
      nom: "Marc-v7-QA2-1010",
      type: null,
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

describe("POST /api/cultures — conduite de l'ITP contre le type de la planche (ticket cmv4z6yhg)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ session: { user: { id: "u1" } } })
    mocks.especeFindFirst.mockResolvedValue({ id: "Zinnia", besoinEau: 2, irrigation: null })
    mocks.itpFindFirst.mockResolvedValue({
      id: "Zinnia — sous abri",
      nom: null,
      especeId: "Zinnia",
      modeDemarrage: null,
      typePlanche: "Sous abri",
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
      nom: "B1",
      type: "Plein champ",
      largeur: 0.9,
      longueur: 24,
      cultures: [],
    })
    mocks.plancheFindUnique.mockResolvedValue({ id: "cmv2epoyb000vriklr0lp3chn" })
    mocks.cultureCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 1193, ...data }))
  })

  it("crée la culture et nomme l'incompatibilité dans `warnings`, sans bloquer", async () => {
    const res = await creer(2)
    expect(res.status).toBe(201)
    const corps = await res.json()
    expect(corps.warnings).toContain(
      "L'itinéraire technique « Zinnia — sous abri » est conduit sous abri ; la planche « B1 » est en plein champ."
    )
    expect(mocks.cultureCreate).toHaveBeenCalledTimes(1)
  })

  it("ne dit rien sur une planche sans type (l'écran s'en charge)", async () => {
    mocks.plancheFindFirst.mockResolvedValue({ id: "cmv2epoyb000vriklr0lp3chn", nom: "Marc-v7-1010", type: null, largeur: 0.9, longueur: 24, cultures: [] })
    const res = await creer(2)
    expect(res.status).toBe(201)
    const corps = await res.json()
    expect((corps.warnings ?? []).some((w: string) => /conduit/.test(w))).toBe(false)
  })
})
