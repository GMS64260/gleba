import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Constat du 2026-10-25 sur un compte réel, culture B : aubergine sous abri sur
 * l'ITP INRAE-MESCLUN-0020 (implantation S16–S18, récolte S27, 16 semaines),
 * créée le 25 octobre depuis « Nouvelle culture ». La fenêtre de l'année étant
 * passée, le formulaire a décalé tout le cycle à partir du jour même
 * (`cycleItpPropose`) : plantation le 25/10/2026, récolte le 10/01/2027
 * (+ 11 semaines), fin le 02/05/2027 (+ 16 semaines). L'accueil affichait
 * ensuite « Planter Aubergine — aujourd'hui ». Corps rejoué : celui du
 * formulaire (dates en minuit local à Paris).
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
vi.mock("@/lib/varietes", () => ({ ensurePlaceholderVariete: vi.fn().mockResolvedValue("Aubergine — Non spécifiée") }))
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

const tzAvant = process.env.TZ
beforeAll(() => {
  process.env.TZ = "Europe/Paris"
})
afterAll(() => {
  if (tzAvant === undefined) delete process.env.TZ
  else process.env.TZ = tzAvant
})

const ITP_0020 = {
  id: "INRAE-MESCLUN-0020",
  nom: "Aubergine — sous abri — implantation S16–S18 · S27–S42",
  especeId: "Aubergine",
  modeDemarrage: null,
  typePlanche: "Sous abri",
  userId: null,
  zoneClimat: "oceanique",
  semaineSemis: null,
  semainePlantation: 16,
  semaineRecolte: 27,
  semaineRecolteFin: 42,
  dureeRecolte: 16,
  semaineImplantationDebut: 16,
  semaineImplantationFin: 18,
  implantation: "Plantation",
  espacementRangs: null,
  nbGrainesPlant: null,
  doseSemis: null,
}

const corpsB = (datePlantation: Date, dateRecolte: Date, annee = 2026) => ({
  especeId: "Aubergine",
  varieteId: null,
  itpId: "INRAE-MESCLUN-0020",
  plancheId: "planche-s1p2",
  annee,
  dateSemis: null,
  datePlantation: datePlantation.toISOString(),
  dateRecolte: dateRecolte.toISOString(),
  finRecolte: null,
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  terminee: null,
  quantite: 20,
  nbRangs: 2,
  longueur: 10,
  espacement: 50,
  notes: null,
  confirmRotation: false,
})

const creer = (corps: Record<string, unknown>) =>
  POST(
    new Request("http://localhost/api/cultures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    }) as never
  )

describe("POST /api/cultures — alerte de saison (culture B)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ session: { user: { id: "u1" } } })
    mocks.especeFindFirst.mockResolvedValue({ id: "Aubergine", besoinEau: 3, irrigation: null })
    mocks.itpFindFirst.mockResolvedValue(ITP_0020)
    mocks.plancheFindFirst.mockResolvedValue({
      id: "planche-s1p2",
      nom: "S1P2",
      type: "Serre",
      largeur: 0.8,
      longueur: 10,
      cultures: [],
    })
    mocks.plancheFindUnique.mockResolvedValue({ id: "planche-s1p2" })
    mocks.cultureCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 2002, ...data }))
  })

  it("crée la culture plantée le 25/10 et dit qu'elle sort de la fenêtre S16–S18", async () => {
    const res = await creer(corpsB(new Date(2026, 9, 25), new Date(2027, 0, 10)))
    expect(res.status).toBe(201)
    const corps = await res.json()
    const message = "Hors fenêtre de l'itinéraire (plantation S16–S18) : plantation prévue S43."
    expect(corps.alerteSaison).toMatchObject({ etape: "plantation", semaine: 43, message })
    // Un seul message pour la plantation, celui de l'écran.
    expect(corps.warnings.filter((w: string) => /plantation/i.test(w))).toEqual([message])
    // Fenêtre dérivée de l'ITP : 10/01/2027 + 16 semaines (règle inchangée).
    const data = mocks.cultureCreate.mock.calls[0][0].data
    expect(data.datePlantation).toEqual(new Date("2026-10-25T00:00:00.000Z"))
    expect(data.finRecolte).toEqual(new Date("2027-05-02T00:00:00.000Z"))
  })

  it("aucune alerte pour une plantation dans la fenêtre (S16 2027)", async () => {
    const res = await creer(corpsB(new Date(2027, 3, 19), new Date(2027, 6, 5), 2027))
    expect(res.status).toBe(201)
    const corps = await res.json()
    expect(corps.alerteSaison).toBeUndefined()
    expect((corps.warnings ?? []).some((w: string) => /fenêtre/.test(w))).toBe(false)
  })
})
