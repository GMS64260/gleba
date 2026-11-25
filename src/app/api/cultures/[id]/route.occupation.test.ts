import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * Relecture du 2026-11-12 — la modification d'une culture contrôle l'occupation
 * de sa planche quand la longueur, les rangs, la planche, l'itinéraire ou les
 * dates changent, sans compter la culture elle-même, et sans bloquer une
 * culture déjà en dépassement que la modification n'aggrave pas.
 */

const mocks = vi.hoisted(() => ({
  /** Lignes de récolte de la culture ; vide = une ligne saisie par récolte comptée. */
  lignesRecolte: [] as Array<{ id: number; recolteOrigineId: number | null }>,
  requireAuthApi: vi.fn(),
  cultureFindUnique: vi.fn(),
  cultureUpdate: vi.fn(),
  plancheFindFirst: vi.fn(),
  itpFindFirst: vi.fn(),
  varieteFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi, getUserId: () => "u-demo" }))
vi.mock("@/lib/rotation-check", () => ({ checkRotationViolation: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/irrigation-cache", () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
// Mock partiel : `calendrier-climat` dérive ses zones de `terroir` au chargement.
vi.mock("@/lib/terroir", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/terroir")>()),
  zoneEffectiveUser: vi.fn().mockResolvedValue(null),
}))
vi.mock("@/lib/prisma", () => {
  const tx = {
    // Verrou d'exploitation ($executeRaw) puis verrou commun des étapes ($queryRaw).
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: async () => [],
    culture: { findUnique: mocks.cultureFindUnique, update: mocks.cultureUpdate },
    // Instant de passage à « fait » d'une récolte : aucune récolte enregistrée.
    recolte: { findFirst: async () => null, findMany: async () => mocks.lignesRecolte.length ? mocks.lignesRecolte : await (async () => {
      const lue = await mocks.cultureFindUnique.mock.results.at(-1)?.value
      return Array.from({ length: lue?._count?.recoltes ?? 0 }, (_, i) => ({ id: i + 1, recolteOrigineId: null }))
    })() },
    planche: { findFirst: mocks.plancheFindFirst },
    iTP: { findFirst: mocks.itpFindFirst },
    variete: { findFirst: mocks.varieteFindFirst },
    // `espece.vivace` lu par le contrôle d'occupation (ADV33) : annuelle ici.
    espece: { findFirst: async () => ({ vivace: false }) },
  }
  return { default: { $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx) } }
})

import { PATCH, PUT } from "./route"

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

const stockee = {
  id: 1237,
  userId: "u-demo",
  especeId: "Oignon",
  varieteId: null,
  itpId: "Oignon-printemps",
  plancheId: PLANCHE,
  annee: 2027,
  quantite: null,
  nbRangs: 3,
  longueur: 1 as number | null,
  espacement: 10,
  terminee: null,
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  dateSemis: new Date("2027-04-05T00:00:00.000Z") as Date | null,
  datePlantation: null as Date | null,
  dateRecolte: new Date("2027-08-02T00:00:00.000Z") as Date | null,
  finRecolte: null as Date | null,
  dateSemisPlan: null as Date | null,
  datePlantationPlan: null,
  dateRecoltePlan: null,
}

// Voisine de 3 rangs à 25 cm (0,50 m), sur la même période.
const voisine = (longueur: number | null) => ({
  id: 900,
  espece: { id: "Carotte", vivace: false },
  dateSemis: new Date("2027-03-01T00:00:00.000Z"),
  datePlantation: null,
  dateRecolte: new Date("2027-09-01T00:00:00.000Z"),
  finRecolte: null,
  nbRangs: 3,
  longueur,
  itp: { espacementRangs: 25 },
})
const planche = (cultures: unknown[]) => ({ nom: "P1", largeur: 0.8, longueur: 20, cultures })

const modifier = (corps: Record<string, unknown>) =>
  PUT(
    new NextRequest("http://localhost/api/cultures/1237", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    }),
    { params: Promise.resolve({ id: "1237" }) }
  )

