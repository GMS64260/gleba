import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  animauxFindMany: vi.fn(),
  animauxGroupBy: vi.fn(),
  lotsFindMany: vi.fn(),
  naissancesFindMany: vi.fn(),
  abattagesGroupBy: vi.fn(),
  exploitationFindUnique: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    animal: {
      findMany: mocks.animauxFindMany,
      groupBy: mocks.animauxGroupBy,
    },
    lotAnimaux: { findMany: mocks.lotsFindMany },
    naissanceAnimale: { findMany: mocks.naissancesFindMany },
    abattage: { groupBy: mocks.abattagesGroupBy },
    exploitation: { findUnique: mocks.exploitationFindUnique },
    declarationReglementaireEvenement: { create: mocks.auditCreate },
  },
}))

import { GET } from "./route"

describe("API inventaire daté du cheptel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.animauxGroupBy.mockResolvedValue([])
    mocks.naissancesFindMany.mockResolvedValue([])
    mocks.abattagesGroupBy.mockResolvedValue([])
    mocks.animauxFindMany.mockResolvedValue([
      {
        id: 1,
        identifiant: "FR001",
        nom: "Amande",
        sexe: "femelle",
        dateNaissance: new Date("2025-01-01T00:00:00.000Z"),
        dateArrivee: new Date("2025-01-01T00:00:00.000Z"),
        dateSortie: null,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        race: null,
        pereIdentifiant: null,
        mereIdentifiant: null,
        especeAnimale: { nom: "Caprin", categorieReglementaire: "Caprin" },
        raceAnimale: { nom: "Alpine" },
        lot: { nom: "Laitières" },
        mere: null,
        pere: null,
      },
      {
        id: 2,
        identifiant: "FR002",
        nom: null,
        sexe: "male",
        dateNaissance: new Date("2024-01-01T00:00:00.000Z"),
        dateArrivee: new Date("2024-01-01T00:00:00.000Z"),
        dateSortie: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        race: null,
        pereIdentifiant: null,
        mereIdentifiant: null,
        especeAnimale: { nom: "Caprin", categorieReglementaire: "Caprin" },
        raceAnimale: null,
        lot: null,
        mere: null,
        pere: null,
      },
    ])
    mocks.lotsFindMany.mockResolvedValue([{
      id: 3,
      nom: "Chevrettes",
      dateArrivee: new Date("2026-02-01T00:00:00.000Z"),
      dateReforme: null,
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      statut: "actif",
      quantiteInitiale: 4,
      quantiteActuelle: 4,
      especeAnimale: { nom: "Caprin", categorieReglementaire: "Caprin" },
    }])
    mocks.exploitationFindUnique.mockResolvedValue({
      raisonSociale: "Ferme test",
      numeroEde: "EDE64",
      adresseSiege: "1 chemin",
      codePostal: "64000",
      ville: "Pau",
    })
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" })
  })

  it("reconstitue la présence à la date demandée et produit un CSV traçable", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/inventaire-cheptel?date=2026-07-20&format=csv",
    ))
    const csv = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("content-disposition")).toContain("2026-07-20.csv")
    expect(csv).toContain("FR001")
    expect(csv).not.toContain("FR002")
    expect(csv).toContain("Chevrettes")
    expect(mocks.animauxFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1" },
    }))
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "INVENTAIRE_CHEPTEL_GENERE",
        declarationKey: "inventaire:2026-07-20",
        snapshotHash: expect.any(String),
      }),
    })
  })

  it("refuse une date future avant toute lecture métier", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/inventaire-cheptel?date=2099-01-01&format=csv",
    ))

    expect(response.status).toBe(400)
    expect(mocks.animauxFindMany).not.toHaveBeenCalled()
  })

  it("refuse une date calendaire impossible", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/inventaire-cheptel?date=2026-02-31&format=csv",
    ))

    expect(response.status).toBe(400)
    expect(mocks.animauxFindMany).not.toHaveBeenCalled()
  })

  it("génère aussi un inventaire PDF paginé", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/inventaire-cheptel?date=2026-07-20&format=pdf",
    ))
    const bytes = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF")
  })

  // Revue 2026-10-20 — un lot était retenu sur le compteur stocké
  // `quantiteActuelle > 0`, qui dérive dans les deux sens. Il l'est désormais
  // sur l'effectif reconstitué (helper réel, lectures simulées).
  it("retient les lots dont l'effectif reconstitué est > 0, quel que soit le compteur stocké", async () => {
    const espece = { nom: "Pintade perle", categorieReglementaire: "Volaille" }
    const lot = (id: number, nom: string, quantiteInitiale: number, quantiteActuelle: number) => ({
      id, nom, quantiteInitiale, quantiteActuelle, statut: "actif", dateReforme: null,
      dateArrivee: new Date("2026-08-17T00:00:00.000Z"), createdAt: new Date("2026-08-17T00:00:00.000Z"),
      especeAnimale: espece,
    })
    mocks.animauxFindMany.mockResolvedValue([])
    mocks.lotsFindMany.mockResolvedValue([
      lot(71, "Pintades perle A3 1708", 2, 5), // + 3 nées, 1 fiche morte : effectif 4
      lot(90, "Lot de fiches", 2, 0), // 2 fiches actives rattachées : effectif 2
      lot(91, "Lot vidé", 1, 1), // sa seule tête, une fiche, est morte : effectif 0
    ])
    mocks.naissancesFindMany.mockResolvedValue([{ lotId: 71, nombreVivants: 3 }])
    mocks.animauxGroupBy.mockImplementation(async ({ where }: { where: { statut: unknown } }) =>
      where.statut === "actif"
        ? [{ lotId: 90, _count: { _all: 2 } }]
        : [{ lotId: 71, _count: { _all: 1 } }, { lotId: 91, _count: { _all: 1 } }],
    )

    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/inventaire-cheptel?date=2026-10-19&format=csv",
    ))
    const lignesLots = (await response.text()).split("\r\n").filter((l) => l.startsWith('"LOT_COLLECTIF"'))

    expect(response.status).toBe(200)
    expect(lignesLots).toEqual([
      '"LOT_COLLECTIF";"Pintade perle";"Volaille";"lot:71";"Pintades perle A3 1708";"";"";"";"";"4"',
      // Ses deux têtes sont listées en INDIVIDU : part collective nulle.
      '"LOT_COLLECTIF";"Pintade perle";"Volaille";"lot:90";"Lot de fiches";"";"";"";"";"0"',
    ])
  })
})
