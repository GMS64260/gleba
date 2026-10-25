import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * Constat du 2026-10-25 sur un compte réel (scénario reconstitué depuis les
 * dates stockées). Culture A, ail : créée sur l'ITP INRAE-MESCLUN-0008
 * (« Ail d'automne sec — sous abri », plantation S44 2026, récolte S27 2027,
 * 5 semaines), d'où une fin de récolte au 09/08/2027 ; deux minutes plus tard,
 * le formulaire d'édition passe l'ITP à INRAE-MESCLUN-0011 (« Ail de
 * printemps sec — sous abri », plantation S3, récolte S29–S33, 5 semaines) et
 * réécrit plantation et récolte sans toucher la fin. Corps rejoué : celui du
 * formulaire d'édition (dates calculées en minuit local, fin renvoyée telle
 * qu'elle a été chargée).
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  cultureFindUnique: vi.fn(),
  cultureUpdate: vi.fn(),
  plancheFindFirst: vi.fn(),
  itpFindFirst: vi.fn(),
  itpFindUnique: vi.fn(),
  varieteFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi, getUserId: () => "u1" }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/irrigation-cache", () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
vi.mock("@/lib/terroir", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/terroir")>()),
  zoneEffectiveUser: vi.fn().mockResolvedValue(null),
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    culture: { findUnique: mocks.cultureFindUnique, update: mocks.cultureUpdate },
    planche: { findFirst: mocks.plancheFindFirst },
    iTP: { findFirst: mocks.itpFindFirst, findUnique: mocks.itpFindUnique },
    variete: { findFirst: mocks.varieteFindFirst },
  },
}))

import { PATCH, PUT } from "./route"

const tzAvant = process.env.TZ
beforeAll(() => {
  process.env.TZ = "Europe/Paris"
})
afterAll(() => {
  if (tzAvant === undefined) delete process.env.TZ
  else process.env.TZ = tzAvant
})

const ITPS: Record<string, Record<string, unknown>> = {
  "INRAE-MESCLUN-0011": {
    userId: null,
    zoneClimat: "oceanique",
    semaineSemis: null,
    semainePlantation: 3,
    semaineRecolte: 29,
    semaineImplantationDebut: 3,
    semaineImplantationFin: 7,
    implantation: "Plantation",
    semaineRecolteFin: 33,
    dureeRecolte: 5,
  },
  "INRAE-MESCLUN-0020": {
    userId: null,
    zoneClimat: "oceanique",
    semaineSemis: null,
    semainePlantation: 16,
    semaineRecolte: 27,
    semaineImplantationDebut: 16,
    semaineImplantationFin: 18,
    implantation: "Plantation",
    semaineRecolteFin: 42,
    dureeRecolte: 16,
  },
}

const cultureA = {
  id: 2001,
  userId: "u1",
  especeId: "Ail",
  varieteId: "Ail Rose de Lautrec",
  itpId: "INRAE-MESCLUN-0008",
  plancheId: "planche-s1p1",
  annee: 2026,
  quantite: 40,
  nbRangs: 4,
  longueur: 10,
  espacement: 10,
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  terminee: null,
  dateSemis: null as Date | null,
  datePlantation: new Date("2026-10-26T00:00:00.000Z") as Date | null,
  dateRecolte: new Date("2027-07-05T00:00:00.000Z") as Date | null,
  finRecolte: new Date("2027-08-09T00:00:00.000Z") as Date | null,
  dateSemisPlan: null,
  datePlantationPlan: null,
  dateRecoltePlan: null,
}

const params = Promise.resolve({ id: "2001" })
const requete = (methode: "PUT" | "PATCH", corps: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/cultures/2001", {
    method: methode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  })