describe("PUT /api/cultures/[id] — occupation de la planche", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lignesRecolte = []
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u-demo" } } })
    mocks.cultureFindUnique.mockResolvedValue(stockee)
    mocks.plancheFindFirst.mockResolvedValue(planche([voisine(19)]))
    mocks.itpFindFirst.mockResolvedValue({ espacementRangs: 25 })
    mocks.cultureUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...stockee, ...data }))
  })

  it("refuse d'étendre à toute la planche une culture logée à la suite d'une autre", async () => {
    const res = await modifier({ longueur: 20 })

    expect(res.status).toBe(400)
    const corps = await res.json()
    expect(corps.error).toMatch(/Largeur insuffisante/)
    expect(corps.ajustements).toBeInstanceOf(Array)
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it("lit les cultures de la planche sans la culture modifiée", async () => {
    await modifier({ longueur: 20 })
    const lecture = mocks.plancheFindFirst.mock.calls[0][0]
    expect(lecture.select.cultures.where).toEqual({ terminee: null, id: { not: 1237 } })
  })

  it("refuse un rang de trop, accepte ce qui tient", async () => {
    mocks.plancheFindFirst.mockResolvedValue(planche([voisine(null)]))
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, nbRangs: 1, longueur: null })

    expect((await modifier({ nbRangs: 2 })).status).toBe(400)
    expect((await modifier({ notes: "paillée" })).status).toBe(200)
  })

  it("ne contrôle rien quand ni la place ni la période ne changent", async () => {
    // Formulaire complet renvoyé à l'identique, plus une note.
    const res = await modifier({ notes: "paillée", nbRangs: 3, longueur: 1, plancheId: PLANCHE, dateSemis: "2027-04-05" })
    expect(res.status).toBe(200)
    expect(mocks.plancheFindFirst.mock.calls.every(([a]) => !a.select.cultures)).toBe(true)
  })

  it("laisse corriger une culture déjà en dépassement sans l'aggraver", async () => {
    mocks.plancheFindFirst.mockResolvedValue(planche([voisine(null)]))
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, nbRangs: 3, longueur: null })

    expect((await modifier({ dateSemis: "2027-04-12" })).status).toBe(200)
    expect((await modifier({ longueur: 12 })).status).toBe(200)
    expect((await modifier({ nbRangs: 2 })).status).toBe(200)
    expect((await modifier({ nbRangs: 4 })).status).toBe(400)
  })

  it("refuse le déplacement vers une planche où elle ne tient pas", async () => {
    mocks.plancheFindFirst.mockResolvedValue(planche([voisine(null)]))
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, plancheId: "autre", longueur: null })

    expect((await modifier({ plancheId: PLANCHE })).status).toBe(400)
  })

  it.each([PUT, PATCH])("refuse la réouverture sur une planche pleine (%s)", async (route) => {
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, longueur: 20, terminee: 'x', _count: { recoltes: 0 } })
    const res = await route(new NextRequest('http://localhost/api/cultures/1237', {
      method: route === PUT ? 'PUT' : 'PATCH', body: JSON.stringify({ terminee: null }),
    }), { params: Promise.resolve({ id: '1237' }) })
    expect(res.status).toBe(400)
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it("refuse le PATCH du calendrier qui crée un chevauchement", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, longueur: 20,
      dateSemis: new Date('2027-10-01'), dateRecolte: new Date('2027-11-01'), _count: { recoltes: 0 } })
    const res = await PATCH(new NextRequest('http://localhost/api/cultures/1237', {
      method: 'PATCH', body: JSON.stringify({ dateSemis: '2027-04-01' }),
    }), { params: Promise.resolve({ id: '1237' }) })
    expect(res.status).toBe(400)
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  // Un fait accompli s'enregistre : cocher « semis fait » recale le semis au
  // jour même ; le chevauchement qui en résulte est signalé, pas refusé.
  it("enregistre le PATCH qui coche le semis fait malgré le chevauchement, et avertit", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, longueur: 20,
      dateSemis: new Date('2099-10-01'), dateRecolte: new Date('2099-11-01'), _count: { recoltes: 0 } })
    const res = await PATCH(new NextRequest('http://localhost/api/cultures/1237', {
      method: 'PATCH', body: JSON.stringify({ semisFait: true }),
    }), { params: Promise.resolve({ id: '1237' }) })
    expect(res.status).toBe(200)
    expect((await res.json()).warnings[0]).toMatch(/^Enregistré\. Planche P1 : largeur insuffisante/)
    expect(mocks.cultureUpdate).toHaveBeenCalledTimes(1)
  })

  // Cocher une étape ne couvre pas une date déplacée dans le même envoi : ce
  // serait une planification passée sous couvert d'un fait accompli.
  it("refuse le PATCH qui coche le semis fait en déplaçant aussi la récolte sur une voisine", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, longueur: 20,
      dateSemis: new Date('2099-10-01'), dateRecolte: new Date('2099-11-01'), _count: { recoltes: 0 } })
    const res = await PATCH(new NextRequest('http://localhost/api/cultures/1237', {
      method: 'PATCH', body: JSON.stringify({ semisFait: true, dateRecolte: '2099-12-01' }),
    }), { params: Promise.resolve({ id: '1237' }) })
    expect(res.status).toBe(400)
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it.each([PUT, PATCH])("contrôle les dates de plan restituées après annulation du semis (%s)", async (route) => {
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, longueur: 20, semisFait: true,
      dateSemis: new Date('2027-10-01'), dateSemisPlan: new Date('2027-04-01'),
      dateRecolte: new Date('2027-11-01'), _count: { recoltes: 0 } })
    const res = await route(new NextRequest('http://localhost/api/cultures/1237', {
      method: route === PUT ? 'PUT' : 'PATCH', body: JSON.stringify({ semisFait: false }),
    }), { params: Promise.resolve({ id: '1237' }) })
    expect(res.status).toBe(400)
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  // Lignée : une récolte de 10 kg dont 1 kg est perdu fait deux lignes, une
  // seule récolte saisie. Le refus tient (il y a des lignes), le nombre est juste.
  it.each([PUT, PATCH])("annonce les récoltes saisies, pas les lignes d'un lot scindé (%s)", async (route) => {
    mocks.lignesRecolte = [{ id: 10, recolteOrigineId: null }, { id: 11, recolteOrigineId: 10 }]
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, longueur: 20, semisFait: true, recolteFaite: true,
      dateSemis: new Date('2026-04-01'), dateRecolte: new Date('2026-07-01'), _count: { recoltes: 2 } })
    const res = await route(new NextRequest('http://localhost/api/cultures/1237', {
      method: route === PUT ? 'PUT' : 'PATCH', body: JSON.stringify({ recolteFaite: false }),
    }), { params: Promise.resolve({ id: '1237' }) })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ recoltes: 1, error: expect.stringContaining('1 récolte enregistrée') })
  })

  // FB-S9UM9T : la fiche culture (PUT) décochait « Récolte faite » sur une
  // culture qui portait des récoltes, dont une vendue ; seul le PATCH refusait.

  it.each([PUT, PATCH])("refuse d'annuler la récolte d'une culture qui porte des récoltes (%s)", async (route) => {
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, longueur: 20, semisFait: true, recolteFaite: true,
      dateSemis: new Date('2026-04-01'), dateRecolte: new Date('2026-07-01'), _count: { recoltes: 2 } })
    const res = await route(new NextRequest('http://localhost/api/cultures/1237', {
      method: route === PUT ? 'PUT' : 'PATCH', body: JSON.stringify({ recolteFaite: false }),
    }), { params: Promise.resolve({ id: '1237' }) })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ recoltes: 2, error: expect.stringContaining('2 récoltes enregistrées') })
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  // FB-EYRRO5 : la fiche (PUT) annulait le semis d'une culture plantée et
  // récoltée (sans ligne de récolte) ; seul le PATCH gardait le cycle cohérent.
  it.each([PUT, PATCH])("refuse d'annuler le semis tant que la plantation et la récolte restent faites (%s)", async (route) => {
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, longueur: 20, semisFait: true, plantationFaite: true, recolteFaite: true,
      dateSemis: new Date('2026-04-01'), datePlantation: new Date('2026-05-01'), dateRecolte: new Date('2026-07-01'), _count: { recoltes: 0 } })
    const res = await route(new NextRequest('http://localhost/api/cultures/1237', {
      method: route === PUT ? 'PUT' : 'PATCH', body: JSON.stringify({ semisFait: false, plantationFaite: true, recolteFaite: true }),
    }), { params: Promise.resolve({ id: '1237' }) })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain("Annulez d'abord la plantation et la récolte")
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it("laisse le formulaire renvoyer une case déjà décochée sur une culture qui porte des récoltes", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, longueur: 20, semisFait: false, recolteFaite: true,
      dateSemis: new Date('2026-04-01'), dateRecolte: new Date('2026-07-01'), _count: { recoltes: 2 } })
    const res = await PUT(new NextRequest('http://localhost/api/cultures/1237', {
      method: 'PUT', body: JSON.stringify({ semisFait: false, recolteFaite: true, notes: 'Note de test' }),
    }), { params: Promise.resolve({ id: '1237' }) })
    expect(res.status).toBe(200)
    expect(mocks.cultureUpdate).toHaveBeenCalledTimes(1)
  })

  it("refuse la mutation lorsque la lecture de l'occupation échoue", async () => {
    mocks.plancheFindFirst.mockRejectedValue(new Error('Lecture indisponible'))
    expect((await modifier({ longueur: 20 })).status).toBe(500)
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it("n'empêche pas de modifier une culture terminée", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...stockee, terminee: "Terminée" })
    expect((await modifier({ longueur: 20 })).status).toBe(200)
  })
})
