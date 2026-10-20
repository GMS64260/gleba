/**
 * QA 2026-10-19 — Traçabilité > Carnet sanitaire : un Vermifuge et une
 * Vaccination saisis en Élevage s'affichaient « Autre », et le filtre Vermifuge
 * ne retrouvait pas la ligne, alors que le résumé les distinguait.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  soinFindMany: vi.fn(),
  reconstituerEffectifsLots: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/elevage/effectif", () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))
vi.mock("@/lib/prisma", () => ({
  default: { soinAnimal: { findMany: mocks.soinFindMany } },
}))

import { GET } from "./route"

const soin = (id: number, type: string, date: string) => ({
  id,
  date: new Date(date),
  type,
  animalId: id,
  lotId: null,
  animal: { id, nom: `Animal ${id}`, identifiant: null, race: null, especeAnimale: { nom: "Ovin" } },
  lot: null,
  description: null,
  produit: "Produit",
  quantite: null,
  unite: null,
  cout: null,
  veterinaire: null,
  datePrevue: null,
  fait: true,
  notes: null,
})

describe("GET /api/tracabilite/carnet-sanitaire", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map())
  })

  it("garde le type saisi par l'écran, en clé et en libellé, et le résumé compte la même clé", async () => {
    mocks.soinFindMany.mockResolvedValue([
      soin(1, "Vermifuge", "2026-03-15T00:00:00Z"),
      soin(2, "Vaccination", "2026-10-19T00:00:00Z"),
      soin(3, "vermifuge", "2026-04-01T00:00:00Z"), // ancien code en minuscules
      soin(4, "Traitement vétérinaire", "2026-05-01T00:00:00Z"),
    ])
    const res = await GET(new NextRequest("http://localhost/api/tracabilite/carnet-sanitaire?annee=2026"))
    const json = await res.json()

    expect(json.carnet.map((e: { type: string; typeLabel: string }) => [e.type, e.typeLabel])).toEqual([
      ["Vermifuge", "Vermifuge"],
      ["Vaccination", "Vaccination"],
      ["Vermifuge", "Vermifuge"],
      ["Traitement vétérinaire", "Traitement vétérinaire"],
    ])
    expect(json.stats.parType).toEqual({ Vermifuge: 2, Vaccination: 1, "Traitement vétérinaire": 1 })
    // Le filtre de l'écran compare `type` à la clé choisie : les deux vermifuges sortent.
    expect(json.carnet.filter((e: { type: string }) => e.type === "Vermifuge")).toHaveLength(2)
    expect(mocks.soinFindMany.mock.calls[0][0].where).toMatchObject({ userId: "user-1", fait: true })
  })

  // Revue 2026-10-20 — « (N animaux) » derrière le lot d'un soin lisait le
  // compteur stocké (5 pour le lot démo 71) au lieu de l'effectif reconstitué
  // de l'écran Lots (4).
  it("affiche l'effectif reconstitué du lot soigné, sans « (0 animaux) » pour un lot vidé", async () => {
    const pintades = { id: 71, nom: "Pintades perle A3 1708", quantiteInitiale: 2, quantiteActuelle: 5, especeAnimale: { nom: "Pintade perle" } }
    const lotVide = { id: 72, nom: null, quantiteInitiale: 3, quantiteActuelle: 1, especeAnimale: { nom: "Pintade perle" } }
    const lapin = { id: 73, nom: "Lapins", quantiteInitiale: 1, quantiteActuelle: 1, especeAnimale: { nom: "Lapin" } }
    const soinLot = (id: number, lot: typeof pintades | typeof lotVide | typeof lapin) => ({
      ...soin(id, "Vermifuge", "2026-03-15T00:00:00Z"),
      animalId: null,
      animal: null,
      lotId: lot.id,
      lot,
    })
    mocks.soinFindMany.mockResolvedValue([soinLot(1, pintades), soinLot(2, pintades), soinLot(3, lotVide), soinLot(4, lapin)])
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map([
      [71, { effectifCalcule: 4 }],
      [72, { effectifCalcule: 0 }],
      [73, { effectifCalcule: 1 }],
    ]))

    const json = await (await GET(new NextRequest("http://localhost/api/tracabilite/carnet-sanitaire?annee=2026"))).json()

    // Un lot soigné deux fois n'est reconstitué qu'une fois.
    expect(mocks.reconstituerEffectifsLots).toHaveBeenCalledWith("user-1", [pintades, lotVide, lapin])
    expect(json.carnet.map((e: { animalLot: string }) => e.animalLot)).toEqual([
      "Pintades perle A3 1708 (4 animaux)",
      "Pintades perle A3 1708 (4 animaux)",
      "Lot #72",
      "Lapins (1 animal)",
    ])
  })
})