/** Corps du formulaire d'édition après « ITP → INRAE-MESCLUN-0011 ». */
const corpsEdition = (surcharge: Record<string, unknown> = {}) => ({
  especeId: "Ail",
  varieteId: "Ail Rose de Lautrec",
  itpId: "INRAE-MESCLUN-0011",
  plancheId: "planche-s1p1",
  annee: 2026,
  dateSemis: null,
  // `datesDepuisItp(2026, ITP 0011)` : minuits LOCAUX, sérialisés en UTC.
  datePlantation: new Date(2026, 0, 12).toISOString(),
  dateRecolte: new Date(2026, 6, 13).toISOString(),
  // Fin chargée avec la fiche, non touchée.
  finRecolte: "2027-08-09T00:00:00.000Z",
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  terminee: null,
  quantite: 40,
  nbRangs: 4,
  longueur: 10,
  espacement: 10,
  notes: null,
  ...surcharge,
})

const ecrit = () => mocks.cultureUpdate.mock.calls[0][0].data as Record<string, unknown>
const jour = (d: unknown) => (d as Date).toISOString().slice(0, 10)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
  mocks.cultureFindUnique.mockResolvedValue(cultureA)
  mocks.cultureUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...cultureA, ...data }))
  mocks.itpFindUnique.mockResolvedValue({ especeId: "Ail" })
  mocks.plancheFindFirst.mockResolvedValue({ nom: "S1P1", longueur: 10 })
  mocks.itpFindFirst.mockImplementation(async ({ where, select }: { where: { AND: Array<{ id?: string }> }; select: Record<string, boolean> }) => {
    const id = where.AND[0].id as string
    if (!ITPS[id]) return null
    return select.dureeRecolte ? ITPS[id] : { id }
  })
})

describe("PUT /api/cultures/[id] — la fenêtre de récolte suit l'itinéraire (culture A)", () => {
  it("refait la fin de récolte depuis le nouvel ITP : 13/07/2026 + 5 semaines, pas le 09/08/2027", async () => {
    const res = await PUT(requete("PUT", corpsEdition()), { params })
    expect(res.status).toBe(200)
    const data = ecrit()
    expect(jour(data.datePlantation)).toBe("2026-01-12")
    expect(jour(data.dateRecolte)).toBe("2026-07-13")
    expect(data.finRecolte).toEqual(new Date("2026-08-17T00:00:00.000Z"))
    // Plantation S3 dans la fenêtre S3–S7 : aucune alerte de saison.
    expect((await res.json()).alerteSaison).toBeUndefined()
  })

  it("garde la fin que l'utilisateur a changée dans le même envoi", async () => {
    await PUT(requete("PUT", corpsEdition({ finRecolte: "2026-09-01" })), { params })
    expect(ecrit().finRecolte).toEqual(new Date("2026-09-01T00:00:00.000Z"))
  })

  it("même ITP, récolte déplacée d'une semaine : la fenêtre suit sans changer de longueur", async () => {
    mocks.cultureFindUnique.mockResolvedValue({
      ...cultureA,
      itpId: "INRAE-MESCLUN-0011",
      datePlantation: new Date("2026-01-12T00:00:00.000Z"),
      dateRecolte: new Date("2026-07-13T00:00:00.000Z"),
      finRecolte: new Date("2026-08-31T00:00:00.000Z"),
    })
    await PUT(
      requete("PUT", corpsEdition({ dateRecolte: "2026-07-20", finRecolte: "2026-08-31T00:00:00.000Z" })),
      { params }
    )
    expect(ecrit().finRecolte).toEqual(new Date("2026-09-07T00:00:00.000Z"))
  })

  it("A telle qu'elle est en base (fin à 392 jours) : réparée au prochain enregistrement, même sans rien changer", async () => {
    mocks.cultureFindUnique.mockResolvedValue({
      ...cultureA,
      itpId: "INRAE-MESCLUN-0011",
      datePlantation: new Date("2026-01-12T00:00:00.000Z"),
      dateRecolte: new Date("2026-07-13T00:00:00.000Z"),
      finRecolte: new Date("2027-08-09T00:00:00.000Z"),
    })
    const res = await PUT(
      requete(
        "PUT",
        corpsEdition({
          datePlantation: "2026-01-12T00:00:00.000Z",
          dateRecolte: "2026-07-13T00:00:00.000Z",
          notes: "relue",
        })
      ),
      { params }
    )
    expect(res.status).toBe(200)
    expect(ecrit().finRecolte).toEqual(new Date("2026-08-17T00:00:00.000Z"))
  })

  it("PATCH d'une date de récolte (+14 jours) : la fenêtre suit, écrite à minuit UTC", async () => {
    mocks.cultureFindUnique.mockResolvedValue({
      ...cultureA,
      _count: { recoltes: 0 },
      itp: { semainePlantation: 44 },
    })
    const res = await PATCH(requete("PATCH", { dateRecolte: "2027-07-19T00:00:00.000Z" }), { params })
    expect(res.status).toBe(200)
    expect(ecrit().finRecolte).toEqual(new Date("2027-08-23T00:00:00.000Z"))
  })

  it("PATCH sans date de récolte : la fenêtre ne bouge pas", async () => {
    mocks.cultureFindUnique.mockResolvedValue({
      ...cultureA,
      _count: { recoltes: 0 },
      itp: { semainePlantation: 44 },
    })
    const res = await PATCH(requete("PATCH", { notes: "paillée" }), { params })
    expect(res.status).toBe(200)
    expect("finRecolte" in ecrit()).toBe(false)
  })
})

