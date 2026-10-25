import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * Ticket QA cmvnulry1 (2026-10-25) — une date de culture est un JOUR. Un
 * client qui envoie un instant (assistant « Semer » avant correctif :
 * `toISOString()` d'un minuit local, « 2027-04-11T22:00:00.000Z » pour le
 * 12 avril à Paris) faisait stocker la veille au soir, que le Registre de
 * culture (jour UTC) affichait au 11. La création écrit désormais minuit UTC
 * du jour civil, comme une saisie « AAAA-MM-JJ ».
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  especeFindFirst: vi.fn(),
  itpFindFirst: vi.fn(),
  plancheFindFirst: vi.fn(),
  plancheFindUnique: vi.fn(),
  cultureCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi, getUserId: () => "u-demo" }))
vi.mock("@/lib/rotation-check", () => ({ checkRotationViolation: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/irrigation-cache", () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
vi.mock("@/lib/varietes", () => ({ ensurePlaceholderVariete: vi.fn().mockResolvedValue("Courge — Non spécifiée") }))
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

const corps = (dates: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  especeId: "Courge",
  varieteId: null,
  itpId: null,
  plancheId: PLANCHE,
  annee: 2027,
  nbRangs: 1,
  longueur: 10,
  espacement: 100,
  aIrriguer: true,
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  ...dates,
  ...extra,
})

const creer = (body: Record<string, unknown>) =>
  POST(
    new NextRequest("http://localhost/api/cultures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )

const ecrit = () => mocks.cultureCreate.mock.calls[0][0].data as Record<string, Date | null>

describe("POST /api/cultures — dates écrites au jour seul (cmvnulry1)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u-demo" } } })
    mocks.especeFindFirst.mockResolvedValue({ id: "Courge", besoinEau: 3, irrigation: null })
    mocks.itpFindFirst.mockResolvedValue(null)
    mocks.plancheFindFirst.mockResolvedValue({
      id: PLANCHE,
      nom: "v8-Marc-2010 (2)",
      type: null,
      largeur: 1.2,
      longueur: 10,
      cultures: [],
    })
    mocks.plancheFindUnique.mockResolvedValue({ id: PLANCHE })
    mocks.cultureCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 1237, ...data }))
  })

  it("un instant minuit-Paris est stocké à minuit UTC de son jour", async () => {
    const res = await creer(
      corps({ dateSemis: "2027-04-11T22:00:00.000Z", datePlantation: "2027-05-09T22:00:00.000Z" })
    )

    expect(res.status).toBe(201)
    expect(ecrit().dateSemis?.toISOString()).toBe("2027-04-12T00:00:00.000Z")
    expect(ecrit().datePlantation?.toISOString()).toBe("2027-05-10T00:00:00.000Z")
  })

  it("heure d'hiver, et un jour « AAAA-MM-JJ » du formulaire inchangé", async () => {
    const res = await creer(corps({ dateSemis: "2027-01-31T23:00:00.000Z", dateRecolte: "2027-06-01" }))

    expect(res.status).toBe(201)
    expect(ecrit().dateSemis?.toISOString()).toBe("2027-02-01T00:00:00.000Z")
    expect(ecrit().dateRecolte?.toISOString()).toBe("2027-06-01T00:00:00.000Z")
  })

  it("un jour inexistant est refusé en nommant le champ, au lieu de glisser au 3 mars", async () => {
    const res = await creer(corps({ dateSemis: "2027-02-31" }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Date invalide pour dateSemis")
    expect(mocks.cultureCreate).not.toHaveBeenCalled()
  })

  it("la fin de récolte dérivée de l'ITP reste au jour seul après le passage à l'heure d'été", async () => {
    mocks.itpFindFirst.mockResolvedValue({
      id: "Courge-plein-champ",
      especeId: "Courge",
      userId: null,
      zoneClimat: null,
      typePlanche: null,
      semaineSemis: null,
      semainePlantation: null,
      semaineRecolte: 9,
      semaineRecolteFin: null,
      dureeRecolte: 6,
      nbRangs: 1,
      espacement: 100,
      espacementRangs: null,
    })
    // Récolte le 01/03 (heure d'hiver), six semaines : fin le 12/04 (heure d'été).
    const res = await creer(corps({ dateRecolte: "2027-03-01" }, { itpId: "Courge-plein-champ" }))

    expect(res.status).toBe(201)
    expect(ecrit().finRecolte?.toISOString()).toBe("2027-04-12T00:00:00.000Z")
  })
})
