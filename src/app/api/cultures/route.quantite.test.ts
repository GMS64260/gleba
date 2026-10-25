import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * Ticket QA cmvnpkkhp (2026-10-25) — l'assistant « Semer » affichait
 * « 3 rangs x 16m (30cm esp.) = ~159 plants » ; la culture #1232 naissait
 * pourtant sans quantité (liste « — », champ « Quantité / plants (auto) »
 * vide à la réouverture) quand Planification > Plants recalculait 159.
 *
 * Corps rejoués : celui que `AssistantStepRecap` envoyait (sans `quantite`),
 * celui qu'il envoie désormais, et celui du formulaire d'édition rouvert sur
 * la culture née sans quantité.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  especeFindFirst: vi.fn(),
  itpFindFirst: vi.fn(),
  plancheFindFirst: vi.fn(),
  plancheFindUnique: vi.fn(),
  cultureCreate: vi.fn(),
  cultureFindUnique: vi.fn(),
  cultureUpdate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi, getUserId: () => "u-demo" }))
vi.mock("@/lib/rotation-check", () => ({ checkRotationViolation: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/irrigation-cache", () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
vi.mock("@/lib/varietes", () => ({ ensurePlaceholderVariete: vi.fn().mockResolvedValue("Laitue — Non spécifiée") }))
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
    culture: { findUnique: mocks.cultureFindUnique, update: mocks.cultureUpdate },
    $transaction: (fn: (tx: unknown) => unknown) => fn({ culture: { create: mocks.cultureCreate } }),
  },
}))

import { POST } from "./route"
import { PUT } from "./[id]/route"

const PLANCHE = "cmvnpk0plan2d0002demo0001"

/** Corps exact de « Semer » > Planche existante > Laitue, planning manuel 2027. */
const corpsSemerAvant = {
  especeId: "Laitue",
  varieteId: null,
  itpId: null,
  plancheId: PLANCHE,
  annee: 2027,
  // 01/02, 01/03 et 15/04/2027 saisis à Paris, convertis par `toISOString()`.
  dateSemis: "2027-01-31T23:00:00.000Z",
  datePlantation: "2027-02-28T23:00:00.000Z",
  dateRecolte: "2027-04-14T22:00:00.000Z",
  nbRangs: 3,
  longueur: 16,
  espacement: 30,
  aIrriguer: true,
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
}

const creer = (corps: Record<string, unknown>) =>
  POST(
    new NextRequest("http://localhost/api/cultures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    })
  )

describe("POST /api/cultures — quantité de plants à la création (ticket cmvnpkkhp)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u-demo" } } })
    mocks.especeFindFirst.mockResolvedValue({ id: "Laitue", besoinEau: 3, irrigation: null })
    mocks.plancheFindFirst.mockResolvedValue({
      id: PLANCHE,
      nom: "v8-Marc-2510 plan2D (2)",
      type: null,
      largeur: 0.8,
      longueur: 16,
      cultures: [],
    })
    mocks.plancheFindUnique.mockResolvedValue({ id: PLANCHE })
    mocks.cultureCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 1232, ...data }))
  })

  it("corps de « Semer » sans quantité : la route enregistre les 159 plants du récapitulatif", async () => {
    const res = await creer(corpsSemerAvant)

    expect(res.status).toBe(201)
    expect(mocks.cultureCreate).toHaveBeenCalledTimes(1)
    expect(mocks.cultureCreate.mock.calls[0][0].data).toMatchObject({
      nbRangs: 3,
      longueur: 16,
      espacement: 30,
      quantite: 159,
    })
    expect((await res.json()).quantite).toBe(159)
  })

  it("corps de « Semer » corrigé : la quantité affichée est celle enregistrée", async () => {
    const res = await creer({ ...corpsSemerAvant, quantite: 159 })

    expect(res.status).toBe(201)
    expect(mocks.cultureCreate.mock.calls[0][0].data.quantite).toBe(159)
  })

  it("une quantité saisie à la main n'est pas recalculée", async () => {
    await creer({ ...corpsSemerAvant, quantite: 150 })
    expect(mocks.cultureCreate.mock.calls[0][0].data.quantite).toBe(150)
  })

  it("sans espacement, rien n'est inventé", async () => {
    await creer({ ...corpsSemerAvant, espacement: null })
    expect(mocks.cultureCreate.mock.calls[0][0].data.quantite ?? null).toBeNull()
  })
})

describe("PUT /api/cultures/[id] — quantité automatique (ticket cmvnpkkhp)", () => {
  const nee = {
    id: 1232,
    userId: "u-demo",
    especeId: "Laitue",
    varieteId: "Laitue — Non spécifiée",
    itpId: null,
    plancheId: PLANCHE,
    annee: 2027,
    quantite: null as number | null,
    nbRangs: 3,
    longueur: 16,
    espacement: 30,
    semisFait: false,
    plantationFaite: false,
    recolteFaite: false,
    dateSemis: new Date("2027-01-31T23:00:00.000Z"),
    datePlantation: new Date("2027-02-28T23:00:00.000Z"),
    dateRecolte: new Date("2027-04-14T22:00:00.000Z"),
  }

  const modifier = (corps: Record<string, unknown>) =>
    PUT(
      new NextRequest("http://localhost/api/cultures/1232", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      }),
      { params: Promise.resolve({ id: "1232" }) }
    )

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u-demo" } } })
    mocks.cultureFindUnique.mockResolvedValue(nee)
    mocks.plancheFindFirst.mockResolvedValue({ nom: "v8-Marc-2510 plan2D (2)", longueur: 16 })
    mocks.cultureUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...nee, ...data }))
  })

  it("formulaire d'édition rouvert sur la culture née sans quantité : 159 enregistrés", async () => {
    // Corps du formulaire d'édition avant ce correctif : quantité vide, le
    // recalcul de l'écran étant bloqué pendant le chargement initial.
    const res = await modifier({
      especeId: "Laitue",
      varieteId: "Laitue — Non spécifiée",
      itpId: null,
      plancheId: PLANCHE,
      annee: 2027,
      dateSemis: "2027-01-31T23:00:00.000Z",
      datePlantation: "2027-02-28T23:00:00.000Z",
      dateRecolte: "2027-04-14T22:00:00.000Z",
      finRecolte: null,
      semisFait: false,
      plantationFaite: false,
      recolteFaite: false,
      terminee: null,
      quantite: null,
      nbRangs: 3,
      longueur: 16,
      espacement: 30,
      notes: null,
    })

    expect(res.status).toBe(200)
    expect(mocks.cultureUpdate.mock.calls[0][0].data.quantite).toBe(159)
  })

  it("une quantité saisie à la main reste intacte quand un autre champ change", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...nee, quantite: 120 })
    await modifier({ nbRangs: 2 })
    expect(mocks.cultureUpdate.mock.calls[0][0].data).not.toHaveProperty("quantite")
  })

  it("une quantité automatique suit le nombre de rangs", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...nee, quantite: 159 })
    await modifier({ nbRangs: 2 })
    expect(mocks.cultureUpdate.mock.calls[0][0].data.quantite).toBe(106)
  })
})