describe("PUT /api/cultures/[id] — année de la plantation (revue du 2026-10-25)", () => {
  it("avertit d'une plantation en 2028 pour une culture de la saison 2026, en plus de la saison", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...cultureA, itpId: "INRAE-MESCLUN-0011" })
    const res = await PUT(
      requete(
        "PUT",
        corpsEdition({
          datePlantation: "2028-01-17",
          dateRecolte: "2028-07-17",
          finRecolte: "2028-08-21",
        })
      ),
      { params }
    )
    expect(res.status).toBe(200)
    const corps = await res.json()
    // S3 2028 : dans la fenêtre S3–S7, pas d'alerte de saison…
    expect(corps.alerteSaison).toBeUndefined()
    // …mais l'année ne correspond pas à la saison de la culture.
    expect(corps.warnings).toContain("Plantation prévue en 2028 pour une culture de la saison 2026 : vérifiez l'année.")
  })
})

describe("PUT /api/cultures/[id] — alerte de saison (culture B)", () => {
  it("renvoie l'alerte d'une aubergine plantée S43 pour une fenêtre S16–S18, sans bloquer", async () => {
    mocks.cultureFindUnique.mockResolvedValue({
      ...cultureA,
      especeId: "Aubergine",
      varieteId: "Aubergine — Non spécifiée",
      itpId: "INRAE-MESCLUN-0020",
      datePlantation: new Date("2026-10-25T00:00:00.000Z"),
      dateRecolte: new Date("2027-01-10T00:00:00.000Z"),
      finRecolte: new Date("2027-05-02T00:00:00.000Z"),
    })
    mocks.itpFindUnique.mockResolvedValue({ especeId: "Aubergine" })
    const res = await PUT(
      requete(
        "PUT",
        corpsEdition({
          especeId: "Aubergine",
          varieteId: "Aubergine — Non spécifiée",
          itpId: "INRAE-MESCLUN-0020",
          datePlantation: "2026-10-25T00:00:00.000Z",
          dateRecolte: "2027-01-10T00:00:00.000Z",
          finRecolte: "2027-05-02T00:00:00.000Z",
          notes: "relue",
        })
      ),
      { params }
    )
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.alerteSaison?.message).toBe(
      "Hors fenêtre de l'itinéraire (plantation S16–S18) : plantation prévue S43."
    )
    // Un seul message pour l'implantation : l'ancien « hors fenêtre ITP
    // recommandée » de la plantation n'est plus émis à côté.
    expect(corps.warnings.filter((w: string) => /plantation/i.test(w))).toEqual([corps.alerteSaison.message])
    expect(mocks.cultureUpdate).toHaveBeenCalledTimes(1)
  })
})
