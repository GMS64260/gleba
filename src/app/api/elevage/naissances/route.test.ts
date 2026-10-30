import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  naissanceFindMany: vi.fn(),
  naissanceAggregate: vi.fn(),
  naissanceFindFirst: vi.fn(),
  naissanceUpdate: vi.fn(),
  petitDeleteMany: vi.fn(),
  petitCreateMany: vi.fn(),
  mereFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => {
  const db = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    naissanceAnimale: {
      findMany: mocks.naissanceFindMany,
      aggregate: mocks.naissanceAggregate,
      findFirst: mocks.naissanceFindFirst,
      findUnique: vi.fn().mockResolvedValue({ id: 12 }),
      update: mocks.naissanceUpdate,
    },
    petitNaissance: { deleteMany: mocks.petitDeleteMany, createMany: mocks.petitCreateMany },
    animal: { findFirst: mocks.mereFindFirst },
    lotAnimaux: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  }
  return { default: { ...db, $transaction: (callback: (tx: typeof db) => unknown) => callback(db) } }
})

import { GET, PATCH } from "./route"

describe("GET /api/elevage/naissances", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.naissanceFindMany.mockResolvedValue([])
    mocks.naissanceAggregate.mockResolvedValue({
      _count: 245,
      _sum: {
        nombreNes: 600,
        nombreVivants: 570,
        nombreMales: 290,
        nombreFemelles: 280,
      },
    })
  })

  it("calcule les KPI sur toute l'année même si la liste reste paginée", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/naissances?annee=2024&filiere=compagnie",
    ))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.stats).toMatchObject({
      totalNaissances: 245,
      totalVivants: 570,
    })
    expect(mocks.naissanceFindMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 100,
      where: expect.objectContaining({
        userId: "user-1",
        OR: [
          { mere: { especeAnimale: { filiere: "compagnie" } } },
          { lot: { especeAnimale: { filiere: "compagnie" } } },
        ],
      }),
    }))
    expect(mocks.naissanceAggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: "user-1",
        OR: expect.any(Array),
      }),
    }))
  })
})

// Revue du 2026-10-29 — une fois les fiches des petits créées, la garde
// comparait la date à l'instant près (le formulaire renvoie minuit UTC) et
// tout le détail des petits, notes comprises, que le formulaire n'envoie pas :
// corriger les seules notes d'une naissance horodatée renvoyait 409.
describe("PATCH /api/elevage/naissances — naissance dont les fiches existent", () => {
  const tzAvant = process.env.TZ
  beforeAll(() => { process.env.TZ = "Europe/Paris" })
  afterAll(() => {
    if (tzAvant === undefined) delete process.env.TZ
    else process.env.TZ = tzAvant
  })

  // Saisie par l'assistant à 09:00 (Paris), petits passés en fiches.
  const enregistree = {
    id: 12, userId: "user-1", mereId: 5, lotId: null, saillieId: null,
    date: new Date("2026-03-10T08:00:00.000Z"),
    nombreNes: 2, nombreVivants: 2, nombreMales: 1, nombreFemelles: 1, poidsTotal: null,
    pereIdentifiant: null, identifiantsProvisoires: "P1, P2", identifiantsDefinitifs: null, notes: null,
    mere: { lotId: null },
    petits: [
      { numero: 1, sexe: "male", boucleProvisoire: "P1", boucleDefinitive: null, modeElevage: "biberon", poids: 3.2, couleur: null, vivant: true, notes: "Né faible", animalId: 501 },
      { numero: 2, sexe: "femelle", boucleProvisoire: "P2", boucleDefinitive: null, modeElevage: "sous_mere", poids: 3.5, couleur: null, vivant: true, notes: null, animalId: 502 },
    ],
  }

  // Corps de `handleSubmit` (ReproductionTab) en édition : jour seul, petits sans notes.
  const corpsFormulaire = (surcharge: Record<string, unknown> = {}) => ({
    id: 12, mereId: 5, lotId: null, pereIdentifiant: null,
    identifiantsProvisoires: "P1, P2", identifiantsDefinitifs: null,
    date: "2026-03-10", nombreNes: 2, nombreVivants: 2, nombreMales: 1, nombreFemelles: 1, poidsTotal: null,
    notes: "Mise bas facile",
    petits: [
      { sexe: "male", boucleProvisoire: "P1", boucleDefinitive: null, modeElevage: "biberon", poids: 3.2, couleur: null, vivant: true },
      { sexe: "femelle", boucleProvisoire: "P2", boucleDefinitive: null, modeElevage: "sous_mere", poids: 3.5, couleur: null, vivant: true },
    ],
    ...surcharge,
  })

  const patch = (body: object) => PATCH(new NextRequest("http://localhost/api/elevage/naissances", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }))

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.naissanceFindFirst.mockImplementation(async () => structuredClone(enregistree))
    mocks.mereFindFirst.mockResolvedValue({ id: 5, statut: "actif", dateSortie: null })
    mocks.naissanceUpdate.mockResolvedValue({ id: 12 })
  })

  it("enregistre les notes d'une naissance de 08:00 UTC réenregistrée au même jour, sans toucher sa date ni ses petits", async () => {
    const res = await patch(corpsFormulaire())

    expect(res.status).toBe(200)
    expect(mocks.naissanceUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 12 },
      data: expect.objectContaining({ notes: "Mise bas facile", date: new Date("2026-03-10T08:00:00.000Z") }),
    }))
    expect(mocks.petitDeleteMany).not.toHaveBeenCalled()
  })

  it("refuse toujours un autre jour ou un champ transmis d'un petit modifié", async () => {
    expect((await patch(corpsFormulaire({ date: "2026-03-11" }))).status).toBe(409)
    const petits = corpsFormulaire().petits
    petits[1] = { ...petits[1], sexe: "male" }
    expect((await patch(corpsFormulaire({ petits }))).status).toBe(409)
    expect((await patch(corpsFormulaire({ petits: petits.slice(0, 1) }))).status).toBe(409)
    expect(mocks.naissanceUpdate).not.toHaveBeenCalled()
  })

  // Naissance SANS fiches : le détail est remplacé, et le formulaire n'envoie
  // pas les notes des petits. Réenregistrer les effaçait.
  it("sans fiches, réenregistrer garde les notes des petits que la requête ne transmet pas", async () => {
    mocks.naissanceFindFirst.mockImplementation(async () => ({
      ...structuredClone(enregistree),
      petits: enregistree.petits.map((petit) => ({ ...petit, animalId: null })),
    }))
    const petits = corpsFormulaire().petits
    petits[1] = { ...petits[1], poids: 3.6 }

    expect((await patch(corpsFormulaire({ petits }))).status).toBe(200)
    const { data } = mocks.petitCreateMany.mock.calls[0][0]
    expect(data.map((p: { numero: number; notes: string | null; poids: number }) => [p.numero, p.notes, p.poids]))
      .toEqual([[1, "Né faible", 3.2], [2, null, 3.6]])

    // Des notes transmises, même vides, remplacent celles enregistrées.
    petits[0] = { ...petits[0], notes: null } as typeof petits[0]
    expect((await patch(corpsFormulaire({ petits }))).status).toBe(200)
    expect(mocks.petitCreateMany.mock.calls[1][0].data[0].notes).toBeNull()
  })
})
