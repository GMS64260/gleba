import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  animalFindMany: vi.fn(),
  lotAnimauxFindMany: vi.fn(),
  collecteFindMany: vi.fn(),
  lotFromageFindMany: vi.fn(),
  venteFindMany: vi.fn(),
  consommationFindMany: vi.fn(),
  soinFindMany: vi.fn(),
  paieFindMany: vi.fn(),
  reconstituerEffectifsLots: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    animal: { findMany: mocks.animalFindMany },
    lotAnimaux: { findMany: mocks.lotAnimauxFindMany },
    collecteLait: { findMany: mocks.collecteFindMany },
    lotFromage: { findMany: mocks.lotFromageFindMany },
    venteProduit: { findMany: mocks.venteFindMany },
    consommationAliment: { findMany: mocks.consommationFindMany },
    soinAnimal: { findMany: mocks.soinFindMany },
    paieLait: { findMany: mocks.paieFindMany },
  },
}))

vi.mock("@/lib/elevage/effectif", () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))

import { GET } from "./route"

type LotMock = { id: number; quantiteActuelle: number }
/** Effectif reconstitué : le compteur stocké, sauf surcharge par lot. */
const effectifs = (surcharges: Record<number, number> = {}) =>
  mocks.reconstituerEffectifsLots.mockImplementation(async (_userId: string, lots: LotMock[]) =>
    new Map(lots.map((l) => [l.id, { effectifCalcule: surcharges[l.id] ?? l.quantiteActuelle }])),
  )

const especeLait = { production: "lait", productions: ["Lait"] }
const especeViande = { production: "viande", productions: ["Viande"] }

describe("GET /api/elevage/economie-lait", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.animalFindMany.mockResolvedValue([])
    mocks.lotAnimauxFindMany.mockResolvedValue([])
    mocks.collecteFindMany.mockResolvedValue([])
    mocks.lotFromageFindMany.mockResolvedValue([])
    mocks.venteFindMany.mockResolvedValue([])
    mocks.consommationFindMany.mockResolvedValue([])
    mocks.soinFindMany.mockResolvedValue([])
    mocks.paieFindMany.mockResolvedValue([])
    effectifs()
  })

  // Revue 2026-10-20 — le prorata des têtes laitières lit l'effectif
  // reconstitué (écran Lots), pas le compteur stocké qui dérive.
  it("compte les lots à leur effectif reconstitué, pas au compteur stocké", async () => {
    mocks.lotAnimauxFindMany.mockResolvedValue([
      { id: 58, quantiteInitiale: 2, quantiteActuelle: 5, especeAnimale: especeLait },
      { id: 59, quantiteInitiale: 6, quantiteActuelle: 6, especeAnimale: especeViande },
    ])
    effectifs({ 58: 4 })

    const response = await GET(new NextRequest("http://localhost/api/elevage/economie-lait?annee=2026"))
    const json = await response.json()

    expect(mocks.reconstituerEffectifsLots).toHaveBeenCalledWith("user-1", expect.any(Array))
    expect(json.methode.tetesLaitieres).toBe(4)
    expect(json.methode.tetesTotales).toBe(10)
  })

  // Ticket cmsoga3zp — les animaux nominatifs rattachés à un lot étaient
  // comptés deux fois (une fois via animaux.length, une fois via la
  // quantiteActuelle du lot) : « 8/102 » au lieu de 4/98.
  it("ne compte pas deux fois les animaux nominatifs rattachés à un lot", async () => {
    mocks.animalFindMany.mockResolvedValue([
      { id: 1, lotId: 58, statut: "actif", especeAnimale: especeLait },
      { id: 2, lotId: 58, statut: "actif", especeAnimale: especeLait },
      { id: 3, lotId: 58, statut: "actif", especeAnimale: especeLait },
      { id: 4, lotId: 58, statut: "actif", especeAnimale: especeLait },
    ])
    mocks.lotAnimauxFindMany.mockResolvedValue([
      { id: 58, quantiteActuelle: 4, especeAnimale: especeLait },
      { id: 59, quantiteActuelle: 94, especeAnimale: especeViande },
    ])

    const response = await GET(new NextRequest("http://localhost/api/elevage/economie-lait?annee=2026"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.methode.tetesLaitieres).toBe(4)
    expect(json.methode.tetesTotales).toBe(98)
  })

  it("compte une fois les animaux hors lot, en plus des effectifs de lots", async () => {
    mocks.animalFindMany.mockResolvedValue([
      { id: 1, lotId: 58, statut: "actif", especeAnimale: especeLait },
      { id: 5, lotId: null, statut: "actif", especeAnimale: especeLait },
      { id: 6, lotId: null, statut: "actif", especeAnimale: especeViande },
    ])
    mocks.lotAnimauxFindMany.mockResolvedValue([
      { id: 58, quantiteActuelle: 3, especeAnimale: especeLait },
    ])

    const response = await GET(new NextRequest("http://localhost/api/elevage/economie-lait?annee=2026"))
    const json = await response.json()

    expect(response.status).toBe(200)
    // 3 têtes du lot laitier + la femelle laitière hors lot (l'animal #1 est
    // déjà dans la quantiteActuelle du lot 58).
    expect(json.methode.tetesLaitieres).toBe(4)
    // + l'animal viande hors lot.
    expect(json.methode.tetesTotales).toBe(5)
  })

  // Revue du 2026-10-29 — seuls les animaux actifs étaient lus : la ration
  // d'une laitière vendue en cours d'année, sans collecte cette année-là,
  // n'était plus affectée au lait (prorata avant fdd9a06, 0 € depuis).
  it("affecte au lait la consommation d'une laitière sortie pendant l'exercice", async () => {
    type Fiche = { id: number; lotId: null; statut: string; dateSortie: Date | null; especeAnimale: typeof especeLait }
    const fiches: Fiche[] = [
      { id: 1, lotId: null, statut: "actif", dateSortie: null, especeAnimale: especeLait },
      { id: 2, lotId: null, statut: "vendu", dateSortie: new Date(2026, 4, 15), especeAnimale: especeLait },
      { id: 3, lotId: null, statut: "vendu", dateSortie: new Date(2025, 4, 15), especeAnimale: especeLait },
    ]
    // Le `where` de la route est réellement appliqué.
    const retenue = (where: Record<string, unknown>, a: Fiche): boolean => {
      if (Array.isArray(where.OR)) return where.OR.some((clause: Record<string, unknown>) => retenue(clause, a))
      if (where.statut !== undefined && a.statut !== where.statut) return false
      const sortie = where.dateSortie as { gte?: Date } | undefined
      if (sortie?.gte && !(a.dateSortie && a.dateSortie >= sortie.gte)) return false
      return true
    }
    mocks.animalFindMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      fiches.filter((a) => retenue(where, a)),
    )
    mocks.consommationFindMany.mockResolvedValue([
      { quantite: 10, lotId: null, animalId: 2, aliment: { prix: 0.5, userStocks: [] } },
    ])

    const json = await (await GET(new NextRequest("http://localhost/api/elevage/economie-lait?annee=2026"))).json()

    expect(json.couts.alimentaire).toBe(5)
    // Le prorata des charges globales reste sur les têtes présentes.
    expect(json.methode).toMatchObject({ tetesLaitieres: 1, tetesTotales: 1 })
  })
})
